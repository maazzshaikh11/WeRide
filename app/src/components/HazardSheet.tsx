/**
 * HazardSheet — report a hazard at the rider's exact spot (demo "Report a hazard").
 * Uses the same service as the Alerts tab (submitHazardReport + clustering), with
 * the verified own fix. No fix → says so, sends nothing. The crew is warned only
 * once a second rider confirms (the 2-report DBSCAN rule), and the sheet says so.
 */
import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useStyles, useTheme } from '../theme/ThemeProvider';
import { useToastStore } from '../store/toastStore';
import { submitHazardReport, triggerClustering } from '@hazard/services/hazardService';
import { HazardType } from '@app/models/hazardCluster';
import { warn } from '../utils/log';
import { Icon, IconName, PressableScale, Sheet, haptic } from '../ui';

export const HAZARD_SHEET_OPTIONS: { type: HazardType; label: string; icon: IconName }[] = [
  { type: 'pothole', label: 'Pothole', icon: 'pothole' },
  { type: 'oil_spill', label: 'Oil / gravel', icon: 'drop' },
  { type: 'accident', label: 'Accident', icon: 'crash' },
  { type: 'debris', label: 'Debris', icon: 'debris' },
  { type: 'other', label: 'Other', icon: 'more' },
];

const COLUMNS = 3;
const HAZARD_ROWS = HAZARD_SHEET_OPTIONS.reduce<(typeof HAZARD_SHEET_OPTIONS)[]>((rows, o, i) => {
  if (i % COLUMNS === 0) rows.push([]);
  rows[rows.length - 1].push(o);
  return rows;
}, []);

interface Props {
  visible: boolean;
  onClose: () => void;
  groupId: string | null;
  riderId: string | null;
  /** The rider's verified own fix (route store), or null when there is none yet. */
  location: { lat: number; lng: number; timestamp_hlc?: string } | null;
  /** Called after a report was accepted (sent or queued), so the ride recorder can count it. */
  onReported?: (type: HazardType) => void;
}

export default function HazardSheet({ visible, onClose, groupId, riderId, location, onReported }: Props) {
  const { colors, type } = useTheme();
  const push = useToastStore((st) => st.push);
  const [busy, setBusy] = useState<HazardType | null>(null);
  const inFlight = useRef(false);
  const s = useStyles(({ colors: c, type: t }) => ({
    grid: { gap: 10 },
    row: { flexDirection: 'row', gap: 10 },
    // three equal columns (demo `.hz`): flex, not a % width, so three tiles + two gaps always fit one row
    tile: { flex: 1, height: 92, borderRadius: 20, backgroundColor: c.card2, borderWidth: 2, borderColor: c.line2, alignItems: 'center', justifyContent: 'center', gap: 8 },
    pad: { flex: 1 },
    tileLabel: { ...t.tab, fontSize: 12, lineHeight: 14, letterSpacing: 0.96, color: c.ink },
  }));

  const report = async (hazardType: HazardType) => {
    if (inFlight.current) return;
    if (!groupId || !riderId) return;
    if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
      push('Location not available yet — try again', 'warn');
      return;
    }
    inFlight.current = true;
    setBusy(hazardType);
    try {
      const { queued } = await submitHazardReport(hazardType, location.lat, location.lng, riderId, groupId, location.timestamp_hlc ?? '');
      await triggerClustering(groupId);
      push(queued ? 'Hazard queued — will sync when online' : 'Hazard reported', queued ? 'warn' : undefined);
      haptic('success');
      onReported?.(hazardType);
      onClose();
    } catch (e) {
      warn('[HazardSheet] submitHazardReport failed:', e);
      push('Could not submit hazard — please try again', 'error');
      haptic('error');
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="hazard-sheet" accessibilityLabel="Report a hazard">
      <Text style={[type.label, { marginBottom: 12 }]}>REPORT A HAZARD ∙ HERE, NOW</Text>
      <View style={s.grid} testID="hazard-grid">
        {HAZARD_ROWS.map((row, ri) => (
          <View key={ri} style={s.row}>
            {row.map((o) => (
              <PressableScale
                key={o.type}
                haptic={false}
                scaleTo={0.95}
                disabled={busy != null}
                onPress={() => report(o.type)}
                accessibilityRole="button"
                accessibilityLabel={`Report ${o.label}`}
                accessibilityState={{ busy: busy === o.type, disabled: busy != null }}
                style={[s.tile, busy === o.type && { borderColor: colors.pri }]}
              >
                <Icon name={o.icon} size={32} />
                <Text style={s.tileLabel} numberOfLines={1}>{o.label.toUpperCase()}</Text>
              </PressableScale>
            ))}
            {/* keep the last row's tiles the same width as the full rows */}
            {Array.from({ length: COLUMNS - row.length }, (_, i) => <View key={`pad${i}`} style={s.pad} />)}
          </View>
        ))}
      </View>
      <Text style={[type.sm, { textAlign: 'center', marginTop: 16 }]}>
        It's logged at your exact spot. The crew gets warned once a second rider confirms.
      </Text>
    </Sheet>
  );
}
