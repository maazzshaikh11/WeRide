/**
 * Shared Socket.io client. Location updates use 'location:update' event.
 * VOX signaling uses '/vox' namespace (Person D owns that connection).
 *
 * URL from env: SOCKET_URL (platform-aware dev default, see endpoints.ts)
 */
import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL } from './endpoints';
import { getIdToken, TokenSource } from './idToken';

// Dev default is platform-aware (see endpoints.ts). Physical devices: set
// SOCKET_URL in app/.env (e.g. http://<LAN-IP>:3000).
const URL = SOCKET_BASE_URL;

let locationSocket: Socket | null = null;
let voxSocket: Socket | null = null;

/**
 * Socket.io client for the authenticated server. The handshake carries the rider's Firebase ID token
 * (`auth.token`); `auth` is a FUNCTION so every (re)connect fetches a fresh token (they expire hourly).
 * The server refuses a socket with no / a bad token ('unauthorized'): the next attempt force-refreshes the
 * token. A server-initiated disconnect (the token expired mid-session) does not auto-reconnect in
 * socket.io, so it is reconnected here with a fresh token.
 */
export function createAuthedSocket(url: string, tokenSource: TokenSource = getIdToken): Socket {
  let forceRefresh = false;
  const socket = io(url, {
    transports: ['websocket'],
    autoConnect: false,
    auth: (cb) => {
      const force = forceRefresh;
      forceRefresh = false;
      tokenSource(force)
        .then((token) => cb({ token: token ?? '' }))
        .catch(() => cb({ token: '' }));
    },
  });
  socket.on('connect_error', (err: Error) => {
    if (err?.message === 'unauthorized') forceRefresh = true;
  });
  socket.on('disconnect', (reason: string) => {
    if (reason === 'io server disconnect') {
      forceRefresh = true;
      socket.connect();
    }
  });
  return socket;
}

export function getLocationSocket(): Socket {
  if (!locationSocket) {
    locationSocket = createAuthedSocket(URL);
    locationSocket.connect();
  }
  return locationSocket;
}

/** Person D owns the /vox namespace usage; this just provides the connection. */
export function getVoxSocket(): Socket {
  if (!voxSocket) {
    voxSocket = createAuthedSocket(`${URL}/vox`);
    voxSocket.connect();
  }
  return voxSocket;
}

/** Emit a quick rider signal (spec §3.3.7: Wait up / Pull over / All good / Need fuel). */
export function sendSignal(payload: { group_id: string; rider_id: string; label: string }): void {
  getLocationSocket().emit('signal:send', payload);
}

export function disconnectSockets(): void {
  locationSocket?.disconnect();
  voxSocket?.disconnect();
  locationSocket = null;
  voxSocket = null;
}