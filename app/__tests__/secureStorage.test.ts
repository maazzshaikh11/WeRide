/**
 * services/secureStorage: key creation/persistence, encrypted instances, legacy migration and the fallback when the
 * keystore is unavailable. MMKV and the Keychain are replaced with small stateful fakes.
 */
jest.unmock('../src/services/secureStorage');

type Files = Map<string, Map<string, string>>;
const mockFiles: Files = new Map();
const mockOpened: { id: string; encryptionKey?: string }[] = [];
let mockFailOpenEncrypted = false;
let mockCorruptWrites = false;

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(({ id, encryptionKey }: { id: string; encryptionKey?: string }) => {
    if (encryptionKey && mockFailOpenEncrypted) throw new Error('mmkv open failed');
    mockOpened.push({ id, encryptionKey });
    if (!mockFiles.has(id)) mockFiles.set(id, new Map());
    const m = mockFiles.get(id)!;
    return {
      id,
      encryptionKey,
      getString: (k: string) => m.get(k),
      set: (k: string, v: string) => {
        m.set(k, mockCorruptWrites && encryptionKey ? `${v}-corrupt` : v);
      },
      delete: (k: string) => m.delete(k),
      getAllKeys: () => [...m.keys()],
      clearAll: () => m.clear(),
      trim: jest.fn(),
    };
  }),
}));

let mockKeychainStore: { username: string; password: string } | null = null;
const mockKeychain = {
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly' },
  getGenericPassword: jest.fn(async () => mockKeychainStore),
  setGenericPassword: jest.fn(async (username: string, password: string) => {
    mockKeychainStore = { username, password };
    return { service: 's', storage: 'x' };
  }),
};
// Lazy wrappers: the (hoisted) import of the service runs before mockKeychain is initialised.
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AccessibleAfterFirstUnlockThisDeviceOnly' },
  getGenericPassword: (...a: unknown[]) => (mockKeychain.getGenericPassword as (...x: unknown[]) => unknown)(...a),
  setGenericPassword: (...a: unknown[]) => (mockKeychain.setGenericPassword as (...x: unknown[]) => unknown)(...a),
}));

import * as secure from '../src/services/secureStorage';

let warn: jest.SpyInstance;
beforeEach(() => {
  mockFiles.clear();
  mockOpened.length = 0;
  mockFailOpenEncrypted = false;
  mockCorruptWrites = false;
  mockKeychainStore = null;
  mockKeychain.getGenericPassword.mockImplementation(async () => mockKeychainStore);
  mockKeychain.setGenericPassword.mockImplementation(async (username: string, password: string) => {
    mockKeychainStore = { username, password };
    return { service: 's', storage: 'x' };
  });
  jest.clearAllMocks();
  secure.__resetSecureStorageForTests();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => warn.mockRestore());

describe('generateEncryptionKey', () => {
  it('is 16 chars (the MMKV maximum), URL-safe, different every time, from crypto.getRandomValues', () => {
    const spy = jest.spyOn(globalThis.crypto, 'getRandomValues');
    const rand = jest.spyOn(Math, 'random');
    const a = secure.generateEncryptionKey();
    const b = secure.generateEncryptionKey();
    expect(a).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(a).not.toBe(b);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(rand).not.toHaveBeenCalled();
    spy.mockRestore();
    rand.mockRestore();
  });

  it('refuses to fall back to a weak generator when there is no CSPRNG', () => {
    const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      expect(() => secure.generateEncryptionKey()).toThrow(/secure random/);
    } finally {
      if (real) Object.defineProperty(globalThis, 'crypto', real);
    }
  });
});

describe('initSecureStorage', () => {
  it('creates the key once, stores it device-only after first unlock, and reuses it on the next launch', async () => {
    await secure.initSecureStorage();
    expect(secure.getSecureStorageStatus()).toBe('ready');
    expect(mockKeychain.setGenericPassword).toHaveBeenCalledTimes(1);
    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
      'mmkv',
      expect.stringMatching(/^[A-Za-z0-9_-]{16}$/),
      expect.objectContaining({ service: secure.KEYCHAIN_SERVICE, accessible: 'AccessibleAfterFirstUnlockThisDeviceOnly' }),
    );
    const firstKey = mockKeychainStore!.password;
    secure.getEncryptedMMKV('weride_prefs');
    expect(mockOpened.find((o) => o.id === 'weride_prefs.enc')!.encryptionKey).toBe(firstKey);

    // "restart"
    secure.__resetSecureStorageForTests();
    mockOpened.length = 0;
    mockKeychain.setGenericPassword.mockClear();
    await secure.initSecureStorage();
    secure.getEncryptedMMKV('weride_prefs');
    expect(mockKeychain.setGenericPassword).not.toHaveBeenCalled();
    expect(mockOpened.find((o) => o.id === 'weride_prefs.enc')!.encryptionKey).toBe(firstKey);
  });

  it('is idempotent and never rejects', async () => {
    await Promise.all([secure.initSecureStorage(), secure.initSecureStorage()]);
    expect(mockKeychain.setGenericPassword).toHaveBeenCalledTimes(1);
    mockKeychain.getGenericPassword.mockRejectedValue(new Error('keystore locked'));
    secure.__resetSecureStorageForTests();
    await expect(secure.initSecureStorage()).resolves.toBeUndefined();
  });

  it('replaces a malformed stored key', async () => {
    mockKeychainStore = { username: 'mmkv', password: 'short' };
    await secure.initSecureStorage();
    expect(secure.getSecureStorageStatus()).toBe('ready');
    expect(mockKeychainStore!.password).toMatch(/^[A-Za-z0-9_-]{16}$/);
  });
});

describe('getEncryptedMMKV', () => {
  it('opens <id>.enc with the key and caches the instance per id', async () => {
    await secure.initSecureStorage();
    const a = secure.getEncryptedMMKV('weride_prefs');
    expect(secure.getEncryptedMMKV('weride_prefs')).toBe(a);
    expect(mockOpened.filter((o) => o.id === 'weride_prefs.enc')).toHaveLength(1);
    a.set('settings.v1', '{"contacts":[]}');
    expect(mockFiles.get('weride_prefs.enc')!.get('settings.v1')).toBe('{"contacts":[]}');
    expect(mockFiles.get('weride_prefs')?.size ?? 0).toBe(0); // nothing sensitive in the plain file
  });

  it('migrates the old unencrypted instance once: copies, verifies, then wipes it', async () => {
    mockFiles.set('weride_prefs', new Map([['settings.v1', '{"contacts":[{"number":"+919800000000"}]}'], ['theme.lastfix', '{"lat":1,"lng":2}']]));
    await secure.initSecureStorage();
    const enc = secure.getEncryptedMMKV('weride_prefs');
    expect(enc.getString('settings.v1')).toBe('{"contacts":[{"number":"+919800000000"}]}');
    expect(enc.getString('theme.lastfix')).toBe('{"lat":1,"lng":2}');
    expect(mockFiles.get('weride_prefs')!.size).toBe(0); // plaintext gone
    // another restart finds nothing to migrate and keeps the encrypted data
    secure.__resetSecureStorageForTests();
    await secure.initSecureStorage();
    expect(secure.getEncryptedMMKV('weride_prefs').getString('settings.v1')).toContain('+919800000000');
  });

  it('keeps the old data (and works) when the copy cannot be verified, then retries on the next launch', async () => {
    mockFiles.set('ride_recorder', new Map([['recording.v1', '{"track":[1,2,3]}']]));
    await secure.initSecureStorage();
    mockCorruptWrites = true;
    secure.getEncryptedMMKV('ride_recorder');
    expect(mockFiles.get('ride_recorder')!.get('recording.v1')).toBe('{"track":[1,2,3]}'); // not wiped
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('migration of "ride_recorder" incomplete'), expect.anything());

    secure.__resetSecureStorageForTests();
    mockCorruptWrites = false;
    await secure.initSecureStorage();
    expect(secure.getEncryptedMMKV('ride_recorder').getString('recording.v1')).toBe('{"track":[1,2,3]}');
    expect(mockFiles.get('ride_recorder')!.size).toBe(0);
  });

  it('falls back to the plain instance if the encrypted one cannot be opened', async () => {
    await secure.initSecureStorage();
    mockFailOpenEncrypted = true;
    const m = secure.getEncryptedMMKV('weride_pending_logs');
    m.set('pending.v1', '[]');
    expect(mockFiles.get('weride_pending_logs')!.get('pending.v1')).toBe('[]');
    expect(warn).toHaveBeenCalled();
  });
});

describe('fallback when the keystore is unavailable', () => {
  it('keystore throws: init resolves, one warning, plain storage keeps working and keeps the data', async () => {
    mockKeychain.getGenericPassword.mockRejectedValue(new Error('KeyStoreException'));
    await secure.initSecureStorage();
    expect(secure.getSecureStorageStatus()).toBe('unavailable');
    const a = secure.getEncryptedMMKV('ride_recorder');
    const b = secure.getEncryptedMMKV('weride_prefs');
    a.set('recording.v1', 'in-progress ride');
    b.set('settings.v1', 'x');
    expect(mockOpened.every((o) => o.encryptionKey === undefined)).toBe(true);
    expect(mockFiles.get('ride_recorder')!.get('recording.v1')).toBe('in-progress ride');
    const unencryptedWarnings = warn.mock.calls.filter((c) => String(c[0]).includes('UNENCRYPTED'));
    expect(unencryptedWarnings).toHaveLength(1);
  });

  it('a key that cannot be saved or read back is never used (data would be unreadable after restart)', async () => {
    mockKeychain.setGenericPassword.mockResolvedValue(false as never);
    await secure.initSecureStorage();
    expect(secure.getSecureStorageStatus()).toBe('unavailable');

    secure.__resetSecureStorageForTests();
    mockKeychain.setGenericPassword.mockImplementation(async () => ({ service: 's', storage: 'x' })); // claims success, stores nothing
    await secure.initSecureStorage();
    expect(secure.getSecureStorageStatus()).toBe('unavailable');
    expect(secure.getEncryptedMMKV('weride_prefs')).toMatchObject({ id: 'weride_prefs', encryptionKey: undefined });
  });

  it('asking before init does not crash: plain instance and a single warning', () => {
    const m = secure.getEncryptedMMKV('weride_prefs');
    expect(m).toMatchObject({ id: 'weride_prefs' });
    secure.getEncryptedMMKV('other');
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('no encryption key'))).toHaveLength(1);
  });

  it('data written in plain fallback is migrated into the encrypted store once the keystore works again', async () => {
    mockKeychain.getGenericPassword.mockRejectedValueOnce(new Error('locked'));
    await secure.initSecureStorage();
    secure.getEncryptedMMKV('ride_recorder').set('recording.v1', 'written during fallback');

    secure.__resetSecureStorageForTests(); // next launch, keystore fine
    await secure.initSecureStorage();
    expect(secure.getSecureStorageStatus()).toBe('ready');
    expect(secure.getEncryptedMMKV('ride_recorder').getString('recording.v1')).toBe('written during fallback');
    expect(mockFiles.get('ride_recorder')!.size).toBe(0);
  });
});
