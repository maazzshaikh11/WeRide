/**
 * Theme test (Phase 1 T-02).
 * Verifies that the shared design system exports required tokens and thresholds.
 * This is a smoke test to ensure theme consistency across the team.
 */

import { WeRideColors, hazardColor, safetyScoreColor, WeRideFonts, WeRideIconSet } from '../src/theme/theme';

describe('WeRide Theme', () => {
  describe('WeRideColors', () => {
    it('exports all required brand colors', () => {
      expect(WeRideColors.primary).toBeDefined();
      expect(WeRideColors.accent).toBeDefined();
      expect(WeRideColors.background).toBeDefined();
      expect(WeRideColors.surface).toBeDefined();
      expect(WeRideColors.error).toBeDefined();
    });

    it('exports rider marker colors (Person A)', () => {
      expect(WeRideColors.riderVerified).toBeDefined();
      expect(WeRideColors.riderFlagged).toBeDefined();
      expect(WeRideColors.riderStale).toBeDefined();
    });

    it('exports hazard type colors (Person B)', () => {
      expect(WeRideColors.hazardPothole).toBeDefined();
      expect(WeRideColors.hazardOilSpill).toBeDefined();
      expect(WeRideColors.hazardAccident).toBeDefined();
      expect(WeRideColors.hazardDebris).toBeDefined();
      expect(WeRideColors.hazardOther).toBeDefined();
      expect(WeRideColors.hazardResolved).toBeDefined();
    });

    it('exports safety score colors (Person C)', () => {
      expect(WeRideColors.safetyGood).toBeDefined();
      expect(WeRideColors.safetyCaution).toBeDefined();
      expect(WeRideColors.safetyPoor).toBeDefined();
    });

    it('exports VOX indicator colors (Person D)', () => {
      expect(WeRideColors.voxActive).toBeDefined();
      expect(WeRideColors.voxIdle).toBeDefined();
    });
  });

  describe('hazardColor()', () => {
    it('returns correct color for pothole', () => {
      expect(hazardColor('pothole')).toBe(WeRideColors.hazardPothole);
    });

    it('returns correct color for oil_spill', () => {
      expect(hazardColor('oil_spill')).toBe(WeRideColors.hazardOilSpill);
    });

    it('returns correct color for accident', () => {
      expect(hazardColor('accident')).toBe(WeRideColors.hazardAccident);
    });

    it('returns correct color for debris', () => {
      expect(hazardColor('debris')).toBe(WeRideColors.hazardDebris);
    });

    it('returns correct color for other', () => {
      expect(hazardColor('other')).toBe(WeRideColors.hazardOther);
    });

    it('returns default color for unknown hazard type', () => {
      expect(hazardColor('unknown')).toBe(WeRideColors.hazardOther);
    });
  });

  describe('safetyScoreColor()', () => {
    it('returns green for safe scores (>= 0.7)', () => {
      expect(safetyScoreColor(1.0)).toBe(WeRideColors.safetyGood);
      expect(safetyScoreColor(0.7)).toBe(WeRideColors.safetyGood);
      expect(safetyScoreColor(0.9)).toBe(WeRideColors.safetyGood);
    });

    it('returns yellow for caution scores (0.4 to 0.7)', () => {
      expect(safetyScoreColor(0.69)).toBe(WeRideColors.safetyCaution);
      expect(safetyScoreColor(0.5)).toBe(WeRideColors.safetyCaution);
      expect(safetyScoreColor(0.4)).toBe(WeRideColors.safetyCaution);
    });

    it('returns red for poor scores (< 0.4)', () => {
      expect(safetyScoreColor(0.39)).toBe(WeRideColors.safetyPoor);
      expect(safetyScoreColor(0.0)).toBe(WeRideColors.safetyPoor);
      expect(safetyScoreColor(0.1)).toBe(WeRideColors.safetyPoor);
    });

    it('enforces safety threshold boundaries correctly', () => {
      // Boundary tests
      expect(safetyScoreColor(0.70001)).toBe(WeRideColors.safetyGood);
      expect(safetyScoreColor(0.69999)).toBe(WeRideColors.safetyCaution);
      expect(safetyScoreColor(0.40001)).toBe(WeRideColors.safetyCaution);
      expect(safetyScoreColor(0.39999)).toBe(WeRideColors.safetyPoor);
    });
  });

  describe('WeRideFonts', () => {
    it('exports font configuration', () => {
      expect(WeRideFonts.primary).toBe('Roboto');
      expect(WeRideFonts.headline).toBe('Roboto');
      expect(WeRideFonts.mono).toBeDefined();
    });

    it('uses consistent font family', () => {
      // MVP uses Roboto for both primary and headline
      expect(WeRideFonts.primary).toBe(WeRideFonts.headline);
    });
  });

  describe('WeRideIconSet', () => {
    it('exports icon configuration', () => {
      expect(WeRideIconSet.library).toBe('MaterialIcons');
      expect(WeRideIconSet.defaultSize).toBe(24);
      expect(WeRideIconSet.defaultColor).toBeDefined();
    });

    it('uses Material Icons for consistency', () => {
      // Locked decision D-07: Material Icons, not Lucide
      expect(WeRideIconSet.library).toBe('MaterialIcons');
    });
  });
});
