// FL aggregation server proxy.
// Person D owns the actual aggregation logic. This is a thin proxy:
// - If aggregation runs in Python sidecar, proxy POST /fl/submit → localhost:5001/fl/submit
// - If running in this Node process, import D's aggregator directly
//
// For now: pass-through stub

export async function handleFlSubmit(req, res) {
  // Proxy to Python sidecar or D's Node aggregator
  // TODO: implement
  res.json({ status: 'received', round_id: req.body.round_id });
}

export async function handleFlGlobal(req, res) {
  // Return current global weights
  // TODO: implement
  res.json({ global_weights_version: 0, weights: [] });
}