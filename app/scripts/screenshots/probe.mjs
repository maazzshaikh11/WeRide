// Debug helper: render one scene on one device and evaluate a JS expression in the page.
//   node probe.mjs <chrome> <device> <fontScale> <scene> '<js expression returning JSON-able>'  (BUNDLE=... env)
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const [CH, dev, fsc, spec, expr] = process.argv.slice(2);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const D = JSON.parse(fs.readFileSync(path.join(HERE, 'devices.json'), 'utf8'))[dev];
const PORT = 9800 + Math.floor(Math.random() * 100);
const chrome = spawn(CH, ['--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', `--remote-debugging-port=${PORT}`, `--user-data-dir=${fs.mkdtempSync('/tmp/probe-')}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let t; for (let i = 0; i < 60 && !t; i++) { try { t = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()).find((x) => x.type === 'page'); } catch { await sleep(200); } }
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Page.enable'); await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: D.w, height: D.h, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url: `file://${HERE}/index.html?w=${D.w}&h=${D.h}&top=${D.top}&bottom=${D.bottom}&fs=${fsc}&bundle=${process.env.BUNDLE || 'scenes.js'}#${spec}` });
for (let i = 0; i < 100 && !(await ev('window.__READY__')); i++) await sleep(150);
await sleep((await ev('window.__WAIT__')) || 1500);
console.log(JSON.stringify(await ev(expr), null, 1));
ws.close(); chrome.kill(); process.exit(0);
