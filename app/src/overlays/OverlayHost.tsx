/** Renders the current full-screen overlay (store/overlayStore) above everything, including navigation. */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useOverlayStore } from '../store/overlayStore';
import Call112Overlay from './Call112Overlay';
import CrashCountdownOverlay from './CrashCountdownOverlay';
import RollOutOverlay from './RollOutOverlay';
import SosIncomingOverlay from './SosIncomingOverlay';
import SosSentOverlay from './SosSentOverlay';

export default function OverlayHost() {
  const current = useOverlayStore((s) => s.current);
  if (!current) return null;
  const body =
    current.kind === 'sos-sent' ? <SosSentOverlay state={current} /> :
    current.kind === 'sos-incoming' ? <SosIncomingOverlay state={current} /> :
    current.kind === 'crash' ? <CrashCountdownOverlay state={current} /> :
    current.kind === 'call112' ? <Call112Overlay state={current} /> :
    <RollOutOverlay state={current} />;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none" testID="overlay-host">
      {body}
    </View>
  );
}
