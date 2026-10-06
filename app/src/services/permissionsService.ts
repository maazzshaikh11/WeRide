/**
 * OS permissions (OWNER: package A — first launch). API fixed by docs/DEMO_PARITY_SPEC.md; body is a stub until A implements it.
 * Android: PermissionsAndroid. iOS: location via geolocation-service, notifications via firebase-messaging,
 * microphone via the WebRTC permission helper.
 */
export type PermKind = 'location' | 'notifications' | 'microphone';
/** 'blocked' = denied with "don't ask again" (only Settings can fix it). */
export type PermStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';

export async function getPermissionStatus(_kind: PermKind): Promise<PermStatus> {
  return 'undetermined';
}
/** `always` asks for background ("Always") location where the platform distinguishes it. */
export async function requestPermission(_kind: PermKind, _opts?: { always?: boolean }): Promise<PermStatus> {
  return 'undetermined';
}
export async function openSystemSettings(): Promise<void> {
  return undefined;
}
