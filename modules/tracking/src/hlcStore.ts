/**
 * HLC persistence backed by MMKV.
 *
 * Owns the MMKV instance for the tracking module (id: 'tracking').
 * Does NOT touch B's 'sos_queue' or D's 'fl_data' instances.
 *
 * Public API:
 *   loadHlc()       — restore HLC from MMKV, or create fresh if absent/corrupt.
 *   persistHlc(hlc) — write current HLC state to MMKV.
 *
 * Caller integration (Phase 6):
 *   const hlc = loadHlc();
 *   const service = new TrackingService({ ..., hlc });
 *   // persistHlc is called internally by TrackingService on every tick.
 *
 * NOTE: No real TrackingService caller exists yet (only the test suite).
 * App-level wiring is deferred to Phase 6 integration.
 */

import { MMKV } from 'react-native-mmkv';
import { HLC, HlcState } from '@hazard/hlc/hlc';

export const HLC_MMKV_KEY = 'tracking:hlc_state';

/** Lazily-initialised singleton MMKV instance for the tracking module. */
let _mmkv: MMKV | null = null;

/** @internal Exposed only for test isolation — reset the singleton between tests. */
export function _resetMmkvForTest(): void {
  _mmkv = null;
}

function getMmkv(): MMKV {
  if (!_mmkv) {
    _mmkv = new MMKV({ id: 'tracking' });
  }
  return _mmkv;
}

/**
 * Load HLC from persisted MMKV state.
 * Returns HLC.fromState() if valid state exists, HLC.fresh() otherwise.
 */
export function loadHlc(): HLC {
  const raw = getMmkv().getString(HLC_MMKV_KEY);
  if (raw) {
    try {
      const state: HlcState = JSON.parse(raw);
      if (typeof state.physical === 'number' && typeof state.counter === 'number') {
        return HLC.fromState(state);
      }
    } catch {
      // Corrupted JSON — fall through to fresh
    }
  }
  return HLC.fresh();
}

/**
 * Persist current HLC state to MMKV.
 * Called by TrackingService on every tick, immediately after hlc.now().
 */
export function persistHlc(hlc: HLC): void {
  getMmkv().set(HLC_MMKV_KEY, JSON.stringify(hlc.toState()));
}
