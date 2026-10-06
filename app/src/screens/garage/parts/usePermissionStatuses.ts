/**
 * Live OS permission statuses for Me > Permissions. Re-reads on mount, when the app returns to the foreground
 * (after the rider changed something in system settings) and on demand.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { PermKind, PermStatus, getPermissionStatus } from '../../../services/permissionsService';

export const PERM_KINDS: readonly PermKind[] = ['location', 'notifications', 'microphone'];
export type PermStatuses = Partial<Record<PermKind, PermStatus>>;

export default function usePermissionStatuses(active = true): { statuses: PermStatuses; loaded: boolean; refresh: () => Promise<void> } {
  const [statuses, setStatuses] = useState<PermStatuses>({});
  const [loaded, setLoaded] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    const entries = await Promise.all(
      PERM_KINDS.map(async (k) => {
        try {
          return [k, await getPermissionStatus(k)] as const;
        } catch {
          return [k, 'undetermined'] as const;
        }
      }),
    );
    if (!alive.current) return;
    setStatuses(Object.fromEntries(entries) as PermStatuses);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!active) return undefined;
    refresh();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => sub.remove();
  }, [active, refresh]);

  return { statuses, loaded, refresh };
}
