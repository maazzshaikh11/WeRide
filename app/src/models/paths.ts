/** Firestore paths (docs/DEMO_PARITY_SPEC.md §2). One place, so a rename is one edit. */
export const P = {
  user: (uid: string) => `users/${uid}`,
  settings: (uid: string) => `users/${uid}/private/settings`,
  rideLogs: (uid: string) => `users/${uid}/ride_logs`,
  rideLog: (uid: string, rideId: string) => `users/${uid}/ride_logs/${rideId}`,
  crews: 'crews',
  crew: (id: string) => `crews/${id}`,
  rides: 'groups',
  ride: (id: string) => `groups/${id}`,
  rsvp: (rideId: string) => `groups/${rideId}/rsvp`,
  rollCall: (rideId: string) => `groups/${rideId}/roll_call`,
  presence: (rideId: string) => `groups/${rideId}/presence`,
  locations: (rideId: string) => `groups/${rideId}/locations`,
  hazards: 'hazards',
  sos: 'sos_events',
  responders: (sosId: string) => `sos_events/${sosId}/responders`,
} as const;
