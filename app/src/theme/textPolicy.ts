/**
 * Text scaling policy (OS "large text" / Dynamic Type).
 *
 * Body text follows the user's font scale up to BODY_MAX (a default `maxFontSizeMultiplier` on every Text and
 * TextInput). Fixed-height HUD elements - tab labels, plate titles, speed / ETA numerals, pills, keypad keys,
 * control-key labels - are capped tighter with the `CAP` values below, passed as `maxFontSizeMultiplier`, so a
 * rider wearing gloves never gets a Live screen whose controls overlap. Long-copy screens simply grow and scroll.
 *
 * `applyTextPolicy()` runs once at start-up (index.js); the screenshot harness calls it too so renders match.
 */
import { Text, TextInput } from 'react-native';

export const BODY_MAX_FONT_MULTIPLIER = 1.3;

/** Tighter caps for fixed-height elements (use as `maxFontSizeMultiplier={CAP.hud}`). */
export const CAP = {
  /** Never scales: speed / ETA numerals, tab-bar labels, plate titles, keypad keys, avatar initials. */
  fixed: 1,
  /** Pills, chips, segmented labels, button labels, control-key labels: a little room. */
  hud: 1.15,
  /** Long-copy reading text may grow further. */
  reading: 1.6,
} as const;

let applied = false;

/** Idempotent. Gives Text / TextInput a default `maxFontSizeMultiplier`; explicit props still win. */
export function applyTextPolicy(): void {
  if (applied) return;
  applied = true;
  for (const C of [Text, TextInput] as unknown as { defaultProps?: Record<string, unknown> }[]) {
    C.defaultProps = { ...(C.defaultProps ?? {}), maxFontSizeMultiplier: BODY_MAX_FONT_MULTIPLIER };
  }
}

/** For tests: forget that the policy was applied. */
export function resetTextPolicyForTests(): void {
  applied = false;
}
