/**
 * IntelSheet — "Before you roll" (demo `A.intel`): the ride's real active hazard clusters on a Rail, plus its
 * route safety score when it has one, and the two-riders-confirm explainer. Opened from the Ride tab.
 */
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import type { HazardCluster } from '../models/hazardCluster';
import { useTheme } from '../theme/ThemeProvider';
import { Button, Rail, Sheet } from '../ui';
import type { LatLng } from '../utils/mapFit';
import { intelItems } from '../utils/intel';

export interface IntelSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Active hazard clusters of the ride. */
  clusters?: HazardCluster[];
  /** The ride's saved road geometry (to measure "km 46" along); empty when unknown. */
  path?: LatLng[];
  /** 0..1, when the ride has a calculated route. */
  safety?: number | null;
  now?: number;
}

export default function IntelSheet({ visible, onClose, clusters = [], path = [], safety = null, now }: IntelSheetProps) {
  const { type } = useTheme();
  const items = useMemo(() => intelItems(clusters, path, now ?? Date.now(), safety), [clusters, path, safety, now]);
  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-Intel" accessibilityLabel="Route intel">
      <Text style={type.label}>ROUTE INTEL</Text>
      <Text style={[type.h2, { marginTop: 8 }]} accessibilityRole="header">Before you roll</Text>
      <View style={{ marginTop: 16 }}>
        {items.length > 0 ? (
          <Rail items={items.map((i) => ({ title: i.title, sub: i.sub, tone: i.tone }))} />
        ) : (
          <Text style={type.body} testID="intel-empty">No active hazards have been reported on this route.</Text>
        )}
      </View>
      <Text style={[type.sm, { marginTop: 8 }]}>
        Hazards show up when two riders report the same spot. That keeps one bad tap from crying wolf.
      </Text>
      <Button label="Got it" onPress={onClose} style={{ marginTop: 16 }} />
    </Sheet>
  );
}
