/**
 * Call112Overlay — the demo's call screen (A.call112 / A.endCall) that really dials: it opens the phone's dialler on
 * `tel:112` when it appears (tap the 112 disc to dial again). "End call" returns to the screen it was opened from
 * (`state.back`, e.g. the red SOS screen) or closes. A failure to open the dialler is said out loud, never silent.
 */
import React, { useCallback, useEffect } from 'react';
import { Linking, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouteStore } from '@routing/client/routeStore';
import { Plates } from '../theme/palettes';
import { useTheme } from '../theme/ThemeProvider';
import { PressableScale } from '../ui';
import { OverlayState, useOverlayStore } from '../store/overlayStore';
import { formatCoords, isRealPosition } from '../services/sosFormat';
import OverlayToast, { useOverlayToast } from './OverlayToast';

export const EMERGENCY_NUMBER = '112';

export default function Call112Overlay({ state }: { state: OverlayState }) {
  const { colors, type } = useTheme();
  const insets = useSafeAreaInsets();
  const { toast, show } = useOverlayToast(4000);
  const fix = useRouteStore((s) => s.lastValidLocation ?? s.currentLocation);
  const back = state.kind === 'call112' ? state.back : undefined;

  const dial = useCallback(() => {
    Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => show('Couldn’t open the dialler. Dial 112 yourself.', 'yellow'));
  }, [show]);

  useEffect(() => {
    dial();
    // dial once when the screen appears
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const endCall = () => {
    const o = useOverlayStore.getState();
    if (back) o.show(back);
    else o.hide();
  };

  const where = fix && isRealPosition(fix.lat, fix.lng) ? `You are at ${formatCoords(fix.lat, fix.lng)}` : null;

  return (
    <View
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: Plates.black.bg, alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 24, paddingBottom: insets.bottom }}
      testID="overlay-Call112"
      accessibilityViewIsModal
    >
      <PressableScale
        onPress={dial}
        accessibilityRole="button"
        accessibilityLabel="Dial 112 again"
        style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: Plates.red.bg, alignItems: 'center', justifyContent: 'center' }}
        testID="call112-dial"
      >
        <Text style={{ fontFamily: type.h2.fontFamily, fontSize: 24, lineHeight: 28, color: Plates.red.fg }}>112</Text>
      </PressableScale>
      <Text style={[type.h1, { color: Plates.black.fg }]} accessibilityRole="header">Calling 112</Text>
      <Text style={[type.sm, { color: Plates.black.fg, opacity: 0.75, textAlign: 'center' }]}>
        Emergency services · tell them where you are
      </Text>
      {where ? <Text style={[type.num, { color: Plates.black.fg, fontSize: 14, lineHeight: 18 }]} testID="call112-where">{where}</Text> : null}
      <PressableScale
        onPress={endCall}
        accessibilityRole="button"
        accessibilityLabel="End call"
        style={{ width: 200, height: 68, marginTop: 30, borderRadius: 18, backgroundColor: colors.bad, alignItems: 'center', justifyContent: 'center' }}
        testID="call112-end"
      >
        <Text style={[type.button, { color: Plates.red.fg }]}>End call</Text>
      </PressableScale>
      <OverlayToast toast={toast} />
    </View>
  );
}
