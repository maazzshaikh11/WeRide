/**
 * Voice Activity Detection.
 * Options:
 *   1. WebRTC built-in VAD (if the WebRTC lib exposes it) — preferred
 *   2. Energy-based + noise gate + high-pass filter — fallback
 * Ported from vad.dart.
 *
 * TODO: wire to actual audio frames from the WebRTC stream.
 */

export interface VadParams {
  threshold?: number; // RMS energy threshold
  holdMs?: number; // min time above threshold to trigger
  releaseMs?: number; // min time below threshold to release
  highPassHz?: number; // high-pass filter cutoff (85Hz cuts wind)
}

export class Vad {
  readonly threshold: number;
  readonly holdMs: number;
  readonly releaseMs: number;
  readonly highPassHz: number;

  private _speaking = false;
  private _aboveSince?: number;
  private _belowSince?: number;

  constructor(params: VadParams = {}) {
    this.threshold = params.threshold ?? 0.02;
    this.holdMs = params.holdMs ?? 100;
    this.releaseMs = params.releaseMs ?? 300;
    this.highPassHz = params.highPassHz ?? 85.0;
  }

  get isSpeaking(): boolean {
    return this._speaking;
  }

  /** Feed an audio frame (Float32Array samples). Returns current speaking state. */
  processFrame(samples: Float32Array): boolean {
    // 1. High-pass filter (simple one-pole) — cuts wind noise
    // TODO: implement actual filter
    // 2. RMS energy
    const rms = this._rms(samples);
    const now = Date.now();

    if (rms > this.threshold) {
      this._belowSince = undefined;
      this._aboveSince ??= now;
      if (!this._speaking && now - this._aboveSince >= this.holdMs) {
        this._speaking = true;
      }
    } else {
      this._aboveSince = undefined;
      this._belowSince ??= now;
      if (this._speaking && now - this._belowSince >= this.releaseMs) {
        this._speaking = false;
      }
    }
    return this._speaking;
  }

  private _rms(samples: Float32Array): number {
    if (samples.length === 0) return 0;
    let sum = 0;
    for (const s of samples) sum += s * s;
    return Math.sqrt(sum / samples.length);
  }
}