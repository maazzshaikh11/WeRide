import { CONTROL_GAP, MIN_CONTROL_H, liveLayout, liveTier, sideColumnClearsCluster } from '../src/screens/map/live/liveLayout';

const L = (w: number, h: number, top: number, bottom: number, glove = false) => liveLayout({ width: w, height: h, insets: { top, bottom }, glove });

const DEVICES: [string, number, number, number, number][] = [
  ['iphone-se', 375, 667, 20, 0],
  ['android-xs', 320, 568, 24, 48],
  ['android-360x640', 360, 640, 24, 48],
  ['android-360', 360, 800, 24, 48],
  ['iphone14', 390, 844, 47, 34],
  ['iphone-pro', 393, 852, 59, 34],
  ['pixel', 412, 915, 24, 48],
  ['iphone-max', 430, 932, 59, 34],
  ['fold', 673, 841, 24, 0],
  ['ipad', 768, 1024, 0, 0],
  ['ipad-land', 1024, 768, 0, 0],
];

describe('Live layout tiers', () => {
  it('uses the demo numbers on a regular phone', () => {
    const l = L(390, 844, 47, 34);
    expect(l).toMatchObject({ tier: 'regular', sideBtn: 62, plateH: 82, controlH: 88, speedSize: 122, controlsBottom: 30, sosKeyW: 96, gutter: 14 });
  });
  it('shrinks with the usable height, never below the 76 pt control row', () => {
    expect(L(375, 667, 20, 0).tier).toBe('short');
    expect(L(320, 568, 24, 48).tier).toBe('tiny');
    for (const [, w, h, t, b] of DEVICES) {
      const l = L(w, h, t, b);
      expect(l.controlH).toBeGreaterThanOrEqual(MIN_CONTROL_H);
      expect(l.controlH).toBeLessThanOrEqual(88);
    }
    expect(L(320, 568, 24, 48).speedSize).toBeLessThan(L(390, 844, 47, 34).speedSize);
  });
  it('glove mode stays relative: 104 / 132 on a regular phone, larger than non-glove in every tier', () => {
    const g = L(390, 844, 47, 34, true);
    expect(g.controlH).toBe(104);
    expect(g.speedSize).toBe(132);
    for (const [, w, h, t, b] of DEVICES) {
      expect(L(w, h, t, b, true).controlH).toBeGreaterThan(L(w, h, t, b).controlH);
      expect(L(w, h, t, b, true).speedSize).toBeGreaterThanOrEqual(L(w, h, t, b).speedSize);
    }
  });
  it('a tablet is always the regular tier in a centred 640 column', () => {
    const l = L(1024, 768, 0, 0);
    expect(l.tier).toBe('regular');
    expect(l.columnW).toBe(640);
    expect(l.sideMargin).toBe(192);
    expect(liveTier(300, true)).toBe('regular');
  });
  it('keeps the controls above the home indicator / navigation bar', () => {
    expect(L(390, 844, 47, 34).controlsBottom).toBe(30);
    expect(L(360, 800, 24, 48).controlsBottom).toBe(44);
    expect(L(375, 667, 20, 0).controlsBottom).toBeGreaterThanOrEqual(20);
  });
  it('the side column never reaches the speed cluster, in or out of glove mode, on any device', () => {
    for (const [name, w, h, t, b] of DEVICES) {
      for (const glove of [false, true]) {
        const l = L(w, h, t, b, glove);
        // a plate that wraps by up to 30 pt must still clear
        expect([name, glove, sideColumnClearsCluster(l, h, t, l.topChromeH - 8 + 30)]).toEqual([name, glove, true]);
      }
    }
  });
  it('the four control keys fit the row with the SOS key at its share', () => {
    for (const [, w, h, t, b] of DEVICES) {
      const l = L(w, h, t, b);
      const inner = l.columnW - 2 * l.gutter;
      const keyW = (inner - l.sosKeyW - 3 * CONTROL_GAP) / 3;
      expect(keyW).toBeGreaterThanOrEqual(56);
      expect(l.sosKeyW).toBeGreaterThanOrEqual(76);
    }
  });
  it('speed digits and the ETA column fit side by side', () => {
    for (const [, w, h, t, b] of DEVICES) {
      const l = L(w, h, t, b, true);
      const inner = l.columnW - 2 * l.gutter;
      expect(l.speedSize * 1.6 + 100 + 36 + 12).toBeLessThanOrEqual(inner + 40); // 3 digits + ETA ~100 + padding
    }
  });
});
