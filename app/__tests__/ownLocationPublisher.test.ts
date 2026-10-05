/**
 * OwnLocationPublisher — the rider's own verified fix must reach the app.
 * Root cause covered: the server's socket.to(room) never echoes a fix back to
 * its sender, so route origin / hazard reports / stop distances were never fed.
 */
// Virtual: the module under test lives in ../modules/tracking, which has no
// native firebase install to resolve from.
jest.mock(
  '@react-native-firebase/firestore',
  () => ({ __esModule: true, default: jest.fn(() => ({})) }),
  { virtual: true },
);

import { OwnLocationPublisher, isUsableOwnFix } from '../src/services/ownLocationPublisher';
import type { VerifiedLocation } from '../src/models/verifiedLocation';

function fakeFirestore() {
  const set = jest.fn().mockResolvedValue(undefined);
  const firestore: any = {
    collection: () => ({ doc: () => ({ collection: () => ({ doc: () => ({ set }) }) }) }),
  };
  return { firestore, set };
}

function fakeSocket(connected = true) {
  return { on: jest.fn(), emit: jest.fn(), connected } as any;
}

const payload = {
  timestampHlc: '1700000000000:0',
  lat: 18.5204,
  lng: 73.8567,
  speedMps: 11,
  headingDeg: 90,
  spoofFlag: false,
  nisScore: 0.4,
  accuracyM: 8,
};

describe('OwnLocationPublisher', () => {
  it('still publishes to the socket and reports the own fix in snake_case', () => {
    const socket = fakeSocket();
    const { firestore } = fakeFirestore();
    const fixes: VerifiedLocation[] = [];
    const pub = new OwnLocationPublisher(
      { socket, riderId: 'rider-1', groupId: 'g-1', firestore },
      (f) => fixes.push(f),
    );

    pub.publish(payload);

    expect(socket.emit).toHaveBeenCalledWith(
      'location:update',
      expect.objectContaining({ rider_id: 'rider-1', group_id: 'g-1', lat: 18.5204 }),
    );
    expect(fixes).toEqual([
      {
        rider_id: 'rider-1',
        group_id: 'g-1',
        timestamp_hlc: '1700000000000:0',
        lat: 18.5204,
        lng: 73.8567,
        speed_mps: 11,
        heading_deg: 90,
        spoof_flag: false,
        nis_score: 0.4,
        accuracy_m: 8,
      },
    ]);
  });

  it('does not report a non-finite fix (never reaches route origin)', () => {
    const socket = fakeSocket();
    const { firestore } = fakeFirestore();
    const onFix = jest.fn();
    const pub = new OwnLocationPublisher(
      { socket, riderId: 'r', groupId: 'g', firestore },
      onFix,
    );

    pub.publish({ ...payload, lat: NaN });

    expect(onFix).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalled();
  });
});

describe('isUsableOwnFix', () => {
  const base: VerifiedLocation = {
    rider_id: 'r',
    group_id: 'g',
    timestamp_hlc: '1:0',
    lat: 18.5,
    lng: 73.8,
    speed_mps: 0,
    heading_deg: 0,
    spoof_flag: false,
    nis_score: 0,
    accuracy_m: 10,
  };

  it('accepts a clean, accurate fix', () => {
    expect(isUsableOwnFix(base)).toBe(true);
  });

  it('rejects spoof-flagged fixes', () => {
    expect(isUsableOwnFix({ ...base, spoof_flag: true })).toBe(false);
  });

  it('rejects fixes worse than 50 m accuracy', () => {
    expect(isUsableOwnFix({ ...base, accuracy_m: 50.1 })).toBe(false);
    expect(isUsableOwnFix({ ...base, accuracy_m: 50 })).toBe(true);
  });

  it('rejects non-finite coordinates', () => {
    expect(isUsableOwnFix({ ...base, lng: Infinity })).toBe(false);
  });
});
