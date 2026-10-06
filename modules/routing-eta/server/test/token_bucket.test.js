import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket, KeyedLimiter } from '../security/token_bucket.js';

const clock = (t0 = 1_000_000) => { let t = t0; const now = () => t; now.advance = (ms) => { t += ms; }; return now; };

test('token bucket: allows the burst then refuses', () => {
  const now = clock();
  const b = new TokenBucket({ capacity: 3, refillPerSec: 1, now });
  assert.deepEqual([b.take(), b.take(), b.take(), b.take()], [true, true, true, false]);
});

test('token bucket: refills at the sustained rate, capped at capacity', () => {
  const now = clock();
  const b = new TokenBucket({ capacity: 5, refillPerSec: 5, now }); // 5 per second
  for (let i = 0; i < 5; i++) assert.equal(b.take(), true);
  assert.equal(b.take(), false);
  now.advance(200); // +1 token
  assert.equal(b.take(), true);
  assert.equal(b.take(), false);
  now.advance(60_000); // long idle: capped, not 300 tokens
  const burst = Array.from({ length: 10 }, () => b.take()).filter(Boolean).length;
  assert.equal(burst, 5);
});

test('token bucket: location:update <= 5/s sustained over 10 s', () => {
  const now = clock();
  const b = new TokenBucket({ capacity: 10, refillPerSec: 5, now });
  let allowed = 0;
  for (let ms = 0; ms < 10_000; ms += 10) { // attacker sends 100/s
    now.advance(10);
    if (b.take()) allowed += 1;
  }
  assert.ok(allowed <= 10 + 5 * 10 + 1, `allowed ${allowed}`);
  assert.ok(allowed >= 5 * 10 - 2);
});

test('token bucket: retryAfterSec and isIdle', () => {
  const now = clock();
  const b = new TokenBucket({ capacity: 1, refillPerSec: 0.5, now });
  assert.equal(b.retryAfterSec(), 0);
  b.take();
  assert.equal(b.retryAfterSec(), 2);
  assert.equal(b.isIdle(), false);
  now.advance(2000);
  assert.equal(b.isIdle(), true);
});

test('token bucket: rejects nonsense config', () => {
  assert.throws(() => new TokenBucket({ capacity: 0, refillPerSec: 1 }));
  assert.throws(() => new TokenBucket({ capacity: 1, refillPerSec: 0 }));
});

test('keyed limiter: keys are independent', () => {
  const now = clock();
  const l = new KeyedLimiter({ capacity: 1, refillPerSec: 0.1, now });
  assert.equal(l.take('a'), true);
  assert.equal(l.take('a'), false);
  assert.equal(l.take('b'), true);
});

test('keyed limiter: memory stays bounded when an attacker rotates keys', () => {
  const now = clock();
  const l = new KeyedLimiter({ capacity: 1, refillPerSec: 0.001, now, maxKeys: 100 });
  for (let i = 0; i < 10_000; i++) l.take(`k${i}`);
  assert.ok(l.size <= 100, `size ${l.size}`);
});

test('keyed limiter: sweep forgets idle keys', () => {
  const now = clock();
  const l = new KeyedLimiter({ capacity: 2, refillPerSec: 1, now });
  l.take('a'); l.take('b');
  assert.equal(l.size, 2);
  now.advance(5000);
  l.sweep();
  assert.equal(l.size, 0);
});
