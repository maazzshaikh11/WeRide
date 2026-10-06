/**
 * ShareCardSheet — the yellow road-sign "share card" of a finished ride (demo A.shareCard) with the real numbers, and a
 * Share button that opens the OS share sheet with a text version. (The demo's "Save image" is not built: it needs an
 * image-capture library.)
 */
import React from 'react';
import { Share, Text, View } from 'react-native';
import Logo from '../components/Logo';
import type { RideLog } from '../models/domain';
import { usePrefsStore } from '../store/prefsStore';
import { useToastStore } from '../store/toastStore';
import { Plates } from '../theme/palettes';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Icon, Sheet } from '../ui';
import { distanceUnit, formatDistance, formatDuration } from '../utils/units';
import { formatRideDate, hasTogetherData } from '../utils/logStats';

export interface ShareCardSheetProps {
  visible: boolean;
  onClose: () => void;
  log?: RideLog | null;
  [extra: string]: any;
}

/** One line under the numbers: the real arrival, else the time on the road. */
export function shareTagline(log: RideLog): string {
  const arrived = log.events.find((e) => e.kind === 'arrived');
  if (arrived && log.destination?.label) return `Arrived ∙ ${log.destination.label}`;
  return `${formatDuration(log.duration_s)} on the road`;
}

/** Plain-text version for the OS share sheet. */
export function shareText(log: RideLog, units: 'km' | 'mi'): string {
  const together = hasTogetherData(log) ? `${Math.round(log.together_pct)}% together` : null;
  const parts = [formatDistance(log.km, units), together, `${log.riders} ${log.riders === 1 ? 'rider' : 'riders'}`].filter(Boolean);
  return [`${log.name} ∙ ${formatRideDate(log.started_ms)}`, parts.join(' ∙ '), shareTagline(log), 'Ridden with WeRide'].join('\n');
}

export default function ShareCardSheet({ visible, onClose, log }: ShareCardSheetProps) {
  const { type, colors } = useTheme();
  const units = usePrefsStore((s) => s.prefs.units);
  const push = useToastStore((s) => s.push);
  const Y = Plates.yellow;
  const faint = { color: Y.fg, opacity: 0.6 } as const;

  const onShare = async () => {
    if (!log) return;
    try {
      await Share.share({ message: shareText(log, units) });
      onClose();
    } catch {
      push("Couldn't open the share sheet.", 'error');
    }
  };

  const together = log ? (hasTogetherData(log) ? `${Math.round(log.together_pct)}%` : '—') : '';
  const stats = log
    ? [
        { v: formatDistance(log.km, units, false), k: distanceUnit(units) },
        { v: together, k: 'together' },
        { v: String(log.riders), k: log.riders === 1 ? 'rider' : 'riders' },
      ]
    : [];

  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-ShareCard" accessibilityLabel="Share card">
      <Text style={type.label} accessibilityRole="header">SHARE CARD</Text>
      {log ? (
        <>
          <View
            testID="share-card"
            accessible
            accessibilityLabel={`Share card. ${log.name}. ${stats.map((s) => `${s.v} ${s.k}`).join(', ')}. ${shareTagline(log)}`}
            style={{ marginTop: 16, backgroundColor: Y.bg, borderRadius: 18, padding: 20 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[type.label, { color: Y.fg, opacity: 0.65, flex: 1 }]} numberOfLines={1}>{`WERIDE ∙ ${formatRideDate(log.started_ms).toUpperCase()}`}</Text>
              <Logo size={44} />
            </View>
            <Text style={[type.plateTitle, { color: Y.fg, fontSize: 30, lineHeight: 30, marginTop: 16 }]} numberOfLines={3}>{log.name.toUpperCase()}</Text>
            <View style={{ flexDirection: 'row', marginTop: 16 }}>
              {stats.map((s) => (
                <View key={s.k} style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[type.statValue, { color: Y.fg }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{s.v}</Text>
                  <Text style={[type.statKey, faint, { marginTop: 6 }]} numberOfLines={1}>{s.k.toUpperCase()}</Text>
                </View>
              ))}
            </View>
            <Text style={[type.plateSub, { color: Y.fg, fontSize: 15, lineHeight: 18, marginTop: 16 }]} numberOfLines={2}>{shareTagline(log)}</Text>
            <View pointerEvents="none" style={{ position: 'absolute', top: 4, left: 4, right: 4, bottom: 4, borderRadius: 14, borderWidth: 2, borderColor: Y.rim, opacity: 0.92 }} />
          </View>
          <View style={{ marginTop: 16 }}>
            <Button label="Share" leading={<Icon name="share" size={20} color={colors.priInk} />} onPress={onShare} accessibilityHint="Opens the share sheet" testID="share-card-share" />
          </View>
        </>
      ) : (
        <Text style={[type.sm, { marginTop: 16 }]}>There is no ride to share yet.</Text>
      )}
    </Sheet>
  );
}
