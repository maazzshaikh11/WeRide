/**
 * Live active hazard clusters for one or more rides (groups), merged and de-duplicated by cluster id.
 * Uses the existing hazard subscription; a failing subscription leaves that ride's list empty.
 * `ready` turns true once every ride has delivered its first snapshot (or after READY_TIMEOUT_MS, so a
 * failing subscription never blocks a caller that waits for it).
 */
import { useEffect, useMemo, useState } from 'react';
import { subscribeToHazardClusters } from '@hazard/services/hazardService';
import type { HazardCluster } from '../../../models/hazardCluster';

export const READY_TIMEOUT_MS = 2000;

export function useActiveClusters(groupIds: readonly string[]): HazardCluster[] {
  return useActiveClustersState(groupIds).clusters;
}

export function useActiveClustersState(groupIds: readonly string[]): { clusters: HazardCluster[]; ready: boolean } {
  const key = Array.from(new Set(groupIds.filter(Boolean))).sort().join('|');
  const [byGroup, setByGroup] = useState<Record<string, HazardCluster[]>>({});
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setTimedOut(false);
    if (!key) return undefined;
    const id = setTimeout(() => setTimedOut(true), READY_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [key]);

  useEffect(() => {
    const ids = key ? key.split('|') : [];
    const stops: (() => void)[] = [];
    for (const id of ids) {
      try {
        stops.push(subscribeToHazardClusters(id, (c) => setByGroup((prev) => ({ ...prev, [id]: c as unknown as HazardCluster[] }))));
      } catch {
        // no hazard data for this ride
      }
    }
    return () => stops.forEach((s) => s());
  }, [key]);

  const clusters = useMemo(() => {
    const seen = new Set<string>();
    const out: HazardCluster[] = [];
    for (const id of key ? key.split('|') : []) {
      for (const c of byGroup[id] ?? []) {
        if (c.status === 'resolved' || seen.has(c.cluster_id)) continue;
        seen.add(c.cluster_id);
        out.push(c);
      }
    }
    return out;
  }, [byGroup, key]);
  const ready = timedOut || !key || key.split('|').every((id) => byGroup[id] !== undefined);
  return { clusters, ready };
}
