/**
 * Profile — step 3 of 5 (demo `profile`): name, bike chips, riding-style segmented and the live rider plate.
 * Prefilled from the rider's saved profile when there is one (replaying onboarding). Continue saves
 * users/{uid} through userService.saveProfile and moves on to Perms.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { BIKES, RIDING_STYLES, RidingStyle } from '../../models/domain';
import { Button, Chip, Screen, Segmented, Stepper, TextField, TopBar } from '../../ui';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { saveProfile } from '../../services/userService';
import { useProfileStore } from '../../store/profileStore';
import { useSessionStore } from '../../store/sessionStore';
import Kav from './parts/Kav';
import RiderPlate from './parts/RiderPlate';

export const NAME_MAX = 24;
/** Firestore queues a write made offline and only acknowledges it on reconnect; don't make the rider wait for that. */
export const SAVE_WAIT_MS = 6000;

const STYLE_OPTIONS = RIDING_STYLES.map((v) => ({ value: v, label: v }));

export default function ProfileScreen({ navigation }: any) {
  const { type } = useTheme();
  const s = useStyles(({ type: t, colors: c }) => ({
    label: { ...t.fieldLabel, marginTop: 24, marginBottom: 8, marginLeft: 2 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    err: { ...t.sm, color: c.bad, marginTop: 14 },
  }));
  const uid = useSessionStore((st) => st.uid);
  const me = useProfileStore((st) => st.me);
  const [name, setName] = useState(me?.name ?? '');
  const [bike, setBike] = useState<string>(me?.bike || BIKES[0]);
  const [style, setStyle] = useState<RidingStyle>(me?.style ?? 'Steady');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const edited = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);

  // The saved profile can arrive after the screen opens; fill the form once, unless the rider already typed.
  useEffect(() => {
    if (!me || edited.current) return;
    setName(me.name);
    setBike(me.bike || BIKES[0]);
    setStyle(me.style);
  }, [me]);

  const bikeChip = (BIKES as readonly string[]).includes(bike) ? bike : 'Other';
  const ready = name.trim().length > 0 && !busy;

  const next = async () => {
    if (!ready) return;
    if (!uid) {
      setError('You are signed out. Go back and sign in again.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          saveProfile(uid, { name: name.trim(), bike, style }),
          new Promise<void>((resolve) => { timer = setTimeout(resolve, SAVE_WAIT_MS); }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
      navigation.navigate('Perms');
    } catch {
      if (alive.current) setError('Could not save your profile. Check your connection and try again.');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <Kav>
      <Screen testID="screen-Profile" cta={<Button label="Continue" onPress={next} disabled={!ready} loading={busy} testID="profile-continue" />}>
        <TopBar onBack={() => navigation.goBack()} />
        <Stepper step={3} />
        <Text style={type.label}>STEP 3 OF 5</Text>
        <Text style={[type.h1, { marginTop: 12 }]} accessibilityRole="header">Who's riding?</Text>

        <Text style={s.label}>NAME</Text>
        <TextField
          value={name}
          onChangeText={(v) => { edited.current = true; setName(v); if (error) setError(null); }}
          maxLength={NAME_MAX}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          returnKeyType="done"
          placeholder="Your name"
          accessibilityLabel="Name input"
          testID="profile-name"
        />

        <Text style={s.label}>YOUR BIKE</Text>
        <View style={s.chips}>
          {BIKES.map((b) => (
            <Chip key={b} label={b} on={bikeChip === b} onPress={() => { edited.current = true; setBike(b); }} testID={`bike-${b}`} />
          ))}
        </View>

        <Text style={s.label}>RIDING STYLE</Text>
        <Segmented options={STYLE_OPTIONS} value={style} onChange={(v) => { edited.current = true; setStyle(v); }} testID="profile-style" />

        <View style={{ marginTop: 24 }}>
          <RiderPlate name={name} bike={bike} style={style} />
        </View>
        {error ? <Text style={s.err} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="profile-error">{error}</Text> : null}
      </Screen>
    </Kav>
  );
}
