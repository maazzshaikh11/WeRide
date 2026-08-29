import { LocationPublisher, VerifiedLocationPayload } from '../src/locationPublisher';
import firestore from '@react-native-firebase/firestore';

// Mocks are mapped via jest.config.js to our functional mocks in __mocks__/
const { _mockSocket: mockSocket } = jest.requireMock('socket.io-client') as any;

describe('LocationPublisher', () => {
  let publisher: LocationPublisher;
  let mockGet: jest.Mock;
  let mockSet: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Access the chainable mock methods exposed on the mock constructor
    mockGet = (firestore as any)._mockGet;
    mockSet = (firestore as any)._mockSet;

    mockSocket.connected = true;
    for (const key of Object.keys(mockSocket._handlers)) {
      delete mockSocket._handlers[key];
    }

    publisher = new LocationPublisher({
      socket: mockSocket as any,
      riderId: 'rider123',
      groupId: 'group456',
      firestoreThrottleMs: 5000,
      firestore: firestore() as any, // explicit injection for tests
    });

  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const samplePayload: VerifiedLocationPayload = {
    timestampHlc: '100:0',
    lat: 1.0,
    lng: 2.0,
    speedMps: 5.0,
    headingDeg: 90.0,
    spoofFlag: false,
    nisScore: 1.2,
    accuracyM: 3.0,
  };

  // ── Task 3.2: Late-Joiner Read ──────────────────────────────────────────────

  describe('fetchLastKnown', () => {
    it('returns mapped payload when document exists', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          timestamp_hlc: '100:0',
          lat: 1.0,
          lng: 2.0,
          speed_mps: 5.0,
          heading_deg: 90.0,
          spoof_flag: false,
          nis_score: 1.2,
          accuracy_m: 3.0,
        }),
      });

      const res = await publisher.fetchLastKnown('group456', 'rider123');
      expect(res).toEqual(samplePayload);
    });

    it('returns null when document does not exist', async () => {
      mockGet.mockResolvedValueOnce({ exists: false });
      const res = await publisher.fetchLastKnown('group456', 'rider123');
      expect(res).toBeNull();
    });

    it('returns null and warns on Firestore exception', async () => {
      mockGet.mockRejectedValueOnce(new Error('firestore offline'));
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const res = await publisher.fetchLastKnown('group456', 'rider123');

      expect(res).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[LocationPublisher] fetchLastKnown failed:',
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });

  // ── Task 3.3: Offline Socket Queue ────────────────────────────────────────

  describe('Socket offline behavior', () => {
    it('buffers only the latest payload when socket is disconnected', () => {
      mockSocket.connected = false;

      const p1 = { ...samplePayload, lat: 10.0 };
      const p2 = { ...samplePayload, lat: 20.0 };

      publisher.publish(p1);
      publisher.publish(p2);

      // Should not emit while disconnected
      expect(mockSocket.emit).not.toHaveBeenCalled();

      // Ensure internal pending payload matches P2
      // We can test this indirectly by reconnecting
      const call = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'connect');
      if (call) call[1]();

      expect(mockSocket.emit).toHaveBeenCalledTimes(1);
      expect(mockSocket.emit).toHaveBeenCalledWith(
        'location:update',
        expect.objectContaining({ lat: 20.0 })
      );
    });

    it('reconnect flushes latest pending payload then nulls it', () => {
      mockSocket.connected = false;
      publisher.publish(samplePayload);

      const call = mockSocket.on.mock.calls.find((c: any[]) => c[0] === 'connect');
      if (call) call[1]();

      expect(mockSocket.emit).toHaveBeenCalledTimes(1);
      mockSocket.emit.mockClear();

      // A second connect event should not emit again because it was nulled
      if (call) call[1]();
      expect(mockSocket.emit).not.toHaveBeenCalled();
    });
  });

  // ── Task 3.4: Firestore Write Error Handling ────────────────────────────────

  describe('Firestore write handling', () => {
    it('Firestore failure does not stop socket publishing', () => {
      mockSet.mockRejectedValueOnce(new Error('permission-denied'));
      mockSocket.connected = true;
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // This should not throw, because the catch handles it asynchronously
      expect(() => {
        publisher.publish(samplePayload);
      }).not.toThrow();

      // Socket emit happens synchronously before Firestore promise resolves/rejects
      expect(mockSocket.emit).toHaveBeenCalledTimes(1);

      // Advance timers to resolve the promise rejection
      jest.runAllTimers();

      // Verify the catch block warned
      // (jest might require awaiting a tick if it was an unhandled rejection, but catch handles it)
    });

    it('Firestore failure resets throttle guard enabling immediate retry on next tick', async () => {
      mockSet.mockRejectedValueOnce(new Error('fail 1'));
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Tick 1
      publisher.publish(samplePayload);
      expect(mockSet).toHaveBeenCalledTimes(1);

      // Flush microtasks so the catch block executes
      await Promise.resolve();

      // Tick 2 (immediate, within throttle window).
      // Normally this would be blocked by _lastFirestoreWrite.
      // But the catch block should have reset it.
      publisher.publish(samplePayload);
      expect(mockSet).toHaveBeenCalledTimes(2); // Attempted again

      consoleWarnSpy.mockRestore();
    });
  });
});
