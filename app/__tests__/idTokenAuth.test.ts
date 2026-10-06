/**
 * Client plumbing for the authenticated realtime/routing server: every REST call carries
 * `Authorization: Bearer <Firebase ID token>`, every Socket.io handshake carries `auth.token`, and the
 * token is fetched fresh on each (re)connect and refreshed after a 401 / 'unauthorized'.
 */
const mockGetIdToken = jest.fn();
let mockUser: { getIdToken: jest.Mock } | null = null;
jest.mock('@react-native-firebase/auth', () => ({
  __esModule: true,
  default: jest.fn(() => ({ currentUser: mockUser })),
}));

const mockIo = jest.fn();
jest.mock('socket.io-client', () => ({ io: (...a: unknown[]) => mockIo(...a) }));

import { authedFetch, getIdToken } from '../src/services/idToken';
import { createAuthedSocket, getLocationSocket, getVoxSocket, disconnectSockets } from '../src/services/socketService';

type Handler = (...a: any[]) => void;
function fakeSocket() {
  const handlers: Record<string, Handler> = {};
  return {
    handlers,
    on: jest.fn((ev: string, h: Handler) => { handlers[ev] = h; }),
    connect: jest.fn(),
    disconnect: jest.fn(),
    emit: jest.fn(),
  };
}
const handshake = (opts: any): Promise<any> => new Promise((resolve) => opts.auth(resolve));

beforeEach(() => {
  mockGetIdToken.mockReset();
  mockUser = { getIdToken: mockGetIdToken };
  mockIo.mockReset();
  (global as any).fetch = jest.fn();
});

describe('getIdToken', () => {
  it('returns the signed-in rider token and forwards forceRefresh', async () => {
    mockGetIdToken.mockResolvedValue('tok-1');
    expect(await getIdToken()).toBe('tok-1');
    expect(mockGetIdToken).toHaveBeenLastCalledWith(false);
    await getIdToken(true);
    expect(mockGetIdToken).toHaveBeenLastCalledWith(true);
  });

  it('is null when nobody is signed in or the token cannot be read', async () => {
    mockUser = null;
    expect(await getIdToken()).toBeNull();
    mockUser = { getIdToken: mockGetIdToken };
    mockGetIdToken.mockRejectedValue(new Error('network'));
    expect(await getIdToken()).toBeNull();
  });
});

describe('authedFetch', () => {
  it('attaches Authorization: Bearer <token> and keeps the other headers/body', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ status: 200, ok: true });
    await authedFetch('http://s/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }, async () => 'abc');
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('http://s/route');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json', Authorization: 'Bearer abc' });
    expect(init.body).toBe('{}');
    expect(init.method).toBe('POST');
  });

  it('sends no Authorization header when there is no token (server will answer 401)', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ status: 401, ok: false });
    await authedFetch('http://s/x', {}, async () => null);
    for (const [, init] of (global.fetch as jest.Mock).mock.calls) expect(init.headers.Authorization).toBeUndefined();
  });

  it('on 401 refreshes the token once and retries with the fresh one', async () => {
    const source = jest.fn(async (force?: boolean) => (force ? 'fresh' : 'stale'));
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ status: 401, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true });
    const res = await authedFetch('http://s/route', {}, source);
    expect(res.status).toBe(200);
    expect(source.mock.calls).toEqual([[false], [true]]);
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls[0][1].headers.Authorization).toBe('Bearer stale');
    expect(calls[1][1].headers.Authorization).toBe('Bearer fresh');
  });

  it('does not loop: a second 401 is returned to the caller', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ status: 401, ok: false });
    const res = await authedFetch('http://s/route', {}, async () => 't');
    expect(res.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});

describe('socket handshake auth', () => {
  it('auth is a function that supplies the current token on every (re)connect', async () => {
    mockIo.mockReturnValue(fakeSocket());
    let n = 0;
    createAuthedSocket('http://s', async () => `tok-${++n}`);
    const opts = mockIo.mock.calls[0][1];
    expect(typeof opts.auth).toBe('function'); // not a static object: reconnects must not reuse a stale token
    expect(opts.transports).toEqual(['websocket']);
    expect(await handshake(opts)).toEqual({ token: 'tok-1' });
    expect(await handshake(opts)).toEqual({ token: 'tok-2' }); // simulated reconnect
  });

  it('forces a token refresh on the attempt after the server said "unauthorized"', async () => {
    const sock = fakeSocket();
    mockIo.mockReturnValue(sock);
    const source = jest.fn(async (force?: boolean) => (force ? 'fresh' : 'stale'));
    createAuthedSocket('http://s', source);
    const opts = mockIo.mock.calls[0][1];
    expect(await handshake(opts)).toEqual({ token: 'stale' });
    sock.handlers.connect_error(new Error('unauthorized'));
    expect(await handshake(opts)).toEqual({ token: 'fresh' });
    expect(await handshake(opts)).toEqual({ token: 'stale' }); // only once
  });

  it('other connect errors (e.g. network) do not force a refresh', async () => {
    const sock = fakeSocket();
    mockIo.mockReturnValue(sock);
    const source = jest.fn(async () => 't');
    createAuthedSocket('http://s', source);
    sock.handlers.connect_error(new Error('xhr poll error'));
    await handshake(mockIo.mock.calls[0][1]);
    expect(source).toHaveBeenLastCalledWith(false);
  });

  it('reconnects with a fresh token after a server-initiated disconnect (token expired mid-session)', async () => {
    const sock = fakeSocket();
    mockIo.mockReturnValue(sock);
    const source = jest.fn(async (force?: boolean) => (force ? 'fresh' : 'stale'));
    createAuthedSocket('http://s', source);
    sock.handlers.disconnect('io server disconnect');
    expect(sock.connect).toHaveBeenCalledTimes(1);
    expect(await handshake(mockIo.mock.calls[0][1])).toEqual({ token: 'fresh' });
    sock.connect.mockClear();
    sock.handlers.disconnect('transport close'); // socket.io reconnects these itself
    expect(sock.connect).not.toHaveBeenCalled();
  });

  it('a missing token still produces a handshake (the server refuses it) instead of hanging', async () => {
    mockIo.mockReturnValue(fakeSocket());
    createAuthedSocket('http://s', async () => null);
    expect(await handshake(mockIo.mock.calls[0][1])).toEqual({ token: '' });
    mockIo.mockClear();
    mockIo.mockReturnValue(fakeSocket());
    createAuthedSocket('http://s', async () => { throw new Error('x'); });
    expect(await handshake(mockIo.mock.calls[0][1])).toEqual({ token: '' });
  });

  it('both the default and the /vox namespace use authenticated sockets with the real token source', async () => {
    mockGetIdToken.mockResolvedValue('real-token');
    mockIo.mockImplementation(() => fakeSocket());
    disconnectSockets();
    getLocationSocket();
    getVoxSocket();
    const [loc, vox] = mockIo.mock.calls;
    expect(loc[0]).toBe('http://localhost:3000');
    expect(vox[0]).toBe('http://localhost:3000/vox');
    expect(await handshake(loc[1])).toEqual({ token: 'real-token' });
    expect(await handshake(vox[1])).toEqual({ token: 'real-token' });
    disconnectSockets();
  });
});
