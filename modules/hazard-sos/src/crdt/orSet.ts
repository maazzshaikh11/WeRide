/**
 * OR-Set (Observed-Remove Set) CRDT for SOS events.
 * Add: insert (element, unique_tag). Remove (resolve): tombstone the observed tags.
 * Merge: union of adds minus union of tombstones. Convergent + commutative.
 * Ported from or_set.dart.
 *
 * Zero data loss: the local write happens before UI confirms SOS.
 */

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

export class OrSet {
  private _adds = new Map<string, SosEvent>();
  private _tombstones = new Set<string>();

  add(e: SosEvent): void {
    const tag = `${e.sosId}:${e.createdAtHlc}`;
    this._adds.set(tag, e);
  }

  /** Resolve = tombstone. Not a hard delete — preserves convergence. */
  resolve(sosId: string, resolvedAtHlc: string): void {
    for (const [tag, e] of this._adds) {
      if (e.sosId === sosId && !this._tombstones.has(tag)) {
        this._tombstones.add(tag);
        e.resolved = true;
        e.resolvedAtHlc = resolvedAtHlc;
      }
    }
  }

  /** Merge another OR-Set into this one. */
  merge(other: OrSet): void {
    for (const [tag, e] of other._adds) {
      if (!this._adds.has(tag)) this._adds.set(tag, e);
    }
    for (const t of other._tombstones) this._tombstones.add(t);
    // Apply tombstones
    for (const t of this._tombstones) {
      this._adds.get(t)!.resolved = true;
    }
  }

  /** Active (non-resolved) events. */
  get active(): SosEvent[] {
    const result: SosEvent[] = [];
    for (const [tag, e] of this._adds) {
      if (!this._tombstones.has(tag)) result.push(e);
    }
    return result;
  }

  /** All events (including resolved). */
  get all(): SosEvent[] {
    return [...this._adds.values()];
  }

  contains(sosId: string): boolean {
    return [...this._adds.values()].some((e) => e.sosId === sosId);
  }
}