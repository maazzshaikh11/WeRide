import React from 'react';
import { create, act } from 'react-test-renderer';
import RiderMarkerOverlay from '../src/screens/map/overlays/RiderMarkerOverlay';
import { useRidersStore } from '../src/store/ridersStore';
import { markerColorForState } from '../src/screens/map/overlays/riderMarkerState';

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

    // The mock for @rnmapbox/maps exports ShapeSource as the string 'ShapeSource'
    const shapeSource = root.findByType('ShapeSource');
    const geojson = shapeSource.props.shape;
    
    // There should be exactly one feature
    expect(geojson.features).toHaveLength(1);
    
    // The feature properties should have markerState 'GREY' and markerColor for GREY
    const feature = geojson.features[0];
    expect(feature.properties.markerState).toBe('GREY');
    
    const expectedColor = markerColorForState('GREY');
    expect(feature.properties.markerColor).toBe(expectedColor);

    // The CircleLayer should be bound to use the 'markerColor' property dynamically
    const circleLayer = root.findByType('CircleLayer');
    expect(circleLayer.props.style.circleColor).toEqual(['get', 'markerColor']);
    
    // Clean up interval to prevent open handles
    act(() => {
      renderer.unmount();
    });
  });
});
