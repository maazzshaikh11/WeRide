// Authentication + group-membership primitives.
//
// Everything here is INJECTABLE: tests (and bootstrapAuth) install a token
// verifier and a membership provider with the setters below. Nothing is open
// by default: with no verifier installed every authentication attempt fails
// and startServer() refuses to run.

export class AuthError extends Error {
  constructor(message = 'unauthorized') {
    super(message);
    this.name = 'AuthError';
  }
}

export const MAX_TOKEN_LEN = 4096;
export const ID_RE = /^[A-Za-z0-9_.:-]{1,128}$/; // uids / rider ids
export const GROUP_ID_RE = /^[A-Za-z0-9_-]{1,128}$/; // Firestore doc ids / plan-<uid>
export const isValidGroupId = (g) => typeof g === 'string' && GROUP_ID_RE.test(g);

let verifier = null; // (idToken) => Promise<{uid:string, exp?:number}>
let membership = null; // MembershipCache

/** Install the ID-token verifier. fn(token) resolves {uid, exp?} or throws. */
export function setTokenVerifier(fn) {
  verifier = typeof fn === 'function' ? fn : null;
}

export function getTokenVerifier() {
  return verifier;
}

/**
 * Install the group-membership source.
 * @param {(groupId:string)=>Promise<string[]>} fetchMembers member uids of the group
 */
export function setMembershipProvider(fetchMembers, opts = {}) {
  membership = typeof fetchMembers === 'function' ? new MembershipCache(fetchMembers, opts) : null;
}

export function getMembership() {
  return membership;
}

export function resetAuth() {
  verifier = null;
  membership = null;
}

/** Verify a raw ID token. Throws AuthError (generic message: never echo the token). */
export async function authenticate(token) {
  if (!verifier) throw new AuthError('auth not configured');
  if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LEN) {
    throw new AuthError('missing or malformed token');
  }
  let decoded;
  try {
    decoded = await verifier(token);
  } catch {
    throw new AuthError('invalid token');
  }
  const uid = decoded && decoded.uid;
  if (typeof uid !== 'string' || !ID_RE.test(uid)) throw new AuthError('invalid token');
  const exp = Number.isFinite(decoded.exp) ? decoded.exp : undefined; // seconds since epoch
  return { uid, exp };
}

/** "Bearer <token>" -> token, else null. */
export function parseBearer(header) {
  if (typeof header !== 'string') return null;
  const m = /^Bearer ([^\s]+)$/.exec(header.trim());
  return m ? m[1] : null;
}

/**
 * Cached `groups/{id}.member_ids` lookups.
 *  - positive answers come from a cache entry younger than ttlMs;
 *  - a miss against an entry older than minRefreshMs refetches (a rider who
 *    has just joined must not be locked out by a stale negative);
 *  - any fetch failure drops the entry and denies (fail closed).
 */
export class MembershipCache {
  constructor(
    fetchMembers,
    { ttlMs = 30_000, minRefreshMs = 2_000, now = Date.now, maxEntries = 5000, allowAll = false } = {}
  ) {
    this._allowAll = allowAll; // dev only: every uid is a member of every (well-formed) group
    this._fetch = fetchMembers;
    this._ttl = ttlMs;
    this._minRefresh = minRefreshMs;
    this._now = now;
    this._max = maxEntries;
    this._entries = new Map(); // groupId -> {members:Set, at:number}
    this._inflight = new Map();
  }

  async _load(groupId) {
    if (this._inflight.has(groupId)) return this._inflight.get(groupId);
    const p = (async () => {
      try {
        const list = await this._fetch(groupId);
        const members = new Set(Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []);
        if (this._entries.size >= this._max) this._entries.delete(this._entries.keys().next().value);
        this._entries.set(groupId, { members, at: this._now() });
        return members;
      } catch (e) {
        this._entries.delete(groupId); // invalidate on failure
        throw e;
      } finally {
        this._inflight.delete(groupId);
      }
    })();
    this._inflight.set(groupId, p);
    return p;
  }

  invalidate(groupId) {
    if (groupId === undefined) this._entries.clear();
    else this._entries.delete(groupId);
  }

  /** @returns {Promise<boolean>} true only when uid is a current member. Throws if the source is unavailable. */
  async isMember(groupId, uid) {
    if (!isValidGroupId(groupId) || typeof uid !== 'string' || !uid) return false;
    if (this._allowAll) return true;
    const e = this._entries.get(groupId);
    const age = e ? this._now() - e.at : Infinity;
    if (e && age < this._ttl && e.members.has(uid)) return true;
    if (e && age < this._ttl && age < this._minRefresh) return false; // fresh negative, do not hammer the source
    return (await this._load(groupId)).has(uid);
  }
}

/** Convenience: membership check via the installed provider. Throws when none is installed. */
export async function isGroupMember(groupId, uid) {
  if (!membership) throw new Error('membership provider not configured');
  return membership.isMember(groupId, uid);
}

// ---------------------------------------------------------------- dev auth
const DEV_UID_RE = /^[A-Za-z0-9_.-]{1,128}$/;

/**
 * Local-development verifier: accepts "dev:<uid>". Opt-in only, never in
 * production. Marked `insecure` so assertAuthConfigured can refuse it there.
 */
export function createDevVerifier() {
  const fn = async (token) => {
    const m = /^dev:(.+)$/.exec(token);
    if (!m || !DEV_UID_RE.test(m[1])) throw new Error('bad dev token');
    return { uid: m[1] };
  };
  fn.insecure = true;
  return fn;
}

export function installDevAuth(config, log = console.warn) {
  if (config.isProd) throw new Error('dev auth is forbidden when NODE_ENV=production');
  log(
    '\n' +
      '!!! ================================================================ !!!\n' +
      '!!!  ALLOW_INSECURE_DEV_AUTH=1  -  ANY client can sign in as ANY user  !!!\n' +
      '!!!  by sending the token "dev:<uid>". DEVELOPMENT ONLY. Never expose  !!!\n' +
      '!!!  this server to a network you do not control.                      !!!\n' +
      '!!! ================================================================ !!!\n'
  );
  setTokenVerifier(createDevVerifier());
  // Dev has no Firestore: every dev user may join any group, unless a map is
  // supplied: DEV_GROUP_MEMBERS='{"g1":["alice","bob"]}'.
  let map = null;
  try {
    map = process.env.DEV_GROUP_MEMBERS ? JSON.parse(process.env.DEV_GROUP_MEMBERS) : null;
  } catch {
    map = null;
  }
  setMembershipProvider(async (groupId) => (map && Array.isArray(map[groupId]) ? map[groupId] : []), {
    allowAll: !map,
  });
}

/** Throws unless a usable verifier + membership provider are installed. */
export function assertAuthConfigured(config) {
  if (!verifier) {
    throw new Error(
      'No ID-token verifier configured: refusing to start. In production set FIREBASE_PROJECT_ID and ' +
        'GOOGLE_APPLICATION_CREDENTIALS (or FIREBASE_SERVICE_ACCOUNT_JSON). For local development only, ' +
        'set ALLOW_INSECURE_DEV_AUTH=1.'
    );
  }
  if (config.isProd && verifier.insecure) {
    throw new Error('Insecure dev verifier installed under NODE_ENV=production: refusing to start.');
  }
  if (!membership) throw new Error('No group-membership provider configured: refusing to start.');
}

/**
 * Wire authentication for the current environment and verify it is complete.
 *  - production: firebase-admin verifier + Firestore membership (credentials
 *    from the environment). Missing config -> throws.
 *  - ALLOW_INSECURE_DEV_AUTH=1 (non-production): dev verifier, loud warning.
 *  - otherwise: keeps whatever was injected (tests); throws if nothing is.
 */
export async function bootstrapAuth(config, env = process.env) {
  if (config.isProd && config.allowInsecureDevAuth) {
    throw new Error('ALLOW_INSECURE_DEV_AUTH is forbidden when NODE_ENV=production');
  }
  if (config.allowInsecureDevAuth) {
    installDevAuth(config);
  } else if (!verifier || !membership) {
    if (config.isProd || env.FIREBASE_PROJECT_ID || env.GOOGLE_CLOUD_PROJECT) {
      const { createFirebaseAuthDeps } = await import('./firebase.js');
      const deps = await createFirebaseAuthDeps(env);
      if (!verifier) setTokenVerifier(deps.verifier);
      if (!membership) setMembershipProvider(deps.fetchMembers, { ttlMs: config.membershipTtlMs });
    }
  }
  assertAuthConfigured(config);
}
