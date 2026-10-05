import { devBaseUrl } from '../src/services/endpoints';

describe('devBaseUrl', () => {
  it('Android emulator reaches the host through 10.0.2.2', () => {
    expect(devBaseUrl('android')).toBe('http://10.0.2.2:3000');
  });
  it('iOS simulator uses localhost (10.0.2.2 is unreachable there)', () => {
    expect(devBaseUrl('ios')).toBe('http://localhost:3000');
  });
});
