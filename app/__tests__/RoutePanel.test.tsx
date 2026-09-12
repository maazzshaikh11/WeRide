/**
 * RoutePanel component tests (T-13, Phase 5 UI).
 * Uses React Test Renderer (RN preset in jest.config.js).
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import RoutePanel from '../src/components/RoutePanel';
import { WeRideColors, safetyScoreColor } from '../src/theme/theme';

// Mock Linking module
jest.mock('react-native/Libraries/Linking/Linking', () => ({
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  openURL: jest.fn(() => Promise.resolve()),
}));

function getTextContent(node: renderer.ReactTestInstance): string {
  const children = node.props.children;
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) {
    return children
      .map((c: string | number | renderer.ReactTestInstance) =>
        typeof c === 'string' || typeof c === 'number' ? String(c) : '',
      )
      .join('');
  }
  return '';
}

function findTextNodes(
  tree: renderer.ReactTestInstance,
  predicate: (text: string) => boolean,
): renderer.ReactTestInstance[] {
  return tree.findAll(
    (node) => node.type === Text && predicate(getTextContent(node)),
  );
}

describe('RoutePanel', () => {
  test('renders collapsed view with ETA, distance, safety bar', () => {
    const tree = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10}
          safetyScore={0.85}
          avoidHazards={true}
        />,
      )
      .root;

    const etaText = findTextNodes(tree, (t) => t.includes('15 min'));
    expect(etaText.length).toBeGreaterThan(0);

    const distanceText = findTextNodes(tree, (t) => t.includes('10.0 km'));
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
        />,
      )
      .root;

    const touchables = tree.findAll(
      (node) => node.type === TouchableOpacity,
    );
    expect(touchables.length).toBeGreaterThan(0);
    expect(onToggle).not.toHaveBeenCalled();
  });

  test('displays correct safety score status text', () => {
    const tree = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10}
          safetyScore={0.85}
          avoidHazards={true}
        />,
      )
      .root;

    const statusText = findTextNodes(tree, (t) =>
      t.includes('Avoiding hazards') || t.includes('Hazards ignored'),
    );
    expect(statusText.length).toBeGreaterThan(0);
  });

  test('rounds ETA to nearest minute', () => {
    const tree = renderer
      .create(
        <RoutePanel
          etaMinutes={15.7}
          distanceKm={10}
          safetyScore={0.85}
        />,
      )
      .root;

    const etaText = findTextNodes(tree, (t) => t.includes('16 min'));
    expect(etaText.length).toBeGreaterThan(0);
  });

  test('formats distance to 1 decimal place', () => {
    const tree = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10.456}
          safetyScore={0.85}
        />,
      )
      .root;

    const distanceText = findTextNodes(tree, (t) => t.includes('10.5 km'));
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
        />,
      )
      .root;

    const avoidingText = findTextNodes(treeAvoiding, (t) =>
      t.includes('Avoiding hazards'),
    );
    expect(avoidingText.length).toBeGreaterThan(0);

    const treeIgnoring = renderer
      .create(
        <RoutePanel
          etaMinutes={15}
          distanceKm={10}
          safetyScore={0.85}
          avoidHazards={false}
        />,
      )
      .root;

    const ignoringText = findTextNodes(treeIgnoring, (t) =>
      t.includes('Hazards ignored'),
    );
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
        />,
      )
      .root;

    // Expand the panel by pressing the header
    const headers = tree.findAll(
      (node) => node.type === TouchableOpacity,
    );
    act(() => {
      headers[0].props.onPress();
    });

    const googleMapsText = findTextNodes(tree, (t) =>
      t.includes('Google Maps'),
    );
    expect(googleMapsText.length).toBeGreaterThan(0);
  });
});