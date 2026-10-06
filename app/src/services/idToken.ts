/**
 * Firebase ID token source for the Node realtime/routing server.
 *
 * The server authenticates every REST request (`Authorization: Bearer <idToken>`) and every Socket.io
 * handshake (`auth.token`) with the rider's Firebase ID token. Tokens expire hourly, so callers ask for
 * one per request / per (re)connect instead of caching it; `getIdToken(true)` forces a refresh (used after a
 * 401 / "unauthorized" handshake).
 */
import auth from '@react-native-firebase/auth';

/** Resolves the current rider's ID token, or null when nobody is signed in / the token cannot be read. */
export type TokenSource = (forceRefresh?: boolean) => Promise<string | null>;

export const getIdToken: TokenSource = async (forceRefresh = false) => {
  try {
    const user = auth().currentUser;
    if (!user) return null;
    return (await user.getIdToken(forceRefresh)) || null;
  } catch {
    return null;
  }
};

/**
 * fetch() with the rider's ID token attached. On a 401 the token is force-refreshed and the request is
 * retried once (covers a token that expired between getIdToken() and the server seeing it).
 */
export async function authedFetch(
  url: string,
  init: RequestInit = {},
  tokenSource: TokenSource = getIdToken,
): Promise<Response> {
  const send = async (forceRefresh: boolean): Promise<Response> => {
    const token = await tokenSource(forceRefresh);
    const headers: Record<string, string> = { ...((init.headers as Record<string, string> | undefined) ?? {}) };
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { ...init, headers });
  };
  const res = await send(false);
  if (res && res.status === 401) return send(true);
  return res;
}
