/**
 * RoutingClient must authenticate to the server: POST /route carries the rider's Firebase ID token
 * (`Authorization: Bearer <idToken>`), refreshed after a 401.
 */
import { RoutingClient } from '../src/client/routingClient';

const okRoute = {
  ok: true,
  status: 200,
  json: async () => ({
    route_id: 'r1',
    path_points: [[40.7128, -74.006], [40.714, -74.0089]],
    distance_km: 1.5,
    eta_minutes: 25,
    safety_score: 0.85,
    recalculated_at_hlc: '1000:0',
  }),
};
const req = { group_id: 'g1', origin: { lat: 40.7128, lng: -74.006 }, destination: { lat: 40.714, lng: -74.0089 } };

describe('RoutingClient auth', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('attaches the ID token as a Bearer Authorization header', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(okRoute);
    const client = new RoutingClient({ baseUrl: 'http://s', getToken: async () => 'id-token-1' });
    await client.requestRoute(req);
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://s/route');
    expect(init.headers.Authorization).toBe('Bearer id-token-1');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('fetches a token per request (never caches an expired one)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(okRoute);
    let n = 0;
    const client = new RoutingClient({ baseUrl: 'http://s', getToken: async () => `t${++n}` });
    await client.requestRoute(req);
    await client.requestRoute(req);
    const auths = (global.fetch as jest.Mock).mock.calls.map((c) => c[1].headers.Authorization);
    expect(auths).toEqual(['Bearer t1', 'Bearer t2']);
  });

  it('refreshes the token and retries once on a 401', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce(okRoute);
    const getToken = jest.fn(async (force?: boolean) => (force ? 'fresh' : 'stale'));
    const client = new RoutingClient({ baseUrl: 'http://s', getToken });
    const route = await client.requestRoute(req);
    expect(route.route_id).toBe('r1');
    expect(getToken.mock.calls).toEqual([[false], [true]]);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][1].headers.Authorization).toBe('Bearer stale');
    expect(calls[1][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('still fails (does not loop) when the server keeps answering 401', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    const client = new RoutingClient({ baseUrl: 'http://s', getToken: async () => 't' });
    await expect(client.requestRoute(req)).rejects.toThrow('Route request failed: 401');
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('sends no Authorization header when signed out, and the public API is unchanged without getToken', async () => {
    (global.fetch as jest.Mock).mockResolvedValue(okRoute);
    const client = new RoutingClient({ baseUrl: 'http://s' }); // default token source: nobody signed in in tests
    await client.requestRoute(req);
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});
