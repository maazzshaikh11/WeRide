// Drives headless Chrome over the DevTools protocol: renders each scene of index.html and screenshots the phone (2x).
//   node shoot.mjs <chrome> <outDir> <resultsJson> <scene[:theme:scheme]>...
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const [CH, OUT, RESULTS, ...scenes] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9400 + Math.floor(Math.random() * 400);
fs.mkdirSync(OUT, { recursive: true });
const chrome = spawn(CH, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--remote-debugging-port=${PORT}`, `--user-data-dir=${fs.mkdtempSync('/tmp/shoot-')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() { for (let i = 0; i < 80; i++) { try { return await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(200); } } throw new Error('no chrome'); }
const t = (await targets()).find((x) => x.type === 'page');
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const consoleErr = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') consoleErr.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 500));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: false });
const results = {};
for (const spec of scenes) {
  const name = spec.split(':')[0];
  consoleErr.length = 0;
  await send('Page.navigate', { url: 'about:blank' });
  await send('Page.navigate', { url: `file://${HERE}/index.html#${spec}` });
  let ready = null;
  for (let i = 0; i < 100 && !ready; i++) { await sleep(150); ready = await ev('window.__READY__ || null'); }
  const wait = (await ev('window.__WAIT__')) || 1200;
  await ev('document.fonts && document.fonts.ready.then(() => 1)');
  await sleep(wait);
  const errs = (await ev('JSON.stringify((window.__ERRS__ || []).concat(window.__ERR__ ? ["render: " + window.__ERR__] : []))')) || '[]';
  const list = [...JSON.parse(errs), ...consoleErr];
  const r = await send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 390, height: 844, scale: 1 } });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.result.data, 'base64'));
  results[name] = { ready, errors: [...new Set(list)] };
  console.log(name, list.length ? `ERR(${list.length})` : 'ok');
}
fs.writeFileSync(RESULTS, JSON.stringify(results, null, 1));
ws.close(); chrome.kill();
process.exit(0);
