import { DpMasking } from '../src/fl/dpMasking';
import { Vad } from '../src/vox/vad';

describe('DpMasking', () => {
  test('clips to max L2 norm', () => {
    const m = new DpMasking({ maxNorm: 1.0, noiseStd: 0.0 }); // no noise for test
    const input = Float32Array.from([3.0, 4.0]); // L2 norm = 5
    const result = m.apply(input);
    const norm = Math.hypot(result[0], result[1]);
    expect(norm).toBeCloseTo(1.0, 1);
  });

  test('adds noise (output != input when noise > 0)', () => {
    const m = new DpMasking({ maxNorm: 100.0, noiseStd: 0.5 }); // no clipping, just noise
    const input = Float32Array.from([1.0, 1.0, 1.0]);
    const result = m.apply(input);
    expect(result[0] !== input[0] || result[1] !== input[1]).toBe(true);
  });

  test('encode/decode roundtrip', () => {
    const weights = Float32Array.from([1.5, -2.3, 0.001]);
    const encoded = DpMasking.encode(weights);
    const decoded = DpMasking.decode(encoded);
    expect(decoded.length).toBe(weights.length);
    expect(decoded[0]).toBeCloseTo(weights[0], 4);
  });
});

describe('VAD', () => {
  test('silent frame does not trigger', () => {
    const vad = new Vad({ threshold: 0.01, holdMs: 10 });
    const silent = new Float32Array(160); // zeros
    expect(vad.processFrame(silent)).toBe(false);
  });

  test('loud frame triggers after hold time', () => {
    const vad = new Vad({ threshold: 0.01, holdMs: 0 });
    const loud = Float32Array.from(Array(160).fill(0.5));
    vad.processFrame(loud);
    expect(vad.processFrame(loud)).toBe(true);
  });

  test('releases after silent period', () => {
    const vad = new Vad({ threshold: 0.01, holdMs: 0, releaseMs: 0 });
    const loud = Float32Array.from(Array(160).fill(0.5));
    const silent = new Float32Array(160);
    vad.processFrame(loud);
    vad.processFrame(loud);
    expect(vad.isSpeaking).toBe(true);
    vad.processFrame(silent);
    expect(vad.isSpeaking).toBe(false);
  });
});