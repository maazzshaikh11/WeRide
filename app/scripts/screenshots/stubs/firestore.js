// In-memory stand-in for @react-native-firebase/firestore. Data lives in globalThis.__FS__ (Map path -> doc data);
// scenes seed it (see scenes.tsx seedFirestore) and the app's real services read it. onSnapshot fires once
// (async) with the current data and again after any write through this module.
const DB = (globalThis.__FS__ = globalThis.__FS__ || new Map());
const subs = (globalThis.__FS_SUBS__ = globalThis.__FS_SUBS__ || new Set());

const SERVER_TS = { __op: 'serverTimestamp' };
const ts = (ms) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0, toMillis: () => ms, toDate: () => new Date(ms) });
const FieldValue = {
  serverTimestamp: () => SERVER_TS,
  increment: (n) => ({ __op: 'increment', n }),
  arrayUnion: (...v) => ({ __op: 'arrayUnion', v }),
  arrayRemove: (...v) => ({ __op: 'arrayRemove', v }),
  delete: () => ({ __op: 'delete' }),
};
const DOC_ID = { __docId: true };
const FieldPath = function () {};
FieldPath.documentId = () => DOC_ID;
const Timestamp = { now: () => ts(Date.now()), fromMillis: ts, fromDate: (d) => ts(d.getTime()) };

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const getIn = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function applyOps(base, patch, dotted) {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    const keys = dotted ? k.split('.') : [k];
    let o = out;
    for (let i = 0; i < keys.length - 1; i++) { o[keys[i]] = { ...(o[keys[i]] || {}) }; o = o[keys[i]]; }
    const last = keys[keys.length - 1];
    const cur = o[last];
    if (v && v.__op === 'serverTimestamp') o[last] = ts(Date.now());
    else if (v && v.__op === 'increment') o[last] = (typeof cur === 'number' ? cur : 0) + v.n;
    else if (v && v.__op === 'arrayUnion') o[last] = [...(cur || []), ...v.v.filter((x) => !(cur || []).includes(x))];
    else if (v && v.__op === 'arrayRemove') o[last] = (cur || []).filter((x) => !v.v.includes(x));
    else if (v && v.__op === 'delete') delete o[last];
    else o[last] = v;
  }
  return out;
}
const notify = () => setTimeout(() => subs.forEach((f) => f()), 0);
const idOf = (p) => p.split('/').pop();

function docSnap(path) {
  const d = DB.get(path);
  return { id: idOf(path), exists: d !== undefined, ref: docRef(path), data: () => (d === undefined ? undefined : clone(d)), get: (f) => getIn(d, f) };
}
function docRef(path) {
  return {
    id: idOf(path), path,
    get: async () => docSnap(path),
    set: async (data, opts) => { DB.set(path, opts && opts.merge ? applyOps(DB.get(path) || {}, data, false) : applyOps({}, data, false)); notify(); },
    update: async (a, ...rest) => {
      let patch = a;
      if (typeof a === 'string') patch = { [a]: rest[0] };
      if (!DB.has(path)) throw Object.assign(new Error('not-found'), { code: 'firestore/not-found' });
      DB.set(path, applyOps(DB.get(path), patch, true)); notify();
    },
    delete: async () => { DB.delete(path); notify(); },
    onSnapshot: (cb, err) => {
      const run = () => { try { (typeof cb === 'function' ? cb : cb.next)(docSnap(path)); } catch (e) { console.error('[fs doc cb]', e); } };
      const f = () => run(); subs.add(f); setTimeout(run, 0); return () => subs.delete(f);
    },
    collection: (name) => collRef(`${path}/${name}`),
  };
}
function query(path, filters, orders, lim) {
  const run = () => {
    let docs = [];
    for (const [p, d] of DB) {
      if (!p.startsWith(path + '/')) continue;
      const rest = p.slice(path.length + 1);
      if (rest.includes('/')) continue;
      docs.push({ p, d });
    }
    for (const [f, op, val] of filters) {
      docs = docs.filter(({ p, d }) => {
        const v = f === DOC_ID ? idOf(p) : getIn(d, f);
        switch (op) {
          case '==': return v === val;
          case '!=': return v !== val;
          case 'array-contains': return Array.isArray(v) && v.includes(val);
          case 'in': return val.includes(v);
          case '>': return v > val; case '>=': return v >= val; case '<': return v < val; case '<=': return v <= val;
          default: return true;
        }
      });
    }
    for (const [f, dir] of [...orders].reverse()) docs.sort((a, b) => { const x = getIn(a.d, f), y = getIn(b.d, f); return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'desc' ? -1 : 1); });
    if (lim != null) docs = docs.slice(0, lim);
    const snaps = docs.map(({ p }) => docSnap(p));
    return { empty: snaps.length === 0, size: snaps.length, docs: snaps, forEach: (fn) => snaps.forEach(fn) };
  };
  const q = {
    where: (f, op, v) => query(path, [...filters, [f, op, v]], orders, lim),
    orderBy: (f, dir) => query(path, filters, [...orders, [f, dir || 'asc']], lim),
    limit: (n) => query(path, filters, orders, n),
    startAfter: () => q, endBefore: () => q,
    get: async () => run(),
    onSnapshot: (cb, err) => {
      const go = () => { try { (typeof cb === 'function' ? cb : cb.next)(run()); } catch (e) { console.error('[fs query cb]', e); } };
      subs.add(go); setTimeout(go, 0); return () => subs.delete(go);
    },
  };
  return q;
}
function collRef(path) {
  return { ...query(path, [], [], null), id: idOf(path), path, doc: (id) => docRef(`${path}/${id || 'auto' + Math.random().toString(36).slice(2, 8)}`), add: async (data) => { const id = 'auto' + Math.random().toString(36).slice(2, 8); await docRef(`${path}/${id}`).set(data); return docRef(`${path}/${id}`); } };
}
const refPath = (r) => r.path;
const instance = {
  doc: (p) => docRef(p),
  collection: (p) => collRef(p),
  batch: () => {
    const ops = [];
    const b = { set: (r, d, o) => (ops.push(() => r.set(d, o)), b), update: (r, d) => (ops.push(() => r.update(d)), b), delete: (r) => (ops.push(() => r.delete()), b), commit: async () => { for (const o of ops) await o(); } };
    return b;
  },
  runTransaction: async (fn) => fn({ get: (r) => r.get(), set: (r, d, o) => r.set(d, o), update: (r, d) => r.update(d), delete: (r) => r.delete() }),
  enableNetwork: async () => {}, disableNetwork: async () => {}, settings: () => {},
};
const firestore = () => instance;
firestore.FieldValue = FieldValue;
firestore.FieldPath = FieldPath;
firestore.Timestamp = Timestamp;
export default firestore;
export { FieldValue, FieldPath, Timestamp };
