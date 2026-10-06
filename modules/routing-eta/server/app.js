// Server factory: Express REST + Socket.io (live location fan-out, signals, VOX).
//
// Every connection and request is authenticated with the rider's Firebase ID
// token; see docs/security/server.md for the threat model.

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

import { handleRoute } from './astar.js';
import { handleFlSubmit, handleFlGlobal } from './fl_proxy.js';
import { setupVoxSignaling } from './vox_signaling.js';
import { loadSecurityConfig } from './security/config.js';
import { KeyedLimiter } from './security/token_bucket.js';
import {
  securityHeaders,
  corsMiddleware,
  socketCorsOption,
  requireAuth,
  rateLimitByUid,
  requireGroupMembership,
  errorHandler,
  createAuthFailLimiter,
} from './security/http.js';
import { sanitizeLocationPayload, sanitizeSignalPayload, parseGroupId, SIGNAL_LABELS } from './security/validation.js';
import {
  GROUP_ROOM,
  MAX_GROUPS_PER_SOCKET,
  createSecurityContext,
  socketAuthMiddleware,
  onSocketConnected,
  allow,
  memberOf,
  ack,
} from './security/sockets.js';

export { SIGNAL_LABELS };

/**
 * @param {ReturnType<typeof loadSecurityConfig>} [config]
 * @returns {{app, server, io, ctx}}
 */
export function createRealtimeServer(config = loadSecurityConfig()) {
  const authFail = createAuthFailLimiter(config.limits);
  const ctx = createSecurityContext(config, authFail);

  // ---------------------------------------------------------------- REST
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', true);
  app.use(securityHeaders);
  app.use(corsMiddleware(config.allowedOrigins));

  const auth = requireAuth({ authFail, trustProxy: config.trustProxy });
  const routeLimit = rateLimitByUid(new KeyedLimiter(config.limits.route));
  const flSubmitLimit = rateLimitByUid(new KeyedLimiter(config.limits.flSubmit));
  const flGlobalLimit = rateLimitByUid(new KeyedLimiter(config.limits.flGlobal));
  // Authentication runs BEFORE the body is parsed: anonymous callers cannot make us read/parse bodies.
  const json = express.json({ limit: config.bodyLimit });
  const flJson = express.json({ limit: config.flBodyLimit });

  // Routing/ETA API (Person C)
  app.post('/route', auth, routeLimit, json, requireGroupMembership(), handleRoute);

  // FL aggregation proxy (Person D). The submitting identity is the verified uid, never the body's claim.
  app.post(
    '/fl/submit',
    auth,
    flSubmitLimit,
    flJson,
    (req, res, next) => {
      if (req.body && typeof req.body === 'object') req.body.client_id = req.uid;
      next();
    },
    handleFlSubmit
  );
  app.get('/fl/global', auth, flGlobalLimit, handleFlGlobal);

  app.use((req, res) => res.status(404).json({ error: 'not found' }));
  app.use(errorHandler);

  const server = http.createServer(app);

  // ---------------------------------------------------------------- sockets
  const io = new Server(server, {
    cors: socketCorsOption(config.allowedOrigins),
    maxHttpBufferSize: 64 * 1024, // location/signal/sdp payloads are tiny; default is 1 MB
  });

  setupVoxSignaling(io.of('/vox'), ctx);

  // Live location fan-out (Person A).
  // A socket joins a per-group room ONLY if its verified uid is in the group's
  // member_ids. location:update / signal:send are forwarded only to a room this
  // socket is in, and only with rider_id == the verified uid. The sender does
  // not receive its own echo (socket.to excludes the sender).
  io.use(socketAuthMiddleware(ctx));

  io.on('connection', (socket) => {
    const enqueue = onSocketConnected(ctx, socket);
    const uid = socket.data.uid;

    socket.on('join-group', (msg, cb) => {
      if (!allow(ctx, socket, 'join')) return ack(cb, { ok: false, error: 'rate_limited' });
      const groupId = parseGroupId(msg);
      if (!groupId) {
        ctx.stats.invalid_payload += 1;
        return ack(cb, { ok: false, error: 'invalid' });
      }
      enqueue(async () => {
        const room = GROUP_ROOM(groupId);
        if (!socket.rooms.has(room)) {
          const joined = [...socket.rooms].filter((r) => r.startsWith('group:')).length;
          if (joined >= MAX_GROUPS_PER_SOCKET) return ack(cb, { ok: false, error: 'too_many_groups' });
        }
        if (!(await memberOf(groupId, uid))) {
          ctx.stats.join_denied += 1;
          console.warn('[auth] join-group denied: not a group member');
          return ack(cb, { ok: false, error: 'forbidden' });
        }
        socket.join(room);
        ack(cb, { ok: true });
      });
    });

    socket.on('leave-group', (msg) => {
      const groupId = parseGroupId(msg);
      if (groupId) socket.leave(GROUP_ROOM(groupId));
    });

    // Shared gate for room-scoped events. Resolves to the room name or null (and counts why).
    const authorise = async (payload, riderId, groupId) => {
      if (payload.rider_id !== uid) {
        ctx.stats.spoof_rejected += 1;
        console.warn(`[auth] ${riderId} rejected: rider_id does not match the authenticated user`);
        return null;
      }
      const room = GROUP_ROOM(groupId);
      if (!socket.rooms.has(room)) {
        ctx.stats.not_in_room += 1;
        return null;
      }
      // Cached lookup: a member removed from the group loses the room within the cache TTL.
      if (!(await memberOf(groupId, uid))) {
        ctx.stats.membership_revoked += 1;
        socket.leave(room);
        return null;
      }
      return room;
    };

    // Relay a quick signal to the rest of the sender's group as `signal:received`.
    socket.on('signal:send', (payload) => {
      if (!allow(ctx, socket, 'signal')) return;
      enqueue(async () => {
        const clean = sanitizeSignalPayload(payload);
        if (!clean) {
          ctx.stats.invalid_payload += 1;
          return;
        }
        const room = await authorise(clean, 'signal:send', clean.group_id);
        if (!room) return;
        socket.to(room).emit('signal:received', {
          group_id: clean.group_id,
          rider_id: uid, // server-attested
          label: clean.label,
          sent_at: Date.now(),
        });
      });
    });

    socket.on('location:update', (payload) => {
      if (!allow(ctx, socket, 'location')) return;
      enqueue(async () => {
        const clean = sanitizeLocationPayload(payload);
        if (!clean) {
          // Malformed payloads are dropped, never forwarded.
          ctx.stats.invalid_payload += 1;
          return;
        }
        const room = await authorise(clean, 'location:update', clean.group_id);
        if (!room) return;
        socket.to(room).emit('location:update', clean);
      });
    });
  });

  return { app, server, io, ctx };
}
