/**
 * FamilySheet — Me > Family sharing (docs/DEMO_PARITY_SPEC.md §3).
 *
 * Honest version of the demo's sheet: there is no backend for live family links, so there is no watcher list and
 * no toggles. What is real is a one-time snapshot: the rider's last verified position as a map pin through the
 * system share sheet.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Share, Text } from 'react-native';
import { useRouteStore } from '@routing/client/routeStore';
import { Button, Icon, Sheet, haptic } from '../ui';
import { useTheme } from '../theme/ThemeProvider';
import { useToastStore } from '../store/toastStore';
import { locationShareMessage } from '../utils/locationShare';

export interface FamilySheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function FamilySheet({ visible, onClose }: FamilySheetProps) {
  const { colors, type } = useTheme();
  const currentLocation = useRouteStore((s) => s.currentLocation);
  const push = useToastStore((s) => s.push);
  const [sharing, setSharing] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const shareLocation = useCallback(async () => {
    if (sharing) return;
    if (!currentLocation) {
      push('Waiting for a verified GPS fix — try again in a moment', 'warn');
      return;
    }
    setSharing(true);
    try {
      const result = await Share.share({ message: locationShareMessage(currentLocation.lat, currentLocation.lng) });
      // Dismissing the sheet (iOS) is not a completed share.
      if (result?.action !== Share.dismissedAction) haptic('success');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[FamilySheet] share failed:', e);
      push('Could not open the share sheet', 'error');
      haptic('error');
    } finally {
      if (alive.current) setSharing(false);
    }
  }, [sharing, currentLocation, push]);

  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-Family" accessibilityLabel="Family sharing">
      <Text style={type.label}>FAMILY SHARING</Text>
      <Text style={[type.h2, { marginTop: 8 }]} accessibilityRole="header">Let them know where you are</Text>
      <Text style={[type.sm, { marginTop: 8 }]}>
        Live family links aren't available yet, so nobody outside your crew can follow a ride. You can send a one-time
        snapshot of where you are right now, to anyone you choose.
      </Text>
      <Button
        label="Send my location"
        variant="soft"
        onPress={shareLocation}
        loading={sharing}
        leading={<Icon name="share" size={20} color={colors.ink} />}
        style={{ marginTop: 16 }}
        testID="family-send-location"
      />
    </Sheet>
  );
}
