/**
 * Shared styles for the floating info cards (rider / hazard / SOS) so they read
 * as one family — the demo `.card`: `card` surface, 1.5 px `line` rim, radius 22,
 * 16 padding, 12 gap, label/value rows and 44+ px actions. Cards flow inside
 * MapScreen's bottom stack (no absolute positioning). Each card is
 * `<FadeIn style={cardWrap}><View|PressableCard style={cardBody}>…`.
 *
 * Colours come from the active theme, so the hook re-skins on a theme change.
 */
import { useStyles } from '../../../theme/ThemeProvider';

/** Corner radius shared by the wrapper, the card body and PressableCard's overlays (demo `.card`). */
export const INFO_CARD_RADIUS = 22;

export function useInfoCardStyles() {
  return useStyles(({ colors, type }) => ({
    /**
     * Outer wrapper (FadeIn): owns the margins and the drop shadow. It needs its
     * own fill + radius so the shadow has a shape (PressableCard clips its
     * children with overflow hidden, which would swallow a shadow set on it).
     */
    cardWrap: {
      backgroundColor: colors.card,
      borderRadius: INFO_CARD_RADIUS,
      marginHorizontal: 16,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: colors.scheme === 'dark' ? 0.35 : 0.12,
      shadowRadius: 18,
      elevation: 6,
    },
    /** Card body inside the wrapper: surface, rim, padding, gap. */
    cardBody: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.line,
      borderRadius: INFO_CARD_RADIUS,
      padding: 16,
      gap: 12,
    },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dot: { width: 12, height: 12, borderRadius: 6 },
    title: { ...type.h3, flex: 1 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    label: { ...type.sm },
    value: { ...type.bodyStrong },
    actions: { flexDirection: 'row', gap: 12 },
    /** Button sharing a row of actions equally. */
    actionFlex: { flex: 1 },
    hint: { ...type.sm, color: colors.ink3 },
  }));
}
