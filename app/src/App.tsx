import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import RootNavigator from './navigation/RootNavigator';
import SessionBootstrap from './navigation/SessionBootstrap';
import RideLifecycleBridge from './navigation/RideLifecycleBridge';
import GlobalToasts from './navigation/GlobalToasts';
import { navigationRef } from './navigation/navigationRef';
import OverlayHost from './overlays/OverlayHost';
import SosListener from './overlays/SosListener';
import CrashWatcher from './overlays/CrashWatcher';
import { ThemeProvider, useTheme } from './theme/ThemeProvider';
import { initFirebase } from './services/firebaseService';
import { initStorage } from './services/localStorage';
import { useAppStore } from './store/appStore';
import {
  startSyncWorker,
  syncHazardReports,
  syncSosEvents,
  mergeSosOnSync,
} from '@hazard/crdt/syncWorker';

/**
 * Starts the hazard/SOS sync worker for the active group and runs one
 * cold-start sync pass (queued reports/SOS from a previous session).
 * Re-starts when the active group changes; stops on unmount/group switch.
 */
function SyncBootstrap() {
  const groupId = useAppStore((s) => s.groupId);

  useEffect(() => {
    if (!groupId) return;

    // Cold-start pass: flush anything queued while the app was closed.
    // Duplicate-safe: remote writes are idempotent (doc id = report/sos id).
    (async () => {
      try {
        await syncHazardReports(groupId);
        await syncSosEvents(groupId);
        await mergeSosOnSync(groupId);
      } catch (e) {
        console.warn('[SyncBootstrap] cold-start sync failed:', e);
      }
    })();

    // Ongoing worker: syncs on offline → online transitions.
    const stop = startSyncWorker(groupId);
    return () => stop();
  }, [groupId]);

  return null;
}

/** Navigation + status bar follow the resolved theme (background flashes would show the wrong colour). */
function ThemedNavigation({ children }: { children: React.ReactNode }) {
  const { colors, scheme } = useTheme();
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, background: colors.bg, card: colors.bg, text: colors.ink, border: colors.line, primary: colors.pri },
  };
  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      {children}
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    (async () => {
      await initStorage(); // open MMKV instances (CRDT queue, hazard queue, FL data)
      await initFirebase(); // firebase + FCM permission
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ThemedNavigation>
          <SessionBootstrap />
          <SyncBootstrap />
          <RootNavigator />
          <RideLifecycleBridge />
          <SosListener />
          <CrashWatcher />
          <GlobalToasts />
          <OverlayHost />
        </ThemedNavigation>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}