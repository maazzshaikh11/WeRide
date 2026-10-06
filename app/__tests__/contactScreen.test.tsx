/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * Contact (step 5) + AddContactSheet: real contacts only, remove, add with validation, live preview, Continue gate.
 */
import React from 'react';
import { act } from 'react-test-renderer';
import { THEMES } from '../src/theme/palettes';
import { DEFAULT_PREFS } from '../src/models/domain';
import { usePrefsStore } from '../src/store/prefsStore';
import { useProfileStore } from '../src/store/profileStore';
import { ALL_PALETTES, byLabel, byTestId, hasText, hasTestId, hasHostId, hostStyles, isDisabled, mount, press, pressId, texts, typeInto, unmountAll } from './onboardingTestUtils';

const mockSaveContacts = jest.fn();
jest.mock('../src/services/userService', () => ({
  ...jest.requireActual('../src/services/userService'),
  saveContacts: (...a: unknown[]) => mockSaveContacts(...a),
}));
jest.mock('react-native-safe-area-context', () => require('./onboardingTestUtils').safeAreaMock());

import ContactScreen, { previewText } from '../src/screens/onboarding/ContactScreen';
import AddContactSheet, { DUPLICATE_ERROR, NAME_ERROR, NUMBER_ERROR, SAVE_ERROR, SAVE_WAIT_MS } from '../src/sheets/AddContactSheet';

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });
const mom = { id: 'c1', name: 'Mom', number: '+919800021034' };
const rohan = { id: 'c2', name: 'Rohan', number: '+919700040611' };

beforeEach(() => {
  mockSaveContacts.mockReset().mockResolvedValue(undefined);
  usePrefsStore.setState({ contacts: [], uid: 'u1', prefs: DEFAULT_PREFS, onboarded: false });
  useProfileStore.setState({ me: null, byId: {} });
});
afterEach(unmountAll);

describe('ContactScreen', () => {
  it.each(ALL_PALETTES)('%s/%s: palette, step 5 of 5, copy, add row, preview card', (id, scheme) => {
    usePrefsStore.setState({ contacts: [mom] });
    const t = mount(<ContactScreen navigation={nav()} />, id, scheme);
    const p = THEMES[id][scheme];
    expect(byTestId(t, 'stepper').props.accessibilityLabel).toBe('Step 5 of 5');
    expect(hasText(t, 'Who do we call')).toBe(true);
    expect(hasText(t, 'If you ever press SOS, this person gets a text with your live location, along with the crew.')).toBe(true);
    expect(hasText(t, 'PREVIEW OF THE TEXT')).toBe(true);
    expect(hasText(t, 'Add a contact')).toBe(true);
    // the preview card is the recessed card2 surface
    expect(hostStyles(t).some((s) => s.backgroundColor === p.card2 && s.borderRadius === 22)).toBe(true);
  });

  it('shows only the rider\'s real contacts, never fictional ones', () => {
    usePrefsStore.setState({ contacts: [mom, rohan] });
    const t = mount(<ContactScreen navigation={nav()} />);
    expect(hasText(t, 'Mom')).toBe(true);
    expect(hasText(t, '+91 98•••• 21034')).toBe(true);
    expect(hasText(t, '+919800021034')).toBe(false); // the stored number is never shown in full
    expect(hasText(t, 'Rohan')).toBe(true);
    expect(texts(t).join(' ')).not.toMatch(/Priya|\+91 99••••/);
  });

  it('with no contacts: an honest empty list with the add row, and Continue disabled', () => {
    const t = mount(<ContactScreen navigation={nav()} />);
    expect(hasTestId(t, 'contact-row-c1')).toBe(false);
    expect(hasText(t, 'Their name and number')).toBe(true);
    expect(isDisabled(byTestId(t, 'contact-continue'))).toBe(true);
  });

  it('Continue (≥1 contact) opens the drill', async () => {
    usePrefsStore.setState({ contacts: [mom] });
    const n = nav();
    const t = mount(<ContactScreen navigation={n} />);
    expect(isDisabled(byTestId(t, 'contact-continue'))).toBe(false);
    await pressId(t, 'contact-continue');
    expect(n.navigate).toHaveBeenCalledWith('Drill');
  });

  it('remove deletes the contact through the store and saves the rest', async () => {
    usePrefsStore.setState({ contacts: [mom, rohan] });
    const t = mount(<ContactScreen navigation={nav()} />);
    await press(t, 'Remove Mom');
    expect(usePrefsStore.getState().contacts).toEqual([rohan]);
    expect(mockSaveContacts).toHaveBeenCalledWith('u1', [rohan]);
    expect(hasTestId(t, 'contact-row-c1')).toBe(false);
  });

  it('the preview uses the rider\'s real name (and a neutral placeholder before the profile loads)', () => {
    expect(previewText('Meera')).toBe('“Meera needs help. Live location: [link to my live position] — sent by WeRide SOS.”');
    const t = mount(<ContactScreen navigation={nav()} />);
    expect(byTestId(t, 'sms-preview-text').props.children).toContain('Your name needs help.');
    useProfileStore.setState({ me: { uid: 'u1', name: 'Meera Iyer', bike: 'Duke 390', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } } });
    const t2 = mount(<ContactScreen navigation={nav()} />);
    expect(byTestId(t2, 'sms-preview-text').props.children).toContain('Meera Iyer needs help.');
  });

  it('the add row opens the AddContact sheet', async () => {
    const t = mount(<ContactScreen navigation={nav()} />);
    expect(hasHostId(t, 'sheet-AddContact')).toBe(false);
    await pressId(t, 'add-contact-row');
    expect(hasHostId(t, 'sheet-AddContact')).toBe(true);
  });

  it('adding through the sheet shows the new contact in the list', async () => {
    const t = mount(<ContactScreen navigation={nav()} />);
    await pressId(t, 'add-contact-row');
    typeInto(t, 'Contact name input', 'Priya');
    typeInto(t, 'Contact number input', '+91 99000 77802');
    await pressId(t, 'contact-save');
    expect(hasText(t, 'Priya')).toBe(true);
    expect(usePrefsStore.getState().contacts[0]).toMatchObject({ name: 'Priya', number: '+919900077802' });
    expect(mockSaveContacts).toHaveBeenCalledTimes(1);
  });
});

describe('AddContactSheet', () => {
  const open = (props: object = {}) => {
    const onClose = jest.fn();
    const onAdded = jest.fn();
    const t = mount(<AddContactSheet visible onClose={onClose} onAdded={onAdded} {...props} />);
    return { t, onClose, onAdded };
  };

  it.each(ALL_PALETTES)('%s/%s: renders titled form on the sheet surface', (id, scheme) => {
    const t = mount(<AddContactSheet visible onClose={jest.fn()} />, id, scheme);
    expect(hasText(t, 'Add a contact')).toBe(true);
    expect(hasText(t, 'NAME')).toBe(true);
    expect(hasText(t, 'NUMBER')).toBe(true);
    expect(byLabel(t, 'Contact number input').props.keyboardType).toBe('phone-pad');
    expect(hostStyles(t).some((s) => s.backgroundColor === THEMES[id][scheme].bg && s.borderTopLeftRadius === 30)).toBe(true);
  });

  it('is not rendered when closed', () => {
    const t = mount(<AddContactSheet visible={false} onClose={jest.fn()} />);
    expect(hasHostId(t, 'sheet-AddContact')).toBe(false);
  });

  it('empty name and bad number show inline errors and save nothing', async () => {
    const { t, onClose } = open();
    await pressId(t, 'contact-save');
    expect(hasText(t, NAME_ERROR)).toBe(true);
    expect(hasText(t, NUMBER_ERROR)).toBe(true);
    expect(mockSaveContacts).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    typeInto(t, 'Contact name input', 'M');
    expect(hasText(t, NAME_ERROR)).toBe(false);
    typeInto(t, 'Contact number input', '12');
    expect(hasText(t, NUMBER_ERROR)).toBe(false);
  });

  it.each(['12345', 'abc', '+1234567890123456', '98x76'])('rejects the number %p', async (num) => {
    const { t } = open();
    typeInto(t, 'Contact name input', 'Mom');
    typeInto(t, 'Contact number input', num);
    await pressId(t, 'contact-save');
    expect(hasText(t, NUMBER_ERROR)).toBe(true);
    expect(usePrefsStore.getState().contacts).toHaveLength(0);
  });

  it('saves a valid contact (normalised) through the prefs store, reports it and closes', async () => {
    const { t, onClose, onAdded } = open();
    typeInto(t, 'Contact name input', '  Mom ');
    typeInto(t, 'Contact number input', '+91 98000-21034');
    await pressId(t, 'contact-save');
    expect(onAdded).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mom', number: '+919800021034' }));
    expect(onClose).toHaveBeenCalled();
    expect(mockSaveContacts).toHaveBeenCalledWith('u1', [expect.objectContaining({ name: 'Mom', number: '+919800021034' })]);
  });

  it('refuses a number that is already in the list', async () => {
    usePrefsStore.setState({ contacts: [mom] });
    const { t, onClose } = open();
    typeInto(t, 'Contact name input', 'Mother');
    typeInto(t, 'Contact number input', '+91 98000 21034');
    await pressId(t, 'contact-save');
    expect(hasText(t, DUPLICATE_ERROR)).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(usePrefsStore.getState().contacts).toHaveLength(1);
  });

  it('a failed Firestore write shows an inline error and keeps the sheet open', async () => {
    mockSaveContacts.mockRejectedValue(new Error('permission-denied'));
    const { t, onClose } = open();
    typeInto(t, 'Contact name input', 'Mom');
    typeInto(t, 'Contact number input', '9800021034');
    await pressId(t, 'contact-save');
    expect(byTestId(t, 'contact-form-error').props.accessibilityLiveRegion).toBe('polite');
    expect(hasText(t, SAVE_ERROR)).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('an offline write (never acknowledged) closes after a short wait; the list already has the contact', async () => {
    jest.useFakeTimers();
    try {
      mockSaveContacts.mockReturnValue(new Promise(() => undefined));
      const { t, onClose } = open();
      typeInto(t, 'Contact name input', 'Mom');
      typeInto(t, 'Contact number input', '9800021034');
      let p: Promise<void> = Promise.resolve();
      act(() => { p = byTestId(t, 'contact-save').props.onPress({ nativeEvent: {} }); });
      expect(onClose).not.toHaveBeenCalled();
      await act(async () => { jest.advanceTimersByTime(SAVE_WAIT_MS); await p; });
      expect(onClose).toHaveBeenCalled();
      expect(usePrefsStore.getState().contacts).toHaveLength(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('opens with a clean form every time', async () => {
    const onClose = jest.fn();
    const t = mount(<AddContactSheet visible onClose={onClose} />);
    typeInto(t, 'Contact name input', 'Typed');
    act(() => t.update(<AddContactSheet visible={false} onClose={onClose} />));
    act(() => t.update(<AddContactSheet visible onClose={onClose} />));
    expect(byLabel(t, 'Contact name input').props.value).toBe('');
  });
});
