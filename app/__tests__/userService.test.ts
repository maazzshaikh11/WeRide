import { contactsFromDoc, normalizeNumber, prefsFromDoc, profileFromDoc, settingsFromDoc } from '../src/services/userService';
import { DEFAULT_PREFS } from '../src/models/domain';

describe('profileFromDoc', () => {
  it('reads a full profile', () => {
    expect(profileFromDoc('u1', { name: ' Arjun Rao ', bike: 'Duke 390', style: 'Spirited', stats: { km: 120.5, rides: 3, together_sum: 270 } })).toEqual({
      uid: 'u1', name: 'Arjun Rao', bike: 'Duke 390', style: 'Spirited', created_ms: undefined, stats: { km: 120.5, rides: 3, together_sum: 270 },
    });
  });
  it('never invents a person: blanks fall back to neutral values', () => {
    expect(profileFromDoc('u1', undefined)).toMatchObject({ name: 'Rider', bike: 'Other', style: 'Steady', stats: { km: 0, rides: 0, together_sum: 0 } });
    expect(profileFromDoc('u1', { name: '  ', style: 'Reckless', stats: { km: 'x' } })).toMatchObject({ name: 'Rider', style: 'Steady', stats: { km: 0 } });
  });
});

describe('prefsFromDoc', () => {
  it('defaults', () => expect(prefsFromDoc(undefined)).toEqual(DEFAULT_PREFS));
  it('accepts only valid values', () => {
    expect(prefsFromDoc({ hold_ms: 2000, glove: true, units: 'mi', road: 'night', crash: false, learn: false })).toMatchObject({
      hold_ms: 2000, glove: true, units: 'mi', road: 'night', crash: false, learn: false,
    });
    expect(prefsFromDoc({ hold_ms: 5, units: 'furlongs', road: 'pink', glove: 'yes' })).toEqual(DEFAULT_PREFS);
  });
  it('the SOS hold defaults to the demo\'s 1.5 s', () => expect(DEFAULT_PREFS.hold_ms).toBe(1500));
});

describe('contacts + settings', () => {
  it('keeps only well-formed contacts', () => {
    expect(contactsFromDoc([{ id: 'a', name: ' Mom ', number: '+919800000000' }, { name: '', number: '1' }, null, { name: 'X' }, { name: 'Y', number: '98' }])).toEqual([
      { id: 'a', name: 'Mom', number: '+919800000000' },
      { id: 'c1', name: 'Y', number: '98' },
    ]);
    expect(contactsFromDoc('nope')).toEqual([]);
  });
  it('settings default to not onboarded with no contacts', () => {
    expect(settingsFromDoc(undefined)).toEqual({ prefs: DEFAULT_PREFS, contacts: [], onboarded: false });
    expect(settingsFromDoc({ onboarded: true, phone: '+911234567890' })).toMatchObject({ onboarded: true, phone: '+911234567890' });
  });
});

describe('normalizeNumber', () => {
  it.each([
    ['+91 98765 43210', '+919876543210'],
    ['98765-43210', '9876543210'],
    ['(022) 2345 6789', '02223456789'],
  ])('%s -> %s', (i, o) => expect(normalizeNumber(i)).toBe(o));
  it.each(['', '12', 'call mom', '1234567890123456', '98x65 43210'])('rejects %p', (i) => expect(normalizeNumber(i)).toBeNull());
});
