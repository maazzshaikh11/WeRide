/**
 * Federated learning only runs while "Improve ETAs for everyone" (prefs.learn) is on: no fetch, no training and no
 * upload otherwise, and an FL client built without a consent gate never touches the network.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

import { FlClient } from '@flvoice/fl/flClient';
import { createFlClient, flParticipationEnabled, flStatusLine } from '../src/services/flService';
import { usePrefsStore } from '../src/store/prefsStore';
import { DEFAULT_PREFS } from '../src/models/domain';
import FlStatusOverlay from '../src/screens/map/overlays/FlStatusOverlay';

const mockFlStore: { keys: string[]; values: Record<string, string> } = { keys: [], values: {} };
jest.mock('../src/services/localStorage', () => ({
  getFlData: () => ({
    getAllKeys: () => mockFlStore.keys,
    getString: (k: string) => mockFlStore.values[k],
  }),
}));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ json: async () => ({ weights: [0.1, 0.2, 0.3] }) });
  (global as any).fetch = fetchMock;
  mockFlStore.keys = [];
  mockFlStore.values = {};
  act(() => usePrefsStore.setState({ prefs: { ...DEFAULT_PREFS } }));
});

const setLearn = (v: boolean) => act(() => { usePrefsStore.getState().setPref('learn', v); });

describe('FlClient consent gate', () => {
  it('an FL client with no gate never trains or uploads', async () => {
    const c = new FlClient({ clientId: 'c', serverUrl: 'http://s' });
    expect(c.enabled).toBe(false);
    await c.runRound();
    await c.submit(new Float32Array(2), 0, 1);
    await c.fetchGlobal();
    expect((await c.trainLocal(1)).length).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a throwing gate counts as no consent', async () => {
    const c = new FlClient({ clientId: 'c', serverUrl: 'http://s', isEnabled: () => { throw new Error('x'); } });
    await c.runRound();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('createFlClient: learn on -> a round fetches global weights and submits; learn off -> silence', async () => {
    const c = createFlClient({ clientId: 'c', serverUrl: 'http://s' });
    setLearn(true);
    expect(flParticipationEnabled()).toBe(true);
    await c.runRound();
    expect(fetchMock.mock.calls.map((x) => x[0])).toEqual(['http://s/fl/global', 'http://s/fl/submit']);

    fetchMock.mockClear();
    setLearn(false); // same client, switched off mid-session
    expect(flParticipationEnabled()).toBe(false);
    await c.runRound();
    await c.submit(new Float32Array(3), 0, 5);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('default pref is on (opt-out), and Privacy writes it via setPref', () => {
    expect(usePrefsStore.getState().prefs.learn).toBe(true);
    setLearn(false);
    expect(usePrefsStore.getState().prefs.learn).toBe(false);
  });
});

describe('status line', () => {
  it('is null until a round was really logged', () => {
    expect(flStatusLine()).toBeNull();
  });
  it('reports the latest logged round', () => {
    mockFlStore.keys = ['round_14'];
    mockFlStore.values.round_14 = JSON.stringify({ roundId: 14, localLoss: 0.1, participants: 38, timestamp: 't' });
    expect(flStatusLine()).toBe('FL round 14 done · 38 clients');
  });
});

describe('FlStatusOverlay respects the choice', () => {
  const text = (t: ReturnType<typeof create>) => String(t.root.findByType(Text).props.children);
  it('shows the round only while learning is on', () => {
    mockFlStore.keys = ['round_3'];
    mockFlStore.values.round_3 = JSON.stringify({ roundId: 3, localLoss: 0, participants: 7, timestamp: 't' });
    let t!: ReturnType<typeof create>;
    act(() => { t = create(<FlStatusOverlay />); });
    expect(text(t)).toBe('FL round 3 done · 7 clients');
    setLearn(false);
    expect(text(t)).toBe('Ride data stays on-device');
    setLearn(true);
    expect(text(t)).toBe('FL round 3 done · 7 clients');
    act(() => t.unmount());
  });
});
