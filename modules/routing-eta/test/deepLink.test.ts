/**
 * Deep-link generation tests (T-15, Phase 5).
 */

import { googleMapsDeepLink } from '../src/client/deepLink';

describe('Deep Link Generation', () => {
  test('generates correct Google Maps URL with positive coordinates', () => {
    const url = googleMapsDeepLink(
      { lat: 40.7128, lng: -74.006 },
      { lat: 40.714, lng: -74.0089 }
    );

    expect(url).toContain('https://www.google.com/maps/dir/');
    expect(url).toContain('?api=1');
    expect(url).toContain('&origin=40.7128,-74.006');
    expect(url).toContain('&destination=40.714,-74.0089');
    expect(url).toContain('&travelmode=driving');
  });

  test('handles negative coordinates correctly (Southern Hemisphere)', () => {
    const url = googleMapsDeepLink(
      { lat: -33.8688, lng: 151.2093 }, // Sydney
      { lat: -37.8136, lng: 144.9631 } // Melbourne
    );

    expect(url).toContain('origin=-33.8688,151.2093');
    expect(url).toContain('destination=-37.8136,144.9631');
  });

  test('preserves coordinate precision', () => {
    const url = googleMapsDeepLink(
      { lat: 40.71289156, lng: -74.00603449 },
      { lat: 40.71401234, lng: -74.00893456 }
    );

    expect(url).toContain('origin=40.71289156,-74.00603449');
    expect(url).toContain('destination=40.71401234,-74.00893456');
  });

  test('URL format matches Google Maps spec', () => {
    const url = googleMapsDeepLink(
      { lat: 0, lng: 0 },
      { lat: 1, lng: 1 }
    );

    // Should not have trailing ?
    expect(url).not.toMatch(/\?$/);
    // Should have proper query string structure
    expect(url).toMatch(/\?api=1&origin=.+&destination=.+&travelmode=driving/);
  });

  test('coordinates are in lat,lng order (not lng,lat)', () => {
    const url = googleMapsDeepLink(
      { lat: 10, lng: 20 },
      { lat: 30, lng: 40 }
    );

    expect(url).toContain('origin=10,20'); // lat,lng order
    expect(url).toContain('destination=30,40'); // lat,lng order
  });
});
