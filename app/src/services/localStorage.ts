/**
 * Shared local storage service. Uses react-native-mmkv (per §2 tech stack).
 * Replaces Hive. Three MMKV instances:
 *   - 'sos_queue'      → Person B (CRDT queue)
 *   - 'hazard_queue'   → Person B (offline hazard reports)
 *   - 'fl_data'        → Person D (local FL training data)
 */
import { MMKV } from 'react-native-mmkv';

let sosQueue: MMKV;
let hazardQueue: MMKV;
let flData: MMKV;

export async function initStorage(): Promise<void> {
  sosQueue = new MMKV({ id: 'sos_queue' });
  hazardQueue = new MMKV({ id: 'hazard_queue' });
  flData = new MMKV({ id: 'fl_data' });
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