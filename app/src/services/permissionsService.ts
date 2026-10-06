/**
 * OS permissions (OWNER: package A — first launch).
 * Android: PermissionsAndroid (FINE+COARSE then BACKGROUND for "always", POST_NOTIFICATIONS on API 33+, RECORD_AUDIO).
 * iOS: location via react-native-geolocation-service (`requestAuthorization`), notifications via
 * @react-native-firebase/messaging, microphone via react-native-webrtc `getUserMedia`.
 *
 * Neither platform lets an app read "denied, don't ask again" without asking, so `blocked` is remembered for
 * the session when a request returns it; the screens always re-check on mount / when the app returns to the front.
 */
import { Linking, PermissionsAndroid, Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';

export type PermKind = 'location' | 'notifications' | 'microphone';
/** 'blocked' = denied with "don't ask again" (only Settings can fix it). */
export type PermStatus = 'granted' | 'denied' | 'blocked' | 'undetermined';

type AndroidPerm = (typeof PermissionsAndroid.PERMISSIONS)[keyof typeof PermissionsAndroid.PERMISSIONS];
const P = PermissionsAndroid.PERMISSIONS;
const POST_NOTIFICATIONS = (P.POST_NOTIFICATIONS ?? 'android.permission.POST_NOTIFICATIONS') as AndroidPerm;
const BACKGROUND_LOCATION = (P.ACCESS_BACKGROUND_LOCATION ?? 'android.permission.ACCESS_BACKGROUND_LOCATION') as AndroidPerm;

const isAndroid = () => Platform.OS === 'android';
const apiLevel = () => (typeof Platform.Version === 'number' ? Platform.Version : parseInt(String(Platform.Version), 10) || 0);

/** What we learned from earlier requests this session (OS check APIs cannot tell denied from never-asked). */
const remembered: Partial<Record<PermKind, PermStatus>> = {};
/** iOS has no read-only microphone check; remember a grant for the session. */
let iosMicGranted = false;

function fromAndroidResult(r: string | undefined): PermStatus {
  if (r === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (r === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

async function androidHas(perm: AndroidPerm): Promise<boolean> {
  try {
    return await PermissionsAndroid.check(perm);
  } catch {
    return false;
  }
}

function fromIosAuthorization(s: number): PermStatus {
  // messaging.AuthorizationStatus: NOT_DETERMINED -1, DENIED 0, AUTHORIZED 1, PROVISIONAL 2, EPHEMERAL 3
  if (s === 1 || s === 2 || s === 3) return 'granted';
  if (s === 0) return 'blocked';
  return 'undetermined';
}

function fromIosLocation(s: string | undefined): PermStatus {
  if (s === 'granted') return 'granted';
  if (s === 'denied' || s === 'restricted' || s === 'disabled') return 'blocked';
  return 'undetermined';
}

/** iOS location status without prompting: the background-geolocation provider state, when that module is present. */
async function iosLocationStatus(): Promise<PermStatus> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module, loaded lazily
    const mod = require('react-native-background-geolocation');
    const bg = mod?.default ?? mod;
    const state = await bg?.getProviderState?.();
    const status = state?.status;
    if (status === 3 || status === 4) return 'granted'; // always / when in use
    if (status === 1 || status === 2) return 'blocked'; // restricted / denied
  } catch {
    // module absent: fall through
  }
  return remembered.location ?? 'undetermined';
}

export async function getPermissionStatus(kind: PermKind): Promise<PermStatus> {
  if (isAndroid()) {
    if (kind === 'location') {
      const ok = (await androidHas(P.ACCESS_FINE_LOCATION)) || (await androidHas(P.ACCESS_COARSE_LOCATION));
      return ok ? 'granted' : remembered.location ?? 'undetermined';
    }
    if (kind === 'notifications') {
      if (apiLevel() < 33) return 'granted'; // no runtime permission before Android 13
      return (await androidHas(POST_NOTIFICATIONS)) ? 'granted' : remembered.notifications ?? 'undetermined';
    }
    return (await androidHas(P.RECORD_AUDIO)) ? 'granted' : remembered.microphone ?? 'undetermined';
  }
  if (kind === 'location') return iosLocationStatus();
  if (kind === 'notifications') {
    try {
      return fromIosAuthorization(Number(await messaging().hasPermission()));
    } catch {
      return 'undetermined';
    }
  }
  return iosMicGranted ? 'granted' : remembered.microphone ?? 'undetermined';
}

/** Android: is background ("Allow all the time") location granted? Always true before Android 10. */
async function androidHasBackground(): Promise<boolean> {
  if (apiLevel() < 29) return true;
  return androidHas(BACKGROUND_LOCATION);
}

/**
 * True when the rider granted "Always" location (background). Android < 10 has no separate grant. On iOS the
 * background-geolocation provider state is the only read-only source; without it this is false.
 */
export async function hasAlwaysLocation(): Promise<boolean> {
  if (isAndroid()) return (await androidHas(P.ACCESS_FINE_LOCATION)) && (await androidHasBackground());
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- optional native module, loaded lazily
    const mod = require('react-native-background-geolocation');
    const bg = mod?.default ?? mod;
    const state = await bg?.getProviderState?.();
    return state?.status === 3;
  } catch {
    return false;
  }
}

async function requestAndroid(kind: PermKind, always: boolean): Promise<PermStatus> {
  if (kind === 'location') {
    const res = await PermissionsAndroid.requestMultiple([P.ACCESS_FINE_LOCATION, P.ACCESS_COARSE_LOCATION]);
    const fine = fromAndroidResult(res[P.ACCESS_FINE_LOCATION]);
    const coarse = fromAndroidResult(res[P.ACCESS_COARSE_LOCATION]);
    const status: PermStatus = fine === 'granted' || coarse === 'granted' ? 'granted' : fine === 'blocked' || coarse === 'blocked' ? 'blocked' : 'denied';
    if (status === 'granted' && always && apiLevel() >= 29 && !(await androidHas(BACKGROUND_LOCATION))) {
      // Android 11+ shows no dialog for this: it opens the Settings location page. The foreground grant stays either way.
      try {
        await PermissionsAndroid.request(BACKGROUND_LOCATION);
      } catch {
        // background stays off; foreground tracking still works
      }
    }
    return status;
  }
  if (kind === 'notifications') {
    if (apiLevel() < 33) return 'granted';
    return fromAndroidResult(await PermissionsAndroid.request(POST_NOTIFICATIONS));
  }
  return fromAndroidResult(await PermissionsAndroid.request(P.RECORD_AUDIO));
}

async function requestIos(kind: PermKind, always: boolean): Promise<PermStatus> {
  if (kind === 'location') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- the package ships no types
    const mod = require('react-native-geolocation-service');
    const Geolocation = mod?.default ?? mod;
    const r = await Geolocation.requestAuthorization(always ? 'always' : 'whenInUse');
    return fromIosLocation(r as string);
  }
  if (kind === 'notifications') {
    return fromIosAuthorization(Number(await messaging().requestPermission()));
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- native module, loaded only when asked
    const { mediaDevices } = require('react-native-webrtc');
    const stream = await mediaDevices.getUserMedia({ audio: true });
    stream?.getTracks?.().forEach((t: { stop: () => void }) => t.stop());
    iosMicGranted = true;
    return 'granted';
  } catch {
    // iOS never asks twice: a refusal is final until the rider changes it in Settings.
    return 'blocked';
  }
}

/** `always` asks for background ("Always") location where the platform distinguishes it. */
export async function requestPermission(kind: PermKind, opts?: { always?: boolean }): Promise<PermStatus> {
  const always = Boolean(opts?.always);
  let status: PermStatus;
  try {
    status = isAndroid() ? await requestAndroid(kind, always) : await requestIos(kind, always);
  } catch {
    status = 'denied';
  }
  if (status === 'granted') delete remembered[kind];
  else remembered[kind] = status;
  return status;
}

export async function openSystemSettings(): Promise<void> {
  try {
    await Linking.openSettings();
  } catch {
    // nothing sensible to do if the OS refuses
  }
}

/** Test hook: forget what earlier requests taught us. */
export function __resetPermissionMemory(): void {
  delete remembered.location;
  delete remembered.notifications;
  delete remembered.microphone;
  iosMicGranted = false;
}
