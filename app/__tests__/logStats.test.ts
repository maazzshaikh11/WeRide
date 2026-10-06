import {
  WEEK_MS, decimateFlat, eventTone, formatClock, formatElapsed, formatHours, formatRideDate, hasTogetherData, logTotals, seasonLabel, weeklyKm,
} from '../src/utils/logStats';

const NOW = new Date(2026, 9, 6, 12, 0, 0).getTime(); // 6 Oct 2026, local noon
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h, 0, 0).getTime();

describe('logTotals', () => {
  it('sums km, rides and hours', () => {
    expect(logTotals([{ km: 28, duration_s: 3480 }, { km: 112, duration_s: 10920 }])).toEqual({ km: 140, rides: 2, hours: (3480 + 10920) / 3600 });
  });
  it('is zero for no rides and ignores junk values', () => {
    expect(logTotals([])).toEqual({ km: 0, rides: 0, hours: 0 });
    expect(logTotals([{ km: NaN, duration_s: -5 }, { km: -3, duration_s: 3600 }])).toEqual({ km: 0, rides: 2, hours: 1 });
  });
});

describe('weeklyKm', () => {
  const log = (agoMs: number, km: number) => ({ km, started_ms: NOW - agoMs });
  it('labels W1..W8 and is all zeros when empty', () => {
    const w = weeklyKm([], NOW);
    expect(w.labels).toEqual(['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8']);
    expect(w.values).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });
  it('W8 is the last 7 days, W7 the 7 before, oldest first', () => {
    const w = weeklyKm([log(0, 10), log(1000, 5), log(WEEK_MS - 1, 2), log(WEEK_MS, 7), log(2 * WEEK_MS + 5, 3)], NOW);
    expect(w.values[7]).toBe(17); // now, 1 s ago, 7 d - 1 ms ago
    expect(w.values[6]).toBe(7); // exactly 7 d ago belongs to the earlier week
    expect(w.values[5]).toBe(3);
  });
  it('week boundaries: 8 weeks - 1 ms is W1, 8 weeks is out', () => {
    const w = weeklyKm([log(8 * WEEK_MS - 1, 4), log(8 * WEEK_MS, 99), log(20 * WEEK_MS, 99)], NOW);
    expect(w.values[0]).toBe(4);
    expect(w.values.reduce((a, b) => a + b, 0)).toBe(4);
  });
  it('a ride dated in the future (clock skew) counts in the latest week; NaN is skipped', () => {
    const w = weeklyKm([{ km: 6, started_ms: NOW + 3600_000 }, { km: NaN, started_ms: NOW }, { km: 1, started_ms: NaN }], NOW);
    expect(w.values[7]).toBe(6);
  });
});

describe('seasonLabel', () => {
  it('spans the first and last month', () => {
    expect(seasonLabel([{ started_ms: at(2026, 8, 15) }, { started_ms: at(2026, 9, 4) }, { started_ms: at(2026, 8, 27) }])).toBe('SEASON · SEP – OCT');
  });
  it('one month', () => {
    expect(seasonLabel([{ started_ms: at(2026, 9, 4) }, { started_ms: at(2026, 9, 20) }])).toBe('SEASON · OCT');
  });
  it('YOUR LOG when empty', () => {
    expect(seasonLabel([])).toBe('YOUR LOG');
    expect(seasonLabel([{ started_ms: 0 }, { started_ms: NaN }])).toBe('YOUR LOG');
  });
});

describe('formatting', () => {
  it('date, clock, elapsed, hours', () => {
    expect(formatRideDate(at(2026, 9, 4))).toBe('Sun 4 Oct');
    expect(formatRideDate(0)).toBe('');
    expect(formatClock(new Date(2026, 9, 4, 6, 34).getTime())).toBe('06:34');
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(75)).toBe('1:15');
    expect(formatElapsed(3725)).toBe('1:02:05');
    expect(formatElapsed(NaN)).toBe('0:00');
    expect(formatHours(31.2)).toBe('31');
    expect(formatHours(3.46)).toBe('3.5');
    expect(formatHours(0)).toBe('0');
  });
});

describe('decimateFlat', () => {
  const track = (n: number) => Array.from({ length: n * 2 }, (_, i) => (i % 2 === 0 ? 19 + Math.floor(i / 2) * 1e-4 : 72.8));
  it('keeps short tracks as they are', () => {
    expect(decimateFlat(track(10), 600)).toEqual(track(10));
    expect(decimateFlat([], 600)).toEqual([]);
  });
  it('keeps at most `max` points including the first and the last', () => {
    const t = track(2500);
    const d = decimateFlat(t, 600);
    expect(d.length).toBe(1200);
    expect(d.slice(0, 2)).toEqual(t.slice(0, 2));
    expect(d.slice(-2)).toEqual(t.slice(-2));
  });
  it('never splits a pair and stays ordered', () => {
    const d = decimateFlat(track(1001), 600);
    for (let i = 2; i < d.length; i += 2) expect(d[i]).toBeGreaterThan(d[i - 2]);
  });
});

describe('hasTogetherData / eventTone', () => {
  it('0 % and 0 m means no other rider was ever seen', () => {
    expect(hasTogetherData({ together_pct: 0, longest_gap_m: 0 })).toBe(false);
    expect(hasTogetherData({ together_pct: 0, longest_gap_m: 800 })).toBe(true);
    expect(hasTogetherData({ together_pct: 96, longest_gap_m: 400 })).toBe(true);
  });
  it('tones', () => {
    expect(eventTone('rolled')).toBe('ok');
    expect(eventTone('arrived')).toBe('ok');
    expect(eventTone('hazard')).toBe('pri');
    expect(eventTone('gap')).toBe('pri');
    expect(eventTone('sos')).toBe('bad');
    expect(eventTone('stop')).toBe('ink');
  });
});
