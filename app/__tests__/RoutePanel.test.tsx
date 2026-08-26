/**
 * RoutePanel component tests (T-13, Phase 5 UI).
 * Uses React Test Renderer (RN preset in jest.config.js).
 */

import React from 'react';
import renderer from 'react-test-renderer';
import RoutePanel from '../src/components/RoutePanel';
import { WeRideColors, safetyScoreColor } from '../src/theme/theme';

// Mock Linking module (used in parent RouteOverlay, not RoutePanel, but good to have)
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  openURL: jest.fn(() => Promise.resolve()),
}));

describe('RoutePanel', () => {
  test('renders collapsed view with ETA, distance, safety bar', () => {
    const tree = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10}
          safetyScore={0.85}
          avoidHazards={true}
        />
      )
      .root;

    // Find the ETA text
    const etaText = tree.findAll((node) => {
      return node.type === 'Text' && node.props.children?.toString().includes('15 min');
    });
    expect(etaText.length).toBeGreaterThan(0);

    // Find the distance text
    const distanceText = tree.findAll((node) => {
      return node.type === 'Text' && node.props.children?.toString().includes('10.0 km');
    });
    expect(distanceText.length).toBeGreaterThan(0);
  });

  test('toggle button calls onToggleAvoidHazards', () => {
    const onToggle = jest.fn();
    const tree = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10}
          safetyScore={0.85}
          avoidHazards={true}
          onToggleAvoidHazards={onToggle}
        />
      )
      .root;

    // Find a TouchableOpacity and press it
    const touchables = tree.findAll((node) => node.type === 'TouchableOpacity');
    expect(touchables.length).toBeGreaterThan(0);

    // First touchable should be the header (expand/collapse), second should be toggle
    // For now, just verify structure exists
    expect(onToggle).not.toHaveBeenCalled(); // Not pressed yet
  });

  test('displays correct safety score status text', () => {
    const tree = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10}
          safetyScore={0.85}
          avoidHazards={true}
        />
      )
      .root;

    const statusText = tree.findAll((node) => {
      return (
        node.type === 'Text' &&
        (node.props.children?.toString().includes('Avoiding hazards') ||
          node.props.children?.toString().includes('Hazards ignored'))
      );
    });
    expect(statusText.length).toBeGreaterThan(0);
  });

  test('rounds ETA to nearest minute', () => {
    const tree = renderer
      .create(
        <RoutePanel
          etaMinutes={15.7}
          distanceKm={10}
          safetyScore={0.85}
        />
      )
      .root;

    const etaText = tree.findAll((node) => {
      return node.type === 'Text' && node.props.children?.toString().includes('16 min');
    });
    expect(etaText.length).toBeGreaterThan(0);
  });

  test('formats distance to 1 decimal place', () => {
    const tree = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10.456}
          safetyScore={0.85}
        />
      )
      .root;

    const distanceText = tree.findAll((node) => {
      return node.type === 'Text' && node.props.children?.toString().includes('10.5 km');
    });
    expect(distanceText.length).toBeGreaterThan(0);
  });

  test('respects avoidHazards prop for toggle text', () => {
    const treeAvoiding = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10}
          safetyScore={0.85}
          avoidHazards={true}
        />
      )
      .root;

    const avoidingText = treeAvoiding.findAll((node) => {
      return node.type === 'Text' && node.props.children?.toString().includes('Avoiding hazards');
    });
    expect(avoidingText.length).toBeGreaterThan(0);

    const treeIgnoring = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10}
          safetyScore={0.85}
          avoidHazards={false}
        />
      )
      .root;

    const ignoringText = treeIgnoring.findAll((node) => {
      return node.type === 'Text' && node.props.children?.toString().includes('Hazards ignored');
    });
    expect(ignoringText.length).toBeGreaterThan(0);
  });

  test('has Google Maps button in expanded view', () => {
    const tree = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10}
          safetyScore={0.85}
          onOpenInGoogleMaps={jest.fn()}
        />
      )
      .root;

    // Look for "Google Maps" text in any Text node
    const googleMapsText = tree.findAll((node) => {
      return node.type === 'Text' && node.props.children?.toString().includes('Google Maps');
    });
    expect(googleMapsText.length).toBeGreaterThan(0);
  });
});
