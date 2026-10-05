/**
 * Privacy / FL status line — owned by Person D (spec §4.5).
 * One-line caption rendered INSIDE the map header (under the ride name), not a
 * floating pill over the map. Default: privacy message.
 * FL round completed: "FL round {N} done · {Y} clients" from FlRoundLogger.
 * Information-only, no interaction.
 */
import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { type } from '../../../theme/typography';
import { getFlData } from '../../../services/localStorage';
import { FlRoundLogger } from '@flvoice/fl/flRoundLogger';

interface FlBadgeState {
  message: string;
}

export default function FlStatusOverlay() {
  const [state, setState] = useState<FlBadgeState>({
    message: 'Ride data stays on-device',
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
    <Text style={styles.text} numberOfLines={1}>
      {state.message}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { ...type.caption },
});
