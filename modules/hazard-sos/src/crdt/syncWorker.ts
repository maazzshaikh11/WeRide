/**
 * Phase 4: Sync Worker
 * 
 * Connectivity detection using NetInfo
 * Syncs queued hazard reports and SOS operations to Firestore when online
 * Merges local and remote SOS CRDTs on reconnect
 * Automatic sync on offline ? online transitions
 * 
 * Retry policy: max 3 retries, then drop and log error
 */

import NetInfo from '@react-native-community/netinfo';
/* eslint-disable-next-line @typescript-eslint/no-var-requires */
import firestore from '@react-native-firebase/firestore';
import type { HazardReport } from '../dbscan/dbscan';
import type { SOSElement } from './orSet';
import {
  createORSet,
  orSetMerge,
  orSetLoad,
  orSetSave,
  orSetAddWithTag,
} from './orSet';
import {
  queuePeek,
  queueDequeue,
  queueUpdateRetry,
  HAZARD_QUEUE,
  SOS_QUEUE,

} from './localQueue';
import { HLC } from '../hlc/hlc';

const MAX_RETRIES = 3;

// ---------------------------------------------------------------------------
// Test-only instrumentation
// Counts how many full sync runs startSyncWorker has triggered.
// Reset in beforeEach via _resetSyncCallCount().
// ---------------------------------------------------------------------------
let _syncCallCount = 0;
/** @internal */
export function _getSyncCallCount(): number { return _syncCallCount; }
/** @internal */
export function _resetSyncCallCount(): void { _syncCallCount = 0; }

/**
 * Get Firestore instance (lazy initialization for testing)
 */
function getFirestore(): any {
  // @ts-expect-error Firestore typing issue with getFirestore wrapper
  return firestore();
}

/**
 * Check if the device is currently online.
 * 
 * Uses NetInfo to query current network state.
 * 
 * @returns Promise<boolean> - true if connected, false otherwise
 */
export async function isOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true;
}

/**
 * Sync hazard reports from local queue to Firestore.
 * 
 * Process:
 * 1. Get pending hazard reports from queue
 * 2. Filter by groupId
 * 3. For each report:
 *    - Write to Firestore groups/{group_id}/reports/{report_id}
 *    - On success: dequeue
 *    - On failure: increment retry_count, keep queued
 *    - If retry_count > 3: dequeue and log error
 * 
 * @param groupId - Group ID to filter reports
 */
export async function syncHazardReports(groupId: string): Promise<void> {
  const db = getFirestore();
  const queue = queuePeek(HAZARD_QUEUE);
  const groupReports = queue.filter(op => {
    if (op.type !== 'hazard_report') return false;
    const report = op.data as HazardReport;
    return report.group_id === groupId;
  });

  for (const operation of groupReports) {
    const report = operation.data as HazardReport;

    try {
      // Write to Firestore
      await db
        .collection('groups')
        .doc(groupId)
        .collection('reports')
        .doc(report.report_id)
        .set({
          report_id: report.report_id,
          rider_id: report.rider_id,
          group_id: report.group_id,
          hazard_type: report.hazard_type,
          lat: report.lat,
          lng: report.lng,
          timestamp_hlc: report.timestamp_hlc,
          reported_at_hlc: report.reported_at_hlc,
        });

      // Success - dequeue
      queueDequeue(HAZARD_QUEUE, operation.id);

    } catch (error) {
      // Failure - increment retry count
      const newRetryCount = operation.retry_count + 1;

      if (newRetryCount > MAX_RETRIES) {
        // Max retries exceeded - dequeue and log
        queueDequeue(HAZARD_QUEUE, operation.id);
        console.error(
          `[syncWorker] Hazard report ${report.report_id} dropped after ${MAX_RETRIES} retries:`,
          error
        );
      } else {
        // Update retry count and keep queued
        queueUpdateRetry(HAZARD_QUEUE, operation.id, newRetryCount);
      }
    }
  }
}

/**
 * Sync SOS events from local queue to Firestore.
 * 
 * Handles two operation types:
 * 1. sos_event: Write new SOS to sos_events/{sos_id}
 * 2. sos_resolve: Update existing SOS with resolved=true, resolved_at_hlc
 * 
 * Retry policy: same as hazard reports (max 3 retries)
 * 
 * CRITICAL: sos_resolve does NOT delete the Firestore document.
 * This preserves CRDT tombstone semantics.
 * 
 * @param groupId - Group ID to filter SOS operations
 */
export async function syncSosEvents(groupId: string): Promise<void> {
  const db = getFirestore();
  const queue = queuePeek(SOS_QUEUE);
  const groupOperations = queue.filter(op => {
    if (op.type === 'sos_event') {
      const sos = op.data as SOSElement;
      return sos.group_id === groupId;
    } else if (op.type === 'sos_resolve') {
      // For resolve operations, we need to check group_id from data
      // Resolve data only has sos_id, so we filter less strictly here
      // The actual group check happens when we look up the SOS
      return true;
    }
    return false;
  });

  for (const operation of groupOperations) {
    try {
      if (operation.type === 'sos_event') {
        // New SOS event
        const sos = operation.data as SOSElement;

        await db
          .collection('sos_events')
          .doc(sos.sos_id)
          .set({
            sos_id: sos.sos_id,
            rider_id: sos.rider_id,
            group_id: sos.group_id,
            lat: sos.lat,
            lng: sos.lng,
            created_at_hlc: sos.created_at_hlc,
            tag: (sos as any).tag || '', // Preserve CRDT tag if present
            resolved: false,
            resolved_at_hlc: null,
          });

        // Success - dequeue
        queueDequeue(SOS_QUEUE, operation.id);

      } else if (operation.type === 'sos_resolve') {
        // Resolve existing SOS
        const resolveData = operation.data as { sos_id: string; resolved_at_hlc: string };

        // Check if SOS exists and belongs to this group
        const sosDoc = await db
          .collection('sos_events')
          .doc(resolveData.sos_id)
          .get();

        if (!sosDoc.exists) {
          // SOS doesn't exist remotely yet - queue resolve intent for later
          // Do NOT dequeue - keep trying until create arrives or max retries
          const newRetryCount = operation.retry_count + 1;

          if (newRetryCount > MAX_RETRIES) {
            // Max retries - create a tombstoned entry to preserve intent
            await db
              .collection('sos_events')
              .doc(resolveData.sos_id)
              .set({
                sos_id: resolveData.sos_id,
                rider_id: '',
                group_id: groupId,
                lat: 0,
                lng: 0,
                created_at_hlc: resolveData.resolved_at_hlc,
                tag: '',
                resolved: true,
                resolved_at_hlc: resolveData.resolved_at_hlc,
              });
            queueDequeue(SOS_QUEUE, operation.id);
          } else {
            queueUpdateRetry(SOS_QUEUE, operation.id, newRetryCount);
          }
          continue;
        }

        const sosData = sosDoc.data();
        if (sosData?.group_id !== groupId) {
          // This resolve belongs to a different group — leave it in the queue
          // so that group's own syncSosEvents() call can process it later.
          // Do NOT dequeue here: that would permanently discard it.
          continue;
        }

        // Update with resolved flag - DO NOT DELETE
        await db
          .collection('sos_events')
          .doc(resolveData.sos_id)
          .update({
            resolved: true,
            resolved_at_hlc: resolveData.resolved_at_hlc,
          });

        // Success - dequeue
        queueDequeue(SOS_QUEUE, operation.id);
      }

    } catch (error) {
      // Failure - increment retry count
      const newRetryCount = operation.retry_count + 1;

      if (newRetryCount > MAX_RETRIES) {
        // Max retries exceeded - dequeue and log
        queueDequeue(SOS_QUEUE, operation.id);
        console.error(
          `[syncWorker] SOS operation ${operation.id} (type: ${operation.type}) dropped after ${MAX_RETRIES} retries:`,
          error
        );
      } else {
        // Update retry count and keep queued
        queueUpdateRetry(SOS_QUEUE, operation.id, newRetryCount);
      }
    }
  }
}

/**
 * Merge local and remote SOS OR-Sets on reconnect.
 * 
 * Process:
 * 1. Load local OR-Set from MMKV
 * 2. Fetch remote SOS events from Firestore (group_id filter)
 * 3. Convert remote data to OR-Set representation
 * 4. Merge local and remote using orSetMerge()
 * 5. Identify local-only additions
 * 6. Push local-only additions to Firestore
 * 7. Save merged OR-Set back to MMKV
 * 
 * CRITICAL: Preserves tombstone semantics. Resolved SOS events
 * are not deleted - they remain in CRDT with tombstone flag.
 * 
 * @param groupId - Group ID for SOS filtering
 */
export async function mergeSosOnSync(groupId: string): Promise<void> {
  const db = getFirestore();
  const storageKey = `sos_orset_${groupId}`;
  const hlc = HLC.fresh();

  // Step 1: Load local OR-Set
  const localSet = orSetLoad(storageKey);

  // Step 2: Fetch remote SOS events from Firestore
  const snapshot = await db
    .collection('sos_events')
    .where('group_id', '==', groupId)
    .get();

  // Step 3: Convert remote data to OR-Set using orSetAddWithTag to preserve tags
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

    // Use Firestore tag if present, else generate one (for legacy data)
    const tag = data.tag || `${data.sos_id}:${data.rider_id}:${data.created_at_hlc}`;

    // Add to remote set with preserved tag
    remoteSet = orSetAddWithTag(remoteSet, sosElement, tag);

    // If resolved, add tombstone
    if (data.resolved) {
      remoteSet = {
        adds: remoteSet.adds,
        tombstones: new Set([
          ...remoteSet.tombstones,
          tag, // Tombstone the specific tag
        ]),
      };
    }
  }

  // Step 4: Merge
  const merged = orSetMerge(localSet, remoteSet);

  // Step 5: Identify local-only additions (not in remote)
  const remoteSOSIds = new Set(
    Array.from(remoteSet.adds.values()).map(el => el.sos_id)
  );
  const localOnly = Array.from(localSet.adds.values()).filter(
    el => !remoteSOSIds.has(el.sos_id) && !localSet.tombstones.has(el.tag)
  );

  // Step 6: Push local-only additions to Firestore with their tags
  if (localOnly.length > 0) {
    const batch = db.batch();

    for (const sosElement of localOnly) {
      const ref = db.collection('sos_events').doc(sosElement.sos_id);
      batch.set(ref, {
        sos_id: sosElement.sos_id,
        rider_id: sosElement.rider_id,
        group_id: sosElement.group_id,
        lat: sosElement.lat,
        lng: sosElement.lng,
        created_at_hlc: sosElement.created_at_hlc,
        tag: sosElement.tag, // Preserve CRDT tag in Firestore
        resolved: false,
        resolved_at_hlc: null,
      });
    }

    await batch.commit();
  }

  // Step 7: Save merged OR-Set back to MMKV
  orSetSave(merged, storageKey);
}

/**
 * Start the sync worker with automatic reconnect handling.
 * 
 * Listens to NetInfo connectivity changes.
 * When offline ? online transition occurs:
 * 1. syncHazardReports(groupId)
 * 2. syncSosEvents(groupId)
 * 3. mergeSosOnSync(groupId)
 * 
 * Duplicate sync protection: only one sync per group at a time.
 * 
 * @param groupId - Active group ID to sync
 * @returns Unsubscribe function to stop the worker
 */
export function startSyncWorker(
  groupId: string,
  onSyncComplete?: () => void
): () => void {
  let syncInProgress = false;
  let previouslyConnected: boolean | null = null;

  const handleStateChange = async (state: any) => {
    const currentlyConnected = state.isConnected === true;

    // Initialize on first event
    if (previouslyConnected === null) {
      previouslyConnected = currentlyConnected;
      return;
    }

    // Only sync on actual offline ? online transition
    if (previouslyConnected === false && currentlyConnected) {
      if (syncInProgress) {
        previouslyConnected = currentlyConnected;
        return;
      }

      syncInProgress = true;

      _syncCallCount++;
      try {
        // Execute all three sync operations
        await syncHazardReports(groupId);
        await syncSosEvents(groupId);
        await mergeSosOnSync(groupId);
      } catch (error) {
        console.error('[syncWorker] Sync failed:', error);
      } finally {
        syncInProgress = false;
        // Update state BEFORE calling onSyncComplete so any synchronous
        // NetInfo triggers fired inside the callback don't re-enter the sync branch.
        previouslyConnected = currentlyConnected;
        onSyncComplete?.();
      }
      return; // previouslyConnected already updated inside finally
    }

    previouslyConnected = currentlyConnected;
  };

  // Subscribe to connectivity changes
  const unsubscribe = NetInfo.addEventListener(handleStateChange);

  // Return unsubscribe function
  return () => {
    unsubscribe();
  };
}



