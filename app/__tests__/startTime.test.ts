import { describeStart, startTimeFromPreset, START_PRESETS } from '../src/utils/startTime';

const MIN = 60_000;
// Local-time "now": Mon 5 Oct 2026 12:00
const NOW = new Date(2026, 9, 5, 12, 0, 0, 0).getTime();

describe('startTimeFromPreset', () => {
  test('relative presets add exact offsets', () => {
    expect(startTimeFromPreset('Now', NOW)).toBe(NOW);
    expect(startTimeFromPreset('In 30 min', NOW)).toBe(NOW + 30 * MIN);
    expect(startTimeFromPreset('In 1 hour', NOW)).toBe(NOW + 60 * MIN);
    expect(startTimeFromPreset('In 2 hours', NOW)).toBe(NOW + 120 * MIN);
  });

  test('Tomorrow 6:00 is 06:00 local on the next calendar day', () => {
    const t = new Date(startTimeFromPreset('Tomorrow 6:00', NOW));
    expect([t.getFullYear(), t.getMonth(), t.getDate()]).toEqual([2026, 9, 6]);
    expect([t.getHours(), t.getMinutes(), t.getSeconds(), t.getMilliseconds()]).toEqual([6, 0, 0, 0]);
  });

  test('Tomorrow 6:00 works late at night and across month/year ends', () => {
    const late = new Date(2026, 9, 5, 23, 59).getTime();
    expect(new Date(startTimeFromPreset('Tomorrow 6:00', late)).getDate()).toBe(6);
    const nye = new Date(2026, 11, 31, 22, 0).getTime();
    const t = new Date(startTimeFromPreset('Tomorrow 6:00', nye));
    expect([t.getFullYear(), t.getMonth(), t.getDate(), t.getHours()]).toEqual([2027, 0, 1, 6]);
  });

  test('Tomorrow 6:00 is 06:00 local on every day of the year (DST-agnostic)', () => {
    for (let day = 0; day < 366; day++) {
      const now = new Date(2026, 0, 1 + day, 13, 15).getTime();
      const t = new Date(startTimeFromPreset('Tomorrow 6:00', now));
      const expected = new Date(2026, 0, 2 + day);
      expect(t.getHours()).toBe(6);
      expect(t.getMinutes()).toBe(0);
      expect([t.getFullYear(), t.getMonth(), t.getDate()]).toEqual([
        expected.getFullYear(), expected.getMonth(), expected.getDate(),
      ]);
    }
  });

  test('exposes exactly the five presets, in order', () => {
    expect([...START_PRESETS]).toEqual(['Now', 'In 30 min', 'In 1 hour', 'In 2 hours', 'Tomorrow 6:00']);
  });
});

describe('describeStart', () => {
  const at = (h: number, m: number, dayOffset = 0) => new Date(2026, 9, 5 + dayOffset, h, m).getTime();

  test('returns null when there is no start time', () => {
    expect(describeStart(null, NOW)).toBeNull();
    expect(describeStart(undefined, NOW)).toBeNull();
    expect(describeStart(0, NOW)).toBeNull();
    expect(describeStart(NaN, NOW)).toBeNull();
  });

  test('imminent, soon and later today', () => {
    expect(describeStart(NOW, NOW)).toBe('Starting now');
    expect(describeStart(NOW + 25 * MIN, NOW)).toBe('Starts in 25 min');
    expect(describeStart(NOW + 59 * MIN, NOW)).toBe('Starts in 59 min');
    expect(describeStart(at(18, 30), NOW)).toBe('Starts today 18:30');
  });

  test('tomorrow and later days', () => {
    expect(describeStart(at(6, 0, 1), NOW)).toBe('Tomorrow 06:00');
    expect(describeStart(at(7, 5, 3), NOW)).toBe('Thu 8 Oct 07:05');
  });

  test('already started', () => {
    expect(describeStart(NOW - 10 * MIN, NOW)).toBe('Started 10 min ago');
    expect(describeStart(NOW - 3 * 60 * MIN, NOW)).toBe('Started 3 h ago');
    expect(describeStart(NOW - 150 * MIN, NOW)).toBe('Started 2 h 30 min ago');
    expect(describeStart(at(18, 30, -1), NOW)).toBe('Started 17 h 30 min ago');
    expect(describeStart(at(8, 0, -1), NOW)).toBe('Started yesterday 08:00');
    expect(describeStart(at(18, 30, -3), NOW)).toBe('Started Fri 2 Oct 18:30');
  });
});
