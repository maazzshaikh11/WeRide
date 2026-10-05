/**
 * Backend base URLs (routing REST + Socket.io live a single Node server).
 *
 * Dev default when ROUTING_URL / SOCKET_URL are unset:
 *  - Android emulator: the host machine is 10.0.2.2 (localhost would be the
 *    emulator itself).
 *  - iOS simulator: shares the host's network, so localhost is correct and
 *    10.0.2.2 is unreachable — the old hardcoded 10.0.2.2 meant the iOS
 *    simulator could never reach the server.
 * Physical devices must set both in app/.env to the machine's LAN address.
 * Values are base URLs: the client appends /route itself.
 */
import { Platform } from 'react-native';
import { ROUTING_URL, SOCKET_URL } from '@env';

export const DEV_PORT = 3000;

export function devBaseUrl(os: string): string {
  return `http://${os === 'android' ? '10.0.2.2' : 'localhost'}:${DEV_PORT}`;
}

export const ROUTING_BASE_URL: string = ROUTING_URL || devBaseUrl(Platform.OS);
export const SOCKET_BASE_URL: string = SOCKET_URL || devBaseUrl(Platform.OS);
