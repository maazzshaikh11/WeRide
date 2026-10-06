import { gapLabel, formatDistance, formatDuration, formatShortDistance, formatSpread, formatSpeed, speedUnit, distanceUnit } from '../src/utils/units';

describe('units', () => {
  it('distance: one decimal under 10, whole above, km or mi', () => {
    expect(formatDistance(84.2)).toBe('84 km');
    expect(formatDistance(5.24)).toBe('5.2 km');
    expect(formatDistance(100, 'mi')).toBe('62 mi');
    expect(formatDistance(8, 'mi', false)).toBe('5.0');
    expect(formatDistance(NaN)).toBe('--');
  });
  it('speed', () => {
    expect(formatSpeed(60)).toBe('60');
    expect(formatSpeed(96.56, 'mi')).toBe('60');
    expect(speedUnit('km')).toBe('KM/H');
    expect(speedUnit('mi')).toBe('MPH');
    expect(distanceUnit('mi')).toBe('mi');
  });
  it('short distances (gaps)', () => {
    expect(formatShortDistance(96)).toBe('100 m');
    expect(formatShortDistance(1234)).toBe('1.2 km');
    expect(formatShortDistance(1609.344, 'mi')).toBe('1.0 mi');
    expect(formatShortDistance(50, 'mi')).toBe('160 ft');
  });
  it('duration in the demo style', () => {
    expect(formatDuration(7500)).toBe('2h 05');
    expect(formatDuration(3480)).toBe('58 min');
    expect(formatDuration(-1)).toBe('--');
  });
});

describe('formatSpread', () => {
  it('metres below 100 m, one decimal of km from 100 m up (the demo "0.6 km spread")', () => {
    expect(formatSpread(60)).toBe('60 m');
    expect(formatSpread(99)).toBe('100 m');
    expect(formatSpread(100)).toBe('0.1 km');
    expect(formatSpread(580)).toBe('0.6 km');
    expect(formatSpread(1340)).toBe('1.3 km');
  });
  it('miles / feet for the mi preference; bad input is a dash', () => {
    expect(formatSpread(50, 'mi')).toBe('160 ft');
    expect(formatSpread(1609.344, 'mi')).toBe('1.0 mi');
    expect(formatSpread(NaN)).toBe('--');
  });
});

describe('gapLabel', () => {
  it('reads km with one decimal from 100 m up and "<100 m" below', () => {
    expect(gapLabel(410)).toBe('0.4 km');
    expect(gapLabel(1800)).toBe('1.8 km');
    expect(gapLabel(100)).toBe('0.1 km');
    expect(gapLabel(99)).toBe('<100 m');
    expect(gapLabel(0)).toBe('<100 m');
  });
  it('follows the rider\'s unit', () => {
    expect(gapLabel(1609.344, 'mi')).toBe('1.0 mi');
    expect(gapLabel(50, 'mi')).toBe('<330 ft');
  });
});
