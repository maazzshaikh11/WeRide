// Socket.io authentication, authorisation and abuse protection.
//
// Shared by the default namespace (live location / signals) and /vox.

import { authenticate, isGroupMember } from './auth.js';
import { KeyedLimiter, TokenBucket } from './token_bucket.js';
import { clientIp } from './http.js';

export const GROUP_ROOM = (groupId) => `group:${groupId}`;
export const MAX_GROUPS_PER_SOCKET = 10;

export function newStats() {
  return {
    auth_rejected: 0, // handshake without a valid ID token
    connections_refused: 0, // too many sockets for one uid
    join_denied: 0, // join-group / vox join for a group the uid is not in
    spoof_rejected: 0, // payload.rider_id != verified uid
    not_in_room: 0, // event for a room this socket has not joined
    rate_limited: 0, // dropped by a token bucket
    invalid_payload: 0, // failed validation
    membership_revoked: 0, // member removed since join: kicked from the room
  };
}

/** Everything the socket layer shares across namespaces. */
export function createSecurityContext(config, authFail) {
  const lim = config.limits;
  return {
    config,
    stats: newStats(),
    authFail,
    socketsPerUid: new Map(),
    uidLimiters: {
      location: new KeyedLimiter(lim.location),
      signal: new KeyedLimiter(lim.signal),
      join: new KeyedLimiter(lim.join),
      vox: new KeyedLimiter(lim.vox),
    },
  };
}

/** Per-socket token buckets (the per-connection half of the rate limit). */
export function newSocketBuckets(config) {
  const lim = config.limits;
  return {
    location: new TokenBucket(lim.location),
    signal: new TokenBucket(lim.signal),
    join: new TokenBucket(lim.join),
    vox: new TokenBucket(lim.vox),
  };
}

/** true when the event may proceed: both the connection and the uid have budget. */
export function allow(ctx, socket, kind) {
  const okConn = socket.data.buckets[kind].take();
  const okUid = ctx.uidLimiters[kind].take(socket.data.uid);
  if (okConn && okUid) return true;
  ctx.stats.rate_limited += 1;
  return false;
}

/** namespace.use(...) handshake authentication: handshake `auth.token` = Firebase ID token. */
export function socketAuthMiddleware(ctx) {
  return async (socket, next) => {
    const reject = (reason, msg) => {
      ctx.stats.auth_rejected += 1;
      // no token, no uid, no PII in logs
      console.warn(`[auth] rejected socket handshake on ${socket.nsp.name}: ${reason}`);
      next(new Error(msg));
    };
    try {
      const ip = clientIp({ headers: socket.handshake.headers, socket: { remoteAddress: socket.handshake.address } }, ctx.config.trustProxy);
      const token = socket.handshake.auth && socket.handshake.auth.token;
      let who;
      try {
        who = await authenticate(token);
      } catch (e) {
        // Only failures are charged to the IP; a flood of garbage tokens gets throttled.
        if (!ctx.authFail.take(ip)) return reject('too many failed attempts', 'rate limited');
        return reject(e && e.message ? e.message : 'invalid token', 'unauthorized');
      }
      if ((ctx.socketsPerUid.get(who.uid) || 0) >= ctx.config.maxSocketsPerUid) {
        ctx.stats.connections_refused += 1;
        return next(new Error('too many connections'));
      }
      socket.data.uid = who.uid;
      socket.data.exp = who.exp;
      socket.data.buckets = newSocketBuckets(ctx.config);
      return next();
    } catch {
      return reject('internal error', 'unauthorized');
    }
  };
}

/**
 * Called from the 'connection' handler: tracks per-uid socket count, expires
 * the socket when its ID token does (the client reconnects with a fresh one),
 * and returns a serial event queue so async membership checks never reorder
 * events (join-group then location:update must behave as emitted).
 */
export function onSocketConnected(ctx, socket) {
  const uid = socket.data.uid;
  ctx.socketsPerUid.set(uid, (ctx.socketsPerUid.get(uid) || 0) + 1);
  let timer = null;
  if (Number.isFinite(socket.data.exp)) {
    const ms = Math.max(0, socket.data.exp * 1000 - Date.now());
    timer = setTimeout(() => socket.disconnect(true), Math.min(ms, 2 ** 31 - 1));
    timer.unref?.();
  }
  socket.on('disconnect', () => {
    if (timer) clearTimeout(timer);
    const n = (ctx.socketsPerUid.get(uid) || 1) - 1;
    if (n <= 0) ctx.socketsPerUid.delete(uid);
    else ctx.socketsPerUid.set(uid, n);
  });

  let chain = Promise.resolve();
  let pending = 0;
  return (fn) => {
    if (pending >= 200) return; // flood protection beyond the rate limits
    pending += 1;
    chain = chain.then(fn).catch(() => {}).finally(() => { pending -= 1; });
  };
}

/** Membership check that fails closed. */
export async function memberOf(groupId, uid) {
  try {
    return await isGroupMember(groupId, uid);
  } catch {
    return false;
  }
}

export const ack = (cb, body) => {
  if (typeof cb === 'function') {
    try { cb(body); } catch { /* client ack misuse must not crash the server */ }
  }
};
