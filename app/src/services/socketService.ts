/**
 * Shared Socket.io client. Location updates use 'location:update' event.
 * VOX signaling uses '/vox' namespace (Person D owns that connection).
 *
 * URL from env: SOCKET_URL (platform-aware dev default, see endpoints.ts)
 */
import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL } from './endpoints';

// Dev default is platform-aware (see endpoints.ts). Physical devices: set
// SOCKET_URL in app/.env (e.g. http://<LAN-IP>:3000).
const URL = SOCKET_BASE_URL;

let locationSocket: Socket | null = null;
let voxSocket: Socket | null = null;

export function getLocationSocket(): Socket {
  if (!locationSocket) {
    locationSocket = io(URL, { transports: ['websocket'], autoConnect: false });
    locationSocket.connect();
  }
  return locationSocket;
}

/** Person D owns the /vox namespace usage; this just provides the connection. */
export function getVoxSocket(): Socket {
  if (!voxSocket) {
    voxSocket = io(`${URL}/vox`, { transports: ['websocket'], autoConnect: false });
    voxSocket.connect();
  }
  return voxSocket;
}

/** Emit a quick rider signal (spec §3.3.7: Wait for me / Pull over / All good / Need fuel). */
export function sendSignal(payload: { group_id: string; rider_id: string; label: string }): void {
  getLocationSocket().emit('signal:send', payload);
}

export function disconnectSockets(): void {
  locationSocket?.disconnect();
  voxSocket?.disconnect();
  locationSocket = null;
  voxSocket = null;
}