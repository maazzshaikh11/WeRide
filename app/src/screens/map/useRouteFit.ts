/**
 * useRouteFit — frames the route like Google Maps does when a ride starts.
 *
 * Root cause this fixes: the camera used to be locked to `followUserLocation`
 * (centred on the rider at a fixed zoom, hardcoded to San Francisco until a GPS
 * fix arrived) and nothing ever fit the route. With no puck yet, rnmapbox shows
 * the world; the route was a speck on it.
 *
 * Contract:
 *  - fits once per `signature` (plan change, or first route for that plan);
 *  - never re-fits on re-routes, so the camera does not fight the rider;
 *  - does nothing while the camera is following the rider;
 *  - waits for the map to finish loading (camera ref is not usable before).
 */
import { RefObject, useCallback, useEffect, useRef } from 'react';
import type MapboxGL from '@rnmapbox/maps';
import { planFit, LatLng } from '../../utils/mapFit';

type Padding = [number, number, number, number]; // top, right, bottom, left

interface Args {
  cameraRef: RefObject<MapboxGL.Camera>;
  mapReady: boolean;
  following: boolean;
  points: LatLng[];
  signature: string;
  padding: Padding;
  animationMs?: number;
}

export function useRouteFit({
  cameraRef,
  mapReady,
  following,
  points,
  signature,
  padding,
  animationMs = 700,
}: Args) {
  const fittedFor = useRef<string | null>(null);
  // Latest inputs for the imperative fit() without re-creating the callback.
  const latest = useRef({ points, padding });
  latest.current = { points, padding };

  const fit = useCallback(
    (animated = true): boolean => {
      const camera = cameraRef.current;
      const plan = planFit(latest.current.points);
      if (!camera || !plan) return false;
      const duration = animated ? animationMs : 0;
      const pad = latest.current.padding;
      if (plan.kind === 'bounds') {
        camera.fitBounds(plan.ne, plan.sw, pad, duration);
      } else {
        camera.setCamera({
          centerCoordinate: plan.center,
          zoomLevel: plan.zoom,
          padding: {
            paddingTop: pad[0],
            paddingRight: pad[1],
            paddingBottom: pad[2],
            paddingLeft: pad[3],
          },
          animationDuration: duration,
        });
      }
      return true;
    },
    [cameraRef, animationMs],
  );

  // Entering follow mode forgets the last fit so leaving it re-frames the route.
  useEffect(() => {
    if (following) fittedFor.current = null;
  }, [following]);

  useEffect(() => {
    if (!mapReady || following) return;
    if (fittedFor.current === signature) return;
    if (fit()) fittedFor.current = signature;
  }, [mapReady, following, signature, fit]);

  /** Call when the rider leaves follow mode by panning: keep the camera where they put it. */
  const markFitted = useCallback(() => {
    fittedFor.current = signature;
  }, [signature]);

  return { fit, markFitted };
}
