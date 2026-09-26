/**
 * Privacy / FL status badge — owned by Person D (spec §4.5).
 * Dark pill, Space Mono 10px. Default: privacy message.
 * FL round completed: "FL round {N} done · {Y} clients" from FlRoundLogger.
 * Information-only, no interaction.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { WeRideColors, WeRideFonts } from '../../../theme/theme';
import { getFlData } from '../../../services/localStorage';
import { FlRoundLogger } from '@flvoice/fl/flRoundLogger';

interface FlBadgeState {
  message: string;
}

export default function FlStatusOverlay() {
  const [state, setState] = useState<FlBadgeState>({
    message: 'Your ride data stays on your device',
  });

  useEffect(() => {
    try {
      const logger = new FlRoundLogger(getFlData());
      const latest = logger.latestRound();
      if (latest) {
        setState({
          message: `FL round ${latest.roundId} done · ${latest.participants} clients`,
        });
      }
    } catch {
      // FL state unavailable — keep default privacy message
    }
  }, []);

  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{state.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 80,
    left: 16,
    backgroundColor: '#00000099',
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontFamily: WeRideFonts.mono,
    fontSize: 10,
    color: WeRideColors.text,
  },
});