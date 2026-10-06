/**
 * The teamDSY demo account and everything seeded for it. Pure data + small helpers
 * (no Firebase imports) so it can be unit-tested and read without running anything.
 *
 * The app signs in with an EMAIL, not a username, so "teamDSY" is the display name and
 * the login email is teamdsy@weride.app.
 *
 * Crew members are plain member ids prefixed `seed-`. They are NOT auth accounts, they
 * cannot log in, and the app never shows names for them (it shows "Rider <last 4 of id>").
 *
 * Shapes match what the app reads (docs/DEMO_PARITY_SPEC.md §2): the rider's public profile and private
 * settings, three crews, six rides (groups) with status/crew/RSVPs, a recorded ride log per past ride and
 * hazard clusters. Ride logs are SYNTHETIC: their tracks are interpolated along each ride's planned route so
 * the Log / Recap screens have something to show; they are demo data, not recorded rides.
 * Firestore rejects nested arrays, so tracks are flat [lat,lng,…] and polygon_points is empty.
 */

const EMAIL = 'teamdsy@weride.app';
// The owner's requested demo password is the default; set SEED_PASSWORD to use another (never seed this account into a production project).
const PASSWORD = process.env.SEED_PASSWORD || 'teamDSY@123';
const DISPLAY_NAME = 'teamDSY';

// Same alphabet GroupService uses (no 0/O/1/I/L).
const JOIN_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

const CREW = {
  meera: 'seed-meera',
  zoya: 'seed-zoya',
  dev: 'seed-dev',
  ishan: 'seed-ishan',
  kabir: 'seed-kabir',
};

const DAY = 24 * 3600 * 1000;
const HOUR = 3600 * 1000;

/** Which crew each ride belongs to, and where it stands. */
const RIDE_META = {
  'sunday-ghat-run': { crew: 'ghosts', status: 'planned', pace: 'Steady' },
  'ghat-ghosts-weekend': { crew: 'ghosts', status: 'planned', pace: 'Relaxed' },
  'lonavala-sunrise-loop': { crew: 'ghosts', status: 'finished', pace: 'Steady' },
  'marine-drive-night-ride': { crew: 'office', status: 'finished', pace: 'Relaxed' },
  'pune-expressway-blast': { crew: 'ghosts', status: 'finished', pace: 'Spirited' },
  'alibaug-coastal-run': { crew: 'rollers', status: 'finished', pace: 'Relaxed' },
};

const place = (label, lat, lng) => ({ label, lat, lng });
const stop = (id, label, lat, lng, icon) => ({ id, label, lat, lng, icon });

/** Local clock time `hh:mm` on the day `days` from `now`. */
function atLocalTime(now, days, hh, mm) {
  const d = new Date(now + days * DAY);
  d.setHours(hh, mm, 0, 0);
  return d.getTime();
}

/**
 * Group definitions. `me` is the account's uid. `at(days, hh, mm)` gives epoch ms.
 * Order: the next ride, the group teamDSY joined, then past rides (newest first).
 */
function groups(me, now = Date.now()) {
  const at = (days, hh, mm) => atLocalTime(now, days, hh, mm);
  const { meera, zoya, dev, ishan, kabir } = CREW;
  return [
    {
      key: 'sunday-ghat-run', code: 'K7M2QX', name: 'Sunday Ghat Run', created_by: me, ride_type: 'Touring',
      start_time_ms: at(1, 6, 30), created_ms: now - 2 * DAY,
      member_ids: [me, meera, zoya, dev, ishan, kabir],
      ride_plan: {
        start: place('Bandra Fort, Mumbai', 19.0419, 72.8188),
        stops: [stop('s1', 'Chai Point, Khopoli', 18.7886, 73.3452, '☕')],
        destination: place('Lonavala, Maharashtra', 18.7481, 73.4072),
      },
    },
    {
      key: 'ghat-ghosts-weekend', code: 'G4H8TW', name: 'Ghat Ghosts Weekend', created_by: meera, ride_type: 'Off-road',
      start_time_ms: at(6, 7, 0), created_ms: now - 4 * DAY,
      member_ids: [meera, zoya, kabir, me],
      ride_plan: {
        start: place('Shivajinagar, Pune', 18.5308, 73.8475),
        stops: [],
        destination: place('Mulshi Dam, Pune', 18.5167, 73.5167),
      },
    },
    {
      key: 'lonavala-sunrise-loop', code: 'N5P3RD', name: 'Lonavala Sunrise Loop', created_by: me, ride_type: 'Touring',
      start_time_ms: at(-8, 5, 45), created_ms: now - 11 * DAY,
      member_ids: [me, meera, zoya, dev, ishan],
      ride_plan: {
        start: place('Bandra Fort, Mumbai', 19.0419, 72.8188),
        stops: [stop('s1', 'Chai Point, Khopoli', 18.7886, 73.3452, '☕')],
        destination: place('Lonavala, Maharashtra', 18.7481, 73.4072),
      },
    },
    {
      key: 'marine-drive-night-ride', code: 'R6S9VX', name: 'Marine Drive Night Ride', created_by: meera, ride_type: 'Casual',
      start_time_ms: at(-15, 21, 30), created_ms: now - 17 * DAY,
      member_ids: [meera, me, dev, kabir],
      ride_plan: {
        start: place('Worli Sea Face, Mumbai', 19.0176, 72.8157),
        stops: [],
        destination: place('Marine Drive, Mumbai', 18.944, 72.8235),
      },
    },
    {
      key: 'pune-expressway-blast', code: 'T2W7YZ', name: 'Pune Expressway Blast', created_by: me, ride_type: 'Sport',
      start_time_ms: at(-29, 6, 0), created_ms: now - 32 * DAY,
      member_ids: [me, meera, zoya, dev, ishan, kabir],
      ride_plan: {
        start: place('Kharghar, Navi Mumbai', 19.033, 73.066),
        stops: [stop('s1', 'Fuel stop, Khalapur', 18.818, 73.2985, '⛽')],
        destination: place('Hinjewadi, Pune', 18.5912, 73.7389),
      },
    },
    {
      key: 'alibaug-coastal-run', code: 'C8D4FJ', name: 'Alibaug Coastal Run', created_by: zoya, ride_type: 'Casual',
      start_time_ms: at(-44, 7, 15), created_ms: now - 47 * DAY,
      member_ids: [zoya, me, ishan, kabir],
      ride_plan: {
        start: place('Gateway of India, Mumbai', 18.922, 72.8347),
        stops: [],
        destination: place('Alibaug Beach, Maharashtra', 18.6414, 72.8722),
      },
    },
  ];
}

/**
 * Hazard clusters on the next ride's route, as the Alerts screen reads them.
 * created_at_hlc is "<epoch ms>:<counter>"; `hazard_score` follows the app's 0..1 scale.
 */
function hazards(groupId, now = Date.now()) {
  const hlc = (agoMin) => `${now - agoMin * 60000}:0`;
  return [
    { key: 'pothole-khopoli', hazard_type: 'pothole', centroid_lat: 18.7712, centroid_lng: 73.3544, report_count: 4, hazard_score: 0.62, created_at_hlc: hlc(18), status: 'active' },
    { key: 'oil-ghat', hazard_type: 'oil_spill', centroid_lat: 18.7602, centroid_lng: 73.3961, report_count: 2, hazard_score: 0.41, created_at_hlc: hlc(55), status: 'active' },
    { key: 'debris-expressway', hazard_type: 'debris', centroid_lat: 18.8231, centroid_lng: 73.2841, report_count: 3, hazard_score: 0.35, created_at_hlc: hlc(240), status: 'resolved' },
  ].map(({ key, ...h }) => ({ cluster_id: `seed-teamdsy-${key}`, group_id: groupId, polygon_points: [], ...h }));
}

/** Deterministic Firestore id for a seeded group. */
const groupDocId = (key) => `seed-teamdsy-${key}`;


// ─── people ────────────────────────────────────────────────────────────────
const CREW_PROFILES = {
  [CREW.meera]: { name: 'Meera', bike: 'Interceptor 650', style: 'Steady', km: 4210, rides: 31, together: 92 },
  [CREW.zoya]: { name: 'Zoya', bike: 'Duke 390', style: 'Spirited', km: 2380, rides: 22, together: 90 },
  [CREW.dev]: { name: 'Dev', bike: 'Meteor 350', style: 'Relaxed', km: 960, rides: 12, together: 94 },
  [CREW.ishan]: { name: 'Ishan', bike: 'RC 390', style: 'Spirited', km: 1710, rides: 15, together: 88 },
  [CREW.kabir]: { name: 'Kabir', bike: 'Himalayan 411', style: 'Steady', km: 5030, rides: 38, together: 97 },
};

/** Public profiles for the crew (plain ids, no auth accounts) — so the app shows names, not "Rider 1234". */
function crewProfiles(now = Date.now()) {
  return Object.entries(CREW_PROFILES).map(([uid, p]) => ({
    uid,
    doc: {
      name: p.name, bike: p.bike, style: p.style, created_ms: now - 200 * DAY,
      stats: { km: p.km, rides: p.rides, together_sum: p.together * p.rides },
    },
  }));
}

/** The three crews. `me` is the account's uid. */
function crews(me, now = Date.now()) {
  const { meera, zoya, dev, ishan, kabir } = CREW;
  return [
    { key: 'ghosts', code: 'GH7S2K', name: 'Ghat Ghosts', created_by: meera, member_ids: [me, meera, zoya, dev, ishan, kabir], roles: { [meera]: 'lead', [kabir]: 'sweep' }, created_ms: now - 200 * DAY },
    { key: 'rollers', code: 'SM4W8R', name: 'Sunday Slow Rollers', created_by: zoya, member_ids: [me, zoya, dev, ishan, kabir], roles: { [zoya]: 'lead' }, created_ms: now - 120 * DAY },
    { key: 'office', code: 'RF9B3C', name: 'Office Bikers', created_by: me, member_ids: [me, meera, kabir, dev], roles: { [me]: 'lead' }, created_ms: now - 60 * DAY },
  ];
}
const crewDocId = (key) => `seed-teamdsy-crew-${key}`;

/** Ride docs: groups() plus crew / pace / status / timing. */
function rides(me, now = Date.now()) {
  return groups(me, now).map((g) => {
    const m = RIDE_META[g.key];
    const done = m.status === 'finished';
    return { ...g, crew_key: m.crew, pace: m.pace, status: done ? 'finished' : 'planned',
      started_ms: done ? g.start_time_ms : undefined, finished_ms: done ? g.start_time_ms + 2.6 * HOUR : undefined,
      meetup: g.ride_plan.start, invited_ids: g.member_ids.filter((x) => x !== g.created_by) };
  });
}

/** RSVPs for the two upcoming rides (uid -> status). Real crew members only. */
function rsvps(me, now = Date.now()) {
  const { meera, zoya, dev, ishan, kabir } = CREW;
  return {
    'sunday-ghat-run': [[me, 'going'], [meera, 'going'], [zoya, 'going'], [dev, 'maybe'], [ishan, 'going'], [kabir, 'going']].map(([uid, status], i) => ({ uid, status, updated_ms: now - (i + 1) * 47 * 60000 })),
    'ghat-ghosts-weekend': [[meera, 'going'], [zoya, 'going'], [kabir, 'going'], [me, 'going']].map(([uid, status], i) => ({ uid, status, updated_ms: now - (i + 3) * 61 * 60000 })),
  };
}

// ─── synthetic ride logs ───────────────────────────────────────────────────
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const toRad = (d) => (d * Math.PI) / 180;
function hav(a, b) {
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(x));
}

/** ~`n` points along start → stops → destination with a gentle seeded wiggle, as a FLAT [lat,lng,…] array. */
function trackAlong(plan, seed, n = 240) {
  const pts = [plan.start, ...plan.stops, plan.destination].map((p) => ({ lat: p.lat, lng: p.lng }));
  const seg = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = hav(pts[i - 1], pts[i]); seg.push(d); total += d; }
  const r = rng(seed);
  const out = [];
  for (let k = 0; k < n; k++) {
    let d = (k / (n - 1)) * total, i = 0;
    while (i < seg.length - 1 && d > seg[i]) { d -= seg[i]; i++; }
    const f = seg[i] ? Math.min(1, d / seg[i]) : 0;
    const a = pts[i], b = pts[i + 1];
    const wob = Math.sin((k / n) * Math.PI * 6) * 0.0035 + (r() - 0.5) * 0.0006;
    out.push(+(a.lat + (b.lat - a.lat) * f + wob * 0.6).toFixed(5), +(a.lng + (b.lng - a.lng) * f - wob * 0.6).toFixed(5));
  }
  return { flat: out, straightKm: total / 1000 };
}

const LOG_SHAPE = {
  'lonavala-sunrise-loop': { avg: 38, together: 96, gap: 400, hz: 1, sig: 3, seed: 11 },
  'marine-drive-night-ride': { avg: 29, together: 88, gap: 1100, hz: 4, sig: 2, seed: 23 },
  'pune-expressway-blast': { avg: 52, together: 79, gap: 2300, hz: 6, sig: 5, seed: 37 },
  'alibaug-coastal-run': { avg: 31, together: 93, gap: 700, hz: 2, sig: 1, seed: 41 },
};

/** The rider's recorded log for each past ride (synthetic demo data — see the file header). */
function logs(me, now = Date.now()) {
  return rides(me, now).filter((g) => g.status === 'finished').map((g) => {
    const sh = LOG_SHAPE[g.key];
    const { flat, straightKm } = trackAlong(g.ride_plan, sh.seed);
    const km = +(straightKm * 1.22).toFixed(1);
    const stopS = g.ride_plan.stops.length * 14 * 60;
    const duration_s = Math.round((km / sh.avg) * 3600 + stopS);
    const t0 = g.start_time_ms;
    const ev = [{ t_ms: t0, kind: 'rolled', text: `Rolled out ∙ ${g.member_ids.length} of ${g.member_ids.length} ready` }];
    ev.push({ t_ms: t0 + duration_s * 1000 * 0.3, kind: 'hazard', text: 'Hazard reported ahead' });
    if (g.ride_plan.stops.length) ev.push({ t_ms: t0 + duration_s * 1000 * 0.5, kind: 'stop', text: `${g.ride_plan.stops[0].label.split(',')[0]} ∙ 14 min break` });
    if (sh.together < 90) ev.push({ t_ms: t0 + duration_s * 1000 * 0.65, kind: 'gap', text: `Gap of ${(sh.gap / 1000).toFixed(1)} km — regrouped` });
    ev.push({ t_ms: t0 + duration_s * 1000, kind: 'arrived', text: `Arrived ∙ ${g.ride_plan.destination.label.split(',')[0]}` });
    return {
      ride_id: groupDocId(g.key), crew_id: crewDocId(g.crew_key), name: g.name, started_ms: t0, ended_ms: t0 + duration_s * 1000,
      km, duration_s, avg_kmh: sh.avg, max_kmh: Math.round(sh.avg * 1.7), together_pct: sh.together, longest_gap_m: sh.gap,
      riders: g.member_ids.length, hazards_shared: sh.hz, signals_sent: sh.sig, track: flat, events: ev, rating: null,
      start: g.ride_plan.start, destination: g.ride_plan.destination,
    };
  });
}

/** My public profile, with lifetime stats equal to the sum of the seeded logs. */
function myProfile(me, now = Date.now()) {
  const ls = logs(me, now);
  return {
    name: DISPLAY_NAME, bike: 'Himalayan 450', style: 'Steady', created_ms: now - 90 * DAY,
    stats: { km: +ls.reduce((a, l) => a + l.km, 0).toFixed(1), rides: ls.length, together_sum: ls.reduce((a, l) => a + l.together_pct, 0) },
  };
}
/** My private settings: onboarded (so the app opens in the Garage). No contacts — you add your own. */
const mySettings = () => ({ onboarded: true, prefs: { hold_ms: 1500, glove: false, units: 'km', road: 'auto', crash: true, learn: true, share: 'crew' } });

module.exports = { EMAIL, PASSWORD, DISPLAY_NAME, JOIN_CODE_RE, CREW, CREW_PROFILES, DAY, HOUR, groups, hazards, groupDocId, crews, crewDocId, crewProfiles, rides, rsvps, logs, myProfile, mySettings, hav };
