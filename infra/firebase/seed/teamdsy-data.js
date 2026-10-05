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
 * Shapes match what the app reads: groups/{id} as written by GroupService.createGroup,
 * hazards/{id} as read by the Alerts screen. Firestore rejects nested arrays, so a hazard
 * cluster's polygon_points is left empty here.
 */

const EMAIL = 'teamdsy@weride.app';
const PASSWORD = 'teamDSY@123';
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

module.exports = { EMAIL, PASSWORD, DISPLAY_NAME, JOIN_CODE_RE, CREW, DAY, groups, hazards, groupDocId };
