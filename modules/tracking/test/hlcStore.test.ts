/**
 * Tests for hlcStore: MMKV-backed HLC persistence.
 *
 * Isolation strategy:
 *   hlcStore owns a module-level lazy MMKV singleton (_mmkv).
 *   Before each test, _resetMmkvForTest() drops that singleton.
 *   The next loadHlc() / persistHlc() call constructs a new MMKV(),
 *   which the MMKV mock returns as a fresh in-memory store.
 *   We capture the constructed mock instance via MMKV.mock.instances[0].
 */

import { loadHlc, persistHlc, HLC_MMKV_KEY, _resetMmkvForTest } from '../src/hlcStore';
import { HLC } from '@hazard/hlc/hlc';
import { MMKV } from 'react-native-mmkv';

// jest.config.js maps 'react-native-mmkv' → __mocks__/mmkvMock.js
// The mock provides a functional in-memory MMKV class.


describe('hlcStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Drop the module-level singleton so the next call constructs a fresh mock instance.
    _resetMmkvForTest();
  });

  /** Returns the MMKV instance that hlcStore constructed on the last singleton init. */
  function getHlcMmkv() {
    // MMKV is the mocked constructor; its returned object is in mock.results.
    const results = (MMKV as jest.Mock).mock.results;
    if (results.length === 0) throw new Error('MMKV was never constructed');
    return results[results.length - 1].value as InstanceType<typeof MMKV> & { _store: Record<string, string>, set: jest.Mock };
  }



  // ── Test 1 ──────────────────────────────────────────────────────────────────
  describe('loadHlc', () => {
    it('returns HLC.fromState when a valid persisted state exists', () => {
      // Pre-populate: we need to prime the mock before hlcStore constructs its MMKV.
      // Strategy: mock the MMKV constructor to return an instance pre-seeded with state.
      const state = { physical: 1_700_000_000_000, counter: 7 };
      (MMKV as jest.Mock).mockImplementationOnce(() => {
        const store: Record<string, string> = {
          [HLC_MMKV_KEY]: JSON.stringify(state),
        };
        return {
          getString: jest.fn((key: string) => store[key]),
          set: jest.fn((key: string, val: string) => { store[key] = val; }),
          delete: jest.fn((key: string) => { delete store[key]; }),
          _store: store,
        };
      });

      const hlc = loadHlc();

      expect(hlc.physical).toBe(state.physical);
      expect(hlc.counter).toBe(state.counter);
    });

    it('returns HLC.fresh when no persisted state exists', () => {
      // Default mock: getString returns undefined (empty store).
      const before = Date.now();
      const hlc = loadHlc();
      const after = Date.now();

      const ts = hlc.now();
      expect(ts).toMatch(/^\d+:\d+$/);
      expect(hlc.physical).toBeGreaterThanOrEqual(before);
      expect(hlc.physical).toBeLessThanOrEqual(after + 10);
    });

    it('returns HLC.fresh when persisted state is corrupted JSON', () => {
      (MMKV as jest.Mock).mockImplementationOnce(() => {
        const store: Record<string, string> = { [HLC_MMKV_KEY]: 'not-valid-json' };
        return {
          getString: jest.fn((key: string) => store[key]),
          set: jest.fn(),
          delete: jest.fn(),
          _store: store,
        };
      });

      const hlc = loadHlc();
      // Should not throw; result is a valid fresh HLC
      expect(hlc.now()).toMatch(/^\d+:\d+$/);
    });
  });

  // ── Test 3 ──────────────────────────────────────────────────────────────────
  describe('persistHlc', () => {
    it('writes serialized HlcState to MMKV under tracking:hlc_state', () => {
      // loadHlc triggers singleton init → MMKV is constructed.
      const hlc = loadHlc();
      hlc.now(); // advance clock once

      const mmkv = getHlcMmkv();
      persistHlc(hlc);

      expect(mmkv.set).toHaveBeenCalledWith(
        HLC_MMKV_KEY,
        expect.stringContaining('"physical"')
      );

      // Verify the written JSON round-trips to the expected HlcState
      const setCall = (mmkv.set as jest.Mock).mock.calls.find(
        (c: string[]) => c[0] === HLC_MMKV_KEY
      );
      const written = JSON.parse(setCall[1]);
      expect(written).toEqual(hlc.toState());
    });

    it('uses the SAME singleton MMKV instance for both loadHlc and persistHlc', () => {
      // loadHlc constructs the singleton.
      const hlc = loadHlc();
      const mmkvAfterLoad = getHlcMmkv();

      // persistHlc must reuse the same instance, not create a new one.
      const constructorCallsBefore = (MMKV as jest.Mock).mock.instances.length;
      persistHlc(hlc);
      const constructorCallsAfter = (MMKV as jest.Mock).mock.instances.length;

      expect(constructorCallsAfter).toBe(constructorCallsBefore); // no new MMKV created

      // The set call should be on the same instance reference.
      expect(mmkvAfterLoad.set).toHaveBeenCalled();
    });
  });
});
