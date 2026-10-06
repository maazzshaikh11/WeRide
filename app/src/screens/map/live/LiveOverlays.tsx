/**
 * Small pieces drawn over the live map: the post-hazard "Still there / Gone" buttons (they replace the status plate
 * for ~4 min after passing a hazard) and the green "Talking to crew" plate shown while push-to-talk is held.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Text, View } from 'react-native';
import { Plates } from '../../../theme/palettes';
import { useStyles, useTheme } from '../../../theme/ThemeProvider';
import { CAP } from '../../../theme/textPolicy';
import { PressableScale, useReducedMotion } from '../../../ui';
import { useLiveLayout } from './LiveChrome';

export function HazardConfirmButtons({ onAnswer, name }: { onAnswer: (a: 'still' | 'gone') => void; name?: string }) {
  const { road } = useTheme();
  const { plateH } = useLiveLayout();
  const s = useStyles(({ roadType: t }) => ({
    row: { flexDirection: 'row', gap: 8 },
    btn: { flex: 1, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    label: { ...t.button, fontSize: 21, lineHeight: 24, fontFamily: t.plateTitle.fontFamily, letterSpacing: -0.2 },
  }));
  const what = name ? name.toLowerCase() : 'hazard';
  return (
    <View style={s.row} testID="hazard-confirm">
      <PressableScale
        onPress={() => onAnswer('still')}
        haptic="select"
        accessibilityRole="button"
        accessibilityLabel={`Still there: the ${what} is still on the road`}
        testID="confirm-still"
        style={[s.btn, { height: Math.min(76, plateH - 4), backgroundColor: road.ok }]}
      >
        <Text style={[s.label, { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={CAP.fixed}>STILL THERE</Text>
      </PressableScale>
      <PressableScale
        onPress={() => onAnswer('gone')}
        haptic="select"
        accessibilityRole="button"
        accessibilityLabel={`Gone: the ${what} is no longer there`}
        testID="confirm-gone"
        style={[s.btn, { height: Math.min(76, plateH - 4), backgroundColor: road.ink }]}
      >
        <Text style={[s.label, { color: road.bg }]} numberOfLines={1} maxFontSizeMultiplier={CAP.fixed}>GONE</Text>
      </PressableScale>
    </View>
  );
}

const BAR_DELAYS = [0, 100, 200, 300, 400];

function WaveBar({ delay, animate, color }: { delay: number; animate: boolean; color: string }) {
  const h = useRef(new Animated.Value(animate ? 6 : 18)).current;
  useEffect(() => {
    if (!animate) {
      h.setValue(18);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(h, { toValue: 28, duration: 400, useNativeDriver: false }),
        Animated.timing(h, { toValue: 6, duration: 400, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, delay, h]);
  return <Animated.View style={{ width: 5, borderRadius: 3, backgroundColor: color, height: h }} />;
}

/** demo `Talking to crew` plate: a 5-bar wave, title and "Release to stop". */
export function TalkPlate() {
  const { type } = useTheme();
  const reduced = useReducedMotion();
  const { plateH } = useLiveLayout();
  const p = Plates.green;
  const s = useStyles(() => ({
    plate: { borderRadius: 18, paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: p.bg },
    rim: { position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 14, borderWidth: 2, borderColor: p.rim, opacity: 0.92 },
    wave: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 30, width: 41, justifyContent: 'center' },
  }));
  return (
    <View style={[s.plate, { minHeight: plateH }]} testID="talk-plate" accessible accessibilityLabel="Talking to crew. Release to stop." accessibilityLiveRegion="polite">
      <View style={s.wave}>
        {BAR_DELAYS.map((d) => <WaveBar key={d} delay={d} animate={!reduced} color={p.fg} />)}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.plateTitle, { color: p.fg, fontSize: 28, lineHeight: 28 }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} maxFontSizeMultiplier={CAP.fixed}>TALKING TO CREW</Text>
        <Text style={[type.plateSub, { color: p.fg, opacity: 0.85, marginTop: 4 }]} maxFontSizeMultiplier={CAP.hud}>Release to stop</Text>
      </View>
      <View pointerEvents="none" style={s.rim} />
    </View>
  );
}
