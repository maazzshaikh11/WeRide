/**
 * Server-side location fan-out tests (Person A).
 *
 * Verifies: join-group → location:update is rebroadcast to room peers,
 * malformed payloads are dropped, and leave-group stops delivery.
 *
 * Run: NODE_ENV=test node --test server/test/location_fanout.test.js
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { io as clientIo } from 'socket.io-client';

process.env.NODE_ENV = 'test';
const { server } = await import('../index.js');

const validPayload = {
  rider_id: 'rider-1',
  group_id: 'group-1',
  timestamp_hlc: '1700000000000:0',
  lat: 37.7749,
  lng: -122.4194,
  speed_mps: 5,
  heading_deg: 90,
  spoof_flag: false,
  nis_score: 1.2,
  accuracy_m: 8,
};

function connectClient() {
  return new Promise((resolve, reject) => {
    const socket = clientIo('http://127.0.0.1:0', { autoConnect: false });
    socket.on('connect_error', reject);
    // URL is replaced after the server binds to an ephemeral port.
    resolve(socket);
  });
}

describe('location fan-out', () => {
  let port;
  let rider1;
  let rider2;

  before(async () => {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = server.address().port;

    rider1 = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    rider2 = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    await Promise.all([
      new Promise((r) => rider1.on('connect', r)),
      new Promise((r) => rider2.on('connect', r)),
    ]);
    rider1.emit('join-group', { groupId: 'group-1' });
    rider2.emit('join-group', { groupId: 'group-1' });
    // Give the server a tick to process the joins.
    await new Promise((r) => setTimeout(r, 50));
  });

  after(async () => {
    rider1.disconnect();
    rider2.disconnect();
    await new Promise((r) => server.close(r));
  });

  it('rebroadcasts location:update to other room members', async () => {
    const received = new Promise((resolve) => {
      rider2.once('location:update', resolve);
    });
    let senderGotEcho = false;
    rider1.once('location:update', () => {
      senderGotEcho = true;
    });

    rider1.emit('location:update', validPayload);
    const msg = await received;
    assert.equal(msg.rider_id, 'rider-1');
    assert.equal(msg.group_id, 'group-1');
    assert.equal(msg.lat, 37.7749);
    // Sender must not receive its own echo.
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(senderGotEcho, false);
  });

  it('does not deliver to clients in a different group', async () => {
    const other = clientIo(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
    await new Promise((r) => other.on('connect', r));
    other.emit('join-group', { groupId: 'group-2' });
    await new Promise((r) => setTimeout(r, 50));

    let gotMessage = false;
    other.once('location:update', () => {
      gotMessage = true;
    });
    rider1.emit('location:update', validPayload);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(gotMessage, false);
    other.disconnect();
  });

  it('drops malformed payloads without broadcasting', async () => {
    let gotMessage = false;
    rider2.once('location:update', () => {
      gotMessage = true;
    });
    rider1.emit('location:update', { rider_id: 'rider-1' }); // missing fields
    rider1.emit('location:update', null);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(gotMessage, false);
  });

  it('stops delivery after leave-group', async () => {
    rider2.emit('leave-group', { groupId: 'group-1' });
    await new Promise((r) => setTimeout(r, 50));
    let gotMessage = false;
    rider2.once('location:update', () => {
      gotMessage = true;
    });
    rider1.emit('location:update', validPayload);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(gotMessage, false);
    // Rejoin so later tests (if any) are unaffected.
    rider2.emit('join-group', { groupId: 'group-1' });
    await new Promise((r) => setTimeout(r, 50));
  });
});
