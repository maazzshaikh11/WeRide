/**
 * Encrypted MMKV for everything sensitive that WeRide caches on the phone: emergency contacts, the last known
 * position, the in-progress GPS recording, ride logs waiting to upload, the offline SOS/hazard queues.
 *
 * How it works
 *  - A random MMKV key is created once and kept in the platform keystore through react-native-keychain
 *    (Android Keystore-backed storage / iOS Keychain, "after first unlock, this device only" so SOS and the ride
 *    recorder still work with the phone locked in a pocket and the key never leaves the device or its backups).
 *  - MMKV encrypts with AES-128 and caps `encryptionKey` at 16 bytes. The key is therefore 16 characters drawn
 *    uniformly from a 64-symbol alphabet using the platform CSPRNG (crypto.getRandomValues via
 *    react-native-get-random-values): 96 bits of entropy. (MMKV offers no longer key.)
 *  - The key is read ONCE at start-up (`initSecureStorage()`, awaited by SecureRoot before the app tree and its stores
 *    are loaded) and cached in memory, so `getEncryptedMMKV(id)` stays synchronous like the stores expect.
 *
 * Migration (per instance id, once per process)
 *  - Encrypted data lives in a NEW MMKV file `<id>.enc`. The old unencrypted `<id>` instance is opened, every key is copied
 *    into the encrypted one, and the old instance is then wiped. If anything fails part-way the old data is left in place
 *    and the copy is retried on the next launch. Data found in the old instance always wins over the encrypted copy
 *    (it can only be there when the previous launch had to fall back to plain storage, i.e. it is the newer data).
 *
 * Fallback (keystore unavailable, key not loaded yet, or the key cannot be persisted)
 *  - We log ONE warning and keep working with the legacy unencrypted instance. We never invent a key that is not
 *    persisted (that would make the data unreadable after a restart) and we never throw: a ride recording or an SOS
 *    must not be lost because the keystore misbehaved. On the next launch where the keystore works, the plain data is
 *    migrated by the rules above.
 *  - Known limit: if the keystore key is lost while `<id>.enc` files remain (e.g. app data restored without the
 *    keystore, which allowBackup=false prevents), MMKV discards what it cannot decrypt. Every store here is a cache of
 *    server data or a short-lived buffer.
 */
import { MMKV } from 'react-native-mmkv';
import * as Keychain from 'react-native-keychain';
import { warn } from '../utils/log';

export const KEYCHAIN_SERVICE = 'com.weride.mmkv-encryption-key';
const KEYCHAIN_USERNAME = 'mmkv';
export const KEY_LENGTH = 16; // MMKV maximum
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'; // 64 symbols: 6 bits each, no modulo bias

export type SecureStorageStatus = 'uninitialised' | 'ready' | 'unavailable';

let key: string | null = null;
let status: SecureStorageStatus = 'uninitialised';
let initPromise: Promise<void> | null = null;
let warnedFallback = false;
const instances = new Map<string, MMKV>();

function randomBytes(n: number): Uint8Array {
  const c = (globalThis as { crypto?: { getRandomValues?: <T extends Uint8Array>(a: T) => T } }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') throw new Error('no secure random source (crypto.getRandomValues)');
  return c.getRandomValues(new Uint8Array(n));
}

/** 16 characters, uniformly random, from a CSPRNG. Never Math.random. */
export function generateEncryptionKey(): string {
  const bytes = randomBytes(KEY_LENGTH);
  let out = '';
  for (let i = 0; i < KEY_LENGTH; i++) out += ALPHABET[bytes[i] & 63];
  return out;
}

function isValidKey(k: unknown): k is string {
  return typeof k === 'string' && k.length === KEY_LENGTH && [...k].every((ch) => ALPHABET.includes(ch));
}

async function loadOrCreateKey(): Promise<string | null> {
  const existing = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  if (existing && isValidKey(existing.password)) return existing.password;
  if (existing) warn('[secureStorage] stored key is malformed; creating a new one');

  const fresh = generateEncryptionKey();
  const saved = await Keychain.setGenericPassword(KEYCHAIN_USERNAME, fresh, {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (!saved) return null;
  // Only trust a key we can read back: otherwise the data we encrypt with it would be unreadable after a restart.
  const back = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  return back && back.password === fresh ? fresh : null;
}

/**
 * Loads (or creates) the encryption key. Idempotent, never throws, never rejects. Await it before anything that
 * calls `getEncryptedMMKV` (SecureRoot does so before loading the app).
 */
export function initSecureStorage(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        key = await loadOrCreateKey();
        status = key ? 'ready' : 'unavailable';
        if (!key) warn('[secureStorage] keystore did not persist the encryption key; cached data stays UNENCRYPTED this session');
      } catch (e) {
        key = null;
        status = 'unavailable';
        warn('[secureStorage] keystore unavailable; cached data stays UNENCRYPTED this session:', e);
      }
    })();
  }
  return initPromise;
}

export function getSecureStorageStatus(): SecureStorageStatus {
  return status;
}

/** Copies every entry of the old plain instance into `enc`, then wipes the old one. Leaves the old data on any failure. */
function migrateLegacy(id: string, enc: MMKV): void {
  let legacy: MMKV;
  try {
    legacy = new MMKV({ id });
  } catch {
    return;
  }
  try {
    const keys = legacy.getAllKeys();
    if (!keys || keys.length === 0) return;
    for (const k of keys) {
      const s = legacy.getString(k);
      if (s !== undefined) {
        enc.set(k, s);
        if (enc.getString(k) !== s) throw new Error(`verify failed for ${k}`);
        continue;
      }
      const buf = legacy.getBuffer?.(k);
      if (buf) {
        enc.set(k, buf);
        continue;
      }
      const num = legacy.getNumber?.(k);
      if (num !== undefined && num !== 0) {
        enc.set(k, num);
        continue;
      }
      if (legacy.getBoolean?.(k)) enc.set(k, true);
    }
    legacy.clearAll(); // all copied and verified: wipe the plaintext
  } catch (e) {
    warn(`[secureStorage] migration of "${id}" incomplete; old data kept, will retry next launch:`, e);
  }
}

/**
 * The encrypted MMKV for `id` (created and migrated on first call, then cached). Falls back to the plain instance
 * with a warning when the keystore is not available; see the file header. Throws only if MMKV itself cannot open.
 */
export function getEncryptedMMKV(id: string): MMKV {
  const cached = instances.get(id);
  if (cached) return cached;

  let inst: MMKV | null = null;
  if (key) {
    try {
      inst = new MMKV({ id: `${id}.enc`, encryptionKey: key });
      migrateLegacy(id, inst);
    } catch (e) {
      warn(`[secureStorage] could not open encrypted "${id}"; using plain storage:`, e);
      inst = null;
    }
  } else if (!warnedFallback) {
    warnedFallback = true;
    warn(`[secureStorage] no encryption key (${status}); "${id}" and other caches use plain storage`);
  }
  if (!inst) inst = new MMKV({ id });
  instances.set(id, inst);
  return inst;
}

/** Test hook: forget the key, status and cached instances. */
export function __resetSecureStorageForTests(): void {
  key = null;
  status = 'uninitialised';
  initPromise = null;
  warnedFallback = false;
  instances.clear();
}
