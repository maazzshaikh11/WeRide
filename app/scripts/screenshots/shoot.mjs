// Drives headless Chrome over the DevTools protocol: renders each scene of index.html on a device matrix at several
// font scales, screenshots it and runs the DOM layout check (layoutcheck.js) after the scene settles.
//   node shoot.mjs <chrome> <outDir> <resultsJson> <scene[:theme:scheme]>...
// Env: DEVICES=iphone14,ipad,...|all   (keys of devices.json, default iphone14)
//      FONTS=1,1.3,1.5,2               (OS font scale, default 1)
//      JOBS=4                          parallel Chrome tabs
//      SHOTS=1|0                       write PNGs (default 1)   LAYOUT=<dir>  write layout json per config to <dir>
//      BUNDLE=scenes.js                which esbuild bundle to load (build.mjs BUNDLE=...)
//      OS=android                      render the Android branches (Platform.OS)
// PNGs: <outDir>/<scene>.png for the single default config, else <outDir>/<device>/fs<scale>/<scene>.png.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const [CH, OUT, RESULTS, ...scenes] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEV = JSON.parse(fs.readFileSync(path.join(HERE, 'devices.json'), 'utf8'));
const devIds = (process.env.DEVICES || 'iphone14') === 'all' ? Object.keys(DEV) : (process.env.DEVICES || 'iphone14').split(',');
const fonts = (process.env.FONTS || '1').split(',').map(Number);
const JOBS = Number(process.env.JOBS || 1);
const SHOTS = process.env.SHOTS !== '0';
const LAYOUT = process.env.LAYOUT || '';
const BUNDLE = process.env.BUNDLE || 'scenes.js';
const OSQ = process.env.OS ? `&os=${process.env.OS}` : '';
const flat = devIds.length === 1 && devIds[0] === 'iphone14' && fonts.length === 1 && fonts[0] === 1;
const CHECK = fs.readFileSync(path.join(HERE, 'layoutcheck.js'), 'utf8');
const PORT = 9400 + Math.floor(Math.random() * 400);
fs.mkdirSync(OUT, { recursive: true });
const chrome = spawn(CH, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files', `--remote-debugging-port=${PORT}`, `--user-data-dir=${fs.mkdtempSync('/tmp/shoot-')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() { for (let i = 0; i < 80; i++) { try { return await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); } catch { await sleep(200); } } throw new Error('no chrome'); }
await targets();

async function openPage(first) {
  let t;
  if (first) t = (await targets()).find((x) => x.type === 'page');
  else {
    // each worker gets its own *window*: tabs of one window are throttled when not in front (timers, ResizeObserver / onLayout),
    // which would leave measured layouts (Live side column, docks) at their first estimate
    const ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
    const bws = new WebSocket(ver.webSocketDebuggerUrl);
    await new Promise((r) => (bws.onopen = r));
    const targetId = await new Promise((res) => { bws.onmessage = (m) => res(JSON.parse(m.data).result.targetId); bws.send(JSON.stringify({ id: 1, method: 'Target.createTarget', params: { url: 'about:blank', newWindow: true } })); });
    bws.close();
    t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.id === targetId);
  }
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map(); const consoleErr = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') consoleErr.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text).slice(0, 500));
  };
  // every CDP call has a deadline so one hung page cannot stall the whole matrix
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; const tm = setTimeout(() => { pend.delete(i); r({ error: 'timeout ' + method }); }, 25000); pend.set(i, (d) => { clearTimeout(tm); r(d); }); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.result?.value; };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  return { send, ev, consoleErr, ws };
}

const jobs = [];
for (const dev of devIds) for (const fsc of fonts) for (const spec of scenes) jobs.push({ dev, fsc, spec });
const results = {};
let next = 0;
async function worker(i) {
  const p = await openPage(i === 0);
  let cur = null;
  while (next < jobs.length) {
    const { dev, fsc, spec } = jobs[next++];
    const D = DEV[dev];
    if (!D) throw new Error('unknown device ' + dev);
    const name = spec.split(':')[0];
    if (cur !== dev) { await p.send('Emulation.setDeviceMetricsOverride', { width: D.w, height: D.h, deviceScaleFactor: D.dpr || 2, mobile: false }); cur = dev; }
    p.consoleErr.length = 0;
    await p.send('Page.navigate', { url: 'about:blank' });
    const q = `?w=${D.w}&h=${D.h}&top=${D.top}&bottom=${D.bottom}&fs=${fsc}&bundle=${BUNDLE}${OSQ}`;
    await p.send('Page.navigate', { url: `file://${HERE}/index.html${q}#${spec}` });
    let ready = null;
    for (let k = 0; k < 100 && !ready; k++) { await sleep(150); ready = await p.ev('window.__READY__ || null'); }
    if (!ready) { results[`${dev}|${fsc}|${name}`] = { ready: null, errors: ['not ready (timeout)'] }; console.log(dev, fsc, name, 'TIMEOUT', JSON.stringify(p.consoleErr).slice(0, 400), await p.ev('document.readyState + " " + (document.getElementById("root")?.childElementCount)')); continue; }
    const wait = (await p.ev('window.__WAIT__')) || 1200;
    await p.ev('document.fonts && document.fonts.ready.then(() => 1)');
    await sleep(wait);
    // wait until the layout stops moving (onLayout-driven re-layouts, font swaps, fit-to-size) before measuring
    const SIG = '(() => { let h = 0; for (const e of document.querySelectorAll("#root *")) { const r = e.getBoundingClientRect(); h = (h * 31 + Math.round(r.left) * 7 + Math.round(r.top) * 13 + Math.round(r.width) * 3 + Math.round(r.height)) | 0; } return h; })()';
    for (let k = 0, prev = null, same = 0; k < 20 && same < 2; k++) { const sg = await p.ev(SIG); same = sg === prev ? same + 1 : 0; prev = sg; await sleep(180); }
    const errs = (await p.ev('JSON.stringify((window.__ERRS__ || []).concat(window.__ERR__ ? ["render: " + window.__ERR__] : []))')) || '[]';
    const list = [...JSON.parse(errs), ...p.consoleErr];
    let layout = null;
    if (LAYOUT && ready === 'ok') {
      try { layout = JSON.parse(await p.ev(CHECK)); } catch (e) { layout = { error: String(e) }; }
      const dir = path.join(LAYOUT, `${dev}__fs${fsc}`); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${spec.replace(/[:]/g, '_')}.json`), JSON.stringify({ scene: spec, device: dev, fontScale: fsc, ...layout }, null, 1));
    }
    if (SHOTS) {
      const r = await p.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: D.w, height: D.h, scale: 1 } });
      if (!r.result) { console.log('screenshot failed', dev, fsc, name); continue; }
      const dir = flat ? OUT : path.join(OUT, dev, `fs${fsc}`); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from(r.result.data, 'base64'));
    }
    const key = flat ? name : `${dev}|${fsc}|${name}`;
    results[key] = { ready, errors: [...new Set(list)], ...(layout && !layout.error ? { violations: layout.violations.length } : {}) };
    console.log(key, list.length ? `ERR(${list.length})` : 'ok', layout?.violations ? `layout:${layout.violations.filter((v) => v.sev === 'error').length}` : '');
  }
  p.ws.close();
}
await Promise.all(Array.from({ length: JOBS }, (_, i) => worker(i)));
fs.writeFileSync(RESULTS, JSON.stringify(results, null, 1));
chrome.kill();
process.exit(0);
