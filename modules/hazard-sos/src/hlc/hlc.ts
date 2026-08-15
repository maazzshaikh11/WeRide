/**
 * Hybrid Logical Clock (Kulkarni et al.).
 * Shared utility — A, C, D all import this to timestamp their events.
 * Ported from hlc.dart.
 *
 * Tuple: (physical_ms, counter). Persisted on every update.
 * App restart must NOT reset the clock (breaks causal ordering).
 */

export interface HlcState {
  physical: number;
  counter: number;
}

export type NowFn = () => number;

export class HLC {
  private _physical: number;
  private _counter: number;
  private _now: NowFn;

  constructor(state: HlcState, now?: NowFn) {
    this._physical = state.physical;
    this._counter = state.counter;
    this._now = now ?? (() => Date.now());
  }

  static fresh(now?: NowFn): HLC {
    const n = now ?? (() => Date.now());
    return new HLC({ physical: n(), counter: 0 }, n);
  }

  /** Local event / send. Returns string form. */
  now(): string {
    const pt = this._now();
    if (pt > this._physical) {
      this._physical = pt;
      this._counter = 0;
    } else {
      this._counter = this._counter + 1;
    }
    return this.toString();
  }

  /** Receive a remote HLC. Merge and return new string form. */
  receive(remote: string): string {
    const r = HLC.parse(remote);
    const pt = this._now();
    this._physical = Math.max(this._physical, r.physical, pt);
    if (this._physical === r.physical && this._physical === pt) {
      this._counter = Math.max(this._counter, r.counter) + 1;
    } else if (this._physical === r.physical) {
      this._counter = (this._counter > r.counter ? this._counter : r.counter) + 1;
    } else if (this._physical === pt) {
      this._counter = this._counter + 1;
    } else {
      this._counter = 0;
    }
    return this.toString();
  }

  toString(): string {
    return `${this._physical}:${this._counter}`;
  }

  get physical(): number {
    return this._physical;
  }

  get counter(): number {
    return this._counter;
  }

  /** For persistence (MMKV). */
  toState(): HlcState {
    return { physical: this._physical, counter: this._counter };
  }

  static fromState(state: HlcState, now?: NowFn): HLC {
    return new HLC(state, now);
  }

  private static parse(s: string): HlcState {
    const parts = s.split(':');
    return { physical: parseInt(parts[0], 10), counter: parseInt(parts[1], 10) };
  }

  /** Ordering: -1 if a < b, 0 if equal, 1 if a > b */
  static compare(a: string, b: string): number {
    const pa = HLC.parse(a);
    const pb = HLC.parse(b);
    if (pa.physical !== pb.physical) return pa.physical < pb.physical ? -1 : 1;
    if (pa.counter !== pb.counter) return pa.counter < pb.counter ? -1 : 1;
    return 0;
  }
}