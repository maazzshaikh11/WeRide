/**
 * Phase 6 UI Component Tests
 *
 * Scope:
 * - HazardReportSheet basic rendering and cancel action
 * - SosButton accidental-trigger guard
 * - Hazard overlay subscription and marker rendering
 * - SOS overlay subscription and resolved-state rendering
 *
 * External services/map libraries are mocked so these remain component tests.
 */

import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import HazardReportSheet from '@hazard/ui/HazardReportSheet';
import SosButton from '@hazard/ui/SosButton';
import { HazardOverlayMapLayer } from '@app/screens/map/overlays/HazardOverlay';
import {
  SosOverlayMapLayer,
  SosOverlayInfoCards,
} from '@app/screens/map/overlays/SosOverlay';

import { subscribeToHazardClusters } from '@hazard/services/hazardService';
import { subscribeToSosEvents } from '@hazard/services/sosService';

jest.mock('@rnmapbox/maps', () => ({
  MapView: ({ children }: any) => children,
  ShapeSource: ({ children }: any) => children,
  FillLayer: () => null,
  SymbolLayer: () => null,
  MarkerView: ({ children }: any) => children,
  Camera: ({ children }: any) => children,
}));

jest.mock('@hazard/services/hazardService', () => ({
  submitHazardReport: jest.fn().mockResolvedValue({}),
  subscribeToHazardClusters: jest.fn(),
  resolveHazard: jest.fn().mockResolvedValue({}),
  HazardCluster: {},
}));

jest.mock('@hazard/services/sosService', () => ({
  triggerSos: jest.fn().mockResolvedValue('test-sos-id'),
  resolveSos: jest.fn().mockResolvedValue({}),
  subscribeToSosEvents: jest.fn(),
  getLocalActiveSosEvents: jest.fn().mockReturnValue([]),
  ActiveSos: {},
}));

jest.mock('@hazard/dbscan/dbscan', () => ({
  TYPES: [
    { type: 'pothole', label: 'Pothole' },
    { type: 'oil_spill', label: 'Oil Spill' },
    { type: 'accident', label: 'Accident' },
    { type: 'debris', label: 'Debris' },
    { type: 'other', label: 'Other' },
  ],
  HazardType: {},
  HazardReport: {},
  DBCluster: {},
}));

jest.mock('@hazard/crdt/syncWorker', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

const findAllByType = (root: any, typeName: string) =>
  root.findAll(
    (node: any) =>
      node.type?.name === typeName || node.type === typeName,
  );

describe('Phase 6: UI Component Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('HazardReportSheet', () => {
    const defaultProps = {
      visible: true,
      onClose: jest.fn(),
      groupId: 'test-group',
      riderId: 'test-rider',
      currentLocation: {
        lat: 37.7749,
        lng: -122.4194,
        timestampHlc: '1000-0',
      },
    };

    test('renders without crashing', () => {
      let renderer: TestRenderer.ReactTestRenderer;

      act(() => {
        renderer = TestRenderer.create(
          <HazardReportSheet {...defaultProps} />,
        );
      });

      expect(renderer!).toBeTruthy();
    });

    test('Cancel calls onClose', () => {
      const onClose = jest.fn();
      let renderer: TestRenderer.ReactTestRenderer;

      act(() => {
        renderer = TestRenderer.create(
          <HazardReportSheet
            {...defaultProps}
            onClose={onClose}
          />,
        );
      });

      const buttons = findAllByType(renderer!.root, 'TouchableOpacity');
      const cancelButton = buttons.find((button: any) =>
        findAllByType(button, 'Text').some(
          (text: any) => text.props.children === 'Cancel',
        ),
      );

      expect(cancelButton).toBeTruthy();

      act(() => {
        cancelButton.props.onPress();
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('SosButton', () => {
    test('short press does not trigger SOS', () => {
      const onTrigger = jest.fn();
      let renderer: TestRenderer.ReactTestRenderer;

      act(() => {
        renderer = TestRenderer.create(
          <SosButton
            onTrigger={onTrigger}
            testID="sos-button"
          />,
        );
      });

      const button = renderer!.root
        .findAllByProps({
          testID: 'sos-button',
        })
        .find((n: any) => typeof n.props?.onPressIn === 'function')!;

      act(() => {
        button.props.onPressIn();
        button.props.onPressOut();
      });

      expect(onTrigger).not.toHaveBeenCalled();
    });

    test('2-second hold triggers SOS once', () => {
      jest.useFakeTimers();

      const onTrigger = jest.fn();
      let renderer: TestRenderer.ReactTestRenderer;

      act(() => {
        renderer = TestRenderer.create(
          <SosButton
            onTrigger={onTrigger}
            testID="sos-button"
          />,
        );
      });

      const button = renderer!.root
        .findAllByProps({
          testID: 'sos-button',
        })
        .find((n: any) => typeof n.props?.onPressIn === 'function')!;

      act(() => {
        button.props.onPressIn();
        jest.advanceTimersByTime(2000);
      });

      expect(onTrigger).toHaveBeenCalledTimes(1);

      act(() => {
        button.props.onPressOut();
      });

      expect(onTrigger).toHaveBeenCalledTimes(1);
    });
  });

  describe('HazardOverlayMapLayer', () => {
    test('subscribes to hazard clusters and renders a marker', () => {
      const mockSubscribe =
        subscribeToHazardClusters as jest.Mock;

      mockSubscribe.mockImplementation(
        (groupId: string, callback: any) => {
          callback([
            {
              cluster_id: 'c1',
              hazard_type: 'pothole',
              hazard_score: 0.5,
              report_count: 2,
              status: 'active',
              centroid_lat: 37.7749,
              centroid_lng: -122.4194,
              polygon_points: [],
            },
          ]);

          return jest.fn();
        },
      );

      let renderer: TestRenderer.ReactTestRenderer;

      act(() => {
        renderer = TestRenderer.create(
          <HazardOverlayMapLayer groupId="test-group" />,
        );
      });

      expect(mockSubscribe).toHaveBeenCalledWith(
        'test-group',
        expect.any(Function),
      );

      expect(
        findAllByType(renderer!.root, 'MarkerView').length,
      ).toBeGreaterThan(0);
    });
  });

  describe('SosOverlay', () => {
    test('subscribes to SOS events', () => {
      const mockSubscribe = subscribeToSosEvents as jest.Mock;

      mockSubscribe.mockImplementation(
        (groupId: string, callback: any) => {
          callback([]);
          return jest.fn();
        },
      );

      let renderer: TestRenderer.ReactTestRenderer;

      act(() => {
        renderer = TestRenderer.create(
          <SosOverlayMapLayer
            groupId="test-group"
            userId="user-1"
            onSosEventsChange={jest.fn()}
          />,
        );
      });

      expect(mockSubscribe).toHaveBeenCalledWith(
        'test-group',
        expect.any(Function),
      );
    });

    test('renders Resolved for a resolved SOS event', () => {
      const resolvedSos = {
        sos_id: 'sos-1',
        rider_id: 'rider-1',
        group_id: 'test-group',
        lat: 37.7749,
        lng: -122.4194,
        created_at_hlc: '1000-0',
        resolved: true,
        resolved_at_hlc: '2000-0',
        isSender: false,
      };

      let renderer: TestRenderer.ReactTestRenderer;

      act(() => {
        renderer = TestRenderer.create(
          <SosOverlayInfoCards
            sosEvents={[resolvedSos]}
            userId="user-1"
            onResolve={jest.fn()}
            onNavigate={jest.fn()}
          />,
        );
      });

      const texts = findAllByType(renderer!.root, 'Text');

      expect(
        texts.some((text: any) =>
          text.props.children?.includes?.('Resolved'),
        ),
      ).toBe(true);
    });
  });
});
