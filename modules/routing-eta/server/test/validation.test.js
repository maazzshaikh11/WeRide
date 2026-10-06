import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeLocationPayload, sanitizeSignalPayload, parseGroupId } from '../security/validation.js';

const ok = { rider_id: 'r1', group_id: 'g1', timestamp_hlc: '1:0', lat: 1, lng: 2 };

test('location: minimal valid payload passes, extras are stripped', () => {
  assert.deepEqual(sanitizeLocationPayload({ ...ok, junk: 'x' }), ok);
});

test('location: contract fields are range-checked', () => {
  const bad = [
    { lat: 90.0001 }, { lat: -90.0001 }, { lng: 180.1 }, { lng: -180.1 }, { lat: Infinity }, { lng: NaN },
    { speed_mps: 201 }, { speed_mps: NaN }, { heading_deg: 1e9 }, { accuracy_m: -1 }, { accuracy_m: 1e6 },
    { nis_score: -1 }, { spoof_flag: 1 }, { timestamp_hlc: 'x'.repeat(65) }, { timestamp_hlc: '' },
    { rider_id: 'x'.repeat(129) }, { group_id: 'a b' }, { group_id: 'a/b' }, { rider_id: '' },
  ];
  for (const b of bad) assert.equal(sanitizeLocationPayload({ ...ok, ...b }), null, JSON.stringify(b));
  for (const v of [null, undefined, 5, 'x', [], true]) assert.equal(sanitizeLocationPayload(v), null);
});

test('location: unwrapped EKF heading is normalised, slightly negative speed accepted', () => {
  const p = sanitizeLocationPayload({ ...ok, heading_deg: 450, speed_mps: -0.2 });
  assert.equal(p.heading_deg, 90);
  assert.equal(p.speed_mps, -0.2);
  assert.equal(sanitizeLocationPayload({ ...ok, heading_deg: -90 }).heading_deg, 270);
});

test('signal: label allow-list and id shapes', () => {
  assert.deepEqual(sanitizeSignalPayload({ group_id: 'g', rider_id: 'r', label: 'Wait up', x: 1 }), { group_id: 'g', rider_id: 'r', label: 'Wait up' });
  assert.equal(sanitizeSignalPayload({ group_id: 'g', rider_id: 'r', label: 'hi' }), null);
  assert.equal(sanitizeSignalPayload({ group_id: 'g', label: 'Wait up' }), null);
});

test('parseGroupId accepts a string or {groupId} and nothing hostile', () => {
  assert.equal(parseGroupId('g1'), 'g1');
  assert.equal(parseGroupId({ groupId: 'g1' }), 'g1');
  for (const v of ['', '../x', 'a/b', 'a'.repeat(129), 5, null, undefined, {}, { groupId: 5 }]) assert.equal(parseGroupId(v), null);
});
