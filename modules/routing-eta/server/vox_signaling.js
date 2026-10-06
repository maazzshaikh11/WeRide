// WebRTC signaling for VOX (Person D).
// Socket.io /vox namespace. Relays SDP offers/answers + ICE candidates + voice_active.
//
// Security: the namespace requires a verified Firebase ID token (handshake
// auth.token). A socket may only join the voice room of a group its uid belongs
// to, and may only address peers that are in that same room (a socket id is
// itself a room name, so unchecked targetId = eavesdropping/injection into any
// connected client).

import { parseGroupId } from './security/validation.js';
import {
  createSecurityContext,
  socketAuthMiddleware,
  onSocketConnected,
  allow,
  memberOf,
  ack,
} from './security/sockets.js';
import { loadSecurityConfig } from './security/config.js';
import { createAuthFailLimiter } from './security/http.js';

export const VOX_ROOM = (groupId) => `vox:${groupId}`;
const MAX_SIGNAL_BYTES = 16 * 1024;

function boundedSignal(v) {
  if (v === undefined || v === null) return false;
  try {
    return JSON.stringify(v).length <= MAX_SIGNAL_BYTES;
  } catch {
    return false;
  }
}

export function setupVoxSignaling(namespace, ctx) {
  if (!ctx) {
    const config = loadSecurityConfig();
    ctx = createSecurityContext(config, createAuthFailLimiter(config.limits));
  }
  namespace.use(socketAuthMiddleware(ctx));

  namespace.on('connection', (socket) => {
    const enqueue = onSocketConnected(ctx, socket);

    socket.on('join', (groupIdArg, cb) => {
      if (!allow(ctx, socket, 'join')) return ack(cb, { ok: false, error: 'rate_limited' });
      const groupId = parseGroupId(groupIdArg);
      if (!groupId) {
        ctx.stats.invalid_payload += 1;
        return ack(cb, { ok: false, error: 'invalid' });
      }
      enqueue(async () => {
        if (!(await memberOf(groupId, socket.data.uid))) {
          ctx.stats.join_denied += 1;
          console.warn('[vox] join denied: not a group member');
          return ack(cb, { ok: false, error: 'forbidden' });
        }
        if (socket.data.groupId && socket.data.groupId !== groupId) {
          socket.leave(VOX_ROOM(socket.data.groupId));
        }
        socket.join(VOX_ROOM(groupId));
        socket.data.groupId = groupId;
        ack(cb, { ok: true });
      });
    });

    // Relay SDP offer/answer / ICE candidate to a specific peer of the SAME group room.
    const relay = (event, field) => (payload) => {
      if (!allow(ctx, socket, 'vox')) return;
      enqueue(async () => {
        const groupId = socket.data.groupId;
        const targetId = payload && payload.targetId;
        if (!groupId || typeof targetId !== 'string' || targetId.length > 64 || targetId === socket.id || !boundedSignal(payload[field])) {
          ctx.stats.invalid_payload += 1;
          return;
        }
        const room = VOX_ROOM(groupId);
        if (!socket.rooms.has(room) || !namespace.adapter.rooms.get(room)?.has(targetId)) {
          ctx.stats.not_in_room += 1;
          return;
        }
        socket.to(targetId).emit(event, { fromId: socket.id, uid: socket.data.uid, [field]: payload[field] });
      });
    };
    socket.on('sdp', relay('sdp', 'sdp'));
    socket.on('ice', relay('ice', 'candidate'));

    // Broadcast voice_active to the group
    socket.on('voice_active', (active) => {
      if (!allow(ctx, socket, 'vox')) return;
      if (typeof active !== 'boolean') {
        ctx.stats.invalid_payload += 1;
        return;
      }
      const groupId = socket.data.groupId;
      if (groupId) {
        socket.to(VOX_ROOM(groupId)).emit('voice_active', { riderId: socket.id, uid: socket.data.uid, active });
      }
    });
  });
}
