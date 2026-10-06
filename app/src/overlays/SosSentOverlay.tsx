/**
 * SosSentOverlay — placeholder until implemented (docs/DEMO_PARITY_SPEC.md §3, SOS / Road). Keep the default export and props.
 */
import React from 'react';
import { View } from 'react-native';
import type { OverlayState } from '../store/overlayStore';

export default function SosSentOverlay(_props: { state: OverlayState }) {
  return <View testID="overlay-SosSent" />;
}
