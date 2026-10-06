// Security configuration, read from the environment (never hard-coded).

const num = (v, d) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n > 0 ? n : d;
};

export function parseOrigins(v) {
  return String(v || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*'); // a wildcard is never honoured
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @throws when the combination is unsafe (dev auth requested in production).
 */
export function loadSecurityConfig(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  const allowInsecureDevAuth = env.ALLOW_INSECURE_DEV_AUTH === '1';
  if (isProd && allowInsecureDevAuth) {
    throw new Error(
      'ALLOW_INSECURE_DEV_AUTH=1 is forbidden when NODE_ENV=production. ' +
        'Refusing to start: it would accept unauthenticated "dev:<uid>" tokens.'
    );
  }
  return {
    isProd,
    allowInsecureDevAuth,
    // Browsers only. Native apps send no Origin / need no CORS. Default: none.
    allowedOrigins: parseOrigins(env.ALLOWED_ORIGINS),
    trustProxy: env.TRUST_PROXY === '1',
    bodyLimit: env.BODY_LIMIT || '64kb',
    flBodyLimit: env.FL_BODY_LIMIT || '256kb', // model deltas are larger than route requests
    membershipTtlMs: num(env.MEMBERSHIP_TTL_MS, 30_000),
    maxSocketsPerUid: num(env.MAX_SOCKETS_PER_UID, 10),
    limits: {
      // socket events: burst = capacity, sustained = refillPerSec
      location: { capacity: num(env.RL_LOCATION_BURST, 10), refillPerSec: num(env.RL_LOCATION_PER_SEC, 5) },
      signal: { capacity: num(env.RL_SIGNAL_BURST, 10), refillPerSec: num(env.RL_SIGNAL_PER_SEC, 1) },
      join: { capacity: num(env.RL_JOIN_BURST, 10), refillPerSec: num(env.RL_JOIN_PER_MIN, 10) / 60 },
      vox: { capacity: num(env.RL_VOX_BURST, 50), refillPerSec: num(env.RL_VOX_PER_SEC, 20) },
      // REST, per uid
      route: { capacity: num(env.RL_ROUTE_PER_MIN, 30), refillPerSec: num(env.RL_ROUTE_PER_MIN, 30) / 60 },
      flSubmit: { capacity: num(env.RL_FL_SUBMIT_PER_MIN, 10), refillPerSec: num(env.RL_FL_SUBMIT_PER_MIN, 10) / 60 },
      flGlobal: { capacity: num(env.RL_FL_GLOBAL_PER_MIN, 30), refillPerSec: num(env.RL_FL_GLOBAL_PER_MIN, 30) / 60 },
      // failed authentications per client IP (garbage-token flood)
      authFail: { capacity: num(env.RL_AUTH_FAIL_PER_MIN, 20), refillPerSec: num(env.RL_AUTH_FAIL_PER_MIN, 20) / 60 },
    },
  };
}
