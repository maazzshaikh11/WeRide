/**
 * On-device FL client.
 * - Trains a small model locally on ride data (MMKV box 'fl_data')
 * - Computes weight delta vs global weights
 * - Applies DP masking (clip + noise)
 * - POSTs fl_model_update to the aggregation server
 *
 * FedProx: loss = local_loss(w) + (mu/2) * ||w - w_global||^2
 *
 * Ported from fl_client.dart.
 *
 * TODO: wire to TFLite for actual model training. For now: stub the training step.
 */

import { DpMasking } from './dpMasking';

export interface FlClientParams {
  clientId: string;
  serverUrl: string;
  masking?: DpMasking;
  mu?: number; // FedProx proximal coefficient
}

export class FlClient {
  readonly clientId: string;
  readonly serverUrl: string;
  readonly masking: DpMasking;
  readonly mu: number;

  private _globalWeights?: Float32Array;
  private _round = 0;

  constructor(params: FlClientParams) {
    this.clientId = params.clientId;
    this.serverUrl = params.serverUrl;
    this.masking = params.masking ?? new DpMasking();
    this.mu = params.mu ?? 0.01;
  }

  /** Fetch current global weights from the server. */
  async fetchGlobal(): Promise<void> {
    const res = await fetch(`${this.serverUrl}/fl/global`);
    const data = await res.json();
    // _globalWeights = DpMasking.decode(data.weights);
    this._globalWeights = new Float32Array(data.weights?.length ?? 10);
  }

  /** Train locally for E epochs on MMKV 'fl_data'. Returns the masked weight delta. */
  async trainLocal(epochs: number): Promise<Float32Array> {
    if (!this._globalWeights) await this.fetchGlobal();
    // TODO: TFLite training loop with FedProx proximal term
    const delta = new Float32Array(this._globalWeights?.length ?? 10);
    return this.masking.apply(delta);
  }

  /** Submit the masked weight delta to the server. */
  async submit(maskedDelta: Float32Array, localLoss: number, sampleCount: number): Promise<void> {
    const payload = {
      client_id: this.clientId,
      round_id: this._round,
      masked_weights_delta: DpMasking.encode(maskedDelta),
      local_loss: localLoss,
      sample_count: sampleCount,
    };
    await fetch(`${this.serverUrl}/fl/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    this._round++;
  }

  /** Full round: fetch global → train → submit. */
  async runRound(epochs = 3): Promise<void> {
    await this.fetchGlobal();
    const masked = await this.trainLocal(epochs);
    await this.submit(masked, 0.0, 0);
  }
}