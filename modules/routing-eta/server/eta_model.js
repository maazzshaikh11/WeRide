/**
 * ETA Model Inference (Phase 4)
 *
 * Architecture:
 *   Node.js extracts features from route
 *   → HTTP request to Python sidecar
 *   → Python loads LightGBM model, predicts ETA
 *   → Returns prediction to Node
 *   → Fallback: use distance/speed heuristic if sidecar unavailable
 *
 * Features (in order):
 *   distance_km, turn_count, hour_of_day, day_of_week, hazard_count, avg_speed_limit
 *
 * Sidecar runs on localhost:5000/predict (Flask)
 * Expected response: { "eta": number }
 */

/**
 * Extract ETA features from route.
 *
 * @param {Object} routeData - { distance_km, ... }
 * @param {Date} currentTime - current time for hour_of_day, day_of_week
 * @returns {Array} feature vector in order: [distance_km, turn_count, hour_of_day, day_of_week, hazard_count, avg_speed_limit]
 */
export function extractEtaFeatures(routeData, currentTime = new Date()) {
  const distance_km = routeData.distance_km || 0;

  // Phase 4 MVP placeholders (deferred to Phase 5+)
  const turn_count = routeData.turn_count || 0;
  const hazard_count = routeData.hazard_count || 0;
  const avg_speed_limit = routeData.avg_speed_limit || 40;

  // Extract from current time
  const hour_of_day = currentTime.getHours();
  const day_of_week = currentTime.getDay();

  // Return feature vector in EXACT order matching:
  // - generate_synthetic_data.py
  // - train_eta.py
  // - sidecar.py /predict
  return [
    distance_km,
    turn_count,
    hour_of_day,
    day_of_week,
    hazard_count,
    avg_speed_limit,
  ];
}

/**
 * Fallback ETA heuristic (if sidecar unavailable).
 *
 * @param {Array} features - from extractEtaFeatures()
 * @returns {number} ETA in minutes
 */
function fallbackEta(features) {
  const [distance_km, turn_count, hour_of_day, day_of_week, hazard_count, avg_speed_limit] = features;

  // Base: distance / speed
  const baseEta = (distance_km / avg_speed_limit) * 60;

  // Adjustments
  const turnPenalty = turn_count * 1.0; // 1 minute per turn
  const hazardPenalty = hazard_count * 0.5; // 30 seconds per hazard
  const peakHours = [8, 9, 10, 17, 18, 19];
  const peakMultiplier = peakHours.includes(hour_of_day) ? 1.1 : 1.0;

  return Math.max(0.5, (baseEta + turnPenalty + hazardPenalty) * peakMultiplier);
}

/**
 * Predict ETA using Python sidecar.
 *
 * Falls back to heuristic if sidecar is unavailable.
 *
 * @param {Array} features - from extractEtaFeatures()
 * @returns {Promise<number>} ETA in minutes
 */
export async function predictEta(features) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  try {
    // Attempt to call Python sidecar on localhost:5000/predict
    const response = await fetch('http://127.0.0.1:5000/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distance_km: features[0],
        turn_count: features[1],
        hour_of_day: features[2],
        day_of_week: features[3],
        hazard_count: features[4],
        avg_speed_limit: features[5],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`Sidecar returned ${response.status}, using fallback`);
      return fallbackEta(features);
    }

    const data = await response.json();
    const eta = data.eta;

    // Validate ETA
    if (typeof eta !== 'number' || !isFinite(eta) || eta <= 0) {
      console.warn('Invalid ETA from sidecar, using fallback');
      return fallbackEta(features);
    }

    // Reasonable upper bound: 2 hours for distances under 100km
    if (features[0] < 100 && eta > 120) {
      console.warn('Unreasonable ETA (>2h for short distance), using fallback');
      return fallbackEta(features);
    }

    return eta;
  } catch (error) {
    clearTimeout(timeoutId);
    // Sidecar unavailable, network error, timeout, etc.
    if (error.name === 'AbortError') {
      console.warn('ETA sidecar timeout (2s), using fallback heuristic');
    } else {
      console.warn(`ETA sidecar error: ${error.message}, using fallback heuristic`);
    }
    return fallbackEta(features);
  }
}
