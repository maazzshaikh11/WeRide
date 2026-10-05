/**
 * Map-only colour constants.
 *
 * ROUTE_COLOR is the Ember accent (#FF4D00) used for the route polyline and the
 * destination pin. theme.ts still carries the legacy #FF5C00 primary; when the
 * Ember token file lands (theme/ember.ts) point ROUTE_COLOR at its accent token
 * instead of changing this value.
 */
export const ROUTE_COLOR = '#FF4D00';
/** Near-black outline under the route so it separates from roads on the dark style. */
export const ROUTE_CASING_COLOR = '#140700';
export const PIN_LIGHT = '#FFFFFF';
export const PIN_DARK = '#111111';
