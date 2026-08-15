import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RootStack } from './navigation/RootStack';
import { initFirebase } from './services/firebaseService';
import { initStorage } from './services/localStorage';

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
        <RootStack />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}