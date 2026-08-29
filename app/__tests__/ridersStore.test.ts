/**
 * Tests for riderMarkerState helpers and ridersStore.
 *
 * Task 4.1 validation: isValidLocation, extractHlcPhysical,
 * getMarkerState, getMarkerStateForMissing, and ridersStore
 * subscribe/upsert/remove/clear/refreshStaleStates.
 */

jest.mock('@app/services/socketService', () => ({
  getLocationSocket: jest.fn(),
  disconnectSockets: jest.fn(),
}));

import { useRidersStore } from '@app/store/ridersStore';
import {
  isValidLocation,
  extractHlcPhysical,
  getMarkerState,
  getMarkerStateForMissing,
  markerColorForState,
} from '@app/screens/map/overlays/riderMarkerState';

// ---------------------------------------------------------------------------
// isValidLocation
// ---------------------------------------------------------------------------

describe('isValidLocation', () => {
  const validPayload = {
    rider_id: 'rider-1',
    group_id: 'group-1',
    timestamp_hlc: '1700000000000:0',
    lat: 37.7749,
    lng: -122.4194,
    speed_mps: 5.0,
    heading_deg: 90.0,
    spoof_flag: false,
    nis_score: 2.1,
    accuracy_m: 10.0,
  };

  test('accepts a valid payload', () => {
    expect(isValidLocation(validPayload)).toBe(true);
  });

  test('rejects null', () => {
    expect(isValidLocation(null)).toBe(false);
  });

  test('rejects undefined', () => {
    expect(isValidLocation(undefined)).toBe(false);
  });

  test('rejects a string', () => {
    expect(isValidLocation('not an object')).toBe(false);
  });

  test('rejects a number', () => {
    expect(isValidLocation(42)).toBe(false);
  });

  test('rejects missing rider_id', () => {
    const { rider_id, ...noId } = validPayload;
    expect(isValidLocation(noId)).toBe(false);
  });

  test('rejects empty rider_id', () => {
    expect(isValidLocation({ ...validPayload, rider_id: '' })).toBe(false);
  });

  test('rejects non-string rider_id', () => {
    expect(isValidLocation({ ...validPayload, rider_id: 123 })).toBe(false);
  });

  test('rejects missing group_id', () => {
    const { group_id, ...noGroup } = validPayload;
    expect(isValidLocation(noGroup)).toBe(false);
  });

  test('rejects missing lat', () => {
    const { lat, ...noLat } = validPayload;
    expect(isValidLocation(noLat)).toBe(false);
  });

  test('rejects NaN lat', () => {
    expect(isValidLocation({ ...validPayload, lat: NaN })).toBe(false);
  });

  test('rejects NaN lng', () => {
    expect(isValidLocation({ ...validPayload, lng: NaN })).toBe(false);
  });

  test('rejects missing spoof_flag', () => {
    const { spoof_flag, ...noSpoof } = validPayload;
    expect(isValidLocation(noSpoof)).toBe(false);
  });

  test('rejects non-boolean spoof_flag', () => {
    expect(isValidLocation({ ...validPayload, spoof_flag: 1 })).toBe(false);
  });

  test('rejects missing timestamp_hlc', () => {
    const { timestamp_hlc, ...noHlc } = validPayload;
    expect(isValidLocation(noHlc)).toBe(false);
  });

  test('rejects non-string timestamp_hlc', () => {
    expect(isValidLocation({ ...validPayload, timestamp_hlc: 1700000000000 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractHlcPhysical
// ---------------------------------------------------------------------------

describe('extractHlcPhysical', () => {
  test('extracts physical ms from valid HLC string', () => {
    expect(extractHlcPhysical('1700000000000:3')).toBe(1700000000000);
  });

  test('extracts physical ms with counter = 0', () => {
    expect(extractHlcPhysical('1700000000000:0')).toBe(1700000000000);
  });

  test('treats "0:0" as valid (zero is a legitimate non-negative integer)', () => {
    expect(extractHlcPhysical('0:0')).toBe(0);
  });

  test('returns null for empty string', () => {
    expect(extractHlcPhysical('')).toBeNull();
  });

  test('returns null for string without colon (missing counter)', () => {
    expect(extractHlcPhysical('1700000000000')).toBeNull();
  });

  test('returns null for string starting with colon (empty physical)', () => {
    expect(extractHlcPhysical(':3')).toBeNull();
  });

  test('returns null for non-numeric physical part', () => {
    expect(extractHlcPhysical('abc:3')).toBeNull();
  });

  test('returns null for non-numeric counter', () => {
    expect(extractHlcPhysical('1700000000000:abc')).toBeNull();
  });

  test('returns null for extra colon (extra components)', () => {
    expect(extractHlcPhysical('1700000000000:1:garbage')).toBeNull();
  });

  test('returns null for negative physical', () => {
    expect(extractHlcPhysical('-1:0')).toBeNull();
  });

  test('returns null for negative counter', () => {
    expect(extractHlcPhysical('1700000000000:-1')).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(extractHlcPhysical(undefined as any)).toBeNull();
  });

  test('returns null for null input', () => {
    expect(extractHlcPhysical(null as any)).toBeNull();
  });

  test('returns null for non-string input (number)', () => {
    expect(extractHlcPhysical(12345 as any)).toBeNull();
  });

  test('returns null for whitespace-padded input (must be exact, not trimmed)', () => {
    expect(extractHlcPhysical(' 1700000000000:0')).toBeNull();
    expect(extractHlcPhysical('1700000000000:0 ')).toBeNull();
    expect(extractHlcPhysical('1700000000000 :0')).toBeNull();
    expect(extractHlcPhysical('1700000000000: 0')).toBeNull();
  });

  test('handles large timestamps', () => {
    expect(extractHlcPhysical('9999999999999:99')).toBe(9999999999999);
  });
});

// ---------------------------------------------------------------------------
// getMarkerState
// ---------------------------------------------------------------------------

describe('getMarkerState', () => {
  const NOW = 1700000000000;

  test('GREEN for fresh verified rider', () => {
    expect(getMarkerState(false, `${NOW}:0`, NOW)).toBe('GREEN');
  });

  test('GREEN for rider 5 seconds ago', () => {
    expect(getMarkerState(false, `${NOW - 5000}:0`, NOW)).toBe('GREEN');
  });

  test('GREEN for rider exactly 10 seconds ago (boundary)', () => {
    // age === 10000 is NOT > 10000, so it's GREEN
    expect(getMarkerState(false, `${NOW - 10000}:0`, NOW)).toBe('GREEN');
  });

  test('GREY for stale rider (>10s ago)', () => {
    expect(getMarkerState(false, `${NOW - 10001}:0`, NOW)).toBe('GREY');
  });

  test('GREY for rider 30 seconds ago', () => {
    expect(getMarkerState(false, `${NOW - 30000}:0`, NOW)).toBe('GREY');
  });

  test('RED for spoofed rider regardless of freshness (fresh)', () => {
    expect(getMarkerState(true, `${NOW}:0`, NOW)).toBe('RED');
  });

  test('RED for spoofed rider even when stale', () => {
    expect(getMarkerState(true, `${NOW - 30000}:0`, NOW)).toBe('RED');
  });

  test('precedence: spoof_flag=true beats stale', () => {
    expect(getMarkerState(true, `${NOW - 60000}:0`, NOW)).toBe('RED');
  });

  test('GREY for malformed HLC string', () => {
    expect(getMarkerState(false, 'not-a-valid-hlc', NOW)).toBe('GREY');
  });

  test('GREY for empty HLC string', () => {
    expect(getMarkerState(false, '', NOW)).toBe('GREY');
  });

  test('GREY for HLC without colon', () => {
    expect(getMarkerState(false, '1700000000000', NOW)).toBe('GREY');
  });

  test('GREEN for future-dated HLC (negative age)', () => {
    expect(getMarkerState(false, `${NOW + 5000}:0`, NOW)).toBe('GREEN');
  });

  test('GREY for HLC with non-numeric physical', () => {
    expect(getMarkerState(false, 'abc:0', NOW)).toBe('GREY');
  });
});

// ---------------------------------------------------------------------------
// getMarkerStateForMissing
// ---------------------------------------------------------------------------

describe('getMarkerStateForMissing', () => {
  test('always returns GREY', () => {
    expect(getMarkerStateForMissing()).toBe('GREY');
  });
});

// ---------------------------------------------------------------------------
// markerColorForState
// ---------------------------------------------------------------------------

describe('markerColorForState', () => {
  test('GREEN returns riderVerified color', () => {
    expect(markerColorForState('GREEN')).toBe('#2D6A4F');
  });

  test('RED returns riderFlagged color', () => {
    expect(markerColorForState('RED')).toBe('#E63946');
  });

  test('GREY returns riderStale color', () => {
    expect(markerColorForState('GREY')).toBe('#9AA0A6');
  });
});

// ---------------------------------------------------------------------------
// ridersStore
// ---------------------------------------------------------------------------

describe('ridersStore', () => {
  const makePayload = (overrides: Record<string, any> = {}) => ({
    rider_id: 'rider-1',
    group_id: 'group-1',
    timestamp_hlc: `${Date.now()}:0`,
    lat: 37.7749,
    lng: -122.4194,
    speed_mps: 5.0,
    heading_deg: 90.0,
    spoof_flag: false,
    nis_score: 2.1,
    accuracy_m: 10.0,
    ...overrides,
  });

  beforeEach(() => {
    useRidersStore.getState().clear();
    useRidersStore.setState({ connected: false, subscribed: false });
  });

  describe('upsertRider', () => {
    test('adds a valid rider to the store', () => {
      const payload = makePayload();
      useRidersStore.getState().upsertRider(payload);

      const riders = useRidersStore.getState().riders;
      expect(riders.size).toBe(1);
      expect(riders.has('rider-1')).toBe(true);

      const entry = riders.get('rider-1')!;
      expect(entry.location.rider_id).toBe('rider-1');
      expect(entry.location.lat).toBe(37.7749);
      expect(entry.markerState).toBe('GREEN');
      expect(typeof entry.receivedAt).toBe('number');
    });

    test('updates an existing rider (no duplication)', () => {
      const payload1 = makePayload({ lat: 37.0 });
      const payload2 = makePayload({ lat: 38.0 });

      useRidersStore.getState().upsertRider(payload1);
      useRidersStore.getState().upsertRider(payload2);

      const riders = useRidersStore.getState().riders;
      expect(riders.size).toBe(1);
      expect(riders.get('rider-1')!.location.lat).toBe(38.0);
    });

    test('adds multiple distinct riders', () => {
      useRidersStore.getState().upsertRider(makePayload({ rider_id: 'rider-a' }));
      useRidersStore.getState().upsertRider(makePayload({ rider_id: 'rider-b' }));
      useRidersStore.getState().upsertRider(makePayload({ rider_id: 'rider-c' }));

      expect(useRidersStore.getState().riders.size).toBe(3);
    });

    test('updating rider A does not remove rider B', () => {
      useRidersStore.getState().upsertRider(makePayload({ rider_id: 'rider-a', lat: 37.0 }));
      useRidersStore.getState().upsertRider(makePayload({ rider_id: 'rider-b', lat: 38.0 }));

      useRidersStore.getState().upsertRider(makePayload({ rider_id: 'rider-a', lat: 37.5 }));

      const riders = useRidersStore.getState().riders;
      expect(riders.size).toBe(2);
      expect(riders.get('rider-a')!.location.lat).toBe(37.5);
      expect(riders.get('rider-b')!.location.lat).toBe(38.0);
    });

    test('spoof_flag=true → markerState RED regardless of freshness', () => {
      const payload = makePayload({ spoof_flag: true });
      useRidersStore.getState().upsertRider(payload);

      const entry = useRidersStore.getState().riders.get('rider-1')!;
      expect(entry.markerState).toBe('RED');
    });

    test('rejects malformed payload (missing rider_id)', () => {
      const bad = makePayload();
      delete (bad as any).rider_id;

      useRidersStore.getState().upsertRider(bad);
      expect(useRidersStore.getState().riders.size).toBe(0);
    });

    test('rejects malformed payload (NaN lat)', () => {
      useRidersStore.getState().upsertRider(makePayload({ lat: NaN }));
      expect(useRidersStore.getState().riders.size).toBe(0);
    });

    test('rejects malformed payload (spoof_flag missing)', () => {
      const bad = makePayload();
      delete (bad as any).spoof_flag;
      useRidersStore.getState().upsertRider(bad);
      expect(useRidersStore.getState().riders.size).toBe(0);
    });

    test('rejects malformed payload (spoof_flag as number)', () => {
      useRidersStore.getState().upsertRider(makePayload({ spoof_flag: 1 }));
      expect(useRidersStore.getState().riders.size).toBe(0);
    });

    test('empty timestamp_hlc passes validation but produces GREY markerState', () => {
      useRidersStore.getState().upsertRider(makePayload({ timestamp_hlc: '' }));
      const riders = useRidersStore.getState().riders;
      expect(riders.size).toBe(1);
      expect(riders.get('rider-1')!.markerState).toBe('GREY');
    });

    test('rejects null payload', () => {
      useRidersStore.getState().upsertRider(null);
      expect(useRidersStore.getState().riders.size).toBe(0);
    });

    test('rejects undefined payload', () => {
      useRidersStore.getState().upsertRider(undefined);
      expect(useRidersStore.getState().riders.size).toBe(0);
    });

    test('rejects string payload', () => {
      useRidersStore.getState().upsertRider('not an object');
      expect(useRidersStore.getState().riders.size).toBe(0);
    });

    test('rejected payload does not mutate existing valid state', () => {
      const good = makePayload({ lat: 37.0 });
      useRidersStore.getState().upsertRider(good);

      const bad = makePayload();
      delete (bad as any).lat;

      useRidersStore.getState().upsertRider(bad);

      const entry = useRidersStore.getState().riders.get('rider-1')!;
      expect(entry.location.lat).toBe(37.0);
    });
  });

  describe('removeRider', () => {
    test('removes a rider from the store', () => {
      useRidersStore.getState().upsertRider(makePayload({ rider_id: 'rider-1' }));
      expect(useRidersStore.getState().riders.size).toBe(1);

      useRidersStore.getState().removeRider('rider-1');
      expect(useRidersStore.getState().riders.size).toBe(0);
    });

    test('removing a non-existent rider does nothing', () => {
      useRidersStore.getState().upsertRider(makePayload({ rider_id: 'rider-1' }));
      useRidersStore.getState().removeRider('rider-999');
      expect(useRidersStore.getState().riders.size).toBe(1);
    });
  });

  describe('clear', () => {
    test('empties the store', () => {
      useRidersStore.getState().upsertRider(makePayload({ rider_id: 'rider-a' }));
      useRidersStore.getState().upsertRider(makePayload({ rider_id: 'rider-b' }));
      expect(useRidersStore.getState().riders.size).toBe(2);

      useRidersStore.getState().clear();
      expect(useRidersStore.getState().riders.size).toBe(0);
    });
  });

  describe('refreshStaleStates', () => {
    test('spoofed rider stays RED even when stale', () => {
      const OLD_HLC = `${Date.now() - 60000}:0`;
      useRidersStore.getState().upsertRider(
        makePayload({ timestamp_hlc: OLD_HLC, spoof_flag: true }),
      );

      const entry = useRidersStore.getState().riders.get('rider-1')!;
      expect(entry.markerState).toBe('RED');
    });

    test('multiple riders evaluated independently', () => {
      const NOW = Date.now();
      useRidersStore.getState().upsertRider(
        makePayload({ rider_id: 'fresh', timestamp_hlc: `${NOW}:0`, spoof_flag: false }),
      );
      useRidersStore.getState().upsertRider(
        makePayload({ rider_id: 'stale', timestamp_hlc: `${NOW - 20000}:0`, spoof_flag: false }),
      );
      useRidersStore.getState().upsertRider(
        makePayload({ rider_id: 'spoofed', timestamp_hlc: `${NOW}:0`, spoof_flag: true }),
      );

      const riders = useRidersStore.getState().riders;
      expect(riders.get('fresh')!.markerState).toBe('GREEN');
      expect(riders.get('stale')!.markerState).toBe('GREY');
      expect(riders.get('spoofed')!.markerState).toBe('RED');
    });
  });

  describe('subscribe / unsubscribe', () => {
    test('subscribe sets subscribed to true', () => {
      const { getLocationSocket } = require('@app/services/socketService');
      (getLocationSocket as jest.Mock).mockReturnValue({
        on: jest.fn(),
        off: jest.fn(),
        connected: true,
      });

      useRidersStore.getState().subscribe('test-group');
      expect(useRidersStore.getState().subscribed).toBe(true);

      useRidersStore.getState().unsubscribe();
      expect(useRidersStore.getState().subscribed).toBe(false);
    });

    test('subscribe is idempotent', () => {
      const { getLocationSocket } = require('@app/services/socketService');
      (getLocationSocket as jest.Mock).mockReturnValue({
        on: jest.fn(),
        off: jest.fn(),
        connected: true,
      });

      useRidersStore.getState().subscribe('test-group');
      useRidersStore.getState().subscribe('test-group');
      expect(useRidersStore.getState().subscribed).toBe(true);

      useRidersStore.getState().unsubscribe();
    });

    test('unsubscribe when not subscribed does nothing', () => {
      useRidersStore.getState().unsubscribe();
    });
  });

  // ---------------------------------------------------------------------------
  // selectRider (Task 4.4 — info card state)
  // ---------------------------------------------------------------------------

  describe('selectRider', () => {
    test('selectRider sets selectedRiderId', () => {
      useRidersStore.getState().selectRider('rider-1');
      expect(useRidersStore.getState().selectedRiderId).toBe('rider-1');
    });

    test('selectRider(null) clears selectedRiderId', () => {
      useRidersStore.getState().selectRider('rider-1');
      useRidersStore.getState().selectRider(null);
      expect(useRidersStore.getState().selectedRiderId).toBeNull();
    });

    test('selected rider removed from store clears selectedRiderId', () => {
      const NOW = Date.now();
      useRidersStore.getState().upsertRider(
        makePayload({ rider_id: 'rider-1', timestamp_hlc: `${NOW}:0` }),
      );
      useRidersStore.getState().selectRider('rider-1');
      expect(useRidersStore.getState().selectedRiderId).toBe('rider-1');

      // Remove rider — the effect in RiderMarkerOverlay clears selectedRiderId
      useRidersStore.getState().removeRider('rider-1');
      // Verify the rider is gone
      expect(useRidersStore.getState().riders.has('rider-1')).toBe(false);
    });
  });
});