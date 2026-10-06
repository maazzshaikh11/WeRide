import { maskPhone } from '../src/utils/phoneMask';

describe('maskPhone (display only)', () => {
  it('keeps the country code, first 2 and last 5 digits', () => {
    expect(maskPhone('+919876521034')).toBe('+91 98•••• 21034');
    expect(maskPhone('+91 98765 21034')).toBe('+91 98•••• 21034');
  });
  it('masks a national number without a country code', () => {
    expect(maskPhone('9876521034')).toBe('98•••• 21034');
  });
  it('treats everything before the last 10 digits as the country code', () => {
    expect(maskPhone('+14155550132')).toBe('+1 41•••• 50132');
  });
  it('returns short numbers as typed and never throws on empty input', () => {
    expect(maskPhone('1234567')).toBe('1234567');
    expect(maskPhone('')).toBe('');
  });
});
