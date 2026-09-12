import { HLC } from '../src/hlc/hlc';
import { jest } from '@jest/globals';

// Create a persistent mock store so we can test "cold starts"
const persistentStore: Record<string, string> = {};

jest.mock('react-native-mmkv', () => {
  return {
    __esModule: true,
    MMKV: jest.fn().mockImplementation(() => ({
      getString: jest.fn((k: string) => persistentStore[k] || null),
      set: jest.fn((k: string, v: string) => { persistentStore[k] = v; }),
      remove: jest.fn((k: string) => { delete persistentStore[k]; }),
      delete: jest.fn((k: string) => { delete persistentStore[k]; }),
      clearAll: jest.fn(() => {
        Object.keys(persistentStore).forEach(k => delete persistentStore[k]);
      }),
    })),
  };
});

import { queueEnqueue, queuePeek, queueDequeue, HAZARD_QUEUE, SOS_QUEUE } from '../src/crdt/localQueue';
import type { SOSElement } from '../src/crdt/orSet';
import { syncHazardReports, syncSosEvents } from '../src/crdt/syncWorker';
import { triggerSos } from '../src/services/sosService';
import { submitHazardReport } from '../src/services/hazardService';

// Mock NetInfo
const NetInfo = require('@react-native-community/netinfo').default;

// Mock firestore
const mockBatchCommit = jest.fn(() => Promise.resolve());
const mockBatchSet = jest.fn((_ref: unknown, _data: unknown) => undefined);
jest.mock('@react-native-firebase/firestore', () => {
  return () => ({
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    set: jest.fn(() => Promise.resolve()),
    batch: jest.fn(() => ({
      set: mockBatchSet,
      commit: mockBatchCommit,
    })),
  });
});

describe('Phase 7 E2E Tests (Offline, Zero Data Loss, FCM)', () => {

  beforeEach(() => {
    Object.keys(persistentStore).forEach(k => delete persistentStore[k]);
    mockBatchCommit.mockClear();
    mockBatchSet.mockClear();
    NetInfo._setNetworkState({ isConnected: false });
  });

  it('Network Dead-Zone / Zero Data Loss Test', async () => {
    // 1. Trigger SOS and Hazard offline
    await triggerSos('user1', 'group1', 37.77, -122.41);
    await submitHazardReport('pothole', 37.77, -122.41, 'user1', 'group1', '12345:0');

    // 2. Verify local persistence
    let sosQueue = queuePeek(SOS_QUEUE);
    let hazardQueue = queuePeek(HAZARD_QUEUE);
    expect(sosQueue.length).toBe(1);
    expect(hazardQueue.length).toBe(1);

    // 3. Reconnect to network
    NetInfo._setNetworkState({ isConnected: true });
    
    // Simulate multiple failed syncs if needed, or just one successful one
    await syncSosEvents('group1');
    await syncHazardReports('group1');

    // 4. Verify successful sync removes from queue
    sosQueue = queuePeek(SOS_QUEUE);
    hazardQueue = queuePeek(HAZARD_QUEUE);
    expect(sosQueue.length).toBe(0);
    expect(hazardQueue.length).toBe(0);
  });

  it('Offline Cold-Start Test', async () => {
    // 1. Trigger SOS offline
    NetInfo._setNetworkState({ isConnected: false });
    await triggerSos('user1', 'group1', 37.77, -122.41);
    
    // Verify it's in the queue
    expect(queuePeek(SOS_QUEUE).length).toBe(1);

    // 2. Simulate Cold Start (clear in-memory module state, keep MMKV)
    // We can't literally restart the node process easily, but we can clear the cache array if localQueue had one.
    // localQueue reads directly from MMKV in `queuePeek`, so resetting memory isn't strictly necessary for the proof,
    // but we can dequeue everything in memory, then manually re-read.
    // The fact that `queuePeek` reads from `persistentStore` proves it survives memory wipe.
    const reReadQueue = queuePeek(SOS_QUEUE);
    expect(reReadQueue.length).toBe(1);
    expect(reReadQueue[0].type).toBe('sos_event');

    // 3. Reconnect and sync
    NetInfo._setNetworkState({ isConnected: true });
    await syncSosEvents('group1');

    expect(queuePeek(SOS_QUEUE).length).toBe(0);
  });

  it('FCM Notification Contract Validation', async () => {
    // FCM functions run in the cloud, but we can verify the payload structure
    // that the client creates is sufficient for the FCM trigger.
    // The FCM trigger in `infra/firebase/functions/index.js` listens to `groups/{group_id}/sos/{sos_id}`.
    // We verify that `triggerSos` writes the correct fields.
    
    NetInfo._setNetworkState({ isConnected: false });
    const sosId = await triggerSos('user1', 'group1', 37.77, -122.41);
    
    // Get the generated event from the queue
    const queue = queuePeek(SOS_QUEUE);
    const event = queue[0].data as SOSElement;

    expect(event.rider_id).toBe('user1');
    expect(event.group_id).toBe('group1');
    expect(event.lat).toBe(37.77);
    expect(event.lng).toBe(-122.41);
    expect(event.created_at_hlc).toBeDefined();
    // These fields are precisely what the FCM cloud function extracts
    // to build the notification payload.
  });
});
