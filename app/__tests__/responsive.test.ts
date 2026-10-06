import {
  COMPACT_WIDTH,
  GARAGE_COLUMN,
  GUTTER,
  GUTTER_COMPACT,
  ROAD_COLUMN,
  columnWidth,
  computeResponsive,
  dockBottom,
  gutterFor,
  scaleBy,
  scaleFactor,
} from '../src/theme/responsive';

const phone = (w: number, h: number, top = 0, bottom = 0, fs = 1) => computeResponsive(w, h, fs, { top, bottom, left: 0, right: 0 });

describe('computeResponsive', () => {
  it('classifies the device matrix', () => {
    const se = phone(375, 667, 20, 0);
    expect(se).toMatchObject({ isCompactWidth: false, isShortHeight: true, isTablet: false, orientation: 'portrait' });
    const tiny = phone(320, 568, 24, 48);
    expect(tiny).toMatchObject({ isCompactWidth: true, isShortHeight: true, isTablet: false, usableHeight: 496 });
    const short = phone(360, 640, 24, 48);
    expect(short.isShortHeight).toBe(true);
    expect(short.isCompactWidth).toBe(false); // 360 is not < 360
    const android = phone(360, 800, 24, 48);
    expect(android).toMatchObject({ isCompactWidth: false, isShortHeight: false, usableHeight: 728 });
    const iphone14 = phone(390, 844, 47, 34);
    expect(iphone14).toMatchObject({ isCompactWidth: false, isShortHeight: false, usableHeight: 763 });
    expect(phone(430, 932, 59, 34).isShortHeight).toBe(false);
  });

  it('insets make a screen short even when the window height alone is not', () => {
    // 360x720: 720 alone is >= 700 but with 24/48 only 648 is usable
    expect(phone(360, 720, 24, 48).isShortHeight).toBe(true);
    expect(phone(360, 720, 0, 0).isShortHeight).toBe(false);
  });

  it('treats min(width, height) >= 600 as a tablet, in both orientations, and never as short', () => {
    expect(phone(768, 1024).isTablet).toBe(true);
    const land = phone(1024, 768);
    expect(land).toMatchObject({ isTablet: true, orientation: 'landscape', isLandscape: true, isShortHeight: false });
    expect(phone(673, 841, 24, 0).isTablet).toBe(true); // foldable inner screen
    expect(phone(599, 900).isTablet).toBe(false);
    expect(phone(600, 900).isTablet).toBe(true);
  });

  it('carries the font scale and the gutter', () => {
    expect(computeResponsive(390, 844, 1.5).fontScale).toBe(1.5);
    expect(phone(320, 568).gutter).toBe(GUTTER_COMPACT);
    expect(phone(390, 844).gutter).toBe(GUTTER);
  });
});

describe('scaleBy', () => {
  it('is the identity at the demo width and never changes sizes on tablets', () => {
    expect(scaleBy(40, 390)).toBe(40);
    expect(scaleBy(40, 768, true)).toBe(40);
    expect(scaleBy(40, 1024)).toBe(40);
    expect(scaleFactor(600)).toBe(1);
  });
  it('is moderate and capped on phones', () => {
    expect(scaleFactor(320)).toBeCloseTo(0.91, 2);
    expect(scaleFactor(360)).toBeCloseTo(0.96, 2);
    expect(scaleFactor(430)).toBeCloseTo(1.05, 2);
    expect(scaleFactor(200)).toBe(0.9); // floor
    expect(scaleFactor(599)).toBeLessThanOrEqual(1.1); // cap
    expect(scaleBy(100, 320)).toBe(91);
    expect(scaleBy(100, 430)).toBe(105);
  });
  it('rounds to half points', () => {
    expect(scaleBy(17, 360) * 2).toBe(Math.round(scaleBy(17, 360) * 2));
  });
});

describe('columns, gutters, dock', () => {
  it('centres a column of at most the max on wide screens', () => {
    expect(columnWidth(390)).toBe(390);
    expect(columnWidth(768)).toBe(GARAGE_COLUMN);
    expect(columnWidth(1024, ROAD_COLUMN)).toBe(ROAD_COLUMN);
    expect(GARAGE_COLUMN).toBeLessThanOrEqual(560);
    expect(ROAD_COLUMN).toBeLessThanOrEqual(640);
  });
  it('shrinks gutters below the compact width', () => {
    expect(gutterFor(COMPACT_WIDTH - 1)).toBe(16);
    expect(gutterFor(COMPACT_WIDTH)).toBe(20);
  });
  it('keeps docks the demo distance above the bottom edge, clearing taller system bars', () => {
    expect(dockBottom(34)).toBe(30); // iPhone with home indicator: the demo's 30
    expect(dockBottom(0)).toBe(30);
    expect(dockBottom(48)).toBe(44); // Android 3-button bar
    expect(dockBottom(0, 14)).toBe(14);
  });
});
