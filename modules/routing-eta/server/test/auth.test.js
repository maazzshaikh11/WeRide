import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  authenticate, parseBearer, resetAuth, setTokenVerifier, setMembershipProvider, MembershipCache,
  createDevVerifier, installDevAuth, assertAuthConfigured, bootstrapAuth, getTokenVerifier, isGroupMember,
} from '../security/auth.js';
import { loadSecurityConfig } from '../security/config.js';

beforeEach(() => resetAuth());

describe('token verification', () => {
  test('fails closed when no verifier is installed', async () => {
    await assert.rejects(authenticate('anything'), /not configured/);
  });

  test('accepts a verifier result, rejects bad uid shapes and verifier errors', async () => {
    setTokenVerifier(async (t) => { if (t === 'good') return { uid: 'u1', exp: 123 }; if (t === 'weird') return { uid: '../x' }; throw new Error('boom: SECRET'); });
    assert.deepEqual(await authenticate('good'), { uid: 'u1', exp: 123 });
    await assert.rejects(authenticate('weird'), { name: 'AuthError' });
    await assert.rejects(authenticate('bad'), (e) => e.name === 'AuthError' && !String(e.message).includes('SECRET'));
    await assert.rejects(authenticate(''), { name: 'AuthError' });
    await assert.rejects(authenticate(undefined), { name: 'AuthError' });
    await assert.rejects(authenticate('x'.repeat(5000)), { name: 'AuthError' });
  });

  test('parseBearer', () => {
    assert.equal(parseBearer('Bearer abc.def'), 'abc.def');
    for (const h of [undefined, '', 'Bearer', 'Bearer  ', 'Basic abc', 'bearer abc', 'Bearer a b']) assert.equal(parseBearer(h), null, String(h));
  });
});

describe('dev auth (explicit opt-in only)', () => {
  test('dev verifier accepts dev:<uid> only', async () => {
    const v = createDevVerifier();
    assert.deepEqual(await v('dev:alice'), { uid: 'alice' });
    await assert.rejects(v('alice'));
    await assert.rejects(v('dev:'));
    await assert.rejects(v('dev:../x'));
  });

  test('ALLOW_INSECURE_DEV_AUTH=1 under NODE_ENV=production is refused (config)', () => {
    assert.throws(() => loadSecurityConfig({ NODE_ENV: 'production', ALLOW_INSECURE_DEV_AUTH: '1' }), /forbidden/);
  });

  test('installDevAuth refuses production and warns loudly otherwise', () => {
    assert.throws(() => installDevAuth({ isProd: true }, () => {}), /forbidden/);
    const logs = [];
    installDevAuth({ isProd: false }, (m) => logs.push(m));
    assert.match(logs.join(''), /ANY client can sign in as ANY user/);
  });

  test('a dev verifier smuggled into a production process is refused at startup', () => {
    setTokenVerifier(createDevVerifier());
    setMembershipProvider(async () => []);
    assert.throws(() => assertAuthConfigured({ isProd: true }), /Insecure dev verifier/);
  });

  test('dev flag is only honoured when exactly "1"', () => {
    assert.equal(loadSecurityConfig({ ALLOW_INSECURE_DEV_AUTH: 'true' }).allowInsecureDevAuth, false);
    assert.equal(loadSecurityConfig({ ALLOW_INSECURE_DEV_AUTH: '1' }).allowInsecureDevAuth, true);
  });
});

describe('server refuses to start without a verifier', () => {
  test('production without Firebase config rejects', async () => {
    await assert.rejects(bootstrapAuth(loadSecurityConfig({ NODE_ENV: 'production' }), { NODE_ENV: 'production' }), /FIREBASE_PROJECT_ID/);
    assert.equal(getTokenVerifier(), null);
  });

  test('production with a project id but no credentials rejects', async () => {
    const env = { NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'p' };
    await assert.rejects(bootstrapAuth(loadSecurityConfig(env), env), /credentials missing/);
  });

  test('production + dev flag rejects', async () => {
    const env = { NODE_ENV: 'production', ALLOW_INSECURE_DEV_AUTH: '1' };
    await assert.rejects(async () => bootstrapAuth(loadSecurityConfig(env), env), /forbidden/);
  });

  test('development without the opt-in and without a verifier rejects (never open by default)', async () => {
    await assert.rejects(bootstrapAuth(loadSecurityConfig({}), {}), /No ID-token verifier/);
  });

  test('development with the opt-in starts with the dev verifier', async () => {
    const orig = console.warn; console.warn = () => {};
    try {
      await bootstrapAuth(loadSecurityConfig({ ALLOW_INSECURE_DEV_AUTH: '1' }), { ALLOW_INSECURE_DEV_AUTH: '1' });
    } finally { console.warn = orig; }
    assert.equal((await authenticate('dev:alice')).uid, 'alice');
    assert.equal(await isGroupMember('anygroup', 'alice'), true);
  });

  test('injected verifier + membership (tests / custom wiring) satisfy the check', async () => {
    setTokenVerifier(async () => ({ uid: 'u' }));
    setMembershipProvider(async () => ['u']);
    await bootstrapAuth(loadSecurityConfig({ NODE_ENV: 'production' }), {});
  });

  test('verifier without membership provider rejects', () => {
    setTokenVerifier(async () => ({ uid: 'u' }));
    assert.throws(() => assertAuthConfigured({ isProd: false }), /membership/);
  });
});

describe('membership cache', () => {
  const clock = () => { let t = 0; const f = () => t; f.advance = (ms) => { t += ms; }; return f; };

  test('caches positives within the TTL, refetches after', async () => {
    const now = clock(); let calls = 0;
    const c = new MembershipCache(async () => { calls++; return ['a']; }, { ttlMs: 1000, now });
    assert.equal(await c.isMember('g', 'a'), true);
    assert.equal(await c.isMember('g', 'a'), true);
    assert.equal(calls, 1);
    now.advance(1001);
    assert.equal(await c.isMember('g', 'a'), true);
    assert.equal(calls, 2);
  });

  test('a removed member is denied once the TTL passes', async () => {
    const now = clock(); let members = ['a', 'b'];
    const c = new MembershipCache(async () => members, { ttlMs: 1000, minRefreshMs: 0, now });
    assert.equal(await c.isMember('g', 'a'), true);
    members = ['b'];
    now.advance(1001);
    assert.equal(await c.isMember('g', 'a'), false);
  });

  test('a rider who just joined is not locked out by a stale negative (refetch after minRefresh)', async () => {
    const now = clock(); let members = [];
    const c = new MembershipCache(async () => members, { ttlMs: 30_000, minRefreshMs: 2000, now });
    assert.equal(await c.isMember('g', 'a'), false);
    members = ['a'];
    assert.equal(await c.isMember('g', 'a'), false); // still inside the anti-hammering window
    now.advance(2001);
    assert.equal(await c.isMember('g', 'a'), true);
  });

  test('fetch failure invalidates the entry and fails closed', async () => {
    const now = clock(); let fail = false;
    const c = new MembershipCache(async () => { if (fail) throw new Error('down'); return ['a']; }, { ttlMs: 1000, minRefreshMs: 0, now });
    assert.equal(await c.isMember('g', 'a'), true);
    now.advance(1001);
    fail = true;
    await assert.rejects(c.isMember('g', 'a'));
    fail = false;
    let calls = 0;
    const c2 = new MembershipCache(async () => { calls++; if (calls === 1) throw new Error('x'); return ['a']; }, { now });
    await assert.rejects(c2.isMember('g', 'a'));
    assert.equal(await c2.isMember('g', 'a'), true); // failure was not cached
  });

  test('invalid group ids never reach the source', async () => {
    let calls = 0;
    const c = new MembershipCache(async () => { calls++; return ['a']; });
    for (const g of ['../x', 'a/b', '', 5, null]) assert.equal(await c.isMember(g, 'a'), false);
    assert.equal(calls, 0);
  });

  test('concurrent lookups share one fetch', async () => {
    let calls = 0;
    const c = new MembershipCache(async () => { calls++; await new Promise((r) => setTimeout(r, 10)); return ['a']; });
    await Promise.all([c.isMember('g', 'a'), c.isMember('g', 'a'), c.isMember('g', 'b')]);
    assert.equal(calls, 1);
  });
});
