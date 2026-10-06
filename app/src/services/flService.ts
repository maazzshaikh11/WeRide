/**
 * Federated-learning glue for the app: the consent gate and the real status line.
 *
 * Participation is opt-in per rider ("Improve ETAs for everyone", Me > Privacy = prefs.learn). Every FL client is
 * built through `createFlClient`, which binds that setting, so turning it off stops training and uploads
 * immediately, mid-session included.
 */
import { FlClient, FlClientParams } from '@flvoice/fl/flClient';
import { FlRoundLogger } from '@flvoice/fl/flRoundLogger';
import { usePrefsStore } from '../store/prefsStore';
import { getFlData } from './localStorage';

/** The rider's current choice. */
export function flParticipationEnabled(): boolean {
  return usePrefsStore.getState().prefs.learn === true;
}

/** An FL client that only trains/uploads while the rider has "Improve ETAs for everyone" on. */
export function createFlClient(params: Omit<FlClientParams, 'isEnabled'>): FlClient {
  return new FlClient({ ...params, isEnabled: flParticipationEnabled });
}

/**
 * "FL round N done · M clients" from the rounds this phone logged, or null if there is none (or storage is not
 * ready). Never invented: no round logged means no line.
 */
export function flStatusLine(): string | null {
  try {
    const latest = new FlRoundLogger(getFlData()).latestRound();
    return latest ? `FL round ${latest.roundId} done · ${latest.participants} clients` : null;
  } catch {
    return null;
  }
}
