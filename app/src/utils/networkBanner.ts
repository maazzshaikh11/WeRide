/**
 * Network banner transitions for the live map.
 *
 * The riders store starts as "disconnected" and flips to "connected" a moment
 * after the map mounts. That first connect is NOT a recovery — announcing
 * "active again, position resynced" every time a ride opens is wrong. A banner
 * is only shown once the socket has actually been up and then dropped.
 */
export interface NetworkTracker {
  everConnected: boolean;
  prev: boolean | null;
}

export type BannerState = 'lost' | 'recovered' | null;

export function nextNetworkBanner(
  tracker: NetworkTracker,
  connected: boolean,
): { tracker: NetworkTracker; banner: BannerState } {
  const { everConnected, prev } = tracker;
  let banner: BannerState = null;
  if (prev === true && !connected) banner = 'lost';
  else if (prev === false && connected && everConnected) banner = 'recovered';
  return {
    tracker: { everConnected: everConnected || connected, prev: connected },
    banner,
  };
}
