/**
 * FamilyScreen — family tab.
 *
 * What is real today: sharing the rider's last verified position through the
 * system share sheet (a Google Maps pin of real EKF-verified coordinates).
 *
 * What is NOT built (no backend), so it is stated rather than faked:
 *   - live tracking link + watcher list → needs a public tracking endpoint
 *     (GET /track/:groupId) and a watchers collection/endpoint
 *     (POST /groups/:groupId/watchers). Until then there are no watchers to list
 *     and no link to hand out.
 */
import React from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';
import ScreenHeader from '../components/ScreenHeader';
import { useRouteStore } from '@routing/client/routeStore';
import { useToastStore } from '../store/toastStore';

export function locationShareMessage(lat: number, lng: number): string {
  const link = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `I'm out on a ride with WeRide. My location right now: ${link}`;
}

export default function FamilyScreen() {
  const currentLocation = useRouteStore((s) => s.currentLocation);
  const push = useToastStore((s) => s.push);

  const shareLocation = async () => {
    if (!currentLocation) {
      push('Waiting for a verified GPS fix — try again in a moment', 'warn');
      return;
    }
    try {
      await Share.share({ message: locationShareMessage(currentLocation.lat, currentLocation.lng) });
    } catch (e) {
      console.warn('[FamilyScreen] share failed:', e);
      push('Could not open the share sheet', 'error');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Family" />

        <View style={styles.card}>
          <Text style={type.heading}>Send my location</Text>
          <Text style={[type.body, styles.cardBody]}>
            Shares a map pin of where you are right now with anyone you choose. It is a one-time
            snapshot, not a live feed.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={shareLocation}
            accessibilityLabel="Send my location"
            accessibilityRole="button"
          >
            <Text style={type.button}>Send my location</Text>
          </Pressable>
        </View>

        <View style={[styles.card, styles.cardMuted]}>
          <Text style={type.heading}>Live tracking link</Text>
          <Text style={[type.body, styles.cardBody]}>
            Not available yet. Nobody outside your ride group can see your position today, and there
            is no tracking link to hand out.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  content: { paddingHorizontal: WeRideSpacing.lg, paddingBottom: WeRideSpacing.xxl, gap: WeRideSpacing.md },
  card: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
    padding: WeRideSpacing.lg,
    gap: WeRideSpacing.xs,
  },
  cardMuted: { backgroundColor: WeRideColors.dark2 },
  cardBody: { color: WeRideColors.textSub },
  primaryBtn: {
    minHeight: 48,
    borderRadius: WeRideRadius.lg,
    backgroundColor: WeRideColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: WeRideSpacing.md,
  },
  pressed: { opacity: 0.85 },
});
