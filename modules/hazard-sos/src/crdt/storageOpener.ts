/**
 * Storage injection point for the SOS/hazard persistence (offline queue and per-group SOS OR-Set).
 *
 * This package cannot depend on the app, so the app registers its encrypted-MMKV opener here at start-up
 * (app/src/SecureRoot.tsx -> setStorageOpener(getEncryptedMMKV)) and the SOS data (positions, rider ids) is then
 * encrypted at rest. With no opener registered, or if the opener throws, the plain MMKV constructor is used: an SOS must
 * never fail to persist because encryption is unavailable (zero-data-loss invariant).
 */
export type StorageOpener = (id: string) => any;

let opener: StorageOpener | null = null;

export function setStorageOpener(fn: StorageOpener | null): void {
  opener = fn;
}

export function openStorage(id: string, plain: StorageOpener): any {
  if (opener) {
    try {
      return opener(id);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[hazard-sos] secure storage opener failed, using plain MMKV:', e);
    }
  }
  return plain(id);
}
