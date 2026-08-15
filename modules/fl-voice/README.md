# Person D — FL + VOX

Federated Learning (FedProx + FedOpt) with privacy preservation + WebRTC voice (VOX).

## FL model (decide in sync — see plan §3.1.2)
- **Option C (start here):** toy model on synthetic on-device data — proves the FL pipeline
- **Option A (upgrade if time):** ETA refinement (coordinate with C)
- **Option B (stretch):** riding-behavior analytics from IMU

## FedProx
- Proximal term: loss = local_loss(w) + (mu/2) * ||w - w_global||^2
- mu = 0.01 (tune in Week 2-3)

## Privacy (the demo's key proof)
- Gradient clipping: max L2 norm = 1.0
- DP noise: Gaussian, calibrated to epsilon (document budget)
- Only fl_model_update sent: masked_weights_delta, local_loss, sample_count
- NO raw ride data ever leaves the device (locations, speeds, traces)
- Secure aggregation: stretch goal, likely cut for MVP

## On-device training
- TensorFlow Lite (TFLite) — supports on-device training
- Model must be small (<1MB, few layers)
- Local data in MMKV box 'fl_data' (react-native-mmkv)

## FedOpt (server aggregation)
- Adaptive weighted average with momentum
- Python sidecar recommended (TensorFlow/PyTorch) for the math

## VOX
- WebRTC mesh topology (cap 8 riders)
- Signaling: Socket.io /vox namespace (server in routing-eta/server/vox_signaling.js)
- Audio only (no video)
- STUN: stun:stun.l.google.com:19302 (TURN only if NAT testing fails)

## VAD
- WebRTC built-in VAD if available; fallback: energy + noise gate + high-pass filter
- High-pass at 85Hz (cuts wind noise)
- Noise gate: threshold + hold time (X ms)
- Manual PTT fallback (mandatory — loud environments)

## See also
- Plan: `Person_D_FL_VOX.md`
- Contracts: `contracts/fl_model_update.json`, `contracts/vox_signal.json`