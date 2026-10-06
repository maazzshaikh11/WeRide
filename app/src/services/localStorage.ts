/**
 * Shared local storage service. Uses react-native-mmkv (per §2 tech stack), encrypted at rest via services/secureStorage.
 * Replaces Hive. Three MMKV instances:
 *   - 'sos_queue'      → Person B (CRDT queue)
 *   - 'hazard_queue'   → Person B (offline hazard reports)
 *   - 'fl_data'        → Person D (local FL training data)
 */
import type { MMKV } from 'react-native-mmkv';
import { getEncryptedMMKV } from './secureStorage';

let sosQueue: MMKV;
let hazardQueue: MMKV;
let flData: MMKV;

export async function initStorage(): Promise<void> {
  sosQueue = getEncryptedMMKV('sos_queue');
  hazardQueue = getEncryptedMMKV('hazard_queue');
  flData = getEncryptedMMKV('fl_data');
}

export function getSosQueue(): MMKV {
  return sosQueue;
}

export function getHazardQueue(): MMKV {
  return hazardQueue;
}

export function getFlData(): MMKV {
  return flData;
}