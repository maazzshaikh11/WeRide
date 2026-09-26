/**
 * MapScreen TrackingService lifecycle tests (Phase 6, updated for master-spec redesign).
 *
 * MapScreen now reads groupId/userId from useAppStore hooks and renders the
 * redesigned floating UI (header, FABs, bottom sheet, SOS modal).
 *
 * Verified behaviours:
 *  6.1  TrackingService.start() called on mount when groupId + userId are valid.
 *  6.1  TrackingService.stop() called on unmount (cleanup).
 *  6.1  No start when userId is null / empty string.
 *  6.2  loadHlc() is invoked (HLC persistence path) and passed to TrackingService.
 *  6.1  groupId and userId threaded correctly to LocationPublisher.
 *  6.1  getLocationSocket() called for the socket.
 *  6.1  No stop called when service was never started.
 *
 * Approach: mock the entire @tracking/* surface + new UI components so no
 * native module leaks in. appStore is mocked statefully (babel-jest forbids
 * out-of-scope variables in jest.mock factories).
 */

// ---- module-level mocks (must be before any import that uses them) -----------

// Stateful appStore mock: callable zustand hook shape + getState/setState.
jest.mock('@app/store/appStore', () => {
  let _userId: string | null = null;
  let _groupId: string | null = null;
  const state = () => ({
    userId: _userId,
    groupId: _groupId,
    familySharingEnabled: false,
    socketConnected: false,
    currentTab: 'Home',
    setUserId: (id: string | null) => { _userId = id; },
    setGroupId: (id: string | null) => { _groupId = id; },
    setFamilySharingEnabled: () => undefined,
    setSocketConnected: () => undefined,
    setCurrentTab: () => undefined,
  });
  const useAppStore: any = (selector?: (s: unknown) => unknown) =>
    selector ? selector(state()) : state();
  useAppStore.getState = () => state();
  useAppStore.setState = (partial: Record<string, unknown>) => {
    if ('userId' in partial) _userId = partial.userId as string | null;
    if ('groupId' in partial) _groupId = partial.groupId as string | null;
  };
  useAppStore.getInitialState = () => state();
  return { useAppStore };
});

jest.mock('@tracking/ekf', () => ({
  Ekf: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@tracking/sensorStream', () => ({
  SensorStream: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@tracking/locationPublisher', () => ({
  LocationPublisher: jest.fn().mockImplementation(() => ({
    fetchGroupLastKnown: jest.fn().mockResolvedValue([]),
  })),
}));

jest.mock('@tracking/trackingService', () => {
  const mockTrackingService = jest.fn().mockImplementation(() => ({
    start: jest.fn().mockResolvedValue(true),
    stop:  jest.fn().mockResolvedValue(undefined),
  }));
  return { TrackingService: mockTrackingService };
});

jest.mock('@tracking/hlcStore', () => ({
  loadHlc: jest.fn().mockReturnValue({ now: jest.fn().mockReturnValue('0:0') }),
}));

jest.mock('@app/services/socketService', () => ({
  getLocationSocket: jest.fn().mockReturnValue({
    on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: true,
  }),
}));
// MapScreen imports via relative path — mock that specifier too.
jest.mock('../src/services/socketService', () => ({
  getLocationSocket: jest.fn().mockReturnValue({
    on: jest.fn(), off: jest.fn(), emit: jest.fn(), connected: true,
  }),
}));

jest.mock('@rnmapbox/maps', () => ({
  __esModule: true,
  default: {
    setAccessToken: jest.fn(),
    MapView: 'MapView',
    Camera: 'Camera',
    ShapeSource: 'ShapeSource',
    CircleLayer: 'CircleLayer',
    LineLayer: 'LineLayer',
    SymbolLayer: 'SymbolLayer',
    UserLocation: 'UserLocation',
    UserTrackingMode: {
      Follow: 'normal',
      FollowWithHeading: 'compass',
      FollowWithCourse: 'course',
    },
    StyleURL: { Dark: 'dark' },
  },
  setAccessToken: jest.fn(),
  MapView: 'MapView',
  Camera: 'Camera',
  ShapeSource: 'ShapeSource',
  CircleLayer: 'CircleLayer',
  LineLayer: 'LineLayer',
  SymbolLayer: 'SymbolLayer',
  StyleURL: { Dark: 'dark' },
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
jest.mock('../src/screens/map/overlays/HazardOverlay',   () => ({ __esModule: true, HazardOverlayMapLayer: () => null, HazardOverlayInfoCard: () => null }));
jest.mock('../src/screens/map/overlays/SosOverlay',      () => ({ __esModule: true, SosOverlayMapLayer: () => null, SosOverlayInfoCards: () => null }));
jest.mock('../src/screens/map/overlays/RouteOverlay',    () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/map/overlays/FlStatusOverlay', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/screens/map/overlays/routeControls',   () => ({
  registerToggleAvoidHazards: jest.fn(),
  getToggleAvoidHazards: jest.fn(() => null),
}));

// Stub the new shared UI components (they pull in Animated + stores).
jest.mock('../src/components/RoutePanel', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/ToastContainer', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/LivePill', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/NetworkBanner', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/FuelBanner', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/SignalMenu', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/NavHint', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/SosModal', () => ({ __esModule: true, default: () => null }));
jest.mock('../src/components/Fab', () => {
  const React = require('react');
  return { __esModule: true, default: (props: any) => React.createElement('View', props ?? null) };
});
jest.mock('../src/store/toastStore', () => ({
  useToastStore: (selector?: (s: unknown) => unknown) =>
    selector ? selector({ toasts: [], push: jest.fn(), dismiss: jest.fn() }) : { toasts: [], push: jest.fn(), dismiss: jest.fn() },
}));
jest.mock('@routing/client/routeStore', () => ({
  useRouteStore: (selector?: (s: unknown) => unknown) =>
    selector
      ? selector({
          route: null,
          avoidHazardTypes: [],
          isLoading: false,
          currentLocation: null,
          lastValidLocation: null,
          activeClusters: [],
          setRoute: jest.fn(),
          setAvoidHazardTypes: jest.fn(),
          setIsLoading: jest.fn(),
          setCurrentLocation: jest.fn(),
          setLastValidLocation: jest.fn(),
          setActiveClusters: jest.fn(),
        })
      : {},
}));
jest.mock('@app/store/ridersStore', () => {
  const state = {
    riders: new Map(),
    connected: true,
    selectedRiderId: null,
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };
  const useRidersStore = (selector?: (s: unknown) => unknown) =>
    selector
      ? selector(state)
      : state;
  useRidersStore.getState = () => state;
  return { useRidersStore };
});
jest.mock('@routing/client/deepLink', () => ({
  googleMapsDeepLink: jest.fn(() => 'https://maps.google.com'),
}));
// Group service touches native firebase — mock at the service boundary.
jest.mock('@routing/group/groupService', () => ({
  GroupService: jest.fn().mockImplementation(() => ({
    getRidePlan: jest.fn().mockResolvedValue(null),
    getGroup: jest.fn().mockResolvedValue(null),
    createGroup: jest.fn(),
    joinGroup: jest.fn(),
    myGroups: jest.fn(() => jest.fn()),
  })),
}));
// Hazard services have native firebase imports — mock at service boundary
// (Person B's logic is covered by hazard-sos module tests).
jest.mock('@hazard/services/sosService', () => ({
  triggerSos: jest.fn(),
  resolveSos: jest.fn(),
  subscribeToSosEvents: jest.fn(() => jest.fn()),
}));
jest.mock('@hazard/services/hazardService', () => ({
  resolveHazard: jest.fn(),
  submitHazardReport: jest.fn(),
  subscribeToHazardClusters: jest.fn(() => jest.fn()),
}));

// ---- imports ----------------------------------------------------------------

import React from 'react';
import { act, create } from 'react-test-renderer';

// Import AFTER mocks are registered.
import MapScreen from '../src/screens/map/MapScreen';
import { useAppStore } from '@app/store/appStore';

// ---------------------------------------------------------------------------

describe('MapScreen — Phase 6 TrackingService lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock appStore state.
    useAppStore.setState({ userId: null, groupId: null });
  });

  // Mock handles (babel-jest hoists imports above consts; factories are self-contained)
  const getTrackingService = () => require('@tracking/trackingService').TrackingService;
  const getLoadHlc = () => require('@tracking/hlcStore').loadHlc;
  const getSocket = () => require('@app/services/socketService').getLocationSocket;
  const getLocationPublisher = () => require('@tracking/locationPublisher').LocationPublisher;

  /** Sets userId + groupId in the mock store and renders MapScreen. */
  function renderWithUser(userId: string | null, groupId = 'group-1') {
    useAppStore.setState({ userId, groupId });

    let renderer: any;
    act(() => {
      renderer = create(<MapScreen />);
    });
    return renderer;
  }

  // ---------------------------------------------------------------------------
  // 6.1 — start on mount
  // ---------------------------------------------------------------------------

  test('6.1 — TrackingService is constructed and started on mount when userId and groupId are valid', () => {
    renderWithUser('user-abc');
    const TrackingService = getTrackingService();
    expect(TrackingService).toHaveBeenCalledTimes(1);
    const instance = TrackingService.mock.results[0]?.value;
    // start called on the constructed service
    expect(instance.start).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 6.1 — stop on unmount
  // ---------------------------------------------------------------------------

  test('6.1 — TrackingService.stop() is called when MapScreen unmounts', () => {
    const renderer = renderWithUser('user-abc');
    const TrackingService = getTrackingService();
    const instance = TrackingService.mock.results[0]?.value;
    expect(instance.start).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.unmount();
    });

    expect(instance.stop).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // 6.1 — null userId guard
  // ---------------------------------------------------------------------------

  test('6.1 — TrackingService is NOT started when userId is null', () => {
    renderWithUser(null);
    expect(getTrackingService()).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 6.1 — empty string userId guard
  // ---------------------------------------------------------------------------

  test('6.1 — TrackingService is NOT started when userId is empty string', () => {
    renderWithUser('');
    expect(getTrackingService()).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 6.2 — loadHlc() is the HLC source (not raw HLC.fresh())
  // ---------------------------------------------------------------------------

  test('6.2 — loadHlc() is called exactly once to obtain the HLC instance', () => {
    renderWithUser('user-abc');
    expect(getLoadHlc()).toHaveBeenCalledTimes(1);
  });

  test('6.2 — the HLC instance returned by loadHlc() is passed to TrackingService constructor', () => {
    const fakeHlc = { now: jest.fn().mockReturnValue('999:0') };
    getLoadHlc().mockReturnValueOnce(fakeHlc);

    renderWithUser('user-abc');

    const ctorCall = getTrackingService().mock.calls[0][0];
    expect(ctorCall.hlc).toBe(fakeHlc);
  });

  // ---------------------------------------------------------------------------
  // 6.1 — groupId + userId threaded through to LocationPublisher
  // ---------------------------------------------------------------------------

  test('6.1 — LocationPublisher receives correct riderId (userId) and groupId', () => {
    const LocationPublisher = getLocationPublisher();
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
    expect(getSocket()).toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // 6.1 — no stop called if service was never started
  // ---------------------------------------------------------------------------

  test('6.1 — stop is NOT called on unmount when userId was null (no service created)', () => {
    const renderer = renderWithUser(null);
    act(() => { renderer.unmount(); });
    expect(getTrackingService()).not.toHaveBeenCalled();
  });
});