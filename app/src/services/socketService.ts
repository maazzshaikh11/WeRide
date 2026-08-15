/**
 * Shared Socket.io client. Location updates use 'location:update' event.
 * VOX signaling uses '/vox' namespace (Person D owns that connection).
 *
 * URL from env: SOCKET_URL (default http://localhost:3000)
 */
import { io, Socket } from 'socket.io-client';

const URL = process.env.SOCKET_URL ?? 'http://localhost:3000';

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

export function disconnectSockets(): void {
  locationSocket?.disconnect();
  voxSocket?.disconnect();
  locationSocket = null;
  voxSocket = null;
}