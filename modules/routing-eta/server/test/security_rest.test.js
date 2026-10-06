/**
 * Attack-style tests for the REST surface (POST /route, /fl/submit, GET /fl/global).
 *
 * Original behaviour: cors() open to everyone, express.json({limit:'10mb'}),
 * no authentication, no rate limiting, 500 responses echoed e.message.
 *
 * Run: NODE_ENV=test node --test test/security_rest.test.js
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
delete process.env.MAPBOX_ACCESS_TOKEN; // never spend a real token from a test
const { createRealtimeServer } = await import('../app.js');
const { loadSecurityConfig } = await import('../security/config.js');
const { installFakeAuth, tokenFor, wait } = await import('./helpers/auth.js');
const { setMembershipProvider } = await import('../security/auth.js');

const routeBody = (over = {}) => ({
  group_id: 'gA',
  origin: { lat: 40.7128, lng: -74.006 },
  destination: { lat: 40.714, lng: -74.0089 },
  avoid_hazard_types: [],
  ...over,
});

describe('REST security', () => {
  let srv, base;
  const post = (path, body, headers = {}) =>
    fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  const asUser = (uid) => ({ Authorization: `Bearer ${tokenFor(uid)}` });

  before(async () => {
    installFakeAuth({ gA: ['alice', 'bob'], gB: ['carol'] });
    srv = createRealtimeServer(
      loadSecurityConfig({
        NODE_ENV: 'test',
        ALLOWED_ORIGINS: 'https://app.weride.example, *',
        RL_ROUTE_PER_MIN: '1000',
        RL_FL_SUBMIT_PER_MIN: '1000',
        RL_FL_GLOBAL_PER_MIN: '1000',
        RL_AUTH_FAIL_PER_MIN: '100000',
      })
    );
    await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
    base = `http://127.0.0.1:${srv.server.address().port}`;
  });
  after(async () => {
    srv.io.close();
    await new Promise((r) => srv.server.close(() => r()));
  });

  describe('authentication', () => {
    it('ATTACK: POST /route without a token -> 401', async () => {
      const r = await post('/route', routeBody());
      assert.equal(r.status, 401);
      assert.equal(r.headers.get('www-authenticate'), 'Bearer');
      assert.deepEqual(await r.json(), { error: 'unauthorized' });
    });

    it('ATTACK: bad / forged / malformed tokens -> 401 on every endpoint', async () => {
      const bads = [
        'Bearer forged-token',
        'Bearer dev:alice', // dev tokens are not accepted without the explicit dev opt-in
        'Basic YWxpY2U6cHc=',
        'Bearer',
        `Bearer ${'x'.repeat(10_000)}`,
        tokenFor('alice'), // missing the Bearer scheme
      ];
      for (const h of bads) {
        assert.equal((await post('/route', routeBody(), { Authorization: h })).status, 401, h.slice(0, 30));
        assert.equal((await post('/fl/submit', { round_id: 1 }, { Authorization: h })).status, 401);
        assert.equal((await fetch(`${base}/fl/global`, { headers: { Authorization: h } })).status, 401);
      }
      assert.equal((await fetch(`${base}/fl/global`)).status, 401);
    });

    it('a valid token is accepted on all three endpoints', async () => {
      const r = await post('/route', routeBody(), asUser('bob'));
      assert.equal(r.status, 200);
      assert.ok((await r.json()).route_id);
      assert.equal((await post('/fl/submit', { round_id: 1 }, asUser('bob'))).status, 200);
      assert.equal((await fetch(`${base}/fl/global`, { headers: asUser('bob') })).status, 200);
    });

    it('auth failures are logged without the token', async () => {
      const logs = [];
      const orig = console.warn;
      console.warn = (...a) => logs.push(a.join(' '));
      try {
        await post('/route', routeBody(), { Authorization: 'Bearer SECRET-TOKEN-VALUE' });
      } finally {
        console.warn = orig;
      }
      assert.ok(logs.some((l) => l.includes('[auth] rejected')));
      assert.ok(!logs.join('\n').includes('SECRET-TOKEN-VALUE'));
    });
  });

  describe('authorisation on /route', () => {
    it('ATTACK: a valid user requesting a route for a group they are not in -> 403', async () => {
      const r = await post('/route', routeBody({ group_id: 'gB' }), asUser('alice'));
      assert.equal(r.status, 403);
    });

    it("the app's solo planning pseudo group plan-<uid> is allowed only for that uid", async () => {
      assert.equal((await post('/route', routeBody({ group_id: 'plan-alice' }), asUser('alice'))).status, 200);
      assert.equal((await post('/route', routeBody({ group_id: 'plan-alice' }), asUser('bob'))).status, 403);
    });

    it('ATTACK: hostile group ids are rejected before any lookup', async () => {
      const r = await post('/route', routeBody({ group_id: '../users/alice' }), asUser('alice'));
      assert.equal(r.status, 400);
    });

    it('membership source outage -> 503 (fail closed), no internals leaked', async () => {
      setMembershipProvider(async () => { throw new Error('ECONNREFUSED 10.0.0.5:443 secret-host'); });
      const r = await post('/route', routeBody({ group_id: 'gOutage' }), asUser('alice'));
      const text = await r.text();
      assert.equal(r.status, 503);
      assert.ok(!text.includes('secret-host'));
      installFakeAuth({ gA: ['alice', 'bob'], gB: ['carol'] });
    });
  });

  describe('request hardening', () => {
    it('ATTACK: oversize body (> 64 kb) is refused with 413', async () => {
      const big = routeBody({ active_hazards: [{ centroid_lat: 1, centroid_lng: 1, hazard_type: 'x'.repeat(200_000) }] });
      const r = await post('/route', big, asUser('bob'));
      assert.equal(r.status, 413);
      assert.deepEqual(await r.json(), { error: 'payload too large' });
    });

    it('ATTACK: 10 MB body is refused (the old limit was 10mb)', async () => {
      const r = await post('/route', JSON.stringify({ pad: 'x'.repeat(10 * 1024 * 1024 - 100) }), asUser('bob'));
      assert.equal(r.status, 413);
    });

    it('an unauthenticated oversize body gets 401 and is never parsed', async () => {
      const r = await post('/route', JSON.stringify({ pad: 'x'.repeat(2_000_000) }));
      assert.equal(r.status, 401);
    });

    it('malformed JSON -> 400 without a stack trace', async () => {
      const r = await post('/route', '{"group_id": ', asUser('bob'));
      const text = await r.text();
      assert.equal(r.status, 400);
      assert.ok(!/at .*\.js|SyntaxError|node_modules/.test(text), text);
    });

    it('ATTACK: out-of-range coordinates and too many hazards are 400, not CPU burn', async () => {
      assert.equal((await post('/route', routeBody({ origin: { lat: 1e9, lng: 0 } }), asUser('bob'))).status, 400);
      assert.equal((await post('/route', routeBody({ destination: { lat: NaN, lng: 0 } }), asUser('bob'))).status, 400);
      const many = Array.from({ length: 500 }, () => ({ centroid_lat: 1, centroid_lng: 1, hazard_type: 'pothole' }));
      assert.equal((await post('/route', routeBody({ active_hazards: many }), asUser('bob'))).status, 400);
    });

    it('unknown paths get a generic 404', async () => {
      const r = await fetch(`${base}/admin`);
      assert.equal(r.status, 404);
    });
  });

  describe('headers / CORS', () => {
    it('sends security headers and no X-Powered-By', async () => {
      const r = await fetch(`${base}/fl/global`);
      assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
      assert.equal(r.headers.get('x-powered-by'), null);
      assert.equal(r.headers.get('x-frame-options'), 'DENY');
      assert.equal(r.headers.get('cache-control'), 'no-store');
    });

    it('ATTACK: an arbitrary web origin gets NO CORS permission (old: Access-Control-Allow-Origin: *)', async () => {
      const r = await fetch(`${base}/fl/global`, { headers: { Origin: 'https://evil.example', ...asUser('alice') } });
      assert.equal(r.headers.get('access-control-allow-origin'), null);
      const pre = await fetch(`${base}/route`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'POST' },
      });
      assert.equal(pre.headers.get('access-control-allow-origin'), null);
    });

    it('an allow-listed origin is honoured, and a wildcard in the list is ignored', async () => {
      const ok = await fetch(`${base}/fl/global`, { headers: { Origin: 'https://app.weride.example', ...asUser('alice') } });
      assert.equal(ok.headers.get('access-control-allow-origin'), 'https://app.weride.example');
      const star = await fetch(`${base}/fl/global`, { headers: { Origin: 'https://other.example', ...asUser('alice') } });
      assert.notEqual(star.headers.get('access-control-allow-origin'), '*');
      assert.equal(star.headers.get('access-control-allow-origin'), null);
    });

    it('default config (no ALLOWED_ORIGINS) allows no browser origin at all', () => {
      assert.deepEqual(loadSecurityConfig({}).allowedOrigins, []);
    });
  });

  describe('rate limits (tight budgets, separate server)', () => {
    let rl, rbase;
    const rpost = (path, body, headers = {}) =>
      fetch(`${rbase}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    before(async () => {
      installFakeAuth({ gA: ['alice', 'bob'], gB: ['carol'] });
      rl = createRealtimeServer(
        loadSecurityConfig({ NODE_ENV: 'test', RL_ROUTE_PER_MIN: '4', RL_FL_SUBMIT_PER_MIN: '2', RL_AUTH_FAIL_PER_MIN: '6' })
      );
      await new Promise((r) => rl.server.listen(0, '127.0.0.1', r));
      rbase = `http://127.0.0.1:${rl.server.address().port}`;
    });
    after(async () => {
      rl.io.close();
      await new Promise((r) => rl.server.close(() => r()));
    });

    it('ATTACK: /route beyond the per-uid budget -> 429 with Retry-After (and other users are unaffected)', async () => {
      const codes = [];
      let last;
      for (let i = 0; i < 8; i++) {
        last = await rpost('/route', routeBody(), asUser('alice'));
        codes.push(last.status);
      }
      assert.ok(codes.filter((c) => c === 200).length <= 4, codes.join(','));
      assert.ok(codes.includes(429), codes.join(','));
      assert.ok(Number(last.headers.get('retry-after')) >= 1);
      assert.equal((await rpost('/route', routeBody(), asUser('bob'))).status, 200);
    });

    it('ATTACK: /fl/submit flooding (model poisoning attempt) -> 429', async () => {
      const codes = [];
      for (let i = 0; i < 6; i++) codes.push((await rpost('/fl/submit', { round_id: i }, asUser('carol'))).status);
      assert.ok(codes.includes(429), codes.join(','));
    });

    it('ATTACK: a flood of garbage tokens from one IP ends in 429, a valid rider is never locked out', async () => {
      const codes = [];
      for (let i = 0; i < 12; i++) codes.push((await rpost('/route', {}, { Authorization: `Bearer junk${i}` })).status);
      assert.ok(codes.includes(401) && codes.includes(429), codes.join(','));
      assert.equal((await fetch(`${rbase}/fl/global`, { headers: asUser('alice') })).status, 200);
    });
  });
});
