/**
 * Real SOS Service (Phase 5).
 * Connects Phase 1–4 core algorithms/storage/sync to Firestore.
 * 
 * CRITICAL: Zero-data-loss order for SOS trigger:
 * 1. Create SOS element
 * 2. Add to OR-Set using orSetAdd()
 * 3. Persist OR-Set to MMKV using orSetSave()
 * 4. Only after durable local persistence succeeds should network/UI success continue
 * 5. If online → write Firestore sos_events/{sos_id}
 * 6. If offline → enqueue SOS operation to local queue (Phase 4)
 * 
 * - triggerSos: creates SOS with durable local persistence first
 * - resolveSos: creates OR-Set tombstone, persists, updates/queues Firestore
 * - subscribeToSosEvents: merges remote events into local OR-Set via orSetMerge()
 */

import /* eslint-disable-next-line @typescript-eslint/no-var-requires */ firestore from '@react-native-firebase/firestore';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { v4: uuidv4 } = require('uuid');
import { HLC } from '../hlc/hlc';
import {
  SOSElement,
  createORSet,
  orSetAdd,
  orSetAddWithTag,
  orSetRemove,
  orSetMerge,
  orSetGetActive,
  orSetSave,
  orSetLoad,
} from '../crdt/orSet';
import {
  queueEnqueue,
  SOS_QUEUE,
} from '../crdt/localQueue';
import { isOnline } from '../crdt/syncWorker';

const SOS_EVENTS_COLLECTION = 'sos_events';

function getFirestore(): any {
  // @ts-expect-error Firestore typing issue with getFirestore wrapper
  return firestore();
}

export interface SosEventData {
  sos_id: string;
  rider_id: string;
  group_id: string;
  lat: number;
  lng: number;
  created_at_hlc: string;
  resolved: boolean;
  resolved_at_hlc: string | null;
}

/**
 * Trigger SOS with zero-data-loss guarantee.
 * Local OR-Set persistence happens BEFORE any network attempt.
 * Returns the sos_id.
 */
export async function triggerSos(
  riderId: string,
  groupId: string,
  lat: number,
  lng: number
): Promise<string> {
  const hlc = HLC.fresh();
  const sosId = uuidv4();
  const createdAtHlc = hlc.now();

  const sosElement: SOSElement = {
    sos_id: sosId,
    rider_id: riderId,
    group_id: groupId,
    lat,
    lng,
    created_at_hlc: createdAtHlc,
  };

  // Step 1-3: CRITICAL - Local OR-Set persistence FIRST (zero data loss)
  const storageKey = `sos_orset_${groupId}`;
  let localSet = orSetLoad(storageKey);
  localSet = orSetAdd(localSet, sosElement, hlc);
  orSetSave(localSet, storageKey);

  // Step 4-6: Network attempt (best-effort)
  const online = await isOnline();

  if (online) {
    try {
      const db = getFirestore();
      await db
        .collection(SOS_EVENTS_COLLECTION)
        .doc(sosId)
        .set({
          sos_id: sosId,
          rider_id: riderId,
          group_id: groupId,
          lat,
          lng,
          created_at_hlc: createdAtHlc,
          tag: (localSet.adds.get([...localSet.adds.keys()].find(k => localSet.adds.get(k)!.sos_id === sosId) || ''))?.tag || '',
          resolved: false,
          resolved_at_hlc: null,
        });
    } catch (error) {
      // Network failed - queue for sync worker to retry
      console.error('[sosService] Firestore write failed, queuing for sync:', error);
      const operation = {
        id: uuidv4(),
        type: 'sos_event' as const,
        data: sosElement,
        created_at_hlc: createdAtHlc,
        retry_count: 0,
      };
      queueEnqueue(SOS_QUEUE, operation);
    }
  } else {
    // Offline - queue for sync worker
    const operation = {
      id: uuidv4(),
      type: 'sos_event' as const,
      data: sosElement,
      created_at_hlc: createdAtHlc,
      retry_count: 0,
    };
    queueEnqueue(SOS_QUEUE, operation);
  }

  return sosId;
}

/**
 * Resolve an SOS event.
 * Creates OR-Set tombstone, persists locally, then updates/queues Firestore.
 */
export async function resolveSos(sosId: string, groupId: string): Promise<void> {
  const hlc = HLC.fresh();
  const resolvedAtHlc = hlc.now();

  // Step 1-3: Local OR-Set tombstone + persistence FIRST
  const storageKey = `sos_orset_${groupId}`;
  let localSet = orSetLoad(storageKey);
  localSet = orSetRemove(localSet, sosId);
  orSetSave(localSet, storageKey);

  // Step 4-5: Network attempt
  const online = await isOnline();

  if (online) {
    try {
      const db = getFirestore();
      await db
        .collection(SOS_EVENTS_COLLECTION)
        .doc(sosId)
        .update({
          resolved: true,
          resolved_at_hlc: resolvedAtHlc,
        });
    } catch (error) {
      console.error('[sosService] Firestore resolve failed, queuing for sync:', error);
      const operation = {
        id: uuidv4(),
        type: 'sos_resolve' as const,
        data: { sos_id: sosId, resolved_at_hlc: resolvedAtHlc },
        created_at_hlc: resolvedAtHlc,
        retry_count: 0,
      };
      queueEnqueue(SOS_QUEUE, operation);
    }
  } else {
    // Offline - queue for sync worker
    const operation = {
      id: uuidv4(),
      type: 'sos_resolve' as const,
      data: { sos_id: sosId, resolved_at_hlc: resolvedAtHlc },
      created_at_hlc: resolvedAtHlc,
      retry_count: 0,
    };
    queueEnqueue(SOS_QUEUE, operation);
  }
}

/**
 * Subscribe to SOS events for a group.
 * Merges remote events into local OR-Set using orSetMerge().
 * Returns active SOS events via callback.
 * Returns Firestore unsubscribe function.
 */
export function subscribeToSosEvents(
  groupId: string,
  callback: (sosEvents: SOSElement[]) => void
): () => void {
  const db = getFirestore();
  const storageKey = `sos_orset_${groupId}`;

  // Initial load: merge local with remote
  const initialMerge = async () => {
    const localSet = orSetLoad(storageKey);
    
    try {
      const snapshot = await db
        .collection(SOS_EVENTS_COLLECTION)
        .where('group_id', '==', groupId)
        .get();

      let remoteSet = createORSet();
      for (const doc of snapshot.docs) {
        const data = doc.data();
        const sosElement: SOSElement = {
          sos_id: data.sos_id,
          rider_id: data.rider_id,
          group_id: data.group_id,
          lat: data.lat,
          lng: data.lng,
          created_at_hlc: data.created_at_hlc,
        };

        // Use Firestore tag if present
        const tag = data.tag || `${data.sos_id}:${data.rider_id}:${data.created_at_hlc}`;
        remoteSet = orSetAddWithTag(remoteSet, sosElement, tag);

        // If resolved, add tombstone
        if (data.resolved) {
          remoteSet = {
            adds: remoteSet.adds,
            tombstones: new Set([...remoteSet.tombstones, tag]),
          };
        }
      }

      // Merge local and remote
      const merged = orSetMerge(localSet, remoteSet);
      orSetSave(merged, storageKey);

      // Callback with active events
      const active = orSetGetActive(merged);
      callback(active);
    } catch (error) {
      console.error('[sosService] Initial SOS merge failed:', error);
      // Fall back to local only
      callback(orSetGetActive(localSet));
    }
  };

  initialMerge();

  // Realtime listener for ongoing changes
  const unsubscribe = db
    .collection(SOS_EVENTS_COLLECTION)
    .where('group_id', '==', groupId)
    .onSnapshot(
      async (snapshot: any) => {
        const localSet = orSetLoad(storageKey);
        
        let remoteSet = createORSet();
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const sosElement: SOSElement = {
            sos_id: data.sos_id,
            rider_id: data.rider_id,
            group_id: data.group_id,
            lat: data.lat,
            lng: data.lng,
            created_at_hlc: data.created_at_hlc,
          };

          const tag = data.tag || `${data.sos_id}:${data.rider_id}:${data.created_at_hlc}`;
          remoteSet = orSetAddWithTag(remoteSet, sosElement, tag);

          if (data.resolved) {
            remoteSet = {
              adds: remoteSet.adds,
              tombstones: new Set([...remoteSet.tombstones, tag]),
            };
          }
        }

        const merged = orSetMerge(localSet, remoteSet);
        orSetSave(merged, storageKey);

        const active = orSetGetActive(merged);
        callback(active);
      },
      (error: any) => {
        console.error('[sosService] SOS events listener error:', error);
      }
    );

  return unsubscribe;
}

/**
 * Get active SOS events from local OR-Set (synchronous, for immediate UI).
 */
export function getLocalActiveSosEvents(groupId: string): SOSElement[] {
  const storageKey = `sos_orset_${groupId}`;
  const localSet = orSetLoad(storageKey);
  return orSetGetActive(localSet);
}