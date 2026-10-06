import React from 'react';
import { act, create } from 'react-test-renderer';
import { CommonActions } from '@react-navigation/native';

import BootScreen, { SETTINGS_WAIT_MS, bootTarget } from '../src/screens/onboarding/BootScreen';
import { useSessionStore } from '../src/store/sessionStore';
import { usePrefsStore } from '../src/store/prefsStore';

describe('bootTarget', () => {
  const base = { authKnown: true, uid: 'u1', loaded: true, onboarded: true, waited: false };
  it('waits until Firebase reports', () => expect(bootTarget({ ...base, authKnown: false })).toBe('wait'));
  it('signed out -> the first-launch flow', () => expect(bootTarget({ ...base, uid: null })).toBe('Splash'));
  it('signed in + onboarded -> the Garage', () => expect(bootTarget(base)).toBe('GarageTabs'));
  it('signed in, not onboarded -> resume at Profile', () => expect(bootTarget({ ...base, onboarded: false })).toBe('Profile'));
  it('waits for the rider\'s settings, then trusts the device copy', () => {
    expect(bootTarget({ ...base, loaded: false })).toBe('wait');
    expect(bootTarget({ ...base, loaded: false, waited: true })).toBe('GarageTabs');
  });
});

describe('BootScreen', () => {
  const mounted: any[] = [];
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
    jest.useRealTimers();
  });
  const mount = (dispatch: jest.Mock) => {
    let t: any;
    act(() => {
      t = create(<BootScreen navigation={{ dispatch }} />);
    });
    mounted.push(t);
    return t;
  };

  it('resets to the right screen once the session is known', () => {
    useSessionStore.setState({ authKnown: true, uid: 'u1' });
    usePrefsStore.setState({ loaded: true, onboarded: true });
    const dispatch = jest.fn();
    mount(dispatch);
    expect(dispatch).toHaveBeenCalledWith(CommonActions.reset({ index: 0, routes: [{ name: 'GarageTabs' }] }));
  });

  it('does nothing until auth is known, then sends a signed-out rider to Splash', () => {
    useSessionStore.setState({ authKnown: false, uid: null });
    const dispatch = jest.fn();
    mount(dispatch);
    expect(dispatch).not.toHaveBeenCalled();
    act(() => useSessionStore.setState({ authKnown: true, uid: null }));
    expect(dispatch).toHaveBeenCalledWith(CommonActions.reset({ index: 0, routes: [{ name: 'Splash' }] }));
  });

  it('falls back to the on-device settings after the wait', () => {
    jest.useFakeTimers();
    useSessionStore.setState({ authKnown: true, uid: 'u1' });
    usePrefsStore.setState({ loaded: false, onboarded: true });
    const dispatch = jest.fn();
    mount(dispatch);
    expect(dispatch).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(SETTINGS_WAIT_MS + 10);
    });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
