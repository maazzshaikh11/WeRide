/**
 * Mock SOS Event Producer (Phase 1).
 * Generates mock sos_event matching contracts/sos_event.json.
 * For development/testing only. Real implementation comes in later phases.
 */

import { HLC } from '../hlc/hlc';

/**
 * Generate a mock sos_event matching the exact contract schema.
 * Pure function - no Firebase dependency. Tests use this directly.
 * @param riderId - The rider who triggered the SOS
 * @param groupId - The group ID
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @returns Generated SOS event object
 */
export function generateMockSosEvent(
  riderId: string,
  groupId: string,
  lat: number,
  lng: number
) {
  const hlc = HLC.fresh();
  
  // Generate unique sos_id
  const sosId = `mock_sos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const sosEvent = {
    sos_id: sosId,
    rider_id: riderId,
    group_id: groupId,
    lat: lat,
    lng: lng,
    created_at_hlc: hlc.now(),
    resolved: false,
    resolved_at_hlc: null,
  };
  
  return sosEvent;
}

/**
 * Write a mock SOS event to Firestore (Phase 2+).
 * Requires Firebase to be initialized - imported dynamically only when needed.
 * @param riderId - The rider who triggered the SOS
 * @param groupId - The group ID
 * @param lat - Latitude coordinate
 * @param lng - Longitude coordinate
 * @returns Promise that resolves with the generated SOS event
 */
export async function writeMockSosEvent(
  riderId: string,
  groupId: string,
  lat: number,
  lng: number
): Promise<ReturnType<typeof generateMockSosEvent>> {
  // Lazy-load Firebase only when writing (not for pure mock data generation)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const firestore = require('@react-native-firebase/firestore').default;
  
  const sosEvent = generateMockSosEvent(riderId, groupId, lat, lng);
  const db = firestore();
  
  // Write to Firestore sos_events/{sos_id} per contract transport
  await db.collection('sos_events').doc(sosEvent.sos_id).set(sosEvent);
  
  console.log(`[MockSosService] Generated mock SOS event: ${sosEvent.sos_id} for rider ${riderId}`);
  
  return sosEvent;
}
