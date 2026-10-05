/**
 * SosModal — SOS confirmation modal (spec §3.3.11), in the demo's SOS language:
 * a red road-sign Plate on a themed card over the theme's scrim; confirm is the
 * red `danger` Button.
 * On confirm: triggerSos() (Person B), red toast, music ducks.
 *
 * Motion: the backdrop fades; the card scales + rises in on a spring
 * (Motion.spring) and eases out on close, so the Modal stays mounted until the
 * exit finishes. Send is a danger Button that shows a spinner (same size) while
 * sending; one `haptic('heavy')` marks the SOS going out (the red toast's own
 * 'error' haptic is muted for that message so the two do not fight).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable } from 'react-native';
import { Plates } from '../theme/palettes';
import { useStyles } from '../theme/ThemeProvider';
import { triggerSos } from '@hazard/services/sosService';
import { useToastStore } from '../store/toastStore';
import { Button, haptic, Motion, Plate, useReducedMotion } from '../ui';
import { muteToastHaptic } from './Toast';

interface Props {
  visible: boolean;
  riderId: string;
  groupId: string;
  riderCount: number;
  location: { lat: number; lng: number } | null;
  onCancel: () => void;
  onSent: (sosId: string) => void;
}

export const SOS_SENT_MESSAGE = 'SOS sent — your location is live to the whole group';

export default function SosModal({ visible, riderId, groupId, riderCount, location, onCancel, onSent }: Props) {
  const fade = useRef(new Animated.Value(0)).current; // backdrop
  const card = useRef(new Animated.Value(0)).current; // 0 hidden -> 1 settled (spring)
  const [shown, setShown] = useState(visible);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const alive = useRef(true);
  const reduced = useReducedMotion();
  const push = useToastStore((s) => s.push);
  const styles = useStyles(({ colors, type }) => ({
    root: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.scrim },
    overlayPress: { ...StyleSheet.absoluteFillObject },
    box: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.line,
      borderRadius: 30,
      padding: 20,
      width: '100%',
      gap: 14,
    },
    body: { ...type.body },
    noFix: { ...type.smStrong, color: Plates.yellow.fg },
    noFixPlate: { backgroundColor: Plates.yellow.bg, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
    actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
    action: { flex: 1 },
  }));

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (visible) {
      setShown(true);
      fade.setValue(0);
      card.setValue(0);
      const anim = Animated.parallel([
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
        reduced
          ? Animated.timing(card, { toValue: 1, duration: 200, useNativeDriver: true })
          : Animated.spring(card, { toValue: 1, ...Motion.spring, useNativeDriver: true }),
      ]);
      anim.start();
      return () => anim.stop();
    }
    const out = Animated.parallel([
      Animated.timing(fade, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(card, { toValue: 0, duration: 160, useNativeDriver: true }),
    ]);
    out.start(({ finished }) => {
      if (finished && alive.current) setShown(false);
    });
    return () => out.stop();
  }, [visible, fade, card, reduced]);

  const confirm = useCallback(async () => {
    if (!location || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const sosId = await triggerSos(riderId, groupId, location.lat, location.lng);
      haptic('heavy');
      muteToastHaptic(SOS_SENT_MESSAGE);
      push(SOS_SENT_MESSAGE, 'error');
      onSent(sosId);
    } catch (e) {
      console.error('[SosModal] triggerSos failed:', e);
      push('Failed to send SOS', 'error');
    } finally {
      sendingRef.current = false;
      if (alive.current) setSending(false);
    }
  }, [location, riderId, groupId, push, onSent]);

  const cardStyle = {
    opacity: card.interpolate({ inputRange: [0, 0.6], outputRange: [0, 1], extrapolate: 'clamp' }),
    transform: [
      { translateY: card.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
      { scale: card.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
    ],
  };

  return (
    <Modal visible={shown} transparent animationType="none" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]} pointerEvents="none" />
        <Pressable style={styles.overlayPress} onPress={onCancel} accessibilityLabel="Cancel SOS" />
        <Animated.View style={[styles.box, cardStyle]}>
          <Plate tone="red" icon="warn" title="Send SOS to group?" subtitle="Emergency alert" titleSize={22} titleLines={2} />
          <Text style={styles.body}>
            Your live location, speed and last known point will be shared instantly with all {riderCount} rider{riderCount !== 1 ? 's' : ''}.
          </Text>
          {!location ? (
            <View style={styles.noFixPlate}>
              <Text style={styles.noFix}>Waiting for your location. SOS can't be sent without a fix.</Text>
            </View>
          ) : null}
          <View style={styles.actions}>
            <Button
              label="Cancel"
              variant="secondary"
              accessibilityLabel="Cancel, do not send SOS"
              onPress={onCancel}
              disabled={sending}
              style={styles.action}
            />
            <Button
              label="Send SOS"
              variant="danger"
              accessibilityLabel="Send SOS to group"
              onPress={confirm}
              disabled={!location}
              loading={sending}
              haptic={false}
              style={styles.action}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
