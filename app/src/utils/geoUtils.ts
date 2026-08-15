/**
 * Haversine distance in meters between two lat/lng points.
 * Used by: A (EKF heuristic), B (DBSCAN eps), C (A* heuristic), D (FL features).
 * Replaces geo_utils.dart.
 */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // earth radius meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Straight-line distance (Haversine) — admissible heuristic for A*. */
export const straightLineMeters = haversineMeters;