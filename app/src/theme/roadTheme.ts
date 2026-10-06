/**
 * Road theme resolution. The garage palette follows the Light / Dark / Auto setting; the Road screens have their own
 * setting (Me > Road screen & controls): 'night' = the theme's dark Road palette, 'day' = its light Road palette,
 * 'auto' = night when it is dark at the rider's last known position (06:00-18:30 local clock if there is none),
 * re-checked every minute.
 */
import { useEffect, useState } from 'react';
import { useRouteStore } from '@routing/client/routeStore';
import { RoadTheme } from '../models/domain';
import { usePrefsStore } from '../store/prefsStore';
import { isNight, LatLng } from '../utils/sun';
import { Scheme } from './palettes';
import { useThemeStore } from './themeStore';

export function resolveRoadScheme(pref: RoadTheme, now: Date | number, fix?: LatLng | null): Scheme {
  if (pref === 'night') return 'dark';
  if (pref === 'day') return 'light';
  return isNight(now, fix) ? 'dark' : 'light';
}

const MINUTE_MS = 60_000;

/** The scheme the Road palette should use right now. Re-evaluates every minute while the preference is 'auto'. */
export function useRoadScheme(): Scheme {
  const pref = usePrefsStore((s) => s.prefs.road);
  const live = useRouteStore((s) => s.currentLocation);
  const stored = useThemeStore((s) => s.lastFix);
  const setLastFix = useThemeStore((s) => s.setLastFix);
  const [now, setNow] = useState(() => Date.now());

  // Remember where the rider was, so "auto" still works when the bike is parked and there is no live fix.
  const liveLat = live?.lat;
  const liveLng = live?.lng;
  useEffect(() => {
    if (typeof liveLat === 'number' && typeof liveLng === 'number' && Number.isFinite(liveLat) && Number.isFinite(liveLng)) {
      setLastFix({ lat: liveLat, lng: liveLng });
    }
  }, [liveLat, liveLng, setLastFix]);

  useEffect(() => {
    if (pref !== 'auto') return undefined;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(id);
  }, [pref]);

  const fix: LatLng | null = typeof liveLat === 'number' && typeof liveLng === 'number' ? { lat: liveLat, lng: liveLng } : stored;
  return resolveRoadScheme(pref, now, fix);
}
