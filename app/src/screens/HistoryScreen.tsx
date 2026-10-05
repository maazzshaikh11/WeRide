/**
 * HistoryScreen — ride history tab (spec §3.8).
 *
 * Known gap: no backend stores completed rides, so past rides cannot be listed.
 * Needs `GET /users/{uid}/rides` (completed rides with distance, duration,
 * rider count, date). Until then this screen shows only the ride in progress
 * (from the live route) or an honest empty state. No totals are shown because
 * none can be computed from real data.
 */
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import HistoryCard from '../components/HistoryCard';
import { useRouteStore } from '@routing/client/routeStore';
import { useRidersStore } from '../store/ridersStore';
import { useAppStore } from '../store/appStore';
import { Card, FadeIn } from '../ui';

interface Props {
  /** Provided by the tab navigator; absent when rendered standalone (tests). */
  navigation?: { navigate: (...args: any[]) => void };
}

export default function HistoryScreen({ navigation }: Props = {}) {
  const route = useRouteStore((s) => s.route);
  const riders = useRidersStore((s) => s.riders);
  const groupName = useAppStore((s) => s.groupName);
  const { type } = useTheme();
  const styles = useStyles(({ colors: c, type: t }) => ({
    safe: { flex: 1, backgroundColor: c.bg },
    content: { paddingHorizontal: 20, paddingBottom: 40 },
    title: { ...t.h1, paddingTop: 16, paddingBottom: 24 },
    stack: { gap: 16 },
    blockBody: { ...t.body, marginTop: 8 },
  }));

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">Ride History</Text>

        {route != null ? (
          <View style={styles.stack}>
            <FadeIn>
              <HistoryCard
                name={groupName ?? 'Current ride'}
                meta="In progress"
                active
                stats={[
                  { label: 'km', value: route.distance_km.toFixed(1) },
                  { label: 'min eta', value: String(Math.round(route.eta_minutes)) },
                  { label: 'riders', value: String(riders.size) },
                ]}
                onPress={navigation ? () => navigation.navigate('Home') : undefined}
                pressHint="Opens the live map"
              />
            </FadeIn>
            <FadeIn index={1}>
              <Text style={type.sm}>Completed rides are not saved yet, so only this ride is shown.</Text>
            </FadeIn>
          </View>
        ) : (
          <FadeIn>
            <Card>
              <Text style={type.h2}>No completed rides yet</Text>
              <Text style={styles.blockBody}>Rides you finish will be listed here.</Text>
            </Card>
          </FadeIn>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
