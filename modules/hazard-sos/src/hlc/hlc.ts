import type { MMKV } from 'react-native-mmkv';

export interface HlcState {
  physical: number;
  counter: number;
}

export type NowFn = () => number;

// We cannot instantiate MMKV at module load time due to ts-jest mocking bugs.
// The require() is deferred to call-time so Jest's jest.mock() runs first.
let _storage: MMKV | null = null;
function getStorage(): MMKV | null {
  if (!_storage) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { MMKV: MMKVClass } = require('react-native-mmkv') as { MMKV: new (cfg: { id: string }) => MMKV };
      _storage = new MMKVClass({ id: 'hlc' });
    } catch {
      // A caller can still use an in-memory clock while native storage starts.
      // SOS persistence itself remains fail-closed in the OR-Set layer.
      return null;
    }
  }
  return _storage;
}

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
    const saved = getStorage()?.getString('hlc_state');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as HlcState;
        if (typeof parsed.physical === 'number' && typeof parsed.counter === 'number') {
          return new HLC(parsed, n);
        }
      } catch {
        // Fallback if parsing fails
      }
    }

    const newState = { physical: n(), counter: 0 };
    getStorage()?.set('hlc_state', JSON.stringify(newState));
    return new HLC(newState, n);
  }

  now(): string {
    const pt = this._now();
    if (pt > this._physical) {
      this._physical = pt;
      this._counter = 0;
    } else {
      this._counter++;
    }
    this.persist();
    return this.toString();
  }

  receive(remote: string): string {
    const remoteHlc = HLC.parse(remote);
    const pt = this._now();

    const previousPhysical = this._physical;
    const previousCounter = this._counter;
    this._physical = Math.max(previousPhysical, remoteHlc.physical, pt);

    // Kulkarni HLC merge: when wall-clock time wins, the logical component
    // resets. Otherwise increment the clock(s) that contributed the maximum.
    if (this._physical === previousPhysical && this._physical === remoteHlc.physical) {
      this._counter = Math.max(previousCounter, remoteHlc.counter) + 1;
    } else if (this._physical === previousPhysical) {
      this._counter = previousCounter + 1;
    } else if (this._physical === remoteHlc.physical) {
      this._counter = remoteHlc.counter + 1;
    } else {
      this._counter = 0;
    }

    this.persist();
    return this.toString();
  }

  toString(): string {
    return `${this._physical}-${this._counter}`;
  }

  static parse(s: string): HlcState {
    const match = /^(\d+)[-:](\d+)$/.exec(s);
    if (!match) {
      throw new Error('Invalid HLC format');
    }

    const physical = Number(match[1]);
    const counter = Number(match[2]);

    return { physical, counter };
  }

  static compare(a: string, b: string): number {
    const ha = HLC.parse(a);
    const hb = HLC.parse(b);

    if (ha.physical !== hb.physical) {
      return ha.physical < hb.physical ? -1 : 1;
    }
    if (ha.counter !== hb.counter) {
      return ha.counter < hb.counter ? -1 : 1;
    }
    return 0;
  }

  get physical(): number {
    return this._physical;
  }

  get counter(): number {
    return this._counter;
  }

  toState(): HlcState {
    return { physical: this._physical, counter: this._counter };
  }

  static fromState(state: HlcState, now?: NowFn): HLC {
    return new HLC(state, now);
  }

  private persist() {
    getStorage()?.set('hlc_state', JSON.stringify({
      physical: this._physical,
      counter: this._counter
    }));
  }

  static _resetStorage() {
    getStorage()?.remove('hlc_state');
  }
}
