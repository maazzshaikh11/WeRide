// Freezes "now" at the demo's moment (Sat 11 Oct, 05:41 local) so countdowns / greetings match the reference renders.
// The clock keeps running from there. Imported first by scenes.tsx.
const RealDate = Date;
const FIXED = new RealDate(2025, 9, 11, 5, 41, 0).getTime();
const nowMs = () => FIXED; // frozen: countdowns and ages are deterministic
class FakeDate extends RealDate {
  constructor(...a: any[]) {
    if (a.length === 0) super(nowMs());
    else super(...(a as [any]));
  }
  static now() {
    return nowMs();
  }
}
(globalThis as any).Date = FakeDate;
export const DEMO_NOW = FIXED;
