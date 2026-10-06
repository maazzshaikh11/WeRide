/**
 * Registered root. Loads the storage encryption key from the platform keystore BEFORE the app (and the stores that
 * read their cache while their module loads) is required, so every store opens its encrypted MMKV synchronously.
 * `initSecureStorage()` never rejects: if the keystore is unavailable it logs and the app starts with the plain fallback.
 */
import React, { useEffect, useState } from 'react';
import { initSecureStorage, getEncryptedMMKV } from './services/secureStorage';
import { setStorageOpener } from '@hazard/crdt/storageOpener';

export default function SecureRoot() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    initSecureStorage().then(() => {
      // The SOS offline queue / OR-Set live in modules/hazard-sos: hand them the encrypted opener before they first open storage.
      setStorageOpener(getEncryptedMMKV);
      if (live) setReady(true);
    });
    return () => {
      live = false;
    };
  }, []);
  if (!ready) return null; // the native launch screen stays visible
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- deliberately lazy: stores must load after the key
  const App = require('./App').default as React.ComponentType;
  return <App />;
}
