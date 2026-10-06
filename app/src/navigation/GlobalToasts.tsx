/**
 * GlobalToasts — one toast host for every screen that doesn't render its own (the Garage tabs, Recap, plan flow…).
 * The screens that lay toasts out around their own chrome (Live, Meetup, Stop, Arrive, Perms) keep their local
 * container; this one stays hidden on them so a toast is never drawn twice. Toasts that outlive a screen
 * (e.g. "Ride saved to your log" after Arrive resets to the Garage) land here.
 */
import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ToastContainer from '../components/ToastContainer';
import { navigationRef } from './navigationRef';

/** Screens that render their own ToastContainer. */
export const LOCAL_TOAST_ROUTES: readonly string[] = ['Live', 'Meetup', 'Stop', 'Arrive', 'Perms'];

export default function GlobalToasts() {
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<string | undefined>(undefined);

  useEffect(() => {
    const read = () => setRoute(navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined);
    read();
    const unsub = navigationRef.addListener('state', read);
    return unsub;
  }, []);

  if (route && LOCAL_TOAST_ROUTES.includes(route)) return null;
  return <ToastContainer top={insets.top + 8} />;
}
