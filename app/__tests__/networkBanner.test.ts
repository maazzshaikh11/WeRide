import { nextNetworkBanner, NetworkTracker } from '../src/utils/networkBanner';

const start: NetworkTracker = { everConnected: false, prev: null };
const run = (seq: boolean[]) => {
  let t = start;
  return seq.map((c) => {
    const r = nextNetworkBanner(t, c);
    t = r.tracker;
    return r.banner;
  });
};

describe('nextNetworkBanner', () => {
  it('the first connect after mount (false → true) is NOT a recovery', () => {
    expect(run([false, true])).toEqual([null, null]);
  });
  it('starting connected shows nothing', () => {
    expect(run([true])).toEqual([null]);
  });
  it('a real drop shows "lost", and coming back shows "recovered"', () => {
    expect(run([false, true, false, true])).toEqual([null, null, 'lost', 'recovered']);
  });
  it('never connected and still offline shows nothing', () => {
    expect(run([false, false, false])).toEqual([null, null, null]);
  });
  it('repeated drops and recoveries keep announcing', () => {
    expect(run([true, false, true, false, true])).toEqual([null, 'lost', 'recovered', 'lost', 'recovered']);
  });
});
