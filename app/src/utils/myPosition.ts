/**
 * The rider's current position, once: the Ride tab's weather and the Plan flow's "starting from". Prefers
 * the live-ride store's last good fix when it is recent, otherwise asks the OS (no permission prompt here:
 * onboarding already asked; without permission this resolves null).
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore the package ships no type declarations
import Geolocation from 'react-native-geolocation-service';
import { useRouteStore } from '@routing/client/routeStore';

/** Label when a position cannot be reverse-geocoded to a place name. */
export const MY_LOCATION_FALLBACK = 'My location';

export interface Position {
  lat: number;
  lng: number;
}

export function getMyPosition(timeoutMs = 8000): Promise<Position | null> {
  const known = useRouteStore.getState().lastValidLocation;
  if (known && Number.isFinite(known.lat) && Number.isFinite(known.lng)) return Promise.resolve({ lat: known.lat, lng: known.lng });
  return new Promise((resolve) => {
    let done = false;
    const finish = (p: Position | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(p);
    };
    const timer = setTimeout(() => finish(null), timeoutMs + 500);
    try {
      Geolocation.getCurrentPosition(
        (pos: { coords: { latitude: number; longitude: number } }) => finish({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => finish(null),
        { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 120_000 },
      );
    } catch {
      finish(null);
    }
  });
}
