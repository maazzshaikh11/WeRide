/**
 * Shared geo math — single source of truth.
 * (Previously duplicated in astar.js, hazard_penalty.js, safety_score.js.)
 */

/**
 * Haversine distance in METERS between two coordinates.
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Interpolate points along a straight segment, spaced at most stepM apart.
 * Used so hazard proximity scoring sees the whole segment, not just endpoints.
 *
 * @param {{lat:number,lng:number}} a
 * @param {{lat:number,lng:number}} b
 * @param {number} stepM
 * @returns {Array<{lat:number,lng:number}>} including both endpoints
 */
export function densifySegment(a, b, stepM = 50) {
  const total = haversineMeters(a.lat, a.lng, b.lat, b.lng);
  const n = Math.max(1, Math.ceil(total / stepM));
  const points = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    points.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
  }
  return points;
}
