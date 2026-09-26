import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootStack } from './navigation/RootStack';
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

export default function App() {
  useEffect(() => {
    (async () => {
      await initStorage(); // open MMKV instances (CRDT queue, hazard queue, FL data)
      await initFirebase(); // firebase + FCM permission
    })();
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <SyncBootstrap />
        <RootStack />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}