/**
 * HLC persistence backed by MMKV.
 *
 * The HLC is a device-wide singleton clock owned by the hazard-sos module
 * (see @hazard/hlc/hlc). This store shares that exact MMKV location —
 * HLC_STORAGE_ID / HLC_STORAGE_KEY — so tracking, hazard and SOS all read
 * and advance the SAME clock. There is exactly one persisted HLC; the old
 * per-module 'tracking' MMKV id / 'tracking:hlc_state' key are gone.
 *
 * Public API:
 *   loadHlc()       — restore HLC from MMKV, or create fresh if absent/corrupt.
 *   persistHlc(hlc) — write current HLC state to MMKV.
 *
 * Caller integration:
 *   const hlc = loadHlc();
 *   const service = new TrackingService({ ..., hlc });
 *   // persistHlc is called internally by TrackingService on every tick.
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore unresolved when compiled from app context (deps live in module node_modules)
import { MMKV } from 'react-native-mmkv';
import { HLC, HlcState, HLC_STORAGE_ID, HLC_STORAGE_KEY } from '@hazard/hlc/hlc';

/** Kept for backward compatibility; equals HLC_STORAGE_KEY. */
export const HLC_MMKV_KEY = HLC_STORAGE_KEY;

/** Lazily-initialised singleton MMKV instance for the shared HLC clock. */
let _mmkv: MMKV | null = null;

/** @internal Exposed only for test isolation — reset the singleton between tests. */
export function _resetMmkvForTest(): void {
  _mmkv = null;
}

function getMmkv(): MMKV {
  if (!_mmkv) {
    _mmkv = new MMKV({ id: HLC_STORAGE_ID });
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
