/**
 * SosModal — SOS confirmation modal (spec §3.3.11).
 * On confirm: triggerSos() (Person B), red toast, music ducks.
 * sosModal animation: fade 0.2s.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable, ActivityIndicator } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';
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
      push('🆘 SOS sent — your location is live to the whole group', 'error');
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
          <Text style={styles.icon}>🆘</Text>
          <Text style={styles.title}>Send SOS to group?</Text>
          <Text style={styles.body}>
            Your live location, speed and last known point will be shared instantly with all {riderCount} rider{riderCount !== 1 ? 's' : ''}.
          </Text>
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
              style={styles.sendBtn}
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
    padding: 30,
  },
  overlayPress: { ...StyleSheet.absoluteFillObject },
  box: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 18,
    padding: 22,
    width: '100%',
  },
  icon: { fontSize: 32, textAlign: 'center' },
  title: {
    fontFamily: WeRideFonts.heading,
    fontSize: 22,
    color: WeRideColors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  body: {
    fontFamily: WeRideFonts.body,
    fontSize: 12,
    color: WeRideColors.textSub,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: 10,
  },
  actions: { flexDirection: 'row', gap: 8, marginTop: 18 },
  cancelBtn: {
    flex: 1,
    backgroundColor: WeRideColors.dark3,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelText: { fontFamily: WeRideFonts.body, fontSize: 12.5, fontWeight: '700', color: WeRideColors.textSub },
  sendBtn: {
    flex: 1,
    backgroundColor: WeRideColors.red,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  sendText: { fontFamily: WeRideFonts.body, fontSize: 12.5, fontWeight: '700', color: WeRideColors.white },
});