/**
 * VoicePrefsSheet — Me > Voice & signals. Only what is real: push-to-talk is on the Live screen, and the voice
 * channel is not carrying audio yet. There is no spoken-alerts toggle (the app has no text-to-speech engine).
 */
import React from 'react';
import { Text } from 'react-native';
import { Icon, List, ListItem, Sheet } from '../ui';
import { useTheme } from '../theme/ThemeProvider';

export interface VoicePrefsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function VoicePrefsSheet({ visible, onClose }: VoicePrefsSheetProps) {
  const { colors, type } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-VoicePrefs" accessibilityLabel="Voice and signals">
      <Text style={type.h2} accessibilityRole="header">Voice & signals</Text>
      <List style={{ marginTop: 16 }}>
        <ListItem
          first
          icon="mic"
          title="Push-to-talk with crew"
          subtitle="Hold the mic on the live screen"
          right={<Icon name="check" size={20} color={colors.ok} />}
          testID="voice-ptt"
        />
        <ListItem
          icon="signal"
          title="Voice channel"
          subtitle="Joins your crew's channel when a ride is live. Audio between riders isn't live yet."
          testID="voice-channel"
        />
      </List>
      <Text style={[type.sm, { marginTop: 12 }]}>Spoken alerts aren't available yet.</Text>
    </Sheet>
  );
}
