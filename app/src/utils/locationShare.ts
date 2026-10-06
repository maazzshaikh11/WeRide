/** One-time "where I am right now" message for the OS share sheet (a map pin of a verified fix; not a live feed). */
export function locationShareMessage(lat: number, lng: number): string {
  const link = `https://www.google.com/maps/search/?api=1&query=${lat.toFixed(6)},${lng.toFixed(6)}`;
  return `I'm out on a ride with WeRide. My location right now: ${link}`;
}
