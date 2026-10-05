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
import { WeRideColors, WeRideFonts } from '../theme/theme';
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
        <ScreenHeader eyebrow="Family" title="Let someone know" />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Send my location</Text>
          <Text style={styles.cardBody}>
            Shares a map pin of where you are right now with anyone you choose. It's a one-time
            snapshot, not a live feed.
          </Text>
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={shareLocation}
            accessibilityLabel="Send my location"
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>Send my location</Text>
          </Pressable>
        </View>

        <View style={[styles.card, styles.cardMuted]}>
          <Text style={styles.cardTitle}>Live tracking link</Text>
          <Text style={styles.cardBody}>
            Not available yet. Watchers will be able to follow your ride live once family tracking
            ships — nobody can see your position today except riders in your group.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  content: { paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  card: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 14,
    padding: 16,
  },
  cardMuted: { backgroundColor: WeRideColors.dark2 },
  cardTitle: { fontFamily: WeRideFonts.bodySemibold, fontSize: 15, color: WeRideColors.text },
  cardBody: {
    fontFamily: WeRideFonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: WeRideColors.textSub,
    marginTop: 6,
  },
  primaryBtn: {
    height: 44,
    borderRadius: 10,
    backgroundColor: WeRideColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  pressed: { opacity: 0.85 },
  primaryBtnText: { fontFamily: WeRideFonts.bodySemibold, fontSize: 14, color: WeRideColors.onPrimary },
});
