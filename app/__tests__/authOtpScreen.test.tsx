/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * AuthOtp: code boxes + keypad, real confirm, 60 s resend countdown, wrong/expired code handling, reset to Boot.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';
import { THEMES } from '../src/theme/palettes';
import { AuthFlowError } from '../src/services/authService';
import { useSessionStore } from '../src/store/sessionStore';
import { ALL_PALETTES, byTestId, hasText, hasTestId, hostById, hostStyles, mount, press, pressId, texts, unmountAll } from './onboardingTestUtils';

const mockConfirm = jest.fn();
const mockStart = jest.fn();
let mockPhone: string | null = '+919876543210';
jest.mock('../src/services/authService', () => {
  const actual = jest.requireActual('../src/services/authService');
  return {
    ...actual,
    confirmPhoneCode: (...a: unknown[]) => mockConfirm(...a),
    startPhoneSignIn: (...a: unknown[]) => mockStart(...a),
    pendingPhoneNumber: () => mockPhone,
  };
});
jest.mock('react-native-safe-area-context', () => require('./onboardingTestUtils').safeAreaMock());

import AuthOtpScreen, { RESEND_SECONDS, formatPhone, resendLabel } from '../src/screens/onboarding/AuthOtpScreen';

const nav = () => ({ reset: jest.fn(), goBack: jest.fn(), navigate: jest.fn() });

async function typeCode(t: ReturnType<typeof mount>, code: string) {
  for (const d of code) await press(t, d);
}

beforeEach(() => {
  jest.useFakeTimers();
  mockPhone = '+919876543210';
  mockConfirm.mockReset().mockResolvedValue({ uid: 'u1', phone: '+919876543210' });
  mockStart.mockReset().mockResolvedValue(undefined);
  useSessionStore.setState({ uid: null, authKnown: true });
});
afterEach(() => {
  unmountAll();
  jest.useRealTimers();
});

describe('helpers', () => {
  it('formats the number and the countdown like the demo', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('+14155550123')).toBe('+14155550123');
    expect(formatPhone(null)).toBe('your phone');
    expect(resendLabel(24)).toBe('Resend in 0:24');
    expect(resendLabel(60)).toBe('Resend in 1:00');
    expect(resendLabel(5)).toBe('Resend in 0:05');
  });
});

describe('AuthOtpScreen', () => {
  it.each(ALL_PALETTES)('%s/%s: palette, step 2 of 5, number the code went to, six boxes, keypad, no autofill', (id, scheme) => {
    const t = mount(<AuthOtpScreen navigation={nav()} />, id, scheme);
    const p = THEMES[id][scheme];
    expect(StyleSheet.flatten(hostById(t, 'screen-AuthOtp').props.style).backgroundColor).toBe(p.bg);
    expect(byTestId(t, 'stepper').props.accessibilityLabel).toBe('Step 2 of 5');
    expect(hasText(t, 'Enter the')).toBe(true);
    expect(hasText(t, '6-digit code.')).toBe(true);
    expect(byTestId(t, 'sent-to').props.children).toBeDefined();
    expect(hasText(t, '+91 98765 43210')).toBe(true);
    expect(hasTestId(t, 'keypad')).toBe(true);
    expect(texts(t).join(' ')).not.toMatch(/autofill|482913/i);
    expect(hostStyles(t).filter((s) => s.height === 64 && s.borderRadius === 16)).toHaveLength(6);
    expect(byTestId(t, 'resend-countdown').props.children).toBe('Resend in 1:00');
  });

  it('typing fills the boxes; delete removes a digit; nothing is sent before the 6th digit', async () => {
    const t = mount(<AuthOtpScreen navigation={nav()} />);
    await typeCode(t, '482');
    expect(hostById(t, 'code-boxes').props.accessibilityLabel).toBe('Code, 3 of 6 entered');
    await press(t, 'Delete');
    expect(hostById(t, 'code-boxes').props.accessibilityLabel).toBe('Code, 2 of 6 entered');
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it('the 6th digit confirms the code and resets to Boot', async () => {
    const n = nav();
    const t = mount(<AuthOtpScreen navigation={n} />);
    await typeCode(t, '482913');
    expect(mockConfirm).toHaveBeenCalledWith('482913');
    expect(n.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Boot' }] });
    expect(n.reset).toHaveBeenCalledTimes(1);
  });

  it('a wrong code shakes, shows the message live, and clears the boxes for another try', async () => {
    mockConfirm.mockRejectedValue(new AuthFlowError('invalid-code', 'That code is not right. Check the text and try again.'));
    const n = nav();
    const t = mount(<AuthOtpScreen navigation={n} />);
    await typeCode(t, '111111');
    expect(hasText(t, 'That code is not right. Check the text and try again.')).toBe(true);
    expect(byTestId(t, 'otp-error').props.accessibilityLiveRegion).toBe('polite');
    expect(hostById(t, 'code-boxes').props.accessibilityLabel).toBe('Code, 0 of 6 entered');
    expect(hostStyles(t).some((s) => s.borderColor === THEMES.demo.light.bad)).toBe(true);
    expect(n.reset).not.toHaveBeenCalled();
    // typing again removes the error and retries
    mockConfirm.mockResolvedValue({ uid: 'u1', phone: '+919876543210' });
    await typeCode(t, '482913');
    expect(n.reset).toHaveBeenCalledTimes(1);
  });

  it('an expired code shows the expiry message', async () => {
    mockConfirm.mockRejectedValue(new AuthFlowError('code-expired', 'That code has expired. Ask for a new one.'));
    const t = mount(<AuthOtpScreen navigation={nav()} />);
    await typeCode(t, '123456');
    expect(hasText(t, 'That code has expired. Ask for a new one.')).toBe(true);
  });

  it('network and unknown failures show their sentence', async () => {
    mockConfirm.mockRejectedValueOnce(new AuthFlowError('network', 'No connection. Check your internet and try again.'));
    const t = mount(<AuthOtpScreen navigation={nav()} />);
    await typeCode(t, '123456');
    expect(hasText(t, 'No connection.')).toBe(true);
    mockConfirm.mockRejectedValueOnce(new Error('weird'));
    await typeCode(t, '123456');
    expect(hasText(t, 'Something went wrong. Please try again.')).toBe(true);
  });

  it('keys are ignored while the code is being checked', async () => {
    let resolve!: (v: unknown) => void;
    mockConfirm.mockReturnValue(new Promise((r) => { resolve = r; }));
    const t = mount(<AuthOtpScreen navigation={nav()} />);
    await typeCode(t, '123456');
    await press(t, '7');
    await press(t, 'Delete');
    expect(hostById(t, 'code-boxes').props.accessibilityLabel).toBe('Code, 6 of 6 entered');
    expect(mockConfirm).toHaveBeenCalledTimes(1);
    await act(async () => { resolve({ uid: 'u1', phone: '+919876543210' }); });
  });

  it('counts down 60 s, then offers Resend, which texts the same number again and restarts the timer', async () => {
    const t = mount(<AuthOtpScreen navigation={nav()} />);
    expect(RESEND_SECONDS).toBe(60);
    act(() => { jest.advanceTimersByTime(36000); });
    expect(byTestId(t, 'resend-countdown').props.children).toBe('Resend in 0:24');
    expect(hasTestId(t, 'resend-code')).toBe(false);
    act(() => { jest.advanceTimersByTime(24000); });
    expect(hasTestId(t, 'resend-countdown')).toBe(false);
    await pressId(t, 'resend-code');
    expect(mockStart).toHaveBeenCalledWith('+919876543210');
    expect(byTestId(t, 'resend-countdown').props.children).toBe('Resend in 1:00');
  });

  it('a failed resend shows the error and stays available', async () => {
    mockStart.mockRejectedValue(new AuthFlowError('too-many-requests', 'Too many attempts. Wait a few minutes and try again.'));
    const t = mount(<AuthOtpScreen navigation={nav()} />);
    act(() => { jest.advanceTimersByTime(60000); });
    await pressId(t, 'resend-code');
    expect(hasText(t, 'Too many attempts.')).toBe(true);
    expect(hasTestId(t, 'resend-code')).toBe(true);
  });

  it('without a known number, resend goes back to enter it again', async () => {
    mockPhone = null;
    const n = nav();
    const t = mount(<AuthOtpScreen navigation={n} />);
    expect(hasText(t, 'your phone')).toBe(true);
    act(() => { jest.advanceTimersByTime(60000); });
    await pressId(t, 'resend-code');
    expect(n.goBack).toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('when Android verifies the SMS by itself the session appears and the screen resets to Boot once', async () => {
    const n = nav();
    mount(<AuthOtpScreen navigation={n} />);
    await act(async () => { useSessionStore.setState({ uid: 'auto' }); });
    expect(n.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Boot' }] });
    await act(async () => { useSessionStore.setState({ uid: 'auto2' }); });
    expect(n.reset).toHaveBeenCalledTimes(1);
  });

  it('back goes back', async () => {
    const n = nav();
    const t = mount(<AuthOtpScreen navigation={n} />);
    await press(t, 'Back');
    expect(n.goBack).toHaveBeenCalled();
  });
});
