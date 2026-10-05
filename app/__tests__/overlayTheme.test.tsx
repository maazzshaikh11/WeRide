/**
 * Map overlays, banner and pill take their colours from the active theme:
 * route = `pri` line over an `ink`-dark casing, hazard markers = the demo's
 * yellow rounded diamond with `!`, SOS = `bad`, NetworkBanner = yellow/green
 * Plate, LivePill = demo pill. Layout never changes between themes.
 */
import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@rnmapbox/maps', () => ({
  ShapeSource: 'ShapeSource',
  CircleLayer: 'CircleLayer',
  LineLayer: 'LineLayer',
  FillLayer: 'FillLayer',
  SymbolLayer: 'SymbolLayer',
  MarkerView: 'MarkerView',
}));
jest.mock('@hazard/services/sosService', () => ({
  subscribeToSosEvents: jest.fn(() => jest.fn()),
  resolveSos: jest.fn(),
  triggerSos: jest.fn(),
}));
const mockClusters: any[] = [];
jest.mock('@hazard/services/hazardService', () => ({
  subscribeToHazardClusters: jest.fn((_g: string, cb: (c: any[]) => void) => {
    cb(mockClusters);
    return jest.fn();
  }),
  resolveHazard: jest.fn(() => Promise.resolve()),
  submitHazardReport: jest.fn(),
}));

import RouteOverlay from '../src/screens/map/overlays/RouteOverlay';
import { HazardOverlayMapLayer, HazardOverlayInfoCard } from '../src/screens/map/overlays/HazardOverlay';
import { SosOverlayInfoCards } from '../src/screens/map/overlays/SosOverlay';
import NetworkBanner from '../src/components/NetworkBanner';
import LivePill from '../src/components/LivePill';
import { useRouteStore } from '@routing/client/routeStore';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { Plates, THEMES, ThemeId, Scheme } from '../src/theme/palettes';

const CASES: [ThemeId, Scheme][] = [['demo', 'dark'], ['demo', 'light'], ['ember', 'dark'], ['ember', 'light']];

const mounted: ReactTestRenderer[] = [];
function render(id: ThemeId, scheme: Scheme, el: React.ReactElement) {
  const theme = buildTheme(id, THEMES[id][scheme]);
  let t!: ReactTestRenderer;
  act(() => {
    t = create(<ThemeContext.Provider value={theme}>{el}</ThemeContext.Provider>);
  });
  mounted.push(t);
  return { t, theme };
}
afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  mockClusters.length = 0;
  useRouteStore.setState({ route: null });
});

const styleOf = (node: { props: { style?: unknown } }) =>
  Object.assign({}, ...([] as any[]).concat(node.props.style ?? []).flat(3).filter(Boolean)) as Record<string, any>;
const hostStyles = (t: ReactTestRenderer) =>
  t.root.findAll((n) => typeof n.type === 'string' && !!n.props.style).map(styleOf);

describe('RouteOverlay', () => {
  it.each(CASES)('draws the accent (pri) line over a dark ink casing (%s %s)', (id, scheme) => {
    useRouteStore.setState({
      route: {
        path_points: [[18.5, 73.8], [18.6, 73.9]],
        recalculated_at_hlc: '1:0',
      } as any,
    });
    const { t, theme } = render(id, scheme, <RouteOverlay groupId="g" />);
    const casing = t.root.findByProps({ id: 'routeCasing' }).props.style;
    const line = t.root.findByProps({ id: 'routeLine' }).props.style;
    expect(line.lineColor).toBe(theme.colors.pri);
    // light schemes use `ink` (near-black) itself; dark schemes (where ink is light) use near-black.
    expect(casing.lineColor).toBe(scheme === 'light' ? theme.colors.ink : '#050605');
    expect(casing.lineColor).not.toBe(line.lineColor);
  });
});

describe('Hazard overlay', () => {
  it.each(CASES)('hazard marker is the yellow rounded diamond with "!" (%s %s)', (id, scheme) => {
    mockClusters.push({
      cluster_id: 'c1', hazard_type: 'pothole', status: 'active', report_count: 3, hazard_score: 0.5,
      centroid_lat: 18.5, centroid_lng: 73.8, polygon_points: [],
    });
    const { t } = render(id, scheme, <HazardOverlayMapLayer groupId="g" />);
    const diamond = hostStyles(t).find((s) => s.backgroundColor === Plates.yellow.bg);
    expect(diamond).toBeDefined();
    expect(diamond!.borderColor).toBe(Plates.yellow.rim);
    expect(JSON.stringify(diamond!.transform)).toContain('45deg');
    expect(t.root.findAllByType(Text).map((n) => n.props.children)).toContain('!');
  });

  it.each(CASES)('info card surface follows the theme (%s %s)', (id, scheme) => {
    const { t, theme } = render(
      id, scheme,
      <HazardOverlayInfoCard
        selectedCluster={{ cluster_id: 'c', hazard_type: 'debris', status: 'active', report_count: 1, hazard_score: 0.2 } as any}
        onDismiss={jest.fn()}
        onResolve={jest.fn()}
      />,
    );
    expect(hostStyles(t).some((s) => s.backgroundColor === theme.colors.card && s.borderColor === theme.colors.line)).toBe(true);
  });
});

describe('SosOverlayInfoCards', () => {
  it.each(CASES)('active SOS card is rimmed and titled in the theme `bad` (%s %s)', (id, scheme) => {
    const { t, theme } = render(
      id, scheme,
      <SosOverlayInfoCards
        sosEvents={[{ sos_id: 's', rider_id: 'r-1234', group_id: 'g', lat: 1, lng: 2, created_at_hlc: '1:0', resolved: false, resolved_at_hlc: null, isSender: false }]}
        userId="me"
        onResolve={jest.fn()}
        onNavigate={jest.fn()}
      />,
    );
    const styles = hostStyles(t);
    expect(styles.some((s) => s.borderColor === theme.colors.bad && s.borderWidth === 2)).toBe(true);
    const title = t.root.findAllByType(Text).find((n) => String(n.props.children).includes('Emergency'))!;
    expect(styleOf(title).color).toBe(theme.colors.bad);
  });
});

describe('NetworkBanner', () => {
  it.each(CASES)('is a yellow (lost) / green (recovered) Plate in every theme (%s %s)', (id, scheme) => {
    const lost = render(id, scheme, <NetworkBanner state="lost" riderName="Asha" />);
    expect(hostStyles(lost.t).some((s) => s.backgroundColor === Plates.yellow.bg)).toBe(true);
    const ok = render(id, scheme, <NetworkBanner state="recovered" riderName="Asha" onDismiss={jest.fn()} />);
    expect(hostStyles(ok.t).some((s) => s.backgroundColor === Plates.green.bg)).toBe(true);
    expect(ok.t.root.findAllByType(Text).map((n) => n.props.children)).toContain('Asha is active again');
  });
});

describe('LivePill', () => {
  it.each(CASES)('uses the demo pill colours from the theme (%s %s)', (id, scheme) => {
    const live = render(id, scheme, <LivePill variant="live" />);
    expect(hostStyles(live.t).some((s) => s.backgroundColor === live.theme.colors.bad && s.height === 26)).toBe(true);
    const syncing = render(id, scheme, <LivePill variant="gold" />);
    expect(hostStyles(syncing.t).some((s) => s.backgroundColor === syncing.theme.colors.pri)).toBe(true);
    const off = render(id, scheme, <LivePill variant="grey" />);
    expect(hostStyles(off.t).some((s) => s.backgroundColor === off.theme.colors.card2 && s.borderColor === off.theme.colors.line)).toBe(true);
    expect(off.t.root.findAllByType(Text).map((n) => n.props.children)).toContain('OFFLINE');
  });
});
