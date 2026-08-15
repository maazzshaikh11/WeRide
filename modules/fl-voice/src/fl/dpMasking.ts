/**
 * Gradient clipping + differential privacy noise.
 * Applied to weight deltas before sending to the server.
 * This is the ONLY thing that leaves the device for FL — no raw data.
 * Ported from dp_masking.dart.
 */

export interface DpMaskingParams {
  maxNorm?: number;
  noiseStd?: number;
}

export class DpMasking {
  maxNorm: number;
  noiseStd: number;

  constructor(params: DpMaskingParams = {}) {
    this.maxNorm = params.maxNorm ?? 1.0;
    this.noiseStd = params.noiseStd ?? 0.01;
  }

  /** Clip the weight delta to max L2 norm, then add Gaussian noise. */
  apply(weightsDelta: Float32Array): Float32Array {
    // 1. Clip
    const norm = this._l2Norm(weightsDelta);
    const scale = norm > this.maxNorm ? this.maxNorm / norm : 1.0;
    const clipped = new Float32Array(weightsDelta.length);
    for (let i = 0; i < weightsDelta.length; i++) {
      clipped[i] = weightsDelta[i] * scale;
    }
    // 2. Add Gaussian noise
    const result = new Float32Array(weightsDelta.length);
    for (let i = 0; i < result.length; i++) {
      result[i] = clipped[i] + this._gaussian(0, this.noiseStd);
    }
    return result;
  }

  private _l2Norm(v: Float32Array): number {
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
    return Math.sqrt(sum);
  }

  /** Box-Muller transform for Gaussian noise. */
  private _gaussian(mean: number, std: number): number {
    const u1 = Math.random() || 1e-10;
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + std * z;
  }

  /** Encode to base64 for the fl_model_update payload. */
  static encode(weights: Float32Array): string {
    return Buffer.from(weights.buffer).toString('base64');
  }

  /** Decode from base64. */
  static decode(b64: string): Float32Array {
    const bytes = Buffer.from(b64, 'base64');
    return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4);
  }
}