/**
 * EKF state persistence backed by MMKV.
 *
 * Owns the MMKV instance for the tracking module (id: 'tracking'),
 * shared with hlcStore.ts.
 *
 * Public API:
 *   loadEkfState()    — restore EKF state from MMKV, or null if absent/corrupt.
 *   persistEkf(ekf)   — write current EKF state to MMKV.
 */

import { MMKV } from 'react-native-mmkv';
import { Ekf, EkfState } from './ekf';

export const EKF_MMKV_KEY = 'tracking:ekf_state';

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
 * Load EKF state from persisted MMKV storage.
 * Returns EkfState if valid, or null.
 */
export function loadEkfState(): EkfState | null {
  const raw = getMmkv().getString(EKF_MMKV_KEY);
  if (raw) {
    try {
      const state: EkfState = JSON.parse(raw);
      if (
        typeof state.lat === 'number' &&
        typeof state.lng === 'number' &&
        typeof state.speed === 'number' &&
        typeof state.heading === 'number' &&
        Array.isArray(state.p) && state.p.length === 16 &&
        typeof state.spoofFlag === 'boolean' &&
        typeof state.nisScore === 'number'
      ) {
        return state;
      }
    } catch {
      // Corrupted JSON — return null
    }
  }
  return null;
}

/**
 * Persist current EKF state to MMKV.
 * Called by TrackingService on every tick.
 */
export function persistEkf(ekf: Ekf): void {
  getMmkv().set(EKF_MMKV_KEY, JSON.stringify(ekf.toState()));
}
