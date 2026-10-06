/** A navigation handle usable outside screens (root-level bridges, overlays). */
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export function navigateRoot<K extends keyof RootStackParamList>(name: K, params?: RootStackParamList[K]): void {
  if (!navigationRef.isReady()) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the generic overload is awkward to satisfy here
  (navigationRef as any).navigate(name, params);
}

export function resetRoot<K extends keyof RootStackParamList>(name: K, params?: RootStackParamList[K]): void {
  if (!navigationRef.isReady()) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (navigationRef as any).reset({ index: 0, routes: [{ name, params }] });
}
