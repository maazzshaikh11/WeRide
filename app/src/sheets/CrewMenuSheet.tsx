/**
 * CrewMenuSheet — the crew page's ⋯ menu. "Mute crew notifications" is a preference stored on this phone only.
 * "Leave crew" is real and asks to confirm first. (The demo's "Crew settings" is not built: there are no admin roles to edit.)
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { Button, List, ListItem, Sheet, Toggle } from '../ui';

export interface CrewMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  crewName?: string;
  muted?: boolean;
  onToggleMute?: (muted: boolean) => void;
  /** Leaves the crew; reject with an Error to show its message inline. */
  onLeave?: () => Promise<void> | void;
}

export default function CrewMenuSheet({ visible, onClose, crewName = 'this crew', muted = false, onToggleMute, onLeave }: CrewMenuSheetProps) {
  const { colors, type } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (!visible) {
      setConfirming(false);
      setBusy(false);
      setError(null);
    }
  }, [visible]);

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onLeave?.();
    } catch (e) {
      if (alive.current) setError((e as Error)?.message || 'Could not leave the crew. Try again.');
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-CrewMenu" accessibilityLabel="Crew menu">
      {confirming ? (
        <View testID="crewmenu-confirm">
          <Text style={type.h2} accessibilityRole="header">{`Leave ${crewName}?`}</Text>
          <Text style={[type.sm, { marginTop: 8 }]}>You will stop seeing this crew's riders and rides. You can rejoin any time with the crew code.</Text>
          {error ? (
            <Text style={[type.sm, { color: colors.bad, marginTop: 12 }]} accessibilityLiveRegion="polite" testID="crewmenu-error">{error}</Text>
          ) : null}
          <Button label="Leave crew" variant="danger" style={{ marginTop: 16 }} loading={busy} onPress={leave} testID="crewmenu-leave-confirm" />
          <Button label="Stay in the crew" variant="soft" style={{ marginTop: 8 }} disabled={busy} onPress={() => setConfirming(false)} testID="crewmenu-stay" />
        </View>
      ) : (
        <List>
          <ListItem
            first
            icon="bell"
            title="Mute crew notifications"
            subtitle="On this phone only"
            right={<Toggle value={muted} onChange={(v) => onToggleMute?.(v)} accessibilityLabel="Mute crew notifications" testID="crewmenu-mute" />}
          />
          <ListItem icon="trash" title="Leave crew" titleColor={colors.bad} subtitle="You can rejoin with the code" onPress={() => setConfirming(true)} testID="crewmenu-leave" accessibilityLabel="Leave crew" />
        </List>
      )}
    </Sheet>
  );
}
