/**
 * Map info cards (hazard / SOS): entrance via FadeIn, actions are Buttons,
 * the active SOS card carries the pulsing red ring (not the resolved one), and
 * every accessibility label is preserved.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@hazard/services/sosService', () => ({
  subscribeToSosEvents: jest.fn(() => jest.fn()),
  resolveSos: jest.fn(),
  triggerSos: jest.fn(),
}));
jest.mock('@hazard/services/hazardService', () => ({
  subscribeToHazardClusters: jest.fn(() => jest.fn()),
  resolveHazard: jest.fn(() => Promise.resolve()),
  submitHazardReport: jest.fn(),
}));

import { SosOverlayInfoCards, ActiveSos } from '../src/screens/map/overlays/SosOverlay';
import { HazardOverlayInfoCard } from '../src/screens/map/overlays/HazardOverlay';

const mounted: ReactTestRenderer[] = [];
function render(el: React.ReactElement) {
  let t!: ReactTestRenderer;
  act(() => {
    t = create(el);
  });
  mounted.push(t);
  return t;
}
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
});

const real = (t: ReactTestRenderer, label: string) =>
  t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPressIn === 'function')[0];
const texts = (t: ReactTestRenderer) =>
  t.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat().filter((c) => typeof c === 'string' || typeof c === 'number').join(''));

const sos = (over: Partial<ActiveSos> = {}): ActiveSos => ({
  sos_id: 's1',
  rider_id: 'rider-me-1234',
  group_id: 'g',
  lat: 18.5,
  lng: 73.8,
  created_at_hlc: '1:0',
  resolved: false,
  resolved_at_hlc: null,
  isSender: true,
  ...over,
});

describe('SosOverlayInfoCards', () => {
  it('sender sees Cancel SOS (danger Button) that calls onResolve; card press navigates', () => {
    const onResolve = jest.fn();
    const onNavigate = jest.fn();
    const t = render(
      <SosOverlayInfoCards sosEvents={[sos()]} userId="rider-me-1234" onResolve={onResolve} onNavigate={onNavigate} />,
    );
    const cancel = t.root.findByProps({ accessibilityLabel: 'Cancel SOS' });
    expect(cancel.props.variant).toBe('danger');
    act(() => real(t, 'Cancel SOS').props.onPress({}));
    expect(onResolve).toHaveBeenCalledWith('s1');

    act(() => real(t, 'SOS from you. Tap for directions.').props.onPress({}));
    expect(onNavigate).toHaveBeenCalledWith(18.5, 73.8);
    expect(texts(t)).toContain('Emergency: You');
  });

  it('active card has the pulsing border ring; a resolved card has none and no Cancel', () => {
    const active = render(
      <SosOverlayInfoCards sosEvents={[sos()]} userId="u" onResolve={jest.fn()} onNavigate={jest.fn()} />,
    );
    const ring = (t: ReactTestRenderer) =>
      t.root.findAll((n) => n.props.pointerEvents === 'none' && JSON.stringify(n.props.style ?? '').includes('"borderWidth":2'));
    expect(ring(active).length).toBeGreaterThan(0);

    const resolved = render(
      <SosOverlayInfoCards
        sosEvents={[sos({ resolved: true })]}
        userId="u"
        onResolve={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );
    expect(ring(resolved)).toHaveLength(0);
    expect(resolved.root.findAll((n) => n.props.accessibilityLabel === 'Cancel SOS')).toHaveLength(0);
    expect(texts(resolved).join('|')).toContain('Resolved');
  });

  it("someone else's SOS has no Cancel button", () => {
    const t = render(
      <SosOverlayInfoCards
        sosEvents={[sos({ isSender: false, rider_id: 'other-9999' })]}
        userId="me"
        onResolve={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );
    expect(t.root.findAll((n) => n.props.accessibilityLabel === 'Cancel SOS')).toHaveLength(0);
    expect(texts(t)).toContain('Emergency: Rider 9999');
  });
});

describe('HazardOverlayInfoCard', () => {
  const cluster: any = {
    cluster_id: 'c1',
    hazard_type: 'oil_spill',
    status: 'active',
    report_count: 3,
    hazard_score: 0.62,
  };

  it('Dismiss and Resolve are Buttons wired to their handlers', async () => {
    const onDismiss = jest.fn();
    const t = render(<HazardOverlayInfoCard selectedCluster={cluster} onDismiss={onDismiss} onResolve={jest.fn()} />);
    expect(texts(t)).toContain('Oil spill');
    expect(t.root.findByProps({ accessibilityLabel: 'Dismiss hazard details' }).props.variant).toBe('secondary');
    act(() => real(t, 'Dismiss hazard details').props.onPress({}));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    await act(async () => {
      real(t, 'Resolve hazard').props.onPress({});
    });
    expect(onDismiss).toHaveBeenCalledTimes(2); // resolved -> card closes
  });

  it('a resolved cluster offers no Resolve action', () => {
    const t = render(
      <HazardOverlayInfoCard selectedCluster={{ ...cluster, status: 'resolved' }} onDismiss={jest.fn()} onResolve={jest.fn()} />,
    );
    expect(t.root.findAll((n) => n.props.accessibilityLabel === 'Resolve hazard')).toHaveLength(0);
    expect(texts(t).join('|')).toContain('(resolved)');
  });
});
