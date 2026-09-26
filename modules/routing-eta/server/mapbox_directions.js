/**
 * Option A routing: Mapbox Directions API client.
 *
 * The server has no road-graph data of its own (C-P0-2), so the base route
 * comes from Mapbox Directions. Hazard avoidance happens in post-processing
 * (see astar.js handleRoute): routes passing within R of an active hazard
 * the rider wants to avoid lose to cleaner alternatives.
 *
 * Setup (manual — do NOT invent a token):
 *   export MAPBOX_ACCESS_TOKEN=pk.your_token_here
 * See docs/SETUP_CREDENTIALS.md.
 *
 * When the token is unset, fetchMapboxRoutes() returns null and handleRoute
 * falls back to degraded straight-line mode (with real hazard scoring).
 */

const MAPBOX_DIRECTIONS_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';

/**
 * @returns {string|null} the configured token, or null when unset.
 */
export function getMapboxToken() {
  return process.env.MAPBOX_ACCESS_TOKEN || null;
}

/**
 * Fetch candidate routes from Mapbox Directions.
 *
 * @param {{lat:number,lng:number}} origin
 * @param {{lat:number,lng:number}} destination
 * @returns {Promise<Array|null>} list of candidates, or null when no token is
 *   configured. Each candidate: { distanceM, durationS, points: [{lat,lng}],
 *   turnCount }. Mapbox coordinates are [lng, lat]; converted here.
 * @throws on network/API errors (caller decides fallback).
 */
export async function fetchMapboxRoutes(origin, destination) {
  const token = getMapboxToken();
  if (!token) return null;

  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const params = new URLSearchParams({
    alternatives: 'true',
    geometries: 'geojson',
    steps: 'true',
    overview: 'full',
    access_token: token,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${MAPBOX_DIRECTIONS_URL}/${coords}?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Mapbox Directions ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data.routes) || data.routes.length === 0) {
      throw new Error('Mapbox returned no routes');
    }

    return data.routes.map((r) => {
      const points = (r.geometry?.coordinates || []).map(([lng, lat]) => ({ lat, lng }));
      let turnCount = 0;
      for (const leg of r.legs || []) {
        for (const step of leg.steps || []) {
          const type = step.maneuver?.type;
          if (type === 'turn' || type === 'roundabout' || type === 'rotary') turnCount += 1;
        }
      }
      return {
        distanceM: r.distance,
        durationS: r.duration,
        points,
        turnCount,
      };
    });
  } catch (e) {
    clearTimeout(timeoutId);
    throw e;
  }
}
