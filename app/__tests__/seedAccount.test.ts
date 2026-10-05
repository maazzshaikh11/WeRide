/**
 * The teamDSY demo account (infra/firebase/seed) must look right in the app: the Rides
 * screen's own sectioning puts the next ride up top, the joined group in "Your rides"
 * and the four past rides under "Earlier", each with a real route distance.
 */
import { sectionRides, rideBadge, planDistanceKm } from '../src/utils/rides';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- plain-JS data file outside the app
const { groups: seedGroups } = require('../../infra/firebase/seed/teamdsy-data');

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0);
const UID = 'uid-teamdsy';
const asGroups = (seedGroups(UID, NOW) as any[]).map((g) => ({
  id: `seed-${g.key}`, name: g.name, created_by: g.created_by, member_ids: g.member_ids, created_at: { toMillis: () => g.created_ms },
  active_ride_id: null, join_code: g.code, ride_type: g.ride_type, start_time_ms: g.start_time_ms, ride_plan: g.ride_plan,
}));

describe('teamDSY seeded rides in the Rides screen', () => {
  const s = sectionRides(asGroups, NOW);

  it('next ride on top, joined group in Your rides, four past rides under Earlier', () => {
    expect(s.upNext?.name).toBe('Sunday Ghat Run');
    expect(s.rides.map((g) => g.name)).toEqual(['Ghat Ghosts Weekend']);
    expect(s.earlier.map((g) => g.name)).toEqual([
      'Lonavala Sunrise Loop', 'Marine Drive Night Ride', 'Pune Expressway Blast', 'Alibaug Coastal Run',
    ]);
  });

  it('badges: Upcoming for the future rides, Past for the earlier ones', () => {
    expect(rideBadge(s.upNext!, NOW).label).toBe('Upcoming');
    expect(rideBadge(s.rides[0], NOW).label).toBe('Upcoming');
    s.earlier.forEach((g) => expect(rideBadge(g, NOW).label).toBe('Past'));
  });

  it('every ride has a route distance the card can show', () => {
    for (const g of asGroups) {
      const km = planDistanceKm(g);
      expect(km).not.toBeNull();
      expect(km!).toBeGreaterThan(5);
      expect(km!).toBeLessThan(200);
    }
  });
});
