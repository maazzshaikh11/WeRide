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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import ScreenHeader from '../components/ScreenHeader';
import { Button, Card, FadeIn, List, ListItem, haptic } from '../ui';
import { useRouteStore } from '@routing/client/routeStore';
import { useToastStore } from '../store/toastStore';

export function locationShareMessage(lat: number, lng: number): string {
  const link = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `I'm out on a ride with WeRide. My location right now: ${link}`;
}

export default function FamilyScreen() {
  const { type } = useTheme();
  const styles = useStyles(({ colors }) => ({
    safe: { flex: 1, backgroundColor: colors.bg },
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
    card: { marginTop: 24 },
    list: { marginTop: 16 },
    cardBody: { marginTop: 8 },
    primaryBtn: { marginTop: 16 },
  }));
  const currentLocation = useRouteStore((s) => s.currentLocation);
  const push = useToastStore((s) => s.push);

  const [sharing, setSharing] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const shareLocation = useCallback(async () => {
    if (sharing) return;
    if (!currentLocation) {
      push('Waiting for a verified GPS fix — try again in a moment', 'warn');
      return;
    }
    setSharing(true);
    try {
      const result = await Share.share({ message: locationShareMessage(currentLocation.lat, currentLocation.lng) });
      // Dismissing the sheet (iOS) is not a completed share.
      if (result?.action !== Share.dismissedAction) haptic('success');
    } catch (e) {
      console.warn('[FamilyScreen] share failed:', e);
      push('Could not open the share sheet', 'error');
      haptic('error');
    } finally {
      if (alive.current) setSharing(false);
    }
  }, [sharing, currentLocation, push]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader eyebrow="Me" title="Family" />

        <FadeIn>
          <Card style={styles.card}>
            <Text style={type.h3}>Send my location</Text>
            <Text style={[type.body, styles.cardBody]}>
              Shares a map pin of where you are right now with anyone you choose. It is a one-time
              snapshot, not a live feed.
            </Text>
            <Button label="Send my location" onPress={shareLocation} loading={sharing} style={styles.primaryBtn} />
          </Card>
        </FadeIn>

        {/* The demo's family sheet lists watchers with toggles; there is no watcher backend, so
            this is a single honest row stating what is unavailable instead. */}
        <FadeIn index={1}>
          <List style={styles.list}>
            <ListItem
              first
              icon="eye"
              title="Live tracking link"
              subtitle="Not available yet. Nobody outside your ride group can see your position today, and there is no tracking link to hand out."
            />
          </List>
        </FadeIn>
      </ScrollView>
    </SafeAreaView>
  );
}
