/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * AuthPhone: +91 chip, 10-digit field, real "Send code", inline errors, email alternative. No demo helpers.
 */
import { StyleSheet } from 'react-native';
import React from 'react';
import { act } from 'react-test-renderer';
import { THEMES } from '../src/theme/palettes';
import { AuthFlowError } from '../src/services/authService';
import { ALL_PALETTES, byLabel, byTestId, hasText, hasTestId, hostById, isDisabled, mount, press, pressId, texts, typeInto, unmountAll } from './onboardingTestUtils';

const mockStart = jest.fn();
jest.mock('../src/services/authService', () => {
  const actual = jest.requireActual('../src/services/authService');
  return { ...actual, startPhoneSignIn: (...a: unknown[]) => mockStart(...a) };
});
jest.mock('react-native-safe-area-context', () => require('./onboardingTestUtils').safeAreaMock());

import AuthPhoneScreen from '../src/screens/onboarding/AuthPhoneScreen';

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn() });
beforeEach(() => mockStart.mockReset().mockResolvedValue(undefined));
afterEach(unmountAll);

describe('AuthPhoneScreen', () => {
  it.each(ALL_PALETTES)('%s/%s: page colour, step 1 of 5, the demo copy, no demo helpers', (id, scheme) => {
    const t = mount(<AuthPhoneScreen navigation={nav()} />, id, scheme);
    expect(StyleSheet.flatten(hostById(t, 'screen-AuthPhone').props.style).backgroundColor).toBe(THEMES[id][scheme].bg);
    expect(byTestId(t, 'stepper').props.accessibilityLabel).toBe('Step 1 of 5');
    expect(hasText(t, 'STEP 1 OF 5')).toBe(true);
    expect(hasText(t, 'Your number')).toBe(true);
    expect(hasText(t, 'We text you a code. No passwords to forget on a cold morning.')).toBe(true);
    expect(hasText(t, '+91')).toBe(true);
    expect(hasText(t, 'Only your crew sees you, and only during a ride. We never sell location data.')).toBe(true);
    expect(texts(t).join(' ')).not.toMatch(/demo number|autofill/i);
    expect(hasText(t, 'Use email instead')).toBe(true);
  });

  it('Send code is disabled until 10 digits are typed; the field keeps digits only', () => {
    const t = mount(<AuthPhoneScreen navigation={nav()} />);
    expect(isDisabled(byTestId(t, 'send-code'))).toBe(true);
    typeInto(t, 'Mobile number input', '98a76-54 32');
    expect(byLabel(t, 'Mobile number input').props.value).toBe('98765432');
    expect(isDisabled(byTestId(t, 'send-code'))).toBe(true);
    typeInto(t, 'Mobile number input', '98765432109999');
    expect(byLabel(t, 'Mobile number input').props.value).toBe('9876543210');
    expect(isDisabled(byTestId(t, 'send-code'))).toBe(false);
  });

  it('sends the real code to +91 and opens the code screen', async () => {
    const n = nav();
    const t = mount(<AuthPhoneScreen navigation={n} />);
    typeInto(t, 'Mobile number input', '9876543210');
    await pressId(t, 'send-code');
    expect(mockStart).toHaveBeenCalledWith('+919876543210');
    expect(n.navigate).toHaveBeenCalledWith('AuthOtp');
  });

  it('does not send while the number is incomplete', async () => {
    const n = nav();
    const t = mount(<AuthPhoneScreen navigation={n} />);
    typeInto(t, 'Mobile number input', '98765');
    await pressId(t, 'send-code');
    expect(mockStart).not.toHaveBeenCalled();
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('shows the busy state while sending and ignores a second tap', async () => {
    let resolve!: () => void;
    mockStart.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const t = mount(<AuthPhoneScreen navigation={nav()} />);
    typeInto(t, 'Mobile number input', '9876543210');
    let p: Promise<void> = Promise.resolve();
    act(() => { p = byTestId(t, 'send-code').props.onPress({ nativeEvent: {} }); });
    expect(byTestId(t, 'send-code').props.loading).toBe(true);
    await act(async () => { await byTestId(t, 'send-code').props.onPress({ nativeEvent: {} }); });
    expect(mockStart).toHaveBeenCalledTimes(1);
    await act(async () => { resolve(); await p; });
  });

  it.each([
    ['invalid-phone', 'That number does not look right. Check it and try again.'],
    ['too-many-requests', 'Too many attempts. Wait a few minutes and try again.'],
    ['network', 'No connection. Check your internet and try again.'],
  ] as const)('a %s failure is shown inline and nothing navigates', async (kind, message) => {
    mockStart.mockRejectedValue(new AuthFlowError(kind, message));
    const n = nav();
    const t = mount(<AuthPhoneScreen navigation={n} />);
    typeInto(t, 'Mobile number input', '9876543210');
    await pressId(t, 'send-code');
    expect(byTestId(t, 'phone-error').props.accessibilityLiveRegion).toBe('polite');
    expect(hasText(t, message)).toBe(true);
    expect(n.navigate).not.toHaveBeenCalled();
  });

  it('an unexpected error shows the generic sentence; editing the number clears the error', async () => {
    mockStart.mockRejectedValue(new Error('boom'));
    const t = mount(<AuthPhoneScreen navigation={nav()} />);
    typeInto(t, 'Mobile number input', '9876543210');
    await pressId(t, 'send-code');
    expect(hasText(t, 'Something went wrong. Please try again.')).toBe(true);
    typeInto(t, 'Mobile number input', '987654321');
    expect(hasTestId(t, 'phone-error')).toBe(false);
  });

  it('"Use email instead" opens the email sign-in; back goes back', async () => {
    const n = nav();
    const t = mount(<AuthPhoneScreen navigation={n} />);
    await press(t, 'Use email instead');
    expect(n.navigate).toHaveBeenCalledWith('AuthEmail');
    await press(t, 'Back');
    expect(n.goBack).toHaveBeenCalled();
  });

  it('the number field is a numeric phone input with a label', () => {
    const t = mount(<AuthPhoneScreen navigation={nav()} />);
    const f = byLabel(t, 'Mobile number input');
    expect(f.props.keyboardType).toBe('number-pad');
    expect(f.props.maxLength).toBe(10);
    expect(f.props.textContentType).toBe('telephoneNumber');
  });
});
