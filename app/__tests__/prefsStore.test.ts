const mockSavePrefs = jest.fn().mockResolvedValue(undefined);
const mockSaveContacts = jest.fn().mockResolvedValue(undefined);
const mockMarkOnboarded = jest.fn().mockResolvedValue(undefined);
jest.mock('../src/services/userService', () => ({
  ...jest.requireActual('../src/services/userService'),
  savePrefs: (...a: unknown[]) => mockSavePrefs(...a),
  saveContacts: (...a: unknown[]) => mockSaveContacts(...a),
  markOnboarded: (...a: unknown[]) => mockMarkOnboarded(...a),
  subscribeSettings: jest.fn(() => jest.fn()),
}));

import { usePrefsStore } from '../src/store/prefsStore';
import { DEFAULT_PREFS } from '../src/models/domain';

beforeEach(() => {
  jest.clearAllMocks();
  usePrefsStore.getState().reset();
});

describe('prefsStore', () => {
  it('setPref updates at once (works offline) and saves only the changed key for a signed-in rider', async () => {
    usePrefsStore.setState({ uid: 'u1' });
    await usePrefsStore.getState().setPref('hold_ms', 2000);
    expect(usePrefsStore.getState().prefs).toEqual({ ...DEFAULT_PREFS, hold_ms: 2000 });
    expect(mockSavePrefs).toHaveBeenCalledWith('u1', { hold_ms: 2000 });
  });

  it('signed out: the change is kept locally, nothing is sent', async () => {
    await usePrefsStore.getState().setPref('glove', true);
    expect(usePrefsStore.getState().prefs.glove).toBe(true);
    expect(mockSavePrefs).not.toHaveBeenCalled();
  });

  it('addContact validates, normalises and saves the whole list; removeContact deletes by id', async () => {
    usePrefsStore.setState({ uid: 'u1' });
    expect(await usePrefsStore.getState().addContact('', '+919800000000')).toBeNull();
    expect(await usePrefsStore.getState().addContact('Mom', 'not a number')).toBeNull();
    const c = await usePrefsStore.getState().addContact('  Mom ', '+91 98000 00000');
    expect(c).toMatchObject({ name: 'Mom', number: '+919800000000' });
    expect(mockSaveContacts).toHaveBeenLastCalledWith('u1', [expect.objectContaining({ name: 'Mom', number: '+919800000000' })]);
    await usePrefsStore.getState().removeContact(c!.id);
    expect(usePrefsStore.getState().contacts).toEqual([]);
    expect(mockSaveContacts).toHaveBeenLastCalledWith('u1', []);
  });

  it('setOnboarded stores the flag (and phone)', async () => {
    usePrefsStore.setState({ uid: 'u1' });
    await usePrefsStore.getState().setOnboarded(true, '+911234567890');
    expect(usePrefsStore.getState()).toMatchObject({ onboarded: true, phone: '+911234567890' });
    expect(mockMarkOnboarded).toHaveBeenCalledWith('u1', true, '+911234567890');
  });

  it('reset returns to the defaults (sign-out)', async () => {
    await usePrefsStore.getState().addContact('Mom', '+919800000000');
    usePrefsStore.getState().reset();
    expect(usePrefsStore.getState()).toMatchObject({ contacts: [], onboarded: false, uid: null, prefs: DEFAULT_PREFS });
  });
});
