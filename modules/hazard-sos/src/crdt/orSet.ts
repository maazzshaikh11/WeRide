/**
 * OR-Set (Observed-Remove Set) CRDT for SOS events.
 * Add: insert (element, unique_tag). Remove (resolve): tombstone the observed tags.
 * Merge: union of adds minus union of tombstones. Convergent + commutative.
 * Ported from or_set.dart.
 *
 * Zero data loss: the local write happens before UI confirms SOS.
 */

import { HLC } from '../hlc/hlc';

// We cannot instantiate MMKV at module load time due to ts-jest mocking bugs.
// Lazily instantiate it using the same pattern as HLC.
/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const MMKV = require('react-native-mmkv').MMKV;

export interface SOSElement {
  sos_id: string;
  rider_id: string;
  group_id: string;
  lat: number;
  lng: number;
  created_at_hlc: string;
}

/** @deprecated Use SOSElement (snake_case) instead. Kept for backward compatibility. */
export interface SosEvent {
  sosId: string;
  riderId: string;
  groupId: string;
  lat: number;
  lng: number;
  createdAtHlc: string;
  resolved: boolean;
  resolvedAtHlc: string | null;
}

/** @deprecated Use orSetAdd/orSetRemove instead. Kept for backward compatibility. */
export function sosEventToJson(e: SosEvent): Record<string, any> {
  return {
    sos_id: e.sosId,
    rider_id: e.riderId,
    group_id: e.groupId,
    lat: e.lat,
    lng: e.lng,
    created_at_hlc: e.createdAtHlc,
    resolved: e.resolved,
    resolved_at_hlc: e.resolvedAtHlc,
  };
}

/** @deprecated Use orSetAdd/orSetRemove instead. Kept for backward compatibility. */
export function sosEventFromJson(j: Record<string, any>): SosEvent {
  return {
    sosId: j.sos_id,
    riderId: j.rider_id,
    groupId: j.group_id,
    lat: Number(j.lat),
    lng: Number(j.lng),
    createdAtHlc: j.created_at_hlc,
    resolved: Boolean(j.resolved),
    resolvedAtHlc: j.resolved_at_hlc ?? null,
  };
}

interface TaggedElement extends SOSElement {
  tag: string;
}

export interface ORSet {
  adds: Map<string, TaggedElement>;
  tombstones: Set<string>;
}

export function createORSet(): ORSet {
  return {
    adds: new Map(),
    tombstones: new Set(),
  };
}

function generateTag(sosId: string, riderId: string, hlc: HLC): string {
  const timestamp = hlc.now();
  return `${sosId}:${riderId}:${timestamp}`;
}

export function orSetAdd(
  set: ORSet,
  element: SOSElement,
  hlc: HLC
): ORSet {
  const newSet: ORSet = {
    adds: new Map(set.adds),
    tombstones: new Set(set.tombstones),
  };

  // Reject only if there's an ACTIVE (non-tombstoned) tag for this sos_id.
  // Tombstoned tags (from prior resolves) do not block a new concurrent add.
  const hasActiveExistingTag = Array.from(newSet.adds.entries()).some(
    ([tag, e]) => e.sos_id === element.sos_id && !newSet.tombstones.has(tag)
  );

  if (hasActiveExistingTag) {
    return newSet;
  }

  const tag = generateTag(element.sos_id, element.rider_id, hlc);
  const taggedElement: TaggedElement = { ...element, tag };
  newSet.adds.set(tag, taggedElement);

  return newSet;
}


/**
 * Add an element to OR-Set with an explicit tag (for Firestore reconstruction).
 * 
 * This preserves CRDT tag identity across Firestore syncs.
 * Use this when reconstructing OR-Set from Firestore documents that already have tags.
 * Use orSetAdd() for new local additions that need fresh tag generation.
 * 
 * @param set - Current OR-Set
 * @param element - SOS element to add
 * @param tag - Explicit CRDT tag from Firestore
 * @returns New OR-Set with element added using the provided tag
 */
export function orSetAddWithTag(
  set: ORSet,
  element: SOSElement,
  tag: string
): ORSet {
  const newSet: ORSet = {
    adds: new Map(set.adds),
    tombstones: new Set(set.tombstones),
  };

  // Check if this exact tag already exists (idempotency)
  if (newSet.adds.has(tag)) {
    return newSet;
  }
  
  // Allow concurrent adds with different tags for the same sos_id (Phase 3 semantics)
  // Only the exact tag match above provides idempotency

  const taggedElement: TaggedElement = { ...element, tag };
  newSet.adds.set(tag, taggedElement);

  return newSet;
}

export function orSetRemove(
  set: ORSet,
  sosId: string
): ORSet {
  const newSet: ORSet = {
    adds: new Map(set.adds),
    tombstones: new Set(set.tombstones),
  };

  for (const [tag, element] of newSet.adds) {
    if (element.sos_id === sosId && !newSet.tombstones.has(tag)) {
      newSet.tombstones.add(tag);
    }
  }

  return newSet;
}

export function orSetMerge(
  local: ORSet,
  remote: ORSet
): ORSet {
  const merged: ORSet = {
    adds: new Map(),
    tombstones: new Set(),
  };

  for (const [tag, element] of local.adds) {
    merged.adds.set(tag, element);
  }
  for (const [tag, element] of remote.adds) {
    if (!merged.adds.has(tag)) {
      merged.adds.set(tag, element);
    }
  }

  for (const tag of local.tombstones) {
    merged.tombstones.add(tag);
  }
  for (const tag of remote.tombstones) {
    merged.tombstones.add(tag);
  }

  return merged;
}

export function orSetGetActive(set: ORSet): SOSElement[] {
  const active: SOSElement[] = [];
  const seenSosIds = new Set<string>();

  for (const [tag, element] of set.adds) {
    if (!set.tombstones.has(tag) && !seenSosIds.has(element.sos_id)) {
      seenSosIds.add(element.sos_id);
      const { tag: _unusedTag, ...sosElement } = element;
      active.push(sosElement);
    }
  }

  return active;
}

function getStorage(storageKey: string): any {
  return new MMKV({ id: storageKey });
}

export function orSetSave(
  set: ORSet,
  storageKey: string
): void {
  const storage = getStorage(storageKey);

  const addsArray: Array<[string, TaggedElement]> = [];
  for (const [tag, element] of set.adds) {
    addsArray.push([tag, element]);
  }

  const data = {
    adds: addsArray,
    tombstones: Array.from(set.tombstones),
  };

  storage.set('or_set', JSON.stringify(data));
}

export function orSetLoad(
  storageKey: string
): ORSet {
  const storage = getStorage(storageKey);
  const saved = storage.getString('or_set');

  if (!saved) {
    return createORSet();
  }

  try {
    const data = JSON.parse(saved) as {
      adds: Array<[string, TaggedElement]>;
      tombstones: string[];
    };

    const adds = new Map<string, TaggedElement>(data.adds);
    const tombstones = new Set<string>(data.tombstones);

    return { adds, tombstones };
  } catch {
    return createORSet();
  }
}


