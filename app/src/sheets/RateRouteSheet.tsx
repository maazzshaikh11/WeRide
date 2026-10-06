/**
 * RateRouteSheet — "How was the road?" (demo A.rateRoute). Smooth / Mixed / Rough writes the rider's own `rating`
 * on the ride log (rideLogService.setRouteRating) and confirms with a toast.
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import type { RouteRating } from '../models/domain';
import { setRouteRating } from '../services/rideLogService';
import { useSessionStore } from '../store/sessionStore';
import { useToastStore } from '../store/toastStore';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { PressableScale, Sheet, haptic } from '../ui';

export interface RateRouteSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The ride (log) being rated. */
  rideId?: string;
  /** The rating already given, if any (shown selected). */
  current?: RouteRating | null;
  onRated?: (rating: RouteRating) => void;
  [extra: string]: any;
}

export const RATING_OPTIONS: { value: RouteRating; title: string; sub: string }[] = [
  { value: 'smooth', title: 'Smooth', sub: 'Clean tarmac, no surprises' },
  { value: 'mixed', title: 'Mixed', sub: 'A few rough patches' },
  { value: 'rough', title: 'Rough', sub: 'Potholes or loose gravel' },
];

export default function RateRouteSheet({ visible, onClose, rideId, current, onRated }: RateRouteSheetProps) {
  const { type, colors } = useTheme();
  const uid = useSessionStore((s) => s.uid);
  const push = useToastStore((s) => s.push);
  const [busy, setBusy] = useState<RouteRating | null>(null);
  const s = useStyles(({ colors: c }) => ({
    row: { backgroundColor: c.card, borderRadius: 22, borderWidth: 1.5, borderColor: c.line, paddingVertical: 15, paddingHorizontal: 16, minHeight: 62, justifyContent: 'center' },
  }));

  const rate = async (rating: RouteRating, title: string) => {
    if (busy) return;
    if (!uid || !rideId) {
      push("Couldn't save your rating. Sign in and try again.", 'error');
      return;
    }
    setBusy(rating);
    try {
      await setRouteRating(uid, rideId, rating);
      haptic('success');
      push(`Thanks. Rated ${title.toLowerCase()}.`, 'success');
      onRated?.(rating);
      onClose();
    } catch {
      push("Couldn't save your rating. Try again.", 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-RateRoute" accessibilityLabel="Rate the route">
      <Text style={type.h2} accessibilityRole="header">How was the road?</Text>
      <Text style={[type.sm, { marginTop: 8 }]}>Your answer sharpens hazard alerts for every rider on this route.</Text>
      <View style={{ gap: 8, marginTop: 16 }}>
        {RATING_OPTIONS.map((o) => {
          const on = current === o.value;
          return (
            <PressableScale
              key={o.value}
              onPress={() => rate(o.value, o.title)}
              haptic="select"
              scaleTo={0.99}
              disabled={busy !== null}
              accessibilityRole="button"
              accessibilityLabel={`${o.title}. ${o.sub}`}
              accessibilityState={{ selected: on, busy: busy === o.value, disabled: busy !== null }}
              style={[s.row, on && { borderColor: colors.ink }]}
              testID={`rate-${o.value}`}
            >
              <Text style={type.listTitle}>{o.title}</Text>
              <Text style={[type.listSub, { marginTop: 3 }]}>{o.sub}</Text>
            </PressableScale>
          );
        })}
      </View>
    </Sheet>
  );
}
