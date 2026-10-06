/**
 * Boot — decides where the app opens, once Firebase has reported the session and the rider's settings are known:
 *   signed out            → Splash (first-launch flow)
 *   signed in, onboarded  → GarageTabs
 *   signed in, not yet    → Profile (resumes the first-launch flow)
 * Until then it shows the splash artwork so there is no flash of the wrong screen.
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { CommonActions } from '@react-navigation/native';
import Logo from '../../components/Logo';
import { usePrefsStore } from '../../store/prefsStore';
import { useSessionStore } from '../../store/sessionStore';
import { useTheme } from '../../theme/ThemeProvider';

/** How long to wait for the rider's saved settings before trusting the on-device copy. */
export const SETTINGS_WAIT_MS = 2500;

export function bootTarget(input: { authKnown: boolean; uid: string | null; loaded: boolean; onboarded: boolean; waited: boolean }):
  'wait' | 'Splash' | 'GarageTabs' | 'Profile' {
  if (!input.authKnown) return 'wait';
  if (!input.uid) return 'Splash';
  if (!input.loaded && !input.waited) return 'wait';
  return input.onboarded ? 'GarageTabs' : 'Profile';
}

export default function BootScreen({ navigation }: { navigation: { dispatch: (a: any) => void } }) {
  const { colors } = useTheme();
  const authKnown = useSessionStore((s) => s.authKnown);
  const uid = useSessionStore((s) => s.uid);
  const loaded = usePrefsStore((s) => s.loaded);
  const onboarded = usePrefsStore((s) => s.onboarded);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setWaited(true), SETTINGS_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  const target = bootTarget({ authKnown, uid, loaded, onboarded, waited });
  useEffect(() => {
    if (target === 'wait') return;
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: target }] }));
  }, [target, navigation]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }} testID="screen-Boot">
      <Logo size={140} />
    </View>
  );
}
