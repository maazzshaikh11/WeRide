/**
 * Pure empty-state logic for the route details sheet (RouteSheet).
 */

export type RoutePanelMode =
  | 'loading'
  | 'ready'
  | 'no-fix'
  | 'no-destination'
  | 'pending';

export interface RoutePanelInputs {
  hasRoute: boolean;
  isLoading: boolean;
  /** A verified own location fix exists. */
  hasFix: boolean;
  /** The ride plan has a destination. */
  hasDestination: boolean;
}

/** What the collapsed panel shows in place of the stats. */
export function routePanelMode({
  hasRoute,
  isLoading,
  hasFix,
  hasDestination,
}: RoutePanelInputs): RoutePanelMode {
  if (isLoading) return 'loading';
  if (hasRoute) return 'ready';
  if (!hasFix) return 'no-fix';
  if (!hasDestination) return 'no-destination';
  return 'pending';
}

export const EMPTY_STATE_COPY: Record<
  Exclude<RoutePanelMode, 'loading' | 'ready'>,
  { title: string; detail: string }
> = {
  'no-fix': {
    title: 'Waiting for your location',
    detail: 'Distance and ETA appear once your GPS has a fix.',
  },
  'no-destination': {
    title: 'Pick a destination',
    detail: 'This ride has no destination yet.',
  },
  pending: {
    title: 'Finding a route',
    detail: 'Distance and ETA will show up here.',
  },
};
