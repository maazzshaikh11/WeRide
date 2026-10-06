/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories need require */
/**
 * CrewStart: Join with a code / Start a crew (NewCrewSheet), onboarding completion. No demo code.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { act } from 'react-test-renderer';
import { THEMES } from '../src/theme/palettes';
import { useCrewsStore } from '../src/store/crewsStore';
import { usePrefsStore } from '../src/store/prefsStore';
import { ALL_PALETTES, byLabel, hasText, hostById, mount, pressId, texts, unmountAll } from './onboardingTestUtils';

let mockNewCrewProps: any = null;
jest.mock('../src/sheets/NewCrewSheet', () => ({
  __esModule: true,
  default: (props: any) => {
    mockNewCrewProps = props;
    return null;
  },
}));
const mockPhone = jest.fn();
jest.mock('../src/services/authService', () => ({ currentPhoneNumber: () => mockPhone() }));
jest.mock('react-native-safe-area-context', () => require('./onboardingTestUtils').safeAreaMock());

import CrewStartScreen from '../src/screens/onboarding/CrewStartScreen';

const nav = () => ({ navigate: jest.fn(), goBack: jest.fn(), dispatch: jest.fn() });
const mockSetOnboarded = jest.fn();

beforeEach(() => {
  mockNewCrewProps = null;
  mockPhone.mockReset().mockReturnValue('+919876543210');
  mockSetOnboarded.mockReset().mockResolvedValue(undefined);
  useCrewsStore.setState({ crews: [] } as any);
  usePrefsStore.setState({ onboarded: false, setOnboarded: mockSetOnboarded } as any);
});
afterEach(unmountAll);

describe('CrewStartScreen', () => {
  it.each(ALL_PALETTES)('%s/%s: palette, copy, two option cards, no back chip and no GHOST7', (id, scheme) => {
    const t = mount(<CrewStartScreen navigation={nav()} />, id, scheme);
    expect(hasText(t, "YOU'RE IN")).toBe(true);
    expect(hasText(t, 'Now find')).toBe(true);
    expect(hasText(t, 'Join with a code')).toBe(true);
    expect(hasText(t, 'A friend sent you six characters or a QR.')).toBe(true);
    expect(hasText(t, 'Start a crew')).toBe(true);
    expect(hasText(t, 'Name it, get a code, invite your people.')).toBe(true);
    expect(texts(t).join(' ')).not.toMatch(/GHOST7|exploring/i);
    expect(t.root.findAll((n) => n.props.testID === 'topbar-back')).toHaveLength(0);
    expect(StyleSheet.flatten(hostById(t, 'screen-CrewStart').props.style).flex).toBe(1);
    const p = THEMES[id][scheme];
    expect(t.root.findAll((n) => typeof n.type === 'string' && n.props.style && StyleSheet.flatten(n.props.style).backgroundColor === p.pri).length).toBeGreaterThan(0);
  });

  it('"Join with a code" opens Join', async () => {
    const n = nav();
    const t = mount(<CrewStartScreen navigation={n} />);
    await pressId(t, 'join-with-code');
    expect(n.navigate).toHaveBeenCalledWith('Join');
  });

  it('"Start a crew" opens the NewCrewSheet, which can be closed', async () => {
    const t = mount(<CrewStartScreen navigation={nav()} />);
    expect(mockNewCrewProps.visible).toBe(false);
    await pressId(t, 'start-crew');
    expect(mockNewCrewProps.visible).toBe(true);
    act(() => mockNewCrewProps.onClose());
    expect(mockNewCrewProps.visible).toBe(false);
  });

  it('a created crew marks the rider onboarded (with their phone) and resets to the Garage', async () => {
    const n = nav();
    mount(<CrewStartScreen navigation={n} />);
    await act(async () => { await mockNewCrewProps.onCreated('crew1'); });
    expect(mockSetOnboarded).toHaveBeenCalledWith(true, '+919876543210');
    const action = n.dispatch.mock.calls[0][0];
    expect(action.type).toBe('RESET');
    expect(action.payload.routes).toEqual([{ name: 'GarageTabs' }]);
    expect(action.payload.index).toBe(0);
    expect(mockNewCrewProps.visible).toBe(false);
  });

  it('email riders (no phone) are marked onboarded without one', async () => {
    mockPhone.mockReturnValue(null);
    const n = nav();
    mount(<CrewStartScreen navigation={n} />);
    await act(async () => { await mockNewCrewProps.onCreated('crew1'); });
    expect(mockSetOnboarded).toHaveBeenCalledWith(true, undefined);
  });

  it('still opens the Garage when saving the flag fails (the device copy is already set)', async () => {
    mockSetOnboarded.mockRejectedValue(new Error('offline'));
    const n = nav();
    mount(<CrewStartScreen navigation={n} />);
    await act(async () => { await mockNewCrewProps.onCreated('crew1'); });
    expect(n.dispatch).toHaveBeenCalledTimes(1);
  });

  it('having joined a crew (via Join) while this screen waits underneath completes onboarding', async () => {
    mount(<CrewStartScreen navigation={nav()} />);
    expect(mockSetOnboarded).not.toHaveBeenCalled();
    await act(async () => { useCrewsStore.setState({ crews: [{ id: 'c1' }] } as any); });
    expect(mockSetOnboarded).toHaveBeenCalledWith(true, '+919876543210');
  });

  it('is accessible: both cards are labelled buttons', () => {
    const t = mount(<CrewStartScreen navigation={nav()} />);
    expect(byLabel(t, 'Join with a code. A friend sent you six characters or a QR.')).toBeDefined();
    expect(byLabel(t, 'Start a crew. Name it, get a code, invite your people.')).toBeDefined();
  });
});
