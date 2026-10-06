/**
 * Route intel: turns a ride's real active hazard clusters (and its route safety score) into the card text and
 * the sheet's rail. Nothing is invented: a hazard's position along the route ("km 46") is only given when
 * the ride has a saved road geometry to measure on.
 */
import type { HazardCluster } from '../models/hazardCluster';
import { distanceAlongPathKm } from './routeGeo';
import type { LatLng } from './mapFit';
import { agoLabel } from './planWhen';

export const HAZARD_LABEL: Record<string, string> = {
  pothole: 'Pothole',
  oil_spill: 'Oil on the road',
  accident: 'Accident',
  debris: 'Debris',
  other: 'Hazard',
};

export const hazardLabel = (t: string): string => HAZARD_LABEL[t] ?? 'Hazard';

/** Physical time (ms) from an HLC string "physical:counter" (or the legacy dash form); null when it is not a time. */
export function hlcMs(hlc: unknown): number | null {
  const n = Number(String(hlc ?? '').split(/[:-]/)[0]);
  return Number.isFinite(n) && n > 1e12 ? n : null;
}

const reports = (n: number) => `${n} ${n === 1 ? 'report' : 'reports'}`;

export interface IntelItem {
  key: string;
  tone: 'pri' | 'bad' | 'ok';
  title: string;
  sub: string;
}

/** Rail items for the sheet: one per active cluster (nearest the start first when it can be measured). */
export function intelItems(clusters: HazardCluster[], path: LatLng[], now: number, safety: number | null): IntelItem[] {
  const withKm = clusters.map((c) => ({ c, km: distanceAlongPathKm(path, { lat: c.centroid_lat, lng: c.centroid_lng }) }));
  withKm.sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity));
  const items: IntelItem[] = withKm.map(({ c, km }) => {
    const at = hlcMs(c.created_at_hlc);
    const bits = [reports(c.report_count)];
    if (at) bits.push(`first reported ${agoLabel(at, now)}`);
    return {
      key: c.cluster_id,
      tone: c.hazard_type === 'oil_spill' || c.hazard_type === 'accident' ? 'bad' : 'pri',
      title: km != null ? `${hazardLabel(c.hazard_type)} ∙ km ${Math.round(km)}` : hazardLabel(c.hazard_type),
      sub: bits.join(' ∙ '),
    };
  });
  if (safety != null) {
    items.push({
      key: 'safety',
      tone: 'ok',
      title: `Route safety score ${Math.round(safety * 100)}`,
      sub: 'Worked out from the active hazard reports near this route.',
    });
  }
  return items;
}

/** Card headline + one-line body for the Ride tab. */
export function intelSummary(clusters: HazardCluster[], safety: number | null): { title: string; body: string } {
  const n = clusters.length;
  if (n === 0) {
    return {
      title: 'No hazards reported on your route',
      body: safety != null ? `Route safety score ${Math.round(safety * 100)}.` : 'Riders’ reports show up here when two of them flag the same spot.',
    };
  }
  const parts = clusters.slice(0, 2).map((c) => `${hazardLabel(c.hazard_type)} (${reports(c.report_count)})`);
  const more = n > 2 ? ` and ${n - 2} more` : '';
  return { title: `${n} ${n === 1 ? 'hazard' : 'hazards'} on your route`, body: `${parts.join(', ')}${more}.` };
}
