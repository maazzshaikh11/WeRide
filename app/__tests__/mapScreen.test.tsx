/**
 * Phase 6 — MapScreen TrackingService lifecycle tests.
 *
 * Verified behaviours:
 *  6.1  TrackingService.start() called on mount when groupId + userId are valid.
 *  6.1  TrackingService.stop() called on unmount (cleanup).
 *  6.1  No start when userId is null.
 *  6.1  No start when userId is empty string.
 *  6.2  loadHlc() is invoked (HLC persistence path) — NOT a raw HLC.fresh() call.
 *  6.2  The HLC instance returned by loadHlc() is passed to TrackingService constructor.
 *  6.1  groupId and userId are threaded correctly to LocationPublisher.
 *  6.1  getLocationSocket() called for the socket.
 *  6.1  No stop called when service was never started.
 *
 * Approach: mock the entire @tracking/* surface so no native module leaks in.
 * appStore is also mocked so ts-jest never traverses its file (which contains a
 * glob pattern in a comment that trips ts-jest diagnostics).
 */

// ---- module-level mocks (must be before any import that uses them) -----------

// Internal state tracked by the appStore mock.
let _mockUserId: string | null = null;
let _mockGroupId: string | null = null;

jest.mock('@app/store/appStore', () => ({
  useAppStore: {
    getState: jest.fn(() => ({ userId: _mockUserId, groupId: _mockGroupId })),
    setState: jest.fn((partial: { userId?: string | null; groupId?: string | null }) => {
      if ('userId' in partial) _mockUserId = partial.userId ?? null;
      if ('groupId' in partial) _mockGroupId = partial.groupId ?? null;
    }),
  },
}));

jest.mock('@tracking/ekf', () => ({
  Ekf: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@tracking/sensorStream', () => ({
  SensorStream: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@tracking/locationPublisher', () => ({
  LocationPublisher: jest.fn().mockImplementation(() => ({})),
}));

const mockStart = jest.fn().mockResolvedValue(true);
const mockStop  = jest.fn().mockResolvedValue(undefined);
const MockTrackingService = jest.fn().mockImplementation(() => ({
  start: mockStart,
  stop:  mockStop,
}));

jest.mock('@tracking/trackingService', () => ({
  TrackingService: MockTrackingService,
}));

const mockLoadHlc = jest.fn().mockReturnValue({ now: jest.fn().mockReturnValue('0:0') });
jest.mock('@tracking/hlcStore', () => ({
  loadHlc: mockLoadHlc,
}));

const mockGetLocationSocket = jest.fn().mockReturnValue({
  on:         jest.fn(),
  off:        jest.fn(),
  emit:       jest.fn(),
  connected:  true,
});
jest.mock('@app/services/socketService', () => ({
  getLocationSocket: mockGetLocationSocket,
}));

// Ensure setAccessToken is available in the @rnmapbox/maps mock (jest.setup.js only
// stubs the component names; setAccessToken is called at module level in MapScreen).
jest.mock('@rnmapbox/maps', () => ({
  default: {
    setAccessToken: jest.fn(),
    MapView: 'MapView',
    Camera: 'Camera',
    ShapeSource: 'ShapeSource',
    CircleLayer: 'CircleLayer',
    LineLayer: 'LineLayer',
    SymbolLayer: 'SymbolLayer',
  },
  setAccessToken: jest.fn(),
  MapView: 'MapView',
  Camera: 'Camera',
  ShapeSource: 'ShapeSource',
  CircleLayer: 'CircleLayer',
}));

// Stub out overlay components so we don't need to resolve their imports.
jest.mock('../src/screens/map/overlays/RiderMarkerOverlay', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View', null),
    RiderInfoCard: () => React.createElement('View', null),
  };
});
jest.mock('../src/screens/map/overlays/HazardOverlay',   () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/map/overlays/SosOverlay',      () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/map/overlays/RouteOverlay',    () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/map/overlays/VoxOverlay',      () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/map/overlays/FlStatusOverlay', () => ({ __esModule: true, default: () => null }));

// ---- imports ----------------------------------------------------------------

import React from 'react';
import { act, create } from 'react-test-renderer';

// Import AFTER mocks are registered.
import MapScreen from '../src/screens/map/MapScreen';

// ---------------------------------------------------------------------------

describe('MapScreen — Phase 6 TrackingService lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock appStore state.
    _mockUserId  = null;
    _mockGroupId = null;
    // Restore the getState implementation after clearAllMocks.
    const { useAppStore } = require('@app/store/appStore');
    useAppStore.getState.mockImplementation(() => ({ userId: _mockUserId, groupId: _mockGroupId }));
  });

  /** Sets userId + groupId in the mock store and renders MapScreen. */
  function renderWithUser(userId: string | null, groupId = 'group-1') {
    _mockUserId  = userId;
    _mockGroupId = groupId;
    const { useAppStore } = require('@app/store/appStore');
    useAppStore.getState.mockImplementation(() => ({ userId: _mockUserId, groupId: _mockGroupId }));

    let renderer: any;
    act(() => {
      renderer = create(
        <MapScreen route={{ params: { groupId } }} />,
      );
    });
    return renderer;
  }

  // ---------------------------------------------------------------------------
  // 6.1 — start on mount
  // ---------------------------------------------------------------------------

  test('6.1 — TrackingService is constructed and started on mount when userId and groupId are valid', () => {
    renderWithUser('user-abc');
    expect(MockTrackingService).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 6.1 — stop on unmount
  // ---------------------------------------------------------------------------

  test('6.1 — TrackingService.stop() is called when MapScreen unmounts', () => {
    const renderer = renderWithUser('user-abc');
    expect(mockStart).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.unmount();
    });

    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 6.1 — null userId guard
  // ---------------------------------------------------------------------------

  test('6.1 — TrackingService is NOT started when userId is null', () => {
    renderWithUser(null);
    expect(MockTrackingService).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 6.1 — empty string userId guard
  // ---------------------------------------------------------------------------

  test('6.1 — TrackingService is NOT started when userId is empty string', () => {
    renderWithUser('');
    expect(MockTrackingService).not.toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 6.2 — loadHlc() is the HLC source (not raw HLC.fresh())
  // ---------------------------------------------------------------------------

  test('6.2 — loadHlc() is called exactly once to obtain the HLC instance', () => {
    renderWithUser('user-abc');
    expect(mockLoadHlc).toHaveBeenCalledTimes(1);
  });

  test('6.2 — the HLC instance returned by loadHlc() is passed to TrackingService constructor', () => {
    const fakeHlc = { now: jest.fn().mockReturnValue('999:0') };
    mockLoadHlc.mockReturnValueOnce(fakeHlc);

    renderWithUser('user-abc');

    const ctorCall = MockTrackingService.mock.calls[0][0];
    expect(ctorCall.hlc).toBe(fakeHlc);
  });

  // ---------------------------------------------------------------------------
  // 6.1 — groupId + userId threaded through to LocationPublisher
  // ---------------------------------------------------------------------------

  test('6.1 — LocationPublisher receives correct riderId (userId) and groupId', () => {
    const { LocationPublisher } = require('@tracking/locationPublisher');
    renderWithUser('user-xyz', 'group-456');

    const publisherCtorArg = LocationPublisher.mock.calls[0][0];
    expect(publisherCtorArg.riderId).toBe('user-xyz');
    expect(publisherCtorArg.groupId).toBe('group-456');
  });

  // ---------------------------------------------------------------------------
  // 6.1 — Socket obtained via getLocationSocket()
  // ---------------------------------------------------------------------------

  test('6.1 — getLocationSocket() is called to obtain the socket for LocationPublisher', () => {
    renderWithUser('user-abc');
    expect(mockGetLocationSocket).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 6.1 — no stop called if service was never started
  // ---------------------------------------------------------------------------

  test('6.1 — stop is NOT called on unmount when userId was null (no service created)', () => {
    const renderer = renderWithUser(null);
    act(() => { renderer.unmount(); });
    expect(mockStop).not.toHaveBeenCalled();
  });
});
