/**
 * Quick-signal relay tests (SignalMenu → server → group peers).
 *
 * Root cause covered: the app emitted 'signal:send' and toasted "Signal sent",
 * but the server had no handler, so no other rider ever received it.
 *
 * Run: NODE_ENV=test node --test test/signal_relay.test.js
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as clientIo } from 'socket.io-client';

process.env.NODE_ENV = 'test';
const { server } = await import('../index.js');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

describe('signal relay', () => {
  let port;
  let rider1;
  let rider2;
  let outsider;

  before(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;
    const connect = () => clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    rider1 = connect();
    rider2 = connect();
    outsider = connect();
    await Promise.all([rider1, rider2, outsider].map((s) => new Promise((r) => s.on('connect', r))));
    rider1.emit('join-group', { groupId: 'g1' });
    rider2.emit('join-group', { groupId: 'g1' });
    outsider.emit('join-group', { groupId: 'g2' });
    await wait(50);
  });

  after(async () => {
    [rider1, rider2, outsider].forEach((s) => s.disconnect());
    await new Promise((r) => server.close(r));
  });

  it('relays a valid signal to the other riders in the group as signal:received', async () => {
    const got = new Promise((resolve) => rider2.once('signal:received', resolve));
    rider1.emit('signal:send', { group_id: 'g1', rider_id: 'rider-1', label: 'Wait for me' });
    const msg = await got;
    assert.equal(msg.group_id, 'g1');
    assert.equal(msg.rider_id, 'rider-1');
    assert.equal(msg.label, 'Wait for me');
    assert.equal(typeof msg.sent_at, 'number');
  });

  it('does not echo the signal back to the sender', async () => {
    let echoed = false;
    rider1.once('signal:received', () => { echoed = true; });
    rider1.emit('signal:send', { group_id: 'g1', rider_id: 'rider-1', label: 'All good' });
    await wait(100);
    assert.equal(echoed, false);
  });

  it('does not deliver to a different group', async () => {
    let leaked = false;
    outsider.once('signal:received', () => { leaked = true; });
    rider1.emit('signal:send', { group_id: 'g1', rider_id: 'rider-1', label: 'Pull over' });
    await wait(100);
    assert.equal(leaked, false);
  });

  it('drops a signal sent into a group the sender has not joined', async () => {
    let leaked = false;
    rider2.once('signal:received', () => { leaked = true; });
    outsider.emit('signal:send', { group_id: 'g1', rider_id: 'intruder', label: 'Need fuel' });
    await wait(100);
    assert.equal(leaked, false);
  });

  it('drops labels outside the allowlist and malformed payloads', async () => {
    let got = 0;
    rider2.on('signal:received', () => { got += 1; });
    rider1.emit('signal:send', { group_id: 'g1', rider_id: 'rider-1', label: 'arbitrary text' });
    rider1.emit('signal:send', { group_id: 'g1', label: 'All good' });
    rider1.emit('signal:send', null);
    await wait(100);
    rider2.removeAllListeners('signal:received');
    assert.equal(got, 0);
  });
});
