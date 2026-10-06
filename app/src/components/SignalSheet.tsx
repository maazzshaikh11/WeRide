/**
 * SignalSheet — quick signals to the crew (spec §3.3.7, demo "Tell the crew").
 * Four options only, on purpose: nothing to type at 80 km/h. The labels are the
 * server's allow-list. On tap: emits 'signal:send' via Socket.io, toasts, and
 * closes. Offline it says so and sends nothing (nothing is queued).
 */
import React from 'react';
import { Text, View } from 'react-native';
import { Plates } from '../theme/palettes';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { getLocationSocket } from '../services/socketService';
import { useToastStore } from '../store/toastStore';
import { useResponsive } from '../theme/responsive';
import { CAP } from '../theme/textPolicy';
import { PressableScale, Sheet, haptic } from '../ui';

export const SIGNAL_OPTIONS = [
  { label: 'Wait up', hint: 'Slow the whole group', tone: 'yellow' },
  { label: 'Pull over', hint: 'Stop at next safe spot', tone: 'white' },
  { label: 'All good', hint: 'Clear a worry', tone: 'green' },
  { label: 'Need fuel', hint: 'Tell the lead', tone: 'black' },
] as const;

interface Props {
  visible: boolean;
  groupId: string;
  riderId: string;
  onSend: (label: string) => void;
  onClose?: () => void;
}

export default function SignalSheet({ visible, groupId, riderId, onSend, onClose }: Props) {
  const { type } = useTheme();
  const { isCompactWidth } = useResponsive();
  const push = useToastStore((s) => s.push);
  const s = useStyles(() => ({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    tile: { width: '48.5%', minHeight: 122, borderRadius: 24, paddingVertical: 12, justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: 'rgba(0,0,0,0.25)' },
  }));

  const send = (label: string) => {
    if (!visible) return;
    const socket = getLocationSocket();
    // Never claim a signal went out when it could not: nothing is queued offline.
    if (!socket.connected) {
      push('Offline — signal not sent', 'warn');
      return;
    }
    socket.emit('signal:send', { group_id: groupId, rider_id: riderId, label });
    haptic('select');
    push(`Signal sent: ${label}`);
    onSend(label);
  };

  return (
    <Sheet visible={visible} onClose={onClose ?? (() => undefined)} testID="signal-sheet" accessibilityLabel="Tell the crew">
      <Text style={[type.label, { marginBottom: 12 }]}>TELL THE CREW</Text>
      <View style={s.grid}>
        {SIGNAL_OPTIONS.map((opt) => {
          const p = Plates[opt.tone];
          return (
            <PressableScale
              key={opt.label}
              haptic={false}
              scaleTo={0.96}
              onPress={() => send(opt.label)}
              accessibilityLabel={`Send signal: ${opt.label}`}
              accessibilityRole="button"
              style={[s.tile, { backgroundColor: p.bg, paddingHorizontal: isCompactWidth ? 14 : 22 }]}
            >
              <Text style={[type.plateTitle, { color: p.fg, fontSize: isCompactWidth ? 24 : 29, lineHeight: isCompactWidth ? 24 : 28, letterSpacing: -0.87 }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.75} maxFontSizeMultiplier={CAP.fixed}>{opt.label.toUpperCase()}</Text>
              <Text style={[type.plateSub, { color: p.fg, opacity: 0.8, fontSize: 12.5 }]} maxFontSizeMultiplier={CAP.hud}>{opt.hint}</Text>
            </PressableScale>
          );
        })}
      </View>
      <Text style={[type.sm, { textAlign: 'center', marginTop: 16 }]}>Four signals only, on purpose. Nothing to type at 80 km/h.</Text>
    </Sheet>
  );
}
