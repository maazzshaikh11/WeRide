/**
 * AlertCard — hazard alert card for AlertsScreen (spec §3.7).
 * New variant: border #FF5C0055 + alertPop animation (400ms).
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { WeRideColors, WeRideFonts } from '../theme/theme';

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
      style={[
        styles.card,
        isNew && styles.newCard,
        {
          opacity: pop,
          transform: [{ translateY: pop.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }],
        },
      ]}
    >
      <Text style={styles.icon}>{emoji}</Text>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>{meta}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 12,
    padding: 11,
  },
  newCard: { borderColor: '#FF5C0055' },
  icon: { fontSize: 18 },
  textWrap: { flex: 1 },
  title: { fontFamily: WeRideFonts.body, fontSize: 12.5, fontWeight: '600', color: WeRideColors.white },
  meta: { fontFamily: WeRideFonts.body, fontSize: 10, color: WeRideColors.textSub, marginTop: 1 },
});