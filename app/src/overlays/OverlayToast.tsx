/**
 * A tiny transient toast drawn INSIDE a full-screen overlay (the global toast container lives on the map screen,
 * below the overlay, so it would not be visible). Same plate language as the app toasts.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plate } from '../ui';
import type { PlateTone } from '../theme/palettes';

export interface LocalToast {
  message: string;
  tone: PlateTone;
}

export function useOverlayToast(ms = 2400) {
  const [toast, setToast] = useState<LocalToast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback(
    (message: string, tone: PlateTone = 'black') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });
      timer.current = setTimeout(() => setToast(null), ms);
    },
    [ms],
  );
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return { toast, show };
}

/**
 * `bottom`: sit this far above the screen's bottom edge instead of below the status bar (for screens whose headline
 * would be covered by a top toast, e.g. the incoming-SOS title).
 */
export default function OverlayToast({ toast, bottom }: { toast: LocalToast | null; bottom?: number }) {
  const insets = useSafeAreaInsets();
  if (!toast) return null;
  const place = bottom != null ? { bottom } : { top: Math.max(insets.top, 24) + 8 };
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 14, right: 14, ...place, zIndex: 20 }} accessibilityLiveRegion="polite" testID="overlay-toast">
      <Plate compact tone={toast.tone} title={toast.message} icon="check" />
    </View>
  );
}
