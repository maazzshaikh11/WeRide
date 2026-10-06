/** The weather card under the Ride tab header (demo: sun well + "21° · clear" + wind / sunrise line). */
import React from 'react';
import { Text, View } from 'react-native';
import type { Units } from '../../../models/domain';
import { useStyles } from '../../../theme/ThemeProvider';
import { Card, IconWell } from '../../../ui';
import type { IconName } from '../../../ui';
import { formatSpeed } from '../../../utils/units';
import type { Weather } from '../../../utils/weather';

function iconFor(w: Weather): IconName {
  if (w.fair) return 'sun';
  if (w.precipMm > 0 || (w.code != null && w.code >= 51)) return 'drop';
  return 'wind';
}

export function weatherLines(w: Weather, units: Units): { title: string; sub: string } {
  const parts: string[] = [];
  if (w.precipMm > 0) parts.push(`rain ${w.precipMm < 10 ? w.precipMm.toFixed(1) : Math.round(w.precipMm)} mm`);
  parts.push(`wind ${formatSpeed(w.windKmh, units)} ${units === 'mi' ? 'mph' : 'km/h'}`);
  if (w.sunrise) parts.push(`sunrise ${w.sunrise}`);
  return { title: `${Math.round(w.tempC)}° · ${w.sky}`, sub: parts.join(' · ') };
}

export default function WeatherCard({ weather, units }: { weather: Weather; units: Units }) {
  const styles = useStyles(({ type: t }) => ({
    card: { paddingVertical: 12, paddingHorizontal: 14 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    text: { flex: 1, minWidth: 0 },
    title: { ...t.h3 },
    sub: { ...t.sm, marginTop: 3 },
  }));
  const { title, sub } = weatherLines(weather, units);
  return (
    <Card pad={false} style={styles.card} testID="weather-card">
      <View style={styles.row} accessible accessibilityLabel={`Weather: ${title}. ${sub}`}>
        <IconWell icon={iconFor(weather)} accent />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <Text style={styles.sub} numberOfLines={2}>{sub}</Text>
        </View>
      </View>
    </Card>
  );
}
