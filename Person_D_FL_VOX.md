# Person D — Privacy-Preserving Analytics + Hands-Free Voice (FedProx+FedOpt, VOX)

**Objective 4:** Federated learning for ride analytics with privacy preservation (FedProx + FedOpt), and hands-free voice communication (VOX) over WebRTC.

**Module folder:** `/modules/fl-voice`
**UI screens owned:** VOX Voice Indicator (who's talking), Privacy/FL status indicator, Music Control Widget (P2 — cut if behind schedule).

---

## 1. Your Objective (End-to-End)

You own two subsystems that are independent of each other but both serve the "ride experience" layer:

1. **Federated Learning (FL):** Train a model on ride data (e.g., ETA refinement, riding-behavior analytics, or a model that benefits from cross-rider data) **without raw data ever leaving the device.** Only masked weight updates are shared with a central aggregation server (FedProx + FedOpt). This is the privacy story — the demo must visibly prove no raw data leaves the phone.
2. **VOX (Voice):** Hands-free, always-on voice chat for the ride group via WebRTC mesh, with Voice Activity Detection (VOX/VAD) auto-triggering transmission — no push-to-talk needed (but PTT is the fallback).

**What "done" looks like (demo, Week 7):**
> Live group voice call with VOX auto-triggering (riders speak, their avatar ring highlights, no button press). A log/slide shows FL rounds completing with masked weight deltas only — network traffic inspection confirms no raw ride data leaves the device.

---

## 2. Data Contracts (§6.5, §6.6)

### 2.1 `fl_model_update` (internal to your module — §6.5)
```json
{
  "client_id": "string",
  "round_id": "int",
  "masked_weights_delta": "base64",
  "local_loss": "float",
  "sample_count": "int"
}
```
Transport: HTTP POST to the FL aggregation server (Node.js). This is the **only** thing that leaves the device for FL. No raw ride data (locations, speeds, hazards) is ever sent.

### 2.2 `vox_signal` (internal to your module — §6.6)
```json
{
  "group_id": "string",
  "rider_id": "string",
  "sdp_offer": "string",
  "ice_candidates": ["string"],
  "voice_active": "boolean"
}
```
Transport: WebRTC peer connections for audio; Socket.io `/vox` namespace for signaling (SDP offer/answer exchange + ICE candidates). `voice_active` is broadcast over the signaling channel so all clients can update their UI (avatar ring highlight).

---

## 3. Algorithms & Systems

### 3.1 Federated Learning: FedProx + FedOpt

**Why federated (not centralized):** ride data (location traces, speeds, riding patterns) is privacy-sensitive. Centralizing it is both a privacy risk and a trust problem for users. FL keeps raw data on-device; only model weight updates are shared.

**Why FedProx (not plain FedAvg):** plain FedAvg diverges when clients are heterogeneous (non-IID data — different riders ride differently). FedProx adds a proximal term that bounds how far any client's local model can drift from the global model, keeping convergence stable with non-IID data. This is explicitly tested (§11 row 5).

**Why FedOpt (not just FedAvg aggregation):** FedOpt is an optimizer on the server side (e.g., Adam/Yogi-style adaptive aggregation) that accelerates global convergence by adapting the aggregation learning rate per-parameter. Combined with FedProx's local stability, this gives you both robustness and speed.

**The algorithm (high-level, per round):**
1. **Server** broadcasts current global model weights `w_global` to participating clients.
2. **Client** (on-device) trains locally for E epochs on its local ride data:
   - Loss = `local_loss(w) + (mu / 2) * ||w - w_global||^2`  ← the FedProx proximal term
   - `mu` is the proximal penalty coefficient (hyperparameter — tune in Week 2–3; start with `mu=0.01`).
3. **Client** computes `weights_delta = w_local - w_global`, applies masking (see §3.1.1), sends `fl_model_update` to server.
4. **Server** aggregates deltas with FedOpt (adaptive weighted average by `sample_count`, with momentum/adaptive rate), produces new `w_global`.
5. Repeat. Log round, participant count, global loss to `fl_rounds/{round_id}` in Firestore.

**3.1.1 Privacy mechanisms (the demo's key proof):**
- **Masking:** weight deltas are masked — at minimum, clip deltas to a max L2 norm (gradient clipping, e.g., max_norm=1.0) and add calibrated Gaussian noise (differential privacy). This prevents the server from inverting deltas to recover raw data.
- **No raw data ever sent:** the client ONLY sends `masked_weights_delta`, `local_loss`, `sample_count`. Never sends locations, speeds, or ride traces. The demo should show a network traffic capture proving this.
- **Optional (stretch):** secure aggregation (secret-sharing so the server only sees the sum of deltas, never individual deltas). This is complex — mark as stretch, likely cut for MVP. `# ponytail: gradient clip + DP noise, secure aggregation if time permits in Weeks 5-6`

**3.1.2 What model are you training?**
This must be decided in the weekly sync (it affects A, who may need to expose a local ride-data buffer). Options:
- **Option A: ETA refinement.** Train an ETA model on-device (coordinate with C) — each rider's real ride durations + features train a local model; FL aggregates into a better global ETA model. This directly helps C's routing.
- **Option B: Riding-behavior analytics.** Train a model that classifies riding style (smooth vs. aggressive, based on IMU data from A's sensor stream). Aggregate across riders for a "group riding safety" analytics model.
- **Option C: A toy model purely to demonstrate FL.** Train a small model on synthetic on-device data just to prove the FL round-trip works and no raw data leaves. Ship this if the real model is too ambitious.
- **Recommendation:** start with **Option C** in Week 2–3 to prove the FL pipeline end-to-end, then upgrade to Option A (ETA) in Weeks 4–5 if time permits. This de-risks the FL machinery, which is the hard part.

**3.1.3 On-device training:**
- Use **TensorFlow Lite** on-device (per spec §2). TFLite supports on-device training (model conversion + on-device fine-tuning).
- The model must be small (mobile constraint) — a few layers, <1MB. Document the model architecture in your README.
- Local data: stored in MMKV box `fl_data` (same local storage B uses — coordinate). For Option C, generate synthetic feature/label pairs on-device. For Option A, log (features, actual_duration) from real rides.

**3.1.4 Aggregation server:**
- Runs on Node.js (same process as C's routing API, or a separate one — decide Day 1).
- Endpoint: `POST /fl/submit` (receives `fl_model_update`), `GET /fl/global` (returns current global weights).
- Implements FedOpt aggregation (adaptive weighted average with momentum).
- Stores round metadata in Firestore `fl_rounds/{round_id}`.
- Can be in Python (TensorFlow/PyTorch) instead of Node if the math is easier — a Python sidecar is fine. `# ponytail: Python sidecar for aggregation math, Node-native if stable libs exist`

### 3.2 VOX: Voice Activity Detection + WebRTC

**3.2.1 WebRTC mesh topology:**
- Each rider establishes a direct peer connection with every other rider in the group (mesh). For ≤8 riders (spec §2), mesh is acceptable (N² connections = 28 for 8 riders, manageable). SFU is overkill for this group size. Decision §9: mesh (recommended).
- Signaling: Socket.io namespace `/vox`. Exchange SDP offers/answers and ICE candidates through this channel. `voice_active` is also broadcast here so all clients update their avatar ring UI.
- Audio only (no video) — reduces bandwidth significantly.
- **NAT traversal:** STUN server (Google's free STUN `stun:stun.l.google.com:19302` is enough for MVP). TURN server only if STUN fails for some riders — TURN costs money, skip for MVP unless testing reveals NAT issues.

**3.2.2 Voice Activity Detection (VAD / VOX):**
- Detect when a rider is speaking and auto-transmit (set `voice_active=true`); when silent, mute (set `voice_active=false`, stop sending audio to save bandwidth).
- **Algorithm options:**
  - **Energy-based (simplest):** compute RMS energy of the audio frame; if above threshold → speaking. Fast, low CPU, but false-triggers on wind/engine noise.
  - **WebRTC VAD (built into the WebRTC stack):** a GMM-based voice/non-voice classifier. More robust than pure energy. Use this if the WebRTC lib exposes it.
  - **ML-based (RNN/VAD):** overkill for MVP. Skip.
  - **Recommendation:** start with WebRTC's built-in VAD if available; fall back to energy-based with a noise gate. `# ponytail: WebRTC VAD if available, energy+noise-gate fallback`

**3.2.3 Noise robustness (the real-world challenge):**
- Motorcycle environment = wind + engine noise. Pure energy VAD will false-trigger constantly. You need:
  - **Noise gate:** a minimum threshold + a hold time (must be above threshold for X ms before triggering). Prevents brief noise spikes.
  - **High-pass filter:** wind noise is low-frequency; a high-pass filter at ~85Hz cuts most of it before VAD.
  - **Spectral check (optional):** voice has energy spread across 300–3400Hz; engine noise is concentrated low. A simple spectral flatness check helps distinguish. Skip for MVP unless field tests demand it.
- **Manual PTT fallback (mandatory — spec §4.2):** a mic toggle button for push-to-talk. VOX-only is a UX risk in loud environments. The toggle switches between auto (VOX) and manual (PTT) modes.

**3.2.4 Group cap:**
- Groups capped at 8 riders (spec §2). Enforce this in the WebRTC connection logic — don't establish the Nth peer connection if it would exceed 8. Show a "group full for voice" message.

---

## 4. UI Screens You Own

### 4.1 VOX Voice Indicator (P1)
- Small avatar ring highlight on whoever's `voice_active=true` (from the `vox_signal` signaling broadcast).
- Mic icon toggle on the Live Map: switches between **auto (VOX-controlled)** and **manual (push-to-talk)**.
- In auto mode: a visual indicator (pulsing dot) when the local rider's voice is detected as active.
- In manual mode: a hold-to-talk button (release to mute).
- Registered as an overlay on A's `MapScreen`. Lock interface Week 1 Day 2.

### 4.2 Privacy / FL Status Indicator (P1)
- Simple line of text/icon: "Your ride data stays on your device — only anonymized model updates are shared."
- Optional: a small "FL round N complete" toast when a federated round finishes, with a "tap for details" → shows round_id, participant_count, local_loss (if you want to be transparent). Builds user trust, directly demonstrates Objective 4 in the demo.
- This screen needs **no server call** for the UI itself — it reads local FL client state.

### 4.3 Music Control Widget (P2 — cut first if behind)
- Spotify Web API or Apple MusicKit. Lowest priority (spec §4.1).
- Do NOT start this until P0/P1 across all 4 people are done. Likely cut entirely. If you build it: a simple play/pause/skip widget overlaid on the map. Coordinate the API choice Day 1 only if everyone agrees it's in scope.

### 4.4 What you do NOT own
- Map, rider markers (A), hazard markers (B), route line/panel (C), group list (C).
- You register the VOX indicator as an overlay on A's `MapScreen`.

---

## 5. Dependencies

### 5.1 You depend on
| From | What | When you need it |
|---|---|---|
| Person A | `verified_location` + sensor stream (for FL ride data — local ride traces incl. location/speed/IMU) | Mock by Week 1 Day 2, real by Week 5 |
| Person B | HLC (optional — for FL round ordering if needed; likely not critical for FL) | Mock by Week 1 Day 2 |
| Person C | Theme file (`theme.ts`) | Week 1 Day 1 |
| Infra | Firebase project config, Node.js server hosting (for FL aggregation + WebRTC signaling), Socket.io `/vox` namespace | Week 1 Day 1–2 |
| Shared local storage | MMKV box `fl_data` (for local FL training data) | Week 1 Day 3 |

### 5.2 What waits on you
| Who | What they need from you | When |
|---|---|---|
| Person A | (Optional) A local ride-data buffer shape if FL uses location data — coordinate the shape in a sync, add to `/contracts` | Define by Week 4 |
| None (hard) | FL and VOX are self-contained — no other person hard-blocks on your output. B's HLC doesn't need you; C's routing doesn't need FL for MVP. |
| Demo (soft) | The whole-team demo (§12 item 5) needs your VOX working for the "voice chat" step | Week 6 |

**Unblocking rule (mandatory):** Ship by end of Day 2, Week 1:
1. **Mock `vox_signal`** producer (emits fake `voice_active=true/false` toggles every few seconds for a fake rider) over Socket.io `/vox` namespace.
2. **Mock FL round** stub (a fake `fl_model_update` POST that returns a fake global weights response) — proves the server endpoint exists.
3. **Mock FL status indicator** UI (static text — "Your ride data stays on your device").

---

## 6. Week-by-Week Plan

### Week 1
- **Day 1:** Be in the room for §9 decisions. You care about: RN stack (locked — `react-native-webrtc` for VOX), mesh vs SFU (mesh — recommended), Spotify/Apple Music scope (recommend: cut unless Weeks 1–5 finish early), ETA inference location (if you do FL on ETA, coordinate with C).
- **Day 1–2:** Author `/contracts/fl_model_update.json`, `/contracts/vox_signal.json` (internal contracts, but still version them).
- **Day 2:** Ship mock `vox_signal` producer + mock FL round stub + mock FL status UI. **Do not slip this.**
- **Day 3–7:** Start WebRTC setup: Socket.io `/vox` signaling server. `flutter_webrtc` (or RN equivalent) peer connection basics — establish a 2-device audio call manually (hardcode SDP exchange) to prove the plumbing works. This is your Week 1 stretch goal — if you get a 2-phone voice call working, you're ahead.

### Week 2–3 (core algorithm)
- **FL (Week 2):** Implement the FL round-trip:
  - On-device: TFLite model (start with Option C — toy model on synthetic data, §3.1.2). Local training loop with FedProx proximal term. Compute weight delta, clip + add DP noise (§3.1.1), POST to `/fl/submit`.
  - Server: FedOpt aggregation. Broadcast global weights on `GET /fl/global`. Log rounds to Firestore `fl_rounds/`.
  - Prove the round-trip with 3 simulated clients (§11 row 5): non-IID data → FedProx bounds divergence, confirm no raw data leaves device (inspect network traffic).
- **VOX (Week 3):** Implement VAD (WebRTC VAD or energy+noise-gate, §3.2.2). Wire `voice_active` broadcast over `/vox` signaling. Build the VOX indicator UI (avatar ring highlight). Implement the auto/manual toggle + PTT fallback button.
- Unit tests (§7): FedProx convergence with non-IID, DP noise sanity, VAD false-trigger test, WebRTC connection test.
- Write `modules/fl-voice/README.md` documenting: FL model architecture, FedProx mu, FedOpt config, DP noise params, VAD algorithm, WebRTC topology.

### Week 4 (integration swap 1)
- Real EKF (A) replaces mock → if your FL uses location/IMU data (Option A/B), wire in the real sensor stream. If still on Option C (toy model), this week is buffer time — use it to harden the FL pipeline and VAD.

### Week 5 (integration swap 2)
- D integrates real location (per spec §8 Week 5). If upgrading FL to Option A (ETA), this is when real ride data flows. Coordinate with C on the ETA model shape.
- If not upgrading, use this week for VAD field testing (ride with the phone, test wind/engine false-triggers) and FL robustness testing.

### Week 6
- Full system integration testing. Your parts:
  - FL round (§11 row 5): 3 simulated clients, non-IID data → FedProx bounds divergence, no raw data leaves device (check logs/network traffic).
  - VOX (§11 row 6): simulated wind/engine noise → VAD doesn't false-trigger or false-mute; manual PTT fallback works.
  - Battery/CPU (§11 row 7): profile FL training impact on device (target: low — it's a small model, few epochs); profile WebRTC audio CPU.
- Whole-team end-to-end flow rehearsal (§12 item 5) — your VOX is the "voice chat" step.

### Week 7
- Final build frozen 2 days before submission. Demo rehearsal: your beat is the live group voice call + FL round proof (§12 item 4). Practice:
  - 2+ riders on a voice call, VOX auto-triggering when someone speaks (avatar ring lights up).
  - A log/slide showing FL rounds completing with masked updates only — have a network traffic capture ready showing only `masked_weights_delta` is sent, no raw data.

---

## 7. Tests You Must Write (minimum)

`modules/fl-voice/test/`:

| Test | What it asserts |
|---|---|
| `fedprox_noniid_convergence` | 3 clients with non-IID data → global model converges (loss decreases over rounds); FedProx mu>0 converges where FedAvg (mu=0) diverges. |
| `fedprox_delta_clipping` | Weight delta L2 norm ≤ max_norm after clipping. |
| `dp_noise_calibrated` | Noise added has the correct standard deviation for the privacy budget (epsilon). |
| `no_raw_data_sent` | Inspect the `fl_model_update` payload — contains only `masked_weights_delta`, `local_loss`, `sample_count`. No locations/speeds/traces. |
| `vad_speaking_detected` | Feed a clean speech audio sample → `voice_active=true`. |
| `vad_wind_no_false_trigger` | Feed a wind-noise sample → `voice_active=false` (noise gate + high-pass filter working). |
| `vad_engine_no_false_trigger` | Feed an engine-noise sample → `voice_active=false`. |
| `ptt_fallback_works` | Manual mode: hold button → transmits; release → mutes. |
| `webrtc_2client_connect` | Two test clients establish a peer connection via `/vox` signaling and exchange audio. |
| `mock_producer_contract` | Mock `vox_signal` and `fl_model_update` emit exact §6.5/§6.6 schemas. |

Self-check: a `demo()` that runs 3 FL rounds with 3 in-process simulated clients on non-IID synthetic data and prints the global loss decreasing — so you can eyeball convergence without the full app.

---

## 8. Files You Own

```
modules/fl-voice/
  src/
    fl/
      flClient.ts             # on-device: TFLite model, local training, FedProx term, delta+noise, POST /fl/submit
      fl_model.tflite          # the on-device model (toy or ETA — see §3.1.2)
      dpMasking.ts             # gradient clipping + DP noise
      flRoundLogger.ts         # logs local round state for the Privacy/FL status UI
    vox/
      voxClient.ts             # react-native-webrtc peer connections, /vox signaling, audio stream
      vad.ts                   # voice activity detection (WebRTC VAD or energy+noise-gate)
      PttButton.tsx            # manual push-to-talk fallback
    ui/
      VoxIndicator.tsx         # avatar ring highlight + mic toggle (auto/manual)
      FlStatusIndicator.tsx    # privacy text + FL round toast
      MusicWidget.tsx          # P2 — only if time permits
    index.ts                   # re-exports
  server/                      # Node.js — lives in modules/routing-eta/server/ (shared process)
    fl_proxy.js                 # FedOpt aggregation proxy, /fl/submit + /fl/global
    vox_signaling.js           # Socket.io /vox namespace server (SDP/ICE relay)
  README.md                    # FL model arch, FedProx mu, FedOpt config, DP params, VAD algo, WebRTC topology
  test/
    flVoice.test.ts            # DpMasking (clip, noise, encode), VAD (trigger, release)
contracts/
  fl_model_update.json
  vox_signal.json
```

In the app shell:
```
app/src/screens/map/overlays/
  VoxOverlay.tsx         # you register this with A's MapScreen
  FlStatusOverlay.tsx
```

---

## 9. Risks Specific to You

| Risk | Mitigation |
|---|---|
| TFLite on-device training is finicky / poorly documented | Budget extra time in Week 2. If TFLite training doesn't work, fall back to a PyTorch Mobile or a simple numpy-based local training (if the model is small enough to run in Dart/JS directly). The FL machinery (FedProx + aggregation) is the point; the specific ML runtime is swappable. |
| WebRTC mesh doesn't scale (but spec caps at 8) | Enforce the 8-rider cap. If testing shows >4 riders degrade, document it and cap lower for the demo. |
| VAD false-triggers on motorcycle noise | High-pass filter + noise gate + hold time (§3.2.3). Field-test in Week 3 and Week 5. If still bad, default to manual PTT and present VOX as "experimental." |
| FL doesn't visibly converge in the demo timeframe | Use a small model + synthetic non-IID data tuned to converge in 5–10 rounds. The demo needs to *show* rounds completing, not hit production accuracy. |
| No raw data leaving the device is hard to "prove" in a demo | Capture network traffic during the demo (or pre-record it) showing the `fl_model_update` payload contains only `masked_weights_delta`. Have the slide ready. |
| STUN-only fails for some NAT setups | Test with 2 phones on different networks in Week 3. If STUN fails, add a free TURN relay (e.g., Open Relay). Document this only if it comes up. |

---

## 10. Demo Script (Your Beat — §12 item 4)

1. **VOX:** 2+ riders on a live voice call. One rider speaks (no button press) → their avatar ring lights up (`voice_active=true`), others hear them. Stop speaking → ring fades, transmission mutes.
2. Switch to manual PTT mode → hold button to talk, release to mute. Show it works as a fallback.
3. **FL:** Show a log/slide of FL rounds completing — round_id, participant_count, global loss decreasing.
4. Show a network traffic capture (pre-recorded screenshot or live) of the `fl_model_update` POST body — point out it contains only `masked_weights_delta` (base64), `local_loss`, `sample_count`. No locations, no speeds, no ride traces.
5. Say one line: "Federated learning with FedProx — only masked model updates leave the device; raw ride data never does."

---

## 11. What to Skip (YAGNI)

- Secure aggregation (secret sharing). Gradient clipping + DP noise is enough for the privacy story. `# ponytail: clip+DP noise, secure aggregation if reviewer demands`
- Video. Audio-only WebRTC. Video is a bandwidth/CPU sink with no value for riders.
- ML-based VAD (RNN). WebRTC VAD or energy+noise-gate is enough.
- A production-grade FL model. A toy model proving the round-trip is the priority (Option C). Upgrade to ETA only if time permits.
- Spotify/Apple Music (P2). Cut unless everything else is done with time to spare.
- TURN server. STUN-only for MVP. Add TURN only if field testing shows NAT failures.
- SFU. Mesh is fine for ≤8. SFU is infrastructure you don't need.
- Custom WebRTC audio processing. Use the WebRTC stack's built-in echo cancellation + noise suppression.

---

*Questions about your contract or dependencies? Raise in the weekly sync, do not assume. This plan assumes the spec (WeRide_Project_Spec.md) is the source of truth.*