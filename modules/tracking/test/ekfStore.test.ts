import { persistEkf, loadEkfState, EKF_MMKV_KEY, _resetMmkvForTest } from '../src/ekfStore';
import { Ekf, EkfState } from '../src/ekf';
import { MMKV } from 'react-native-mmkv';

jest.mock('react-native-mmkv');

describe('ekfStore', () => {
  let mockMmkv: jest.Mocked<MMKV>;

  beforeEach(() => {
    _resetMmkvForTest();
    mockMmkv = {
      set: jest.fn(),
      getString: jest.fn(),
      // Add other mocked methods if needed
    } as unknown as jest.Mocked<MMKV>;
    
    (MMKV as unknown as jest.Mock).mockImplementation(() => mockMmkv);
  });

  it('persists EKF state to MMKV', () => {
    const ekf = new Ekf({ lat: 10, lng: 20 });
    ekf.P = new Array(16).fill(1.5);
    ekf.speed = 5;
    ekf.heading = 90;
    ekf.nisScore = 2.0;

    persistEkf(ekf);

    expect(mockMmkv.set).toHaveBeenCalledWith(
      EKF_MMKV_KEY,
      JSON.stringify(ekf.toState())
    );
  });

  it('loads valid EKF state from MMKV', () => {
    const validState: EkfState = {
      lat: 10,
      lng: 20,
      speed: 5,
      heading: 90,
      p: new Array(16).fill(1.5),
      spoofFlag: false,
      nisScore: 2.0
    };
    mockMmkv.getString.mockReturnValue(JSON.stringify(validState));

    const state = loadEkfState();
    expect(state).toEqual(validState);
  });

  it('returns null when state is invalid JSON', () => {
    mockMmkv.getString.mockReturnValue('{ corrupted }');
    expect(loadEkfState()).toBeNull();
  });

  it('returns null when state is missing required fields', () => {
    mockMmkv.getString.mockReturnValue(JSON.stringify({ lat: 10, lng: 20 }));
    expect(loadEkfState()).toBeNull();
  });

  it('returns null when state is empty', () => {
    mockMmkv.getString.mockReturnValue(undefined);
    expect(loadEkfState()).toBeNull();
  });
});

describe('Cold-start EKF restoration (Task 8.2)', () => {
  let mockMmkv: jest.Mocked<MMKV>;
  let mmkvStore: Record<string, string>;

  beforeEach(() => {
    _resetMmkvForTest();
    mmkvStore = {};
    mockMmkv = {
      set: jest.fn((key: string, value: string) => { mmkvStore[key] = value; }),
      getString: jest.fn((key: string) => mmkvStore[key] ?? undefined),
    } as unknown as jest.Mocked<MMKV>;

    (MMKV as unknown as jest.Mock).mockImplementation(() => mockMmkv);
  });

  it('simulates full cold-start: persist, kill, load, reconstruct, continue tracking', () => {
    // 1. Create EKF and run ticks to produce meaningful state.
    const original = new Ekf({ lat: 37.7749, lng: -122.4194, speed: 0, heading: 0 });
    for (let i = 0; i < 10; i++) {
      original.update(original.lat + 0.000001, original.lng + 0.000001);
    }
    original.predict(1.0, 2.5, 90);

    // Force spoof flag via GPS teleport.
    for (let i = 0; i < 5; i++) {
      original.update(original.lat + 0.01, original.lng + 0.01);
    }
    expect(original.spoofFlag).toBe(true);

    const preKillState = original.toState();

    // 2. Persist through persistEkf (writes to our in-memory mock MMKV).
    persistEkf(original);

    // 3. Simulate cold start: discard original EKF and service.
    //    (In real app, the entire TrackingService is gone; only MMKV survives.)

    // 4. Caller-side restoration: load state from MMKV.
    const loadedState = loadEkfState();
    expect(loadedState).not.toBeNull();

    // 5. Reconstruct EKF from persisted state.
    const restored = Ekf.fromState(loadedState!);

    // 6. Verify restored state exactly matches what was persisted.
    expect(restored.lat).toBe(preKillState.lat);
    expect(restored.lng).toBe(preKillState.lng);
    expect(restored.speed).toBe(preKillState.speed);
    expect(restored.heading).toBe(preKillState.heading);
    expect(restored.P).toEqual(preKillState.p);
    expect(restored.nisScore).toBe(preKillState.nisScore);
    expect(restored.spoofFlag).toBe(true);

    // 7. Verify the reconstructed EKF can continue tracking without a new GPS fix.
    //    Predict with IMU data (dead-reckoning continues from restored state).
    const lngBeforePredict = restored.lng;
    const speedBeforePredict = restored.speed;

    restored.predict(1.0, 1.0, 5.0);

    // State must have advanced via IMU dead-reckoning — no GPS fix needed.
    // Longitude and speed always change in predict (speed += accel*dt,
    // lng += speed*dt*sin(heading)/scaleFactor). Latitude may not change
    // if heading is ~90deg (east) since cos(90deg) ≈ 0.
    expect(restored.lng).not.toBe(lngBeforePredict);
    expect(restored.speed).toBeCloseTo(speedBeforePredict + 1.0, 10);

    // A subsequent GPS update should still work on the restored filter.
    const nisBeforeUpdate = restored.nisScore;
    restored.update(restored.lat + 0.000001, restored.lng + 0.000001);
    expect(restored.nisScore).toBeGreaterThanOrEqual(0);
    // Covariance must remain valid (no NaN/Infinity from restored state).
    expect(restored.P.every(v => Number.isFinite(v))).toBe(true);
  });

  it('cold-start with no persisted state falls back to fresh EKF (caller decision)', () => {
    // Simulate a fresh install: no EKF state in MMKV.
    const loadedState = loadEkfState();
    expect(loadedState).toBeNull();

    // Caller constructs a fresh EKF — this is the caller's decision, not TrackingService's.
    const fresh = new Ekf({ lat: 37.7749, lng: -122.4194 });
    expect(fresh.spoofFlag).toBe(false);
    expect(fresh.speed).toBe(0);
  });
});
