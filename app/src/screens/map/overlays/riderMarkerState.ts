/**
 * Centralized marker state computation for rider markers.
 *
 * Precedence (deterministic, no exceptions):
 *   1. If payload is null/undefined or fails validation → GREY
 *   2. If spoof_flag === true                          → RED
 *   3. If stale (timestamp_hlc physical > 10s ago)      → GREY
 *   4. Otherwise                                       → GREEN
 *
 * HLC timestamp format is "physical_ms:counter" (documented in
 * modules/hazard-sos/src/hlc/hlc.ts). We parse the physical field
 * locally here rather than using HLC.parse() which is private.
 * This does NOT introduce a second HLC parser — it extracts only
 * the physical Unix-ms component needed for staleness comparison.
 * Malformed/missing HLC → GREY (never GREEN, never treated as fresh).
 */

export type MarkerState = 'RED' | 'GREY' | 'GREEN';

const STALE_THRESHOLD_MS = 10_000;

/**
 * Validate that a raw Socket event payload has all required fields
 * with correct types before it enters the store.
 *
 * This guard wraps verifiedLocationFromJson — that function does not
 * validate, so we check types before calling it.
 */
export function isValidLocation(j: unknown): j is Record<string, any> {
  if (j == null || typeof j !== 'object') {
    return false;
  }
  const obj = j as Record<string, any>;
  return (
    typeof obj.rider_id === 'string' && obj.rider_id.length > 0 &&
    typeof obj.group_id === 'string' &&
    typeof obj.lat === 'number' && Number.isFinite(obj.lat) &&
    typeof obj.lng === 'number' && Number.isFinite(obj.lng) &&
    typeof obj.spoof_flag === 'boolean' &&
    typeof obj.timestamp_hlc === 'string'
  );
}

/**
 * Extract the physical Unix-millisecond timestamp from an HLC string.
 *
 * HLC string format (from HLC.toString): "<physical_ms>:<counter>"
 * We need only the physical component for staleness comparison.
 *
 * This is a minimal format validator / extractor required because
 * HLC.parse() is private. It does NOT replace HLC.parse() — it only
 * validates the canonical "physical:counter" format at this boundary
 * so we can safely extract the physical component without duplicating
 * HLC.parse()'s full internal logic.
 *
 * Returns null if the string is malformed in any way. Never throws.
 */
export function extractHlcPhysical(timestampHlc: string): number | null {
  if (typeof timestampHlc !== 'string') {
    return null;
  }

  // Exact format: physical_ms:counter
  // Both parts must be non-empty, non-negative integers with no extra
  // components, no leading/trailing whitespace, and no non-digit chars.
  const match = timestampHlc.match(/^(\d+):(\d+)$/);
  if (!match) {
    return null;
  }

  const physical = Number(match[1]);
  const counter = Number(match[2]);

  if (!Number.isFinite(physical) || !Number.isFinite(counter)) {
    return null;
  }
  if (physical < 0 || counter < 0) {
    return null;
  }

  return physical;
}

/**
 * Determine the marker state for a rider.
 *
 * @param spoofFlag   - The spoof_flag from the verified_location payload.
 * @param timestampHlc - The HLC timestamp string from the payload.
 * @param now         - Current device clock as Unix milliseconds (Date.now()).
 * @returns MarkerState: 'RED', 'GREY', or 'GREEN'
 */
export function getMarkerState(
  spoofFlag: boolean,
  timestampHlc: string,
  now: number,
): MarkerState {
  // Precedence rule 2: spoof always wins
  if (spoofFlag === true) {
    return 'RED';
  }

  // Determine staleness from HLC physical time
  const physical = extractHlcPhysical(timestampHlc);
  if (physical === null) {
    // Malformed/missing HLC → GREY (never GREEN)
    return 'GREY';
  }

  const age = now - physical;
  if (age > STALE_THRESHOLD_MS) {
    return 'GREY';
  }

  // Negative age means HLC physical time is in the future → treat as fresh
  return 'GREEN';
}

/**
 * Determine marker state when no valid payload exists at all.
 * Always returns GREY — unknown/missing riders are never shown as fresh.
 */
export function getMarkerStateForMissing(): MarkerState {
  return 'GREY';
}

/** The palette tokens a marker colour is drawn from. */
export interface MarkerPalette {
  ok: string;
  bad: string;
  ink3: string;
}

/** Static fallback (the pre-theme values) for callers without a palette. */
const FALLBACK_PALETTE: MarkerPalette = { ok: '#22C55E', bad: '#FF3B3B', ink3: '#9AA0A6' };

/**
 * Map a MarkerState to a colour: verified -> `ok`, spoofed/flagged -> `bad`,
 * stale/unknown -> `ink3` (the active theme's tokens when `palette` is given).
 *
 * This is the single source of truth for rider marker colors.
 * No other component should compute marker colors independently.
 */
export function markerColorForState(state: MarkerState, palette: MarkerPalette = FALLBACK_PALETTE): string {
  switch (state) {
    case 'GREEN':
      return palette.ok;
    case 'RED':
      return palette.bad;
    case 'GREY':
      return palette.ink3;
  }
}

/** What a rider's map dot looks like: fill, outer ring and initials colour (demo `.ld`, `.ld.stale`, `.ld.sos`, `.ld.str`). */
export interface MarkerLook {
  fill: string;
  ring: string;
  text: string;
}

export interface MarkerLookPalette extends MarkerPalette {
  bg: string;
  pri: string;
}

/** Initials colour on a filled dot (demo `.ld .dot`: near-black; white on the red SOS / spoofed fill). */
export const MARKER_INK_DARK = '#10110E';

/**
 * Demo look per state, from real data only:
 *  - normal: the rider's crew colour, dark initials, ring in the page colour
 *  - stale (GREY): hollow dot — page colour fill, `ink3` ring and initials
 *  - SOS / spoofed (RED): `bad` fill, white initials
 *  - far (separated from the crew): crew colour with a `pri` ring
 */
export function riderMarkerLook(
  input: { state: MarkerState; avatar: string; sos?: boolean; far?: boolean },
  palette: MarkerLookPalette,
): MarkerLook {
  if (input.sos || input.state === 'RED') return { fill: palette.bad, ring: palette.bg, text: '#FFFFFF' };
  if (input.state === 'GREY') return { fill: palette.bg, ring: palette.ink3, text: palette.ink3 };
  return { fill: input.avatar, ring: input.far ? palette.pri : palette.bg, text: MARKER_INK_DARK };
}
