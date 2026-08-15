// ETA model inference. LightGBM (chosen Day 1).
// For MVP: server REST call (per §9 recommendation).
//
// If using a Python sidecar for LightGBM, this module proxies to it.
// If using a Node-native binding, load the model here.

// TODO: load the trained LightGBM model (eta_model.txt)
// For now: a simple distance/speed heuristic as placeholder

export function predictEta(features) {
  // features: { distance_km, turn_count, hour_of_day, day_of_week, hazard_count, avg_speed_limit }
  // Real: call LightGBM model.predict([features...])
  // Placeholder: distance / avg_speed
  const avgSpeed = features.avg_speed_limit || 40; // km/h
  const baseTime = (features.distance_km / avgSpeed) * 60; // minutes
  const hazardDelay = (features.hazard_count || 0) * 0.5; // 30s per hazard
  return baseTime + hazardDelay;
}

// Python sidecar proxy (if used):
// import http from 'http';
// export function predictEtaSidecar(features) {
//   return new Promise((resolve, reject) => {
//     const data = JSON.stringify(features);
//     const req = http.request({ hostname: 'localhost', port: 5000, path: '/predict', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } }, (res) => {
//       let body = ''; res.on('data', c => body += c); res.on('end', () => resolve(JSON.parse(body).eta));
//     });
//     req.on('error', reject); req.write(data); req.end();
//   });
// }