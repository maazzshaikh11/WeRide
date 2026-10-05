/**
 * SosModal — SOS confirmation modal (spec §3.3.11).
 * On confirm: triggerSos() (Person B), red toast, music ducks.
 * sosModal animation: fade 0.2s.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable, ActivityIndicator } from 'react-native';
import { WeRideColors, WeRideRadius } from '../theme/theme';
import { type } from '../theme/typography';
import { triggerSos } from '@hazard/services/sosService';
import { useToastStore } from '../store/toastStore';

interface Props {
  visible: boolean;
  riderId: string;
  groupId: string;
  riderCount: number;
  location: { lat: number; lng: number } | null;
  onCancel: () => void;
  onSent: (sosId: string) => void;
}

export default function SosModal({ visible, riderId, groupId, riderCount, location, onCancel, onSent }: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const [sending, setSending] = React.useState(false);
  const push = useToastStore((s) => s.push);

  useEffect(() => {
    if (visible) {
      Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    } else {
      fade.setValue(0);
    }
  }, [visible, fade]);

  const confirm = async () => {
    if (!location) return;
    setSending(true);
    try {
      const sosId = await triggerSos(riderId, groupId, location.lat, location.lng);
      push('SOS sent — your location is live to the whole group', 'error');
      onSent(sosId);
    } catch (e) {
      console.error('[SosModal] triggerSos failed:', e);
      push('Failed to send SOS', 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Animated.View style={[styles.overlay, { opacity: fade }]}>
        <Pressable style={styles.overlayPress} onPress={onCancel} accessibilityLabel="Cancel SOS" />
        <View style={styles.box}>
          <Text style={styles.eyebrow}>SOS</Text>
          <Text style={styles.title}>Send SOS to group?</Text>
          <Text style={styles.body}>
            Your live location, speed and last known point will be shared instantly with all {riderCount} rider{riderCount !== 1 ? 's' : ''}.
          </Text>
          {!location ? (
            <Text style={styles.noFix}>Waiting for your location. SOS can't be sent without a fix.</Text>
          ) : null}
          <View style={styles.actions}>
            <Pressable
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={sending}
              accessibilityLabel="Cancel, do not send SOS"
              accessibilityRole="button"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.sendBtn, !location && styles.sendBtnDisabled]}
              onPress={confirm}
              disabled={sending || !location}
              accessibilityLabel="Send SOS to group"
              accessibilityRole="button"
            >
              {sending ? (
                <ActivityIndicator color={WeRideColors.white} size="small" />
              ) : (
                <Text style={styles.sendText}>Send SOS</Text>
              )}
            </Pressable>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000b0',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayPress: { ...StyleSheet.absoluteFillObject },
  box: {
    backgroundColor: WeRideColors.dark2,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xxxl,
    padding: 20,
    width: '100%',
    gap: 12,
  },
  eyebrow: { ...type.labelStrong, color: WeRideColors.red },
  title: { ...type.titleSm },
  body: { ...type.body, color: WeRideColors.textSub },
  noFix: { ...type.caption, color: WeRideColors.gold },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    minHeight: 52,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { ...type.button, color: WeRideColors.text },
  sendBtn: {
    flex: 1,
    minHeight: 52,
    backgroundColor: WeRideColors.red,
    borderRadius: WeRideRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendText: { ...type.button, color: WeRideColors.white },
});
