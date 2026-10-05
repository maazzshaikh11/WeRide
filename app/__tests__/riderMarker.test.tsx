import React from 'react';
import { create, act } from 'react-test-renderer';
import RiderMarkerOverlay, { RiderInfoCard } from '../src/screens/map/overlays/RiderMarkerOverlay';
import { useRidersStore } from '../src/store/ridersStore';
import { markerColorForState } from '../src/screens/map/overlays/riderMarkerState';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES, ThemeId, Scheme } from '../src/theme/palettes';

describe('RiderMarkerOverlay', () => {
  beforeEach(() => {
    // Clear the store before each test
    act(() => {
      useRidersStore.getState().clear();
    });
  });

  it('Task 7.4 - renders a GREY marker for a rider older than 10 seconds (stale_marker_grey)', () => {
    const NOW = Date.now();
    const staleTime = NOW - 11000; // 11 seconds ago

    // Insert a stale rider directly into the store
    act(() => {
      useRidersStore.getState().upsertRider({
        rider_id: 'rider-stale',
        group_id: 'group-1',
        timestamp_hlc: `${staleTime}:0`,
        lat: 37.7749,
        lng: -122.4194,
        speed_mps: 5,
        heading_deg: 90,
        spoof_flag: false,
        nis_score: 1.0,
        accuracy_m: 5,
      });
      // Force an immediate sweep to ensure marker state is updated against Date.now()
      useRidersStore.getState().refreshStaleStates();
    });

    const renderer = create(<RiderMarkerOverlay groupId="group-1" />);
    const root = renderer.root;
    const { colors } = buildTheme('demo', THEMES.demo.dark);

    // The mock for @rnmapbox/maps exports ShapeSource as the string 'ShapeSource'
    const shapeSource = root.findByType('ShapeSource' as unknown as React.ElementType);
    const geojson = shapeSource.props.shape;
    
    // There should be exactly one feature
    expect(geojson.features).toHaveLength(1);
    
    // The feature properties should have markerState 'GREY' and markerColor for GREY
    const feature = geojson.features[0];
    expect(feature.properties.markerState).toBe('GREY');
    
    const expectedColor = markerColorForState('GREY', colors); // default theme = demo / dark: ink3
    expect(expectedColor).toBe(colors.ink3);
    expect(feature.properties.markerColor).toBe(expectedColor);

    // The CircleLayer should be bound to use the 'markerColor' property dynamically
    const circleLayer = root.findByType('CircleLayer' as unknown as React.ElementType);
    expect(circleLayer.props.style.circleColor).toEqual(['get', 'markerColor']);
    
    // Clean up interval to prevent open handles
    act(() => {
      renderer.unmount();
    });
  });

  it('RiderInfoCard shows the selected rider\'s real fields and dismisses on tap', () => {
    act(() => {
      useRidersStore.getState().upsertRider({
        rider_id: 'rider-card-1',
        group_id: 'group-1',
        timestamp_hlc: `${Date.now()}:0`,
        lat: 18.5,
        lng: 73.8,
        speed_mps: 10,
        heading_deg: 90,
        spoof_flag: false,
        nis_score: 1.0,
        accuracy_m: 4,
      });
      useRidersStore.getState().selectRider('rider-card-1');
    });

    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<RiderInfoCard />);
    });
    const texts = tree.root.findAllByType('Text' as unknown as React.ElementType).map((n) => n.props.children);
    const flat = JSON.stringify(texts);
    expect(flat).toContain('36.0 km/h');
    expect(flat).toContain('90° E');
    expect(flat).toContain('4.0 m');

    const card = tree.root.findByProps({ accessibilityLabel: 'Rider rider-ca details. Tap to dismiss.' });
    act(() => card.props.onPress());
    expect(useRidersStore.getState().selectedRiderId).toBeNull();
    act(() => {
      tree.unmount();
    });
  });

  it.each([
    ['demo', 'dark'],
    ['demo', 'light'],
    ['ember', 'dark'],
    ['ember', 'light'],
  ] as [ThemeId, Scheme][])('markers are ringed in the page bg and coloured ok / ink3 / bad (%s %s)', (id, scheme) => {
    const theme = buildTheme(id, THEMES[id][scheme]);
    const now = Date.now();
    act(() => {
      const up = (rider_id: string, ts: number, spoof_flag: boolean) =>
        useRidersStore.getState().upsertRider({
          rider_id, group_id: 'group-1', timestamp_hlc: `${ts}:0`, lat: 18.5, lng: 73.8,
          speed_mps: 5, heading_deg: 90, spoof_flag, nis_score: 1, accuracy_m: 5,
        });
      up('rider-ok', now, false);
      up('rider-bad', now, true);
      up('rider-stale', now - 20000, false);
      useRidersStore.getState().refreshStaleStates();
    });
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ThemeContext.Provider value={theme}>
          <RiderMarkerOverlay groupId="group-1" />
        </ThemeContext.Provider>,
      );
    });
    const feats = tree.root.findByType('ShapeSource' as unknown as React.ElementType).props.shape.features;
    const colorOf = (rid: string) => feats.find((f: any) => f.properties.rider_id === rid).properties.markerColor;
    expect(colorOf('rider-ok')).toBe(theme.colors.ok);
    expect(colorOf('rider-bad')).toBe(theme.colors.bad);
    expect(colorOf('rider-stale')).toBe(theme.colors.ink3);
    const ring = tree.root.findByType('CircleLayer' as unknown as React.ElementType).props.style;
    expect(ring.circleStrokeColor).toBe(theme.colors.bg);
    expect(ring.circleStrokeWidth).toBe(2.5);
    act(() => {
      tree.unmount();
    });
  });

  it('RiderInfoCard re-colours with the theme (card surface + rim)', () => {
    act(() => {
      useRidersStore.getState().upsertRider({
        rider_id: 'rider-theme-1', group_id: 'group-1', timestamp_hlc: `${Date.now()}:0`, lat: 18.5, lng: 73.8,
        speed_mps: 10, heading_deg: 90, spoof_flag: false, nis_score: 1, accuracy_m: 4,
      });
      useRidersStore.getState().selectRider('rider-theme-1');
    });
    const bodyStyle = (id: ThemeId, scheme: Scheme) => {
      const theme = buildTheme(id, THEMES[id][scheme]);
      let tree!: ReturnType<typeof create>;
      act(() => {
        tree = create(
          <ThemeContext.Provider value={theme}>
            <RiderInfoCard />
          </ThemeContext.Provider>,
        );
      });
      const card = tree.root.findByProps({ accessibilityLabel: 'Rider rider-th details. Tap to dismiss.' });
      const flat = ([] as any[]).concat(card.props.style).flat(3).filter(Boolean);
      act(() => tree.unmount());
      return { flat, theme };
    };
    for (const [id, scheme] of [['demo', 'dark'], ['demo', 'light'], ['ember', 'light']] as [ThemeId, Scheme][]) {
      const { flat, theme } = bodyStyle(id, scheme);
      expect(flat.some((s: any) => s.backgroundColor === theme.colors.card && s.borderColor === theme.colors.line)).toBe(true);
    }
  });
});
