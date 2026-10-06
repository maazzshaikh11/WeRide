// Express hardening: headers, CORS allow-list, authentication, rate limits,
// membership checks and a non-leaking error handler.

import cors from 'cors';
import { authenticate, parseBearer, isGroupMember, isValidGroupId } from './auth.js';
import { KeyedLimiter } from './token_bucket.js';

/** Hand-rolled security headers (no helmet dependency). API only: no HTML is served. */
export function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  res.removeHeader('X-Powered-By');
  next();
}

/** CORS: only origins in the allow-list get CORS headers. Empty list = none (native apps need no CORS). */
export function corsMiddleware(allowedOrigins) {
  const list = new Set(allowedOrigins);
  return cors({
    origin: (origin, cb) => cb(null, Boolean(origin) && list.has(origin)),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    maxAge: 600,
  });
}

/** Socket.io `cors` option for the same allow-list. */
export function socketCorsOption(allowedOrigins) {
  return { origin: allowedOrigins.length ? [...allowedOrigins] : false };
}

export function clientIp(req, trustProxy) {
  if (trustProxy) {
    const xff = req.headers && req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
  }
  return (req.socket && req.socket.remoteAddress) || req.ip || 'unknown';
}

/** Failed-authentication limiter shared by REST and sockets (keyed by IP). */
export function createAuthFailLimiter(limits) {
  return new KeyedLimiter(limits.authFail);
}

function logAuthFailure(where, reason) {
  // Never the token, never the Authorization header, no uid/PII.
  console.warn(`[auth] rejected ${where}: ${reason}`);
}

/** REST: requires `Authorization: Bearer <Firebase ID token>`; sets req.uid. */
export function requireAuth({ authFail, trustProxy }) {
  return async (req, res, next) => {
    const ip = clientIp(req, trustProxy);
    try {
      const token = parseBearer(req.headers.authorization);
      if (!token) throw new Error('no bearer token');
      const { uid } = await authenticate(token);
      req.uid = uid;
      return next();
    } catch (e) {
      // Only FAILED attempts are charged to the IP, so valid riders behind a shared NAT are never locked out.
      if (!authFail.take(ip)) {
        res.setHeader('Retry-After', String(Math.max(1, authFail.retryAfterSec(ip))));
        return res.status(429).json({ error: 'too many requests' });
      }
      logAuthFailure(`${req.method} ${req.path}`, e && e.name === 'AuthError' ? e.message : 'no bearer token');
      res.setHeader('WWW-Authenticate', 'Bearer');
      return res.status(401).json({ error: 'unauthorized' });
    }
  };
}

/** REST per-uid rate limit (run after requireAuth). */
export function rateLimitByUid(limiter) {
  return (req, res, next) => {
    if (limiter.take(req.uid)) return next();
    res.setHeader('Retry-After', String(Math.max(1, limiter.retryAfterSec(req.uid))));
    return res.status(429).json({ error: 'rate limit exceeded' });
  };
}

/**
 * Membership gate for REST bodies carrying a group_id (run after the JSON
 * parser). `plan-<uid>` is the app's solo route-planning pseudo group and is
 * allowed only for that uid. A missing group_id falls through to the handler's
 * own 400.
 */
export function requireGroupMembership() {
  return async (req, res, next) => {
    const g = req.body && req.body.group_id;
    if (g === undefined || g === null || g === '') return next();
    if (!isValidGroupId(g)) return res.status(400).json({ error: 'group_id is invalid' });
    if (g === `plan-${req.uid}`) return next();
    try {
      if (await isGroupMember(g, req.uid)) return next();
    } catch {
      return res.status(503).json({ error: 'authorization unavailable' });
    }
    logAuthFailure(`${req.method} ${req.path}`, 'not a group member');
    return res.status(403).json({ error: 'forbidden' });
  };
}

/** Last-resort error handler: generic bodies, no stack traces, no message echo. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err && Number.isInteger(err.status) ? err.status : 500;
  if (res.headersSent) return res.end();
  if (err && err.type === 'entity.too.large') return res.status(413).json({ error: 'payload too large' });
  if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid JSON' });
  if (status >= 400 && status < 500) return res.status(status).json({ error: 'bad request' });
  console.error(`[server] unhandled error: ${err && err.name ? err.name : 'Error'}`);
  return res.status(500).json({ error: 'internal error' });
}
