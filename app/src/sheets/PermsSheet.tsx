/**
 * PermsSheet — Me > Permissions. Three rows with the REAL OS status (Allowed / Not allowed / Off · optional).
 * Tapping a row that has never been asked requests it; otherwise "Open system settings" is the way to change it.
 */
import React, { useCallback, useEffect, useRef } from 'react';
import { Text } from 'react-native';
import { Button, List, ListItem, Sheet } from '../ui';
import { useTheme } from '../theme/ThemeProvider';
import { PermKind, PermStatus, openSystemSettings, requestPermission } from '../services/permissionsService';
import usePermissionStatuses, { PERM_KINDS } from '../screens/garage/parts/usePermissionStatuses';

export interface PermsSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Called after a permission was requested, so the caller can refresh what it shows. */
  onChanged?: () => void;
}

const ROWS: Record<PermKind, { title: string; off: string }> = {
  location: { title: 'Location', off: 'Not allowed' },
  notifications: { title: 'Notifications', off: 'Not allowed' },
  microphone: { title: 'Microphone', off: 'Off · optional' },
};

export function permissionLabel(kind: PermKind, status: PermStatus | undefined): string {
  if (status === 'granted') return 'Allowed';
  return ROWS[kind].off;
}

export default function PermsSheet({ visible, onClose, onChanged }: PermsSheetProps) {
  const { type } = useTheme();
  const { statuses, refresh } = usePermissionStatuses(visible);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const request = useCallback(
    async (kind: PermKind) => {
      try {
        await requestPermission(kind, kind === 'location' ? { always: true } : undefined);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('[PermsSheet] request failed:', e);
      }
      if (!alive.current) return;
      await refresh();
      onChanged?.();
    },
    [refresh, onChanged],
  );

  const openSettings = useCallback(async () => {
    try {
      await openSystemSettings();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[PermsSheet] could not open settings:', e);
    }
    onClose();
  }, [onClose]);

  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-Perms" accessibilityLabel="Permissions">
      <Text style={type.h2} accessibilityRole="header">Permissions</Text>
      <List style={{ marginTop: 16 }}>
        {PERM_KINDS.map((kind, i) => {
          const status = statuses[kind];
          const granted = status === 'granted';
          const askable = status === 'undetermined';
          const label = permissionLabel(kind, status);
          return (
            <ListItem
              key={kind}
              first={i === 0}
              icon={granted ? 'check' : 'warn'}
              accentIcon={granted}
              title={ROWS[kind].title}
              subtitle={askable ? `${label} · tap to allow` : label}
              onPress={askable ? () => request(kind) : undefined}
              accessibilityLabel={`${ROWS[kind].title}. ${label}${askable ? '. Double tap to allow' : ''}`}
              testID={`perm-${kind}`}
            />
          );
        })}
      </List>
      <Button label="Open system settings" variant="soft" onPress={openSettings} style={{ marginTop: 16 }} testID="perm-open-settings" />
    </Sheet>
  );
}
