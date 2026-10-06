/**
 * FlClient must authenticate to /fl/*: `Authorization: Bearer <Firebase ID token>`, refreshed after a 401.
 */
import { FlClient } from '../src/fl/flClient';

const on = () => true;

describe('FlClient auth', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ weights: [1, 2] }) });
  });

  it('fetchGlobal and submit both carry the Bearer token', async () => {
    const c = new FlClient({ clientId: 'c', serverUrl: 'http://s', isEnabled: on, getToken: async () => 'tok' });
    await c.fetchGlobal();
    await c.submit(new Float32Array(2), 0, 1);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls.map((x) => x[0])).toEqual(['http://s/fl/global', 'http://s/fl/submit']);
    for (const [, init] of calls) expect(init.headers.Authorization).toBe('Bearer tok');
    expect(calls[1][1].headers['Content-Type']).toBe('application/json');
    expect(calls[1][1].method).toBe('POST');
  });

  it('asks for a token on every call (fresh after expiry)', async () => {
    let n = 0;
    const c = new FlClient({ clientId: 'c', serverUrl: 'http://s', isEnabled: on, getToken: async () => `t${++n}` });
    await c.fetchGlobal();
    await c.fetchGlobal();
    const auths = (global.fetch as jest.Mock).mock.calls.map((x) => x[1].headers.Authorization);
    expect(auths).toEqual(['Bearer t1', 'Bearer t2']);
  });

  it('refreshes the token and retries once on a 401', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ status: 401, ok: false, json: async () => ({}) })
      .mockResolvedValueOnce({ status: 200, ok: true, json: async () => ({ weights: [] }) });
    const getToken = jest.fn(async (force?: boolean) => (force ? 'fresh' : 'stale'));
    const c = new FlClient({ clientId: 'c', serverUrl: 'http://s', isEnabled: on, getToken });
    await c.fetchGlobal();
    expect(getToken.mock.calls).toEqual([[false], [true]]);
    expect((global.fetch as jest.Mock).mock.calls[1][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('the consent gate still wins: no consent means no request at all (and so no token use)', async () => {
    const getToken = jest.fn(async () => 'tok');
    const c = new FlClient({ clientId: 'c', serverUrl: 'http://s', getToken });
    await c.runRound();
    expect(global.fetch).not.toHaveBeenCalled();
    expect(getToken).not.toHaveBeenCalled();
  });
});
