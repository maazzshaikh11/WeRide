/**
 * The rider's private settings: preferences, emergency contacts, onboarded flag.
 * Cached on the device (MMKV) so the Road screens and SOS work with no signal, and synced to
 * users/{uid}/private/settings while signed in. Reads are tolerant (see settingsFromDoc).
 */
import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { DEFAULT_SETTINGS, EmergencyContact, Prefs, PrivateSettings } from '../models/domain';
import { normalizeNumber, saveContacts, savePrefs, settingsFromDoc, subscribeSettings, markOnboarded } from '../services/userService';

const KEY = 'settings.v1';
let mmkv: MMKV | null = null;
function disk(): MMKV | null {
  try {
    if (!mmkv) mmkv = new MMKV({ id: 'weride_prefs' });
    return mmkv;
  } catch {
    return null;
  }
}
function readCache(): PrivateSettings {
  try {
    const raw = disk()?.getString(KEY);
    return raw ? settingsFromDoc(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}
function writeCache(s: PrivateSettings): void {
  try {
    disk()?.set(KEY, JSON.stringify(s));
  } catch {
    /* cache is best effort */
  }
}

interface PrefsState extends PrivateSettings {
  /** true once the first Firestore snapshot (or the cache) has been applied for this uid. */
  loaded: boolean;
  uid: string | null;
  watch: (uid: string) => () => void;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => Promise<void>;
  addContact: (name: string, number: string) => Promise<EmergencyContact | null>;
  removeContact: (id: string) => Promise<void>;
  setOnboarded: (on: boolean, phone?: string) => Promise<void>;
  reset: () => void;
}

const cached = readCache();

export const usePrefsStore = create<PrefsState>((set, get) => ({
  ...cached,
  loaded: false,
  uid: null,

  watch: (uid) => {
    set({ uid });
    return subscribeSettings(
      uid,
      (s) => {
        writeCache(s);
        set({ ...s, loaded: true });
      },
      (e) => {
        console.warn('[prefsStore] settings listener failed:', e);
        set({ loaded: true }); // keep the cached values
      },
    );
  },

  // Local first (instant, works offline); the Firestore write follows and the snapshot confirms it.
  setPref: async (key, value) => {
    const prefs = { ...get().prefs, [key]: value };
    set({ prefs });
    writeCache({ ...settingsOf(get()), prefs });
    const uid = get().uid;
    if (uid) await savePrefs(uid, { [key]: value } as Partial<Prefs>);
  },

  addContact: async (name, number) => {
    const n = normalizeNumber(number);
    const nm = name.trim();
    if (!nm || !n) return null;
    const contact: EmergencyContact = { id: `c${Date.now().toString(36)}`, name: nm.slice(0, 40), number: n };
    const contacts = [...get().contacts, contact];
    set({ contacts });
    writeCache({ ...settingsOf(get()), contacts });
    const uid = get().uid;
    if (uid) await saveContacts(uid, contacts);
    return contact;
  },

  removeContact: async (id) => {
    const contacts = get().contacts.filter((c) => c.id !== id);
    set({ contacts });
    writeCache({ ...settingsOf(get()), contacts });
    const uid = get().uid;
    if (uid) await saveContacts(uid, contacts);
  },

  setOnboarded: async (on, phone) => {
    set({ onboarded: on, ...(phone ? { phone } : {}) });
    writeCache({ ...settingsOf(get()), onboarded: on });
    const uid = get().uid;
    if (uid) await markOnboarded(uid, on, phone);
  },

  reset: () => {
    writeCache(DEFAULT_SETTINGS);
    set({ ...DEFAULT_SETTINGS, loaded: false, uid: null });
  },
}));

function settingsOf(s: PrefsState): PrivateSettings {
  return { prefs: s.prefs, contacts: s.contacts, onboarded: s.onboarded, ...(s.phone ? { phone: s.phone } : {}) };
}

/** Hold time (ms) for SOS everywhere. */
export const useHoldMs = () => usePrefsStore((s) => s.prefs.hold_ms);
export const useUnits = () => usePrefsStore((s) => s.prefs.units);
export const useGlove = () => usePrefsStore((s) => s.prefs.glove);
