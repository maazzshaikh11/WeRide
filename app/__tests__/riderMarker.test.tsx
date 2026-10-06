import React from 'react';
import { create, act } from 'react-test-renderer';
import RiderMarkerOverlay, { RiderInfoCard } from '../src/screens/map/overlays/RiderMarkerOverlay';
import { useRidersStore } from '../src/store/ridersStore';
import { riderMarkerLook } from '../src/screens/map/overlays/riderMarkerState';
import { useProfileStore } from '../src/store/profileStore';
import { useRidesStore } from '../src/store/ridesStore';
import { useRouteStore } from '@routing/client/routeStore';
import { AvatarColors, avatarColor } from '../src/theme/palettes';
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
    
    // demo `.ld.stale`: a hollow dot (page colour fill) with an ink3 ring and initials
    expect(feature.properties.markerColor).toBe(colors.bg);
    expect(feature.properties.ringColor).toBe(colors.ink3);
    expect(feature.properties.initialsColor).toBe(colors.ink3);

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

  const up = (rider_id: string, ts: number, spoof_flag = false, lat = 18.5, lng = 73.8) =>
    useRidersStore.getState().upsertRider({
      rider_id, group_id: 'group-1', timestamp_hlc: `${ts}:0`, lat, lng,
      speed_mps: 5, heading_deg: 90, spoof_flag, nis_score: 1, accuracy_m: 5,
    });
  const mountMarkers = (theme: ReturnType<typeof buildTheme>, sosRiderIds?: string[]) => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <ThemeContext.Provider value={theme}>
          <RiderMarkerOverlay groupId="group-1" sosRiderIds={sosRiderIds} />
        </ThemeContext.Provider>,
      );
    });
    const feats = tree.root.findByType('ShapeSource' as unknown as React.ElementType).props.shape.features;
    return { tree, feat: (rid: string) => feats.find((f: any) => f.properties.rider_id === rid).properties };
  };

  afterEach(() => {
    act(() => {
      useProfileStore.setState({ byId: {} });
      useRidesStore.setState({ rides: [] });
      useRouteStore.setState({ lastValidLocation: null } as any);
    });
  });

  it.each([
    ['demo', 'dark'],
    ['demo', 'light'],
    ['ember', 'dark'],
    ['ember', 'light'],
  ] as [ThemeId, Scheme][])('markers follow the demo look: crew colour / hollow stale / bad flagged, page-bg ring (%s %s)', (id, scheme) => {
    const theme = buildTheme(id, THEMES[id][scheme]);
    const now = Date.now();
    act(() => {
      up('rider-ok', now);
      up('rider-bad', now, true);
      up('rider-stale', now - 20000);
      useRidersStore.getState().refreshStaleStates();
    });
    const { tree, feat } = mountMarkers(theme);
    // not in any crew order: a stable palette colour, never random
    expect(AvatarColors).toContain(feat('rider-ok').markerColor);
    expect(feat('rider-ok').ringColor).toBe(theme.colors.bg);
    expect(feat('rider-bad')).toMatchObject({ markerColor: theme.colors.bad, initialsColor: '#FFFFFF' });
    expect(feat('rider-stale')).toMatchObject({ markerColor: theme.colors.bg, ringColor: theme.colors.ink3 });
    const ring = tree.root.findByType('CircleLayer' as unknown as React.ElementType).props.style;
    expect(ring.circleColor).toEqual(['get', 'markerColor']);
    expect(ring.circleStrokeColor).toEqual(['get', 'ringColor']);
    expect(ring.circleStrokeWidth).toBe(2.5);
    act(() => tree.unmount());
  });

  it('initials and colour come from the profile store and the ride\'s crew order', () => {
    const theme = buildTheme('demo', THEMES.demo.dark);
    act(() => {
      useRidesStore.setState({ rides: [{ id: 'group-1', member_ids: ['me-1', 'seed-meera', 'seed-zoya'] }] as any });
      useProfileStore.setState({ byId: { 'seed-meera': { name: 'Meera Rao' }, 'seed-zoya': { name: 'Zoya' } } as any });
      up('seed-meera', Date.now());
      up('seed-zoya', Date.now());
      up('seed-9f3a', Date.now());
    });
    const { tree, feat } = mountMarkers(theme);
    expect(feat('seed-meera').initials).toBe('MR');
    expect(feat('seed-meera').markerColor).toBe(avatarColor(1));
    expect(feat('seed-zoya').initials).toBe('ZO');
    expect(feat('seed-zoya').markerColor).toBe(avatarColor(2));
    // unknown profile: the last two characters of the id, never "SE"
    expect(feat('seed-9f3a').initials).toBe('3A');
    act(() => tree.unmount());
  });

  it('a far rider gets the primary ring and a name chip; an SOS rider is bad-filled; nearby riders have no chip', () => {
    const theme = buildTheme('demo', THEMES.demo.dark);
    act(() => {
      useProfileStore.setState({ byId: { 'seed-kabir': { name: 'Kabir Shah' }, 'seed-near': { name: 'Nina' }, 'seed-help': { name: 'Dev' } } as any });
      useRouteStore.setState({ lastValidLocation: { lat: 18.5, lng: 73.8 } } as any);
      up('seed-kabir', Date.now(), false, 18.5 + 0.02, 73.8); // ~2.2 km away
      up('seed-near', Date.now(), false, 18.5 + 0.001, 73.8); // ~110 m
      up('seed-help', Date.now(), false, 18.5 + 0.002, 73.8);
    });
    const { tree, feat } = mountMarkers(theme, ['seed-help']);
    expect(feat('seed-kabir')).toMatchObject({ ringColor: theme.colors.pri, name: 'KABIR' });
    expect(feat('seed-near')).toMatchObject({ ringColor: theme.colors.bg, name: '' });
    expect(feat('seed-help')).toMatchObject({ markerColor: theme.colors.bad, initialsColor: '#FFFFFF', name: 'DEV' });
    act(() => tree.unmount());
  });

  it('riderMarkerLook is pure: crew colour with dark initials, hollow stale, bad SOS', () => {
    const pal = buildTheme('ember', THEMES.ember.light).colors;
    expect(riderMarkerLook({ state: 'GREEN', avatar: '#7CC4FF' }, pal)).toEqual({ fill: '#7CC4FF', ring: pal.bg, text: '#10110E' });
    expect(riderMarkerLook({ state: 'GREEN', avatar: '#7CC4FF', far: true }, pal).ring).toBe(pal.pri);
    expect(riderMarkerLook({ state: 'GREY', avatar: '#7CC4FF' }, pal)).toEqual({ fill: pal.bg, ring: pal.ink3, text: pal.ink3 });
    expect(riderMarkerLook({ state: 'GREEN', avatar: '#7CC4FF', sos: true }, pal).fill).toBe(pal.bad);
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
