/**
 * AlertCard — hazard alert card for AlertsScreen (spec §3.7).
 * New variant: accent border, "New" tag and a 400ms fade-in.
 * The emoji is the hazard-type glyph (content), not chrome.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideRadius, WeRideSpacing } from '../theme/theme';
import { type } from '../theme/typography';

interface Props {
  emoji: string;
  title: string;
  meta: string;
  isNew?: boolean;
}

export default function AlertCard({ emoji, title, meta, isNew }: Props) {
  const pop = useRef(new Animated.Value(isNew ? 0 : 1)).current;

  useEffect(() => {
    if (isNew) {
      Animated.timing(pop, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  }, [isNew, pop]);

  return (
    <Animated.View
      accessible
      accessibilityLabel={`${isNew ? 'New. ' : ''}${title}. ${meta}`}
      style={[
        styles.card,
        isNew && styles.newCard,
        {
          opacity: pop,
          transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        },
      ]}
    >
      <View style={styles.iconTile}>
        <Text style={styles.icon}>{emoji}</Text>
      </View>
      <View style={styles.textWrap}>
        <Text style={type.heading}>{title}</Text>
        <Text style={type.caption}>{meta}</Text>
      </View>
      {isNew ? <Text style={type.eyebrow}>NEW</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: WeRideSpacing.md,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xl,
    padding: WeRideSpacing.lg,
  },
  newCard: { borderColor: WeRideColors.primary },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: WeRideRadius.lg,
    backgroundColor: WeRideColors.dark2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20, lineHeight: 24 },
  textWrap: { flex: 1 },
});
