/**
 * Attack-style tests for the Socket.io surface. Every test plays an attacker
 * and asserts the attack is REFUSED.
 *
 * Original behaviour (before the fix): no authentication at all; join-group
 * accepted any id; location:update was forwarded to the room named by the
 * PAYLOAD even if the sender never joined it, with a client-claimed rider_id.
 *
 * Run: NODE_ENV=test node --test test/security_sockets.test.js
 */
import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
const { createRealtimeServer } = await import('../app.js');
const { loadSecurityConfig } = await import('../security/config.js');
const { connectAs, connectExpectRefusal, installFakeAuth, tokenFor, wait, emitAck } = await import('./helpers/auth.js');

const loc = (over = {}) => ({
  rider_id: 'alice',
  group_id: 'gA',
  timestamp_hlc: '1700000000000:0',
  lat: 37.77,
  lng: -122.41,
  speed_mps: 5,
  heading_deg: 90,
  spoof_flag: false,
  nis_score: 1,
  accuracy_m: 8,
  ...over,
});

/** collects events of one kind for `ms` */
async function collect(socket, event, ms = 150) {
  const got = [];
  const h = (m) => got.push(m);
  socket.on(event, h);
  await wait(ms);
  socket.off(event, h);
  return got;
}

describe('socket security', () => {
  let srv, port, groups, fx;
  const open = [];
  const as = async (uid, opts) => { const s = await connectAs(port, uid, opts); open.push(s); return s; };
  const joined = async (uid, g) => {
    const s = await as(uid);
    const r = await emitAck(s, 'join-group', { groupId: g });
    assert.equal(r.ok, true, `${uid} should be allowed into ${g}`);
    return s;
  };

  before(async () => {
    groups = { gA: ['alice', 'bob'], gB: ['carol', 'mallory'] };
    fx = installFakeAuth(groups);
    // generous budgets: these tests are about authorisation, the rate-limit suite below uses tight ones
    srv = createRealtimeServer(loadSecurityConfig({
      NODE_ENV: 'test', RL_JOIN_BURST: '1000', RL_JOIN_PER_MIN: '60000', RL_LOCATION_BURST: '1000', RL_SIGNAL_BURST: '1000',
      RL_AUTH_FAIL_PER_MIN: '100000', RL_VOX_BURST: '1000',
    }));
    await new Promise((r) => srv.server.listen(0, '127.0.0.1', r));
    port = srv.server.address().port;
  });
  // Close every socket between tests (the per-uid connection cap would otherwise trip).
  afterEach(async () => {
    open.splice(0).forEach((s) => s.close());
    await wait(40);
  });
  after(async () => {
    srv.io.close();
    await new Promise((r) => srv.server.close(() => r()));
  });

  describe('authentication', () => {
    it('ATTACK: unauthenticated connect (no token) is refused', async () => {
      const e = await connectExpectRefusal(port, {});
      assert.equal(e.message, 'unauthorized');
    });

    it('ATTACK: connect with no auth object at all is refused', async () => {
      await connectExpectRefusal(port, undefined);
    });

    it('ATTACK: forged / garbage token is refused', async () => {
      await connectExpectRefusal(port, { token: 'not-a-real-firebase-token' });
      await connectExpectRefusal(port, { token: 'dev:alice' }); // dev tokens only exist with the explicit dev opt-in
      await connectExpectRefusal(port, { token: 'x'.repeat(100_000) });
      await connectExpectRefusal(port, { token: { uid: 'alice' } });
    });

    it('ATTACK: /vox namespace refuses unauthenticated connections too', async () => {
      await connectExpectRefusal(port, {}, '/vox');
      await connectExpectRefusal(port, { token: 'garbage' }, '/vox');
    });

    it('a valid token connects', async () => {
      const s = await as('alice');
      assert.equal(s.connected, true);
    });

    it('rejections are counted and the token never appears in logs', async () => {
      const before = srv.ctx.stats.auth_rejected;
      const logs = [];
      const orig = console.warn;
      console.warn = (...a) => logs.push(a.join(' '));
      try {
        await connectExpectRefusal(port, { token: 'SECRET-TOKEN-VALUE' });
      } finally {
        console.warn = orig;
      }
      assert.equal(srv.ctx.stats.auth_rejected, before + 1);
      assert.ok(logs.length > 0);
      assert.ok(!logs.join('\n').includes('SECRET-TOKEN-VALUE'));
    });

    it('a socket is disconnected when its ID token expires (client reconnects with a fresh one)', async () => {
      installFakeAuth(groups, { verifierExtra: { exp: Math.floor(Date.now() / 1000) + 1 } });
      const s = await as('alice');
      const reason = await new Promise((r) => s.once('disconnect', r));
      assert.equal(reason, 'io server disconnect');
      installFakeAuth(groups);
    });
  });

  describe('authorisation: join-group', () => {
    it('ATTACK: valid user joining a group they are NOT a member of is denied and receives nothing', async () => {
      const mallory = await as('mallory'); // legit account, member of gB only
      const denied = srv.ctx.stats.join_denied;
      const r = await emitAck(mallory, 'join-group', { groupId: 'gA' });
      assert.deepEqual(r, { ok: false, error: 'forbidden' });
      assert.equal(srv.ctx.stats.join_denied, denied + 1);

      const alice = await joined('alice', 'gA');
      const spy = collect(mallory, 'location:update');
      alice.emit('location:update', loc());
      assert.equal((await spy).length, 0, 'eavesdropper must not receive gA locations');
    });

    it('ATTACK: join-group without ack (legacy fire-and-forget) is still denied', async () => {
      const mallory = await as('mallory');
      mallory.emit('join-group', { groupId: 'gA' });
      mallory.emit('join-group', 'gA');
      await wait(80);
      const alice = await joined('alice', 'gA');
      const spy = collect(mallory, 'location:update');
      alice.emit('location:update', loc());
      assert.equal((await spy).length, 0);
    });

    it('ATTACK: path-traversal / malformed group ids are refused', async () => {
      const s = await as('alice');
      for (const g of ['../groups/gA', 'gA/members', '', 'a'.repeat(500), 42, null, { x: 1 }]) {
        const r = await emitAck(s, 'join-group', { groupId: g });
        assert.equal(r.ok, false);
      }
      assert.ok(!fx.fetches.some((g) => String(g).includes('/')), 'must never query the store with a hostile id');
    });

    it('a member is allowed (and unknown groups are refused)', async () => {
      const bob = await as('bob');
      assert.equal((await emitAck(bob, 'join-group', { groupId: 'gA' })).ok, true);
      assert.equal((await emitAck(bob, 'join-group', { groupId: 'does-not-exist' })).ok, false);
    });

    it('membership source outage fails closed', async () => {
      const { setMembershipProvider } = await import('../security/auth.js');
      setMembershipProvider(async () => { throw new Error('firestore down'); });
      const s = await as('alice');
      assert.equal((await emitAck(s, 'join-group', { groupId: 'gA' })).ok, false);
      installFakeAuth(groups);
    });
  });

  describe('authorisation: location:update', () => {
    it('legit flow still works: member sees a peer location with the verified rider id', async () => {
      const alice = await joined('alice', 'gA');
      const bob = await joined('bob', 'gA');
      const p = new Promise((r) => bob.once('location:update', r));
      alice.emit('location:update', loc());
      const m = await p;
      assert.equal(m.rider_id, 'alice');
      assert.equal(m.group_id, 'gA');
    });

    it('ATTACK: location spoof (rider_id != authenticated uid) is rejected and counted', async () => {
      const mallory = await joined('mallory', 'gB');
      const carol = await joined('carol', 'gB');
      const before = srv.ctx.stats.spoof_rejected;
      const spy = collect(carol, 'location:update');
      mallory.emit('location:update', loc({ rider_id: 'carol', group_id: 'gB' }));
      assert.equal((await spy).length, 0, 'forged position of carol must not be forwarded');
      assert.equal(srv.ctx.stats.spoof_rejected, before + 1);
    });

    it('ATTACK: cross-group injection (sender in room A, payload for room B) is dropped', async () => {
      const alice = await joined('alice', 'gA');
      const carol = await joined('carol', 'gB'); // victim in B
      const before = srv.ctx.stats.not_in_room;
      const spy = collect(carol, 'location:update');
      alice.emit('location:update', loc({ group_id: 'gB' })); // alice never joined gB
      assert.equal((await spy).length, 0);
      assert.equal(srv.ctx.stats.not_in_room, before + 1);
    });

    it('ATTACK: injecting into a group by someone who never joined anything is dropped', async () => {
      const mallory = await as('mallory');
      const alice = await joined('alice', 'gA');
      const spy = collect(alice, 'location:update');
      mallory.emit('location:update', loc({ rider_id: 'mallory', group_id: 'gA' }));
      assert.equal((await spy).length, 0);
    });

    it('ATTACK: a member removed from the group loses the room (membership re-checked)', async () => {
      const g = { gR: ['alice', 'bob'] };
      const { setMembershipProvider } = await import('../security/auth.js');
      setMembershipProvider(async (id) => g[id] || [], { ttlMs: 20, minRefreshMs: 0 });
      const alice = await joined('alice', 'gR');
      const bob = await joined('bob', 'gR');
      g.gR = ['bob']; // alice kicked
      await wait(60); // cache expires
      const spy = collect(bob, 'location:update');
      alice.emit('location:update', loc({ group_id: 'gR' }));
      assert.equal((await spy).length, 0);
      installFakeAuth(groups);
    });

    it('ATTACK: out-of-range / absurd / malformed payloads are dropped', async () => {
      const alice = await joined('alice', 'gA');
      const bob = await joined('bob', 'gA');
      const bad = [
        loc({ lat: 91 }), loc({ lat: -91 }), loc({ lng: 181 }), loc({ lat: NaN }), loc({ lat: 'x' }),
        loc({ speed_mps: 1e9 }), loc({ accuracy_m: -5 }), loc({ nis_score: Infinity }),
        loc({ spoof_flag: 'false' }), loc({ timestamp_hlc: 'h'.repeat(10_000) }),
        loc({ rider_id: 'a'.repeat(500) }), loc({ rider_id: 'alice<script>' }),
        null, 'str', 5, [], {},
      ];
      const spy = collect(bob, 'location:update', 300);
      bad.forEach((p) => alice.emit('location:update', p));
      assert.equal((await spy).length, 0);
    });

    it('forwards only whitelisted fields (no payload smuggling)', async () => {
      const alice = await joined('alice', 'gA');
      const bob = await joined('bob', 'gA');
      const p = new Promise((r) => bob.once('location:update', r));
      alice.emit('location:update', loc({ evil: 'x'.repeat(2000), __proto__: { admin: true }, heading_deg: 450 }));
      const m = await p;
      assert.equal(m.evil, undefined);
      assert.equal(m.heading_deg, 90);
    });
  });

  describe('authorisation: signal:send', () => {
    it('legit signal is relayed with the verified rider id', async () => {
      const alice = await joined('alice', 'gA');
      const bob = await joined('bob', 'gA');
      const p = new Promise((r) => bob.once('signal:received', r));
      alice.emit('signal:send', { group_id: 'gA', rider_id: 'alice', label: 'Wait up' });
      const m = await p;
      assert.equal(m.rider_id, 'alice');
      assert.equal(m.label, 'Wait up');
    });

    it('ATTACK: signal spoof (rider_id != uid) is rejected', async () => {
      const mallory = await joined('mallory', 'gB');
      const carol = await joined('carol', 'gB');
      const before = srv.ctx.stats.spoof_rejected;
      const spy = collect(carol, 'signal:received');
      mallory.emit('signal:send', { group_id: 'gB', rider_id: 'carol', label: 'Need fuel' });
      assert.equal((await spy).length, 0);
      assert.equal(srv.ctx.stats.spoof_rejected, before + 1);
    });

    it('ATTACK: cross-group signal (sender in A, group_id B) is dropped', async () => {
      const alice = await joined('alice', 'gA');
      const carol = await joined('carol', 'gB');
      const spy = collect(carol, 'signal:received');
      alice.emit('signal:send', { group_id: 'gB', rider_id: 'alice', label: 'Pull over' });
      assert.equal((await spy).length, 0);
    });

    it('ATTACK: arbitrary label text is not relayed', async () => {
      const alice = await joined('alice', 'gA');
      const bob = await joined('bob', 'gA');
      const spy = collect(bob, 'signal:received');
      alice.emit('signal:send', { group_id: 'gA', rider_id: 'alice', label: '<b>phishing</b>' });
      assert.equal((await spy).length, 0);
    });
  });

  describe('/vox namespace', () => {
    const voxJoined = async (uid, g) => {
      const s = await as(uid, { ns: '/vox' });
      const r = await emitAck(s, 'join', g);
      return { s, r };
    };

    it('ATTACK: non-member cannot join another group voice room', async () => {
      const { r } = await voxJoined('mallory', 'gA');
      assert.deepEqual(r, { ok: false, error: 'forbidden' });
    });

    it('members can relay sdp/ice and voice_active to peers of the same group only', async () => {
      const a = await voxJoined('alice', 'gA');
      const b = await voxJoined('bob', 'gA');
      assert.equal(a.r.ok && b.r.ok, true);
      const sdp = new Promise((r) => b.s.once('sdp', r));
      a.s.emit('sdp', { targetId: b.s.id, sdp: { type: 'offer', sdp: 'v=0' } });
      const m = await sdp;
      assert.equal(m.fromId, a.s.id);
      assert.equal(m.uid, 'alice');
    });

    it('ATTACK: signalling a socket id outside your group room (eavesdrop/inject) is dropped', async () => {
      const a = await voxJoined('alice', 'gA');
      const victim = await voxJoined('carol', 'gB');
      const before = srv.ctx.stats.not_in_room;
      const spy = collect(victim.s, 'sdp');
      const spyIce = collect(victim.s, 'ice');
      a.s.emit('sdp', { targetId: victim.s.id, sdp: { type: 'offer', sdp: 'v=0' } });
      a.s.emit('ice', { targetId: victim.s.id, candidate: { c: 1 } });
      assert.equal((await spy).length + (await spyIce).length, 0);
      assert.ok(srv.ctx.stats.not_in_room >= before + 2);
    });

    it('ATTACK: joining a "room" that is really another socket id does not grant its traffic', async () => {
      const victim = await voxJoined('carol', 'gB');
      const mallory = await as('mallory', { ns: '/vox' });
      const r = await emitAck(mallory, 'join', victim.s.id);
      assert.equal(r.ok, false);
    });

    it('ATTACK: oversize signalling payload is dropped', async () => {
      const a = await voxJoined('alice', 'gA');
      const b = await voxJoined('bob', 'gA');
      const spy = collect(b.s, 'sdp');
      a.s.emit('sdp', { targetId: b.s.id, sdp: 'x'.repeat(30_000) });
      assert.equal((await spy).length, 0);
    });
  });

  describe('rate limits / abuse', () => {
    let rl;
    before(async () => {
      installFakeAuth(groups);
      rl = createRealtimeServer(loadSecurityConfig({
        NODE_ENV: 'test',
        RL_LOCATION_BURST: '3', RL_LOCATION_PER_SEC: '0.1',
        RL_SIGNAL_BURST: '2', RL_SIGNAL_PER_SEC: '0.1',
        RL_JOIN_BURST: '3', RL_JOIN_PER_MIN: '1',
        MAX_SOCKETS_PER_UID: '2',
        RL_AUTH_FAIL_PER_MIN: '3',
      }));
      await new Promise((r) => rl.server.listen(0, '127.0.0.1', r));
    });
    after(async () => {
      rl.io.close();
      await new Promise((r) => rl.server.close(() => r()));
    });
    const rport = () => rl.server.address().port;
    afterEach(async () => { open.splice(0).forEach((s) => s.close()); await wait(40); });

    it('ATTACK: location:update flood is dropped beyond the burst', async () => {
      const alice = await connectAs(rport(), 'alice'); open.push(alice);
      const bob = await connectAs(rport(), 'bob'); open.push(bob);
      await emitAck(alice, 'join-group', { groupId: 'gA' });
      await emitAck(bob, 'join-group', { groupId: 'gA' });
      const spy = collect(bob, 'location:update', 300);
      for (let i = 0; i < 40; i++) alice.emit('location:update', loc({ lat: 10 + i / 1000 }));
      const got = await spy;
      assert.equal(got.length, 3, 'only the burst allowance is forwarded');
      assert.ok(rl.ctx.stats.rate_limited >= 37);
    });

    it('ATTACK: signal flood is dropped beyond the burst', async () => {
      const alice = await connectAs(rport(), 'alice'); open.push(alice);
      const bob = await connectAs(rport(), 'bob'); open.push(bob);
      await emitAck(alice, 'join-group', { groupId: 'gA' });
      await emitAck(bob, 'join-group', { groupId: 'gA' });
      const spy = collect(bob, 'signal:received', 300);
      for (let i = 0; i < 20; i++) alice.emit('signal:send', { group_id: 'gA', rider_id: 'alice', label: 'Wait up' });
      assert.equal((await spy).length, 2);
    });

    it('ATTACK: the per-uid limit holds across reconnects (a new socket does not reset the budget)', async () => {
      // alice burned her whole location budget above on other sockets (now closed).
      const bob = await connectAs(rport(), 'bob'); open.push(bob);
      const alice2 = await connectAs(rport(), 'alice'); open.push(alice2); // fresh connection => fresh per-connection bucket
      assert.equal((await emitAck(bob, 'join-group', { groupId: 'gA' })).ok, true);
      assert.equal((await emitAck(alice2, 'join-group', { groupId: 'gA' })).ok, true);
      const spy = collect(bob, 'location:update', 200);
      for (let i = 0; i < 10; i++) alice2.emit('location:update', loc());
      assert.equal((await spy).length, 0, 'alice (same uid, new socket) is still throttled');
    });

    it('ATTACK: join-group brute force (group id enumeration) is rate limited', async () => {
      const mallory = await connectAs(rport(), 'mallory'); open.push(mallory);
      const results = [];
      for (let i = 0; i < 8; i++) results.push((await emitAck(mallory, 'join-group', { groupId: `guess${i}` })).error);
      assert.equal(results.filter((e) => e === 'rate_limited').length, 5);
    });

    it('ATTACK: one uid opening unlimited sockets is capped', async () => {
      const a = await connectAs(rport(), 'dave'); open.push(a);
      const b = await connectAs(rport(), 'dave'); open.push(b);
      const e = await connectExpectRefusal(rport(), { token: tokenFor('dave') });
      assert.equal(e.message, 'too many connections');
    });

    it('ATTACK: garbage-token flood from one IP is throttled', async () => {
      const msgs = [];
      for (let i = 0; i < 6; i++) msgs.push((await connectExpectRefusal(rport(), { token: `bad${i}` })).message);
      assert.ok(msgs.includes('rate limited'));
    });
  });
});
