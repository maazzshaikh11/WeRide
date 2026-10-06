/**
 * The rider's appearance choice: which theme (Demo / Ember) and whether to follow
 * the phone's light/dark setting or force one. Persisted on the device (MMKV) so
 * it survives restarts; a failed read/write just falls back to the defaults.
 */
import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';
import { THEME_IDS, ThemeId, ThemePreference } from './palettes';

const KEY_THEME = 'theme.id';
const KEY_MODE = 'theme.mode';

let store: MMKV | null = null;
function prefs(): MMKV | null {
  try {
    if (!store) store = new MMKV({ id: 'weride_prefs' });
    return store;
  } catch {
    return null;
  }
}

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEME_IDS as readonly string[]).includes(v);
}
export function isThemePreference(v: unknown): v is ThemePreference {
  return v === 'system' || v === 'light' || v === 'dark';
}

export const DEFAULT_THEME: ThemeId = 'demo';
export const DEFAULT_MODE: ThemePreference = 'system';

function load(): { themeId: ThemeId; mode: ThemePreference } {
  const p = prefs();
  const t = p?.getString(KEY_THEME);
  const m = p?.getString(KEY_MODE);
  return {
    themeId: isThemeId(t) ? t : DEFAULT_THEME,
    mode: isThemePreference(m) ? m : DEFAULT_MODE,
  };
}

const KEY_FIX = 'theme.lastfix';

export interface LastFix {
  lat: number;
  lng: number;
}

/** The rider's last known position (device-only), so Road theme "Sunset auto" can tell day from night off the bike. */
function loadFix(): LastFix | null {
  try {
    const raw = prefs()?.getString(KEY_FIX);
    const v = raw ? JSON.parse(raw) : null;
    return v && Number.isFinite(v.lat) && Number.isFinite(v.lng) ? { lat: v.lat, lng: v.lng } : null;
  } catch {
    return null;
  }
}

interface ThemeState {
  themeId: ThemeId;
  /** 'system' follows the OS; 'light' / 'dark' override it. */
  mode: ThemePreference;
  /** Last known position, used only to decide sunrise/sunset for the Road theme. */
  lastFix: LastFix | null;
  setThemeId: (id: ThemeId) => void;
  setMode: (mode: ThemePreference) => void;
  setLastFix: (fix: LastFix) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  ...load(),
  lastFix: loadFix(),
  setLastFix: (fix) => {
    const cur = get().lastFix;
    // Sunrise moves a minute per ~15 km, so only a real move is worth a write.
    if (cur && Math.abs(cur.lat - fix.lat) < 0.25 && Math.abs(cur.lng - fix.lng) < 0.25) return;
    set({ lastFix: fix });
    try {
      prefs()?.set(KEY_FIX, JSON.stringify(fix));
    } catch {
      /* best effort */
    }
  },
  setThemeId: (themeId) => {
    set({ themeId });
    prefs()?.set(KEY_THEME, themeId);
  },
  setMode: (mode) => {
    set({ mode });
    prefs()?.set(KEY_MODE, mode);
  },
}));
