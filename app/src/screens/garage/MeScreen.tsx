/**
 * Me — the Account tab (docs/DEMO_PARITY_SPEC.md §3 'Me').
 * Rider plate from the real profile; rows with real subtitles (contacts, crash detection, road theme, glove mode,
 * OS permission status); Replay onboarding and Sign out.
 */
import React, { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { List, ListItem, Screen, SectionLabel } from '../../ui';
import { useTheme } from '../../theme/ThemeProvider';
import { usePrefsStore } from '../../store/prefsStore';
import { useProfileStore } from '../../store/profileStore';
import { useToastStore } from '../../store/toastStore';
import { signOut } from '../../services/authService';
import { navigationRef, resetRoot } from '../../navigation/navigationRef';
import FamilySheet from '../../sheets/FamilySheet';
import VoicePrefsSheet from '../../sheets/VoicePrefsSheet';
import PermsSheet from '../../sheets/PermsSheet';
import RiderPlate from './parts/RiderPlate';
import usePermissionStatuses from './parts/usePermissionStatuses';
import { APP_VERSION } from './parts/appVersion';
import type { NavLike } from './parts/SubScreen';

const ROAD_LABEL = { night: 'Night', day: 'Day', auto: 'Sunset auto' } as const;

export function contactsSubtitle(count: number, crash: boolean): string {
  return `${count} ${count === 1 ? 'contact' : 'contacts'} ∙ crash detection ${crash ? 'on' : 'off'}`;
}

type Sheet = 'family' | 'voice' | 'perms' | null;

export default function MeScreen({ navigation }: { navigation?: NavLike }) {
  const { colors, type } = useTheme();
  const me = useProfileStore((s) => s.me);
  const prefs = usePrefsStore((s) => s.prefs);
  const contacts = usePrefsStore((s) => s.contacts);
  const push = useToastStore((s) => s.push);
  const [sheet, setSheet] = useState<Sheet>(null);
  const { statuses, loaded, refresh } = usePermissionStatuses(true);

  const go = (name: string, params?: object) => navigation?.navigate?.(name, params);
  const closeSheet = useCallback(() => {
    setSheet(null);
    refresh();
  }, [refresh]);

  /** Reset the root stack (works from a tab: the root navigation ref, else the screen's own navigation). */
  const resetTo = (name: 'Promise' | 'Splash') => {
    if (navigationRef.isReady()) resetRoot(name);
    else navigation?.reset?.({ index: 0, routes: [{ name }] });
  };

  const replay = async () => {
    await usePrefsStore.getState().setOnboarded(false);
    resetTo('Promise');
  };

  const logOut = async () => {
    try {
      await signOut();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[MeScreen] sign out failed:', e);
      push('Could not sign out. Check your connection and try again.', 'error');
      return;
    }
    resetTo('Splash');
    push('Signed out', 'success');
  };

  const permsOk = statuses.location === 'granted' && statuses.notifications === 'granted';
  const permsSub = !loaded ? 'Checking…' : permsOk ? 'All set' : 'Needs attention';
  const detail = me ? [me.bike, me.style].filter(Boolean).join(' ∙ ') : undefined;

  return (
    <Screen tabs testID="screen-Me">
      <Text style={type.label}>ACCOUNT</Text>
      <Text style={[type.h1, { marginTop: 8 }]} accessibilityRole="header">Me</Text>
      <View style={{ marginTop: 24 }}>
        <RiderPlate name={me?.name ?? 'Rider'} detail={detail} />
      </View>

      <SectionLabel>Safety</SectionLabel>
      <List>
        <ListItem first icon="shield" accentIcon title="SOS & emergency" subtitle={contactsSubtitle(contacts.length, prefs.crash)} onPress={() => go('Safety')} testID="me-safety" />
        <ListItem icon="eye" title="Family sharing" subtitle="Send family where you are right now" onPress={() => setSheet('family')} testID="me-family" />
      </List>

      <SectionLabel>Riding</SectionLabel>
      <List>
        <ListItem first icon="map" title="Road screen & controls" subtitle={`${ROAD_LABEL[prefs.road]} theme ∙ glove mode ${prefs.glove ? 'on' : 'off'}`} onPress={() => go('Display')} testID="me-display" />
        <ListItem icon="mic" title="Voice & signals" subtitle="Push-to-talk, crew signals" onPress={() => setSheet('voice')} testID="me-voice" />
      </List>

      <SectionLabel>Privacy</SectionLabel>
      <List>
        <ListItem first icon="lock" title="Privacy & learning" subtitle="Learning and who sees your position" onPress={() => go('Privacy')} testID="me-privacy" />
        <ListItem icon="bell" title="Permissions" subtitle={permsSub} onPress={() => setSheet('perms')} testID="me-perms" />
      </List>

      <SectionLabel>Account</SectionLabel>
      <List>
        <ListItem first icon="play" title="Replay onboarding" subtitle="See first launch again" onPress={replay} testID="me-replay" />
        <ListItem icon="back" title="Sign out" titleColor={colors.bad} onPress={logOut} testID="me-signout" accessibilityLabel="Sign out" />
      </List>

      <Text style={[type.sm, { marginTop: 24, textAlign: 'center' }]} testID="me-footer">
        {APP_VERSION ? `WeRide ${APP_VERSION}` : 'WeRide'}
      </Text>

      <FamilySheet visible={sheet === 'family'} onClose={closeSheet} />
      <VoicePrefsSheet visible={sheet === 'voice'} onClose={closeSheet} />
      <PermsSheet visible={sheet === 'perms'} onClose={closeSheet} onChanged={refresh} />
    </Screen>
  );
}
