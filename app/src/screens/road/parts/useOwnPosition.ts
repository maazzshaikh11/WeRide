/**
 * The rider's own position BEFORE the ride is live (the tracking service only starts on Live): a one-shot high-accuracy
 * read every 10 s while a screen is mounted. Gives the roll call a real "GPS precise" check and the "at meetup" tile for you.
 */
import { useEffect, useState } from 'react';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore the package ships no typings
import Geolocation from 'react-native-geolocation-service';

export interface OwnPosition {
  lat: number;
  lng: number;
  accuracyM: number;
  speedMps: number;
}

export function useOwnPosition(enabled = true, everyMs = 10_000): OwnPosition | null {
  const [pos, setPos] = useState<OwnPosition | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const read = () => {
      try {
        Geolocation.getCurrentPosition(
          (p: { coords?: { latitude: number; longitude: number; accuracy: number; speed?: number | null } }) => {
            if (!alive || !p?.coords) return;
            setPos({
              lat: p.coords.latitude,
              lng: p.coords.longitude,
              accuracyM: p.coords.accuracy,
              speedMps: Number.isFinite(p.coords.speed) && (p.coords.speed as number) > 0 ? (p.coords.speed as number) : 0,
            });
          },
          () => undefined,
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 5000 },
        );
      } catch {
        /* no location module (tests / web): the checks simply say "finding GPS" */
      }
    };
    read();
    const id = setInterval(read, everyMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [enabled, everyMs]);
  return pos;
}
