/**
 * HazardSheet (demo "Report a hazard"): a 3-column grid of the five contract hazard types, reports at the verified
 * own fix only, and never claims success when nothing was sent.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';

const mockSubmit = jest.fn();
const mockCluster = jest.fn();
jest.mock('@hazard/services/hazardService', () => ({
  submitHazardReport: (...a: unknown[]) => mockSubmit(...a),
  triggerClustering: (...a: unknown[]) => mockCluster(...a),
}));

import HazardSheet, { HAZARD_SHEET_OPTIONS } from '../src/components/HazardSheet';
import { useToastStore } from '../src/store/toastStore';
import { ThemeContext, buildTheme } from '../src/theme/ThemeProvider';
import { THEMES, ThemeId, Scheme } from '../src/theme/palettes';

const mounted: ReturnType<typeof create>[] = [];
function render(el: React.ReactElement) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(el);
  });
  mounted.push(tree);
  return tree;
}
const FIX = { lat: 18.5, lng: 73.8, timestamp_hlc: '1:0' };
const press = (tree: ReturnType<typeof create>, label: string) =>
  act(async () => {
    tree.root.findByProps({ accessibilityLabel: label }).props.onPress();
  });

describe('HazardSheet', () => {
  beforeEach(() => {
    mockSubmit.mockReset().mockResolvedValue({ queued: false });
    mockCluster.mockReset().mockResolvedValue(undefined);
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
  });

  it('has the demo tiles (Pothole, Oil / gravel, Accident, Debris, Other) mapped to the real hazard types', () => {
    expect(HAZARD_SHEET_OPTIONS.map((o) => [o.type, o.label])).toEqual([
      ['pothole', 'Pothole'],
      ['oil_spill', 'Oil / gravel'],
      ['accident', 'Accident'],
      ['debris', 'Debris'],
      ['other', 'Other'],
    ]);
  });

  it('lays the tiles out 3 + 2 in equal-width columns (the last row is padded, not stretched)', () => {
    const tree = render(<HazardSheet visible onClose={jest.fn()} groupId="g1" riderId="r1" location={FIX} />);
    const grid = tree.root.findAllByProps({ testID: 'hazard-grid' })[0];
    const rows = grid.props.children as any[]; // one element per row: [tiles, spacers]
    expect(rows).toHaveLength(2);
    expect(rows[0].props.children[0]).toHaveLength(3);
    expect(rows[0].props.children[1]).toHaveLength(0);
    expect(rows[1].props.children[0]).toHaveLength(2);
    expect(rows[1].props.children[1]).toHaveLength(1); // 2 tiles + 1 spacer: same column width as the full row
  });

  it('reports the tapped type at the own fix, clusters, toasts and closes', async () => {
    const onClose = jest.fn();
    const onReported = jest.fn();
    const tree = render(<HazardSheet visible onClose={onClose} groupId="g1" riderId="r1" location={FIX} onReported={onReported} />);
    await press(tree, 'Report Oil / gravel');
    expect(mockSubmit).toHaveBeenCalledWith('oil_spill', 18.5, 73.8, 'r1', 'g1', '1:0');
    expect(mockCluster).toHaveBeenCalledWith('g1');
    expect(onReported).toHaveBeenCalledWith('oil_spill');
    expect(onClose).toHaveBeenCalled();
    expect(useToastStore.getState().toasts.map((t: any) => t.message)).toEqual(['Hazard reported']);
  });

  it('no fix: says so and sends nothing', async () => {
    const tree = render(<HazardSheet visible onClose={jest.fn()} groupId="g1" riderId="r1" location={null} />);
    await press(tree, 'Report Pothole');
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts.map((t: any) => t.message)).toEqual([expect.stringContaining('Location not available')]);
  });

  it('a failed submit toasts an error and keeps the sheet open', async () => {
    mockSubmit.mockRejectedValue(new Error('x'));
    const onClose = jest.fn();
    const tree = render(<HazardSheet visible onClose={onClose} groupId="g1" riderId="r1" location={FIX} />);
    await press(tree, 'Report Debris');
    expect(onClose).not.toHaveBeenCalled();
    expect(useToastStore.getState().toasts.map((t: any) => t.message)).toEqual([expect.stringContaining('Could not submit')]);
  });

  it.each([
    ['demo', 'dark'],
    ['demo', 'light'],
    ['ember', 'dark'],
    ['ember', 'light'],
  ] as [ThemeId, Scheme][])('renders under %s %s with an accessibility label per tile', (id, scheme) => {
    const tree = render(
      <ThemeContext.Provider value={buildTheme(id, THEMES[id][scheme])}>
        <HazardSheet visible onClose={jest.fn()} groupId="g1" riderId="r1" location={FIX} />
      </ThemeContext.Provider>,
    );
    HAZARD_SHEET_OPTIONS.forEach((o) => {
      expect(tree.root.findAllByProps({ accessibilityLabel: `Report ${o.label}` }).length).toBeGreaterThan(0);
    });
  });
});
