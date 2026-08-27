/**
 * Google Maps deep-link generation.
 * Hand-off to native turn-by-turn navigation via intent URL.
 * Reference: https://developers.google.com/maps/documentation/urls/get-started
 */

export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * Generate a Google Maps deep-link URL for the given origin and destination.
 * Format: https://www.google.com/maps/dir/?api=1&origin=lat,lng&destination=lat,lng&travelmode=driving
 *
 * @param origin Starting point { lat, lng }
 * @param destination Ending point { lat, lng }
 * @returns URL string suitable for Linking.openURL()
 */
export function googleMapsDeepLink(origin: Coordinate, destination: Coordinate): string {
  const originStr = `${origin.lat},${origin.lng}`;
  const destStr = `${destination.lat},${destination.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${originStr}&destination=${destStr}&travelmode=driving`;
}
