/**
 * Boot-level attack tests: run the REAL entrypoint (`node index.js`) as a child
 * process and assert it refuses to start in unsafe configurations.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(dir, '..', 'index.js');

const freePort = () => new Promise((resolve) => {
  const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => resolve(p)); });
});

function run(env, { killAfterMs = 4000 } = {}) {
  return new Promise((resolve) => {
    // minimal env: nothing inherited that could configure auth
    const child = spawn(process.execPath, [entry], { env: { PATH: process.env.PATH, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    const timer = setTimeout(() => child.kill('SIGKILL'), killAfterMs);
    child.on('exit', (code, signal) => { clearTimeout(timer); resolve({ code, signal, out }); });
    child.on('error', () => resolve({ code: -1, out }));
  });
}

test('ATTACK: production with no verifier configured refuses to start', async () => {
  const r = await run({ NODE_ENV: 'production', PORT: String(await freePort()) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /FATAL/);
  assert.match(r.out, /FIREBASE_PROJECT_ID/);
});

test('ATTACK: production + ALLOW_INSECURE_DEV_AUTH=1 refuses to start', async () => {
  const r = await run({ NODE_ENV: 'production', ALLOW_INSECURE_DEV_AUTH: '1', PORT: String(await freePort()) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /forbidden/);
});

test('ATTACK: production with a project id but no credentials refuses to start', async () => {
  const r = await run({ NODE_ENV: 'production', FIREBASE_PROJECT_ID: 'demo', PORT: String(await freePort()) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /credentials missing/);
});

test('no NODE_ENV and no opt-in: refuses to start (never open by default)', async () => {
  const r = await run({ PORT: String(await freePort()) });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /ALLOW_INSECURE_DEV_AUTH/);
});

test('explicit dev opt-in starts, with a loud warning', async () => {
  const port = await freePort();
  const child = spawn(process.execPath, [entry], { env: { PATH: process.env.PATH, ALLOW_INSECURE_DEV_AUTH: '1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '';
  child.stdout.on('data', (d) => { out += d; });
  child.stderr.on('data', (d) => { out += d; });
  try {
    for (let i = 0; i < 50 && !/WeRide server on/.test(out); i++) await new Promise((r) => setTimeout(r, 100));
    assert.match(out, /WeRide server on/);
    assert.match(out, /ALLOW_INSECURE_DEV_AUTH=1/);
    // still authenticated: no token => 401, dev token => 200
    assert.equal((await fetch(`http://127.0.0.1:${port}/fl/global`)).status, 401);
    assert.equal((await fetch(`http://127.0.0.1:${port}/fl/global`, { headers: { Authorization: 'Bearer dev:alice' } })).status, 200);
  } finally {
    child.kill('SIGKILL');
  }
});
