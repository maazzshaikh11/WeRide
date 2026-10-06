/**
 * Perms — step 4 of 5 (demo `perms`): three cards with the demo's wording. "Allow" shows the in-app explainer and
 * then the REAL operating-system request (services/permissionsService). A refusal shows the demo's yellow toast;
 * a permission the OS will no longer ask for sends the rider to system Settings. Statuses are read on mount (and
 * when the app returns to the front), so a returning rider sees the truth. Continue needs location + notifications.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Text, View } from 'react-native';
import { Button, Card, IconWell, Pill, Screen, Stepper, TopBar } from '../../ui';
import type { IconName } from '../../ui';
import ToastContainer from '../../components/ToastContainer';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import {
  PermKind, PermStatus, getPermissionStatus, hasAlwaysLocation, openSystemSettings, requestPermission,
} from '../../services/permissionsService';
import { useToastStore } from '../../store/toastStore';
import PermExplainer, { ExplainerChoice } from './parts/PermExplainer';

export const PERM_CARDS: { kind: PermKind; icon: IconName; title: string; body: string; required: boolean }[] = [
  { kind: 'location', icon: 'pin', title: 'Location, always', body: 'So your crew sees you when the screen is off and your phone is on the tank bag. Only your crew, only during a ride.', required: true },
  { kind: 'notifications', icon: 'bell', title: 'Notifications', body: 'SOS alerts and “wait up” calls reach you instantly, even with the app closed.', required: true },
  { kind: 'microphone', icon: 'mic', title: 'Microphone', body: 'Optional. Push-to-talk with your crew without taking a hand off the bars.', required: false },
];

/** Toast copy for a refusal / downgrade (demo `A.permAns`). */
export const PERM_TOASTS = {
  denied: { location: 'Needed to ride together. You can allow it later in Me.', notifications: 'Needed to ride together. You can allow it later in Me.', microphone: 'Voice stays off. You can allow it later in Me.' },
  whileUsing: 'Set to “While using”. Crew loses you when the screen locks. Prefer Always.',
} as const;

type Statuses = Record<PermKind, PermStatus | null>;

export default function PermsScreen({ navigation }: any) {
  const { type } = useTheme();
  const s = useStyles(() => ({
    cards: { gap: 12, marginTop: 24 },
    head: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  }));
  const push = useToastStore((st) => st.push);
  const [status, setStatus] = useState<Statuses>({ location: null, notifications: null, microphone: null });
  const [asking, setAsking] = useState<PermKind | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  const refresh = useCallback(async () => {
    const [location, notifications, microphone] = await Promise.all([
      getPermissionStatus('location'), getPermissionStatus('notifications'), getPermissionStatus('microphone'),
    ]);
    if (alive.current) setStatus({ location, notifications, microphone });
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') refresh();
    });
    return () => sub?.remove?.();
  }, [refresh]);

  const onCard = (kind: PermKind) => {
    const st = status[kind];
    if (st === 'granted' || busy) return;
    if (st === 'blocked') {
      openSystemSettings();
      return;
    }
    setAsking(kind);
  };

  const choose = async (kind: PermKind, choice: ExplainerChoice) => {
    setAsking(null);
    if (choice === 'no') {
      push(PERM_TOASTS.denied[kind], 'warn');
      return;
    }
    setBusy(true);
    try {
      const always = kind === 'location' && choice === 'always';
      const result = await requestPermission(kind, { always });
      if (!alive.current) return;
      setStatus((prev) => ({ ...prev, [kind]: result }));
      if (result !== 'granted') {
        push(PERM_TOASTS.denied[kind], 'warn');
      } else if (kind === 'location' && !(await hasAlwaysLocation())) {
        push(PERM_TOASTS.whileUsing, 'warn');
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const canContinue = status.location === 'granted' && status.notifications === 'granted';

  return (
    <View style={{ flex: 1 }} testID="screen-Perms">
      <Screen
        contentStyle={{ paddingBottom: 130 }}
        cta={<Button label="Continue" onPress={() => navigation.navigate('Contact')} disabled={!canContinue} testID="perms-continue" />}
      >
        <TopBar onBack={() => navigation.goBack()} />
        <Stepper step={4} />
        <Text style={type.label}>STEP 4 OF 5</Text>
        <Text style={[type.h1, { marginTop: 12 }]} accessibilityRole="header">Three permissions.{'\n'}Here's why.</Text>
        <View style={s.cards}>
          {PERM_CARDS.map((c) => {
            const st = status[c.kind];
            const granted = st === 'granted';
            return (
              <Card key={c.kind} testID={`perm-card-${c.kind}`}>
                <View style={s.head}>
                  <IconWell icon={granted ? 'check' : c.icon} accent={granted} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={s.titleRow}>
                      <Text style={type.h3}>{c.title}</Text>
                      {c.required ? null : <Pill label="Optional" />}
                    </View>
                    <Text style={[type.sm, { marginTop: 8 }]}>{c.body}</Text>
                  </View>
                </View>
                <Button
                  label={granted ? 'Allowed' : st === 'blocked' ? 'Open settings' : 'Allow'}
                  variant={granted ? 'soft' : 'dark'}
                  size="sm"
                  style={{ marginTop: 16, width: '100%' }}
                  onPress={() => onCard(c.kind)}
                  accessibilityLabel={granted ? `${c.title}: allowed` : st === 'blocked' ? `${c.title}: open system settings` : `Allow ${c.title}`}
                  testID={`perm-btn-${c.kind}`}
                />
              </Card>
            );
          })}
        </View>
      </Screen>
      {asking ? <PermExplainer kind={asking} onChoose={(choice) => choose(asking, choice)} /> : null}
      <ToastContainer top={60} />
    </View>
  );
}
