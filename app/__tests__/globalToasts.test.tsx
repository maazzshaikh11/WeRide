import React from 'react';
import { act, create } from 'react-test-renderer';

const mockRoute = { name: 'GarageTabs' as string | undefined };
const mockListeners: Array<() => void> = [];
jest.mock('../src/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: () => true,
    getCurrentRoute: () => (mockRoute.name ? { name: mockRoute.name } : undefined),
    addListener: (_e: string, fn: () => void) => {
      mockListeners.push(fn);
      return () => undefined;
    },
  },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) }));

import GlobalToasts, { LOCAL_TOAST_ROUTES } from '../src/navigation/GlobalToasts';
import { useToastStore } from '../src/store/toastStore';

const mounted: any[] = [];
afterEach(() => mounted.splice(0).forEach((t) => act(() => t.unmount())));
const mount = () => {
  let t: any;
  act(() => {
    t = create(<GlobalToasts />);
  });
  mounted.push(t);
  return t;
};
const toastTexts = (t: any) => JSON.stringify(t.toJSON() ?? '');

describe('GlobalToasts', () => {
  beforeEach(() => {
    mockListeners.length = 0;
    useToastStore.setState({ toasts: [] });
    act(() => useToastStore.getState().push('Ride saved to your log'));
  });

  it('shows toasts on screens without their own host (Garage, Recap)', () => {
    mockRoute.name = 'GarageTabs';
    expect(toastTexts(mount())).toContain('Ride saved to your log');
  });

  it.each(LOCAL_TOAST_ROUTES)('stays hidden on %s, which draws its own', (name) => {
    mockRoute.name = name;
    expect(toastTexts(mount())).not.toContain('Ride saved to your log');
  });

  it('follows navigation: hidden on Arrive, then shown after the reset to the Garage', () => {
    mockRoute.name = 'Arrive';
    const t = mount();
    expect(toastTexts(t)).not.toContain('Ride saved to your log');
    mockRoute.name = 'Recap';
    act(() => mockListeners.forEach((fn) => fn()));
    expect(toastTexts(t)).toContain('Ride saved to your log');
  });
});
