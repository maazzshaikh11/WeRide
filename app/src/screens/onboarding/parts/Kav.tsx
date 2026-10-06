/** Lifts the pinned CTA / fields above the iOS keyboard (Android resizes the window itself). */
import React from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';

export default function Kav({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {children}
    </KeyboardAvoidingView>
  );
}
