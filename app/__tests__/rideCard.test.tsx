import React from 'react';
import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import RideCard from '../src/components/RideCard';
import RideMapPreview from '../src/components/RideMapPreview';

const mounted: ReactTestRenderer[] = [];
function render(el: React.ReactElement) {
  let t!: ReactTestRenderer;
  act(() => { t = create(el); });
  mounted.push(t);
  return t;
}
afterEach(() => { mounted.splice(0).forEach((t) => act(() => t.unmount())); });

const texts = (t: ReactTestRenderer) =>
  t.root.findAll((n) => (n.type as unknown) === 'Text').map((n) => [].concat(n.props.children).join(''));
const pressable = (t: ReactTestRenderer, label: string) =>
  t.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPressIn === 'function')[0];

const POINTS = [
  { lat: 18.5204, lng: 73.8567 },
  { lat: 18.7546, lng: 73.4062 },
];
const base = {
  badge: { label: 'Upcoming', tone: 'ice' as const },
  dateLabel: 'SUN, OCT 5 · 6:00 AM',
  title: 'Ride to Lonavala',
  from: 'Pune',
  to: 'Lonavala',
  stats: [{ value: '58', label: 'km' }, { value: '6', label: 'riders' }],
  mapPoints: POINTS,
  memberCount: 6,
  selfInitial: 'R',
  onPress: jest.fn(),
  accessibilityLabel: 'Open ride Ride to Lonavala',
};

describe('RideCard', () => {
  it('shows badge, date, title, from → to, stats and View', () => {
    const t = render(<RideCard {...base} />);
    const all = texts(t);
    expect(all).toEqual(expect.arrayContaining(['Upcoming', 'SUN, OCT 5 · 6:00 AM', 'Ride to Lonavala', 'Pune  →  Lonavala', '58', 'km', '6', 'riders']));
    expect(all.some((s) => s.includes('View'))).toBe(true);
  });

  it('press opens the ride', () => {
    const onPress = jest.fn();
    const t = render(<RideCard {...base} onPress={onPress} />);
    act(() => pressable(t, base.accessibilityLabel).props.onPress({}));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('caps avatars at 4 and shows +n for the rest, with the self initial on the first', () => {
    const t = render(<RideCard {...base} memberCount={9} />);
    const all = texts(t);
    expect(all).toContain('R');
    expect(all).toContain('+5');
  });

  it('a solo ride shows one avatar and no overflow', () => {
    const t = render(<RideCard {...base} memberCount={1} />);
    expect(texts(t).some((s) => s.startsWith('+'))).toBe(false);
  });

  it('compact variant and rides with no plan draw no map', () => {
    const compact = render(<RideCard {...base} variant="compact" />);
    expect(compact.root.findAllByType(RideMapPreview)).toHaveLength(0);
    const noPlan = render(<RideCard {...base} mapPoints={[]} />);
    expect(noPlan.root.findAllByType(RideMapPreview)).toHaveLength(0);
    const standard = render(<RideCard {...base} />);
    expect(standard.root.findAllByType(RideMapPreview)).toHaveLength(1);
  });

  it('destination only → "To X"; no stats → no stat row; slots render', () => {
    const t = render(
      <RideCard {...base} from={null} stats={[]} headerRight={<Text>CODE</Text>} footerActions={<Text>Leave</Text>} />,
    );
    const all = texts(t);
    expect(all).toContain('To Lonavala');
    expect(all).toEqual(expect.arrayContaining(['CODE', 'Leave']));
    expect(all).not.toContain('km');
  });
});

describe('RideMapPreview', () => {
  it('draws one segment per leg, start/end dots, and the static map image', () => {
    const t = render(<RideMapPreview token="pk.t" points={[...POINTS, { lat: 18.6, lng: 73.7 }]} />);
    const views = t.root.findAll((n) => (n.type as unknown) === 'View');
    expect(views.length).toBeGreaterThan(4);
    const img = t.root.findAll((n) => n.props.source && n.props.source.uri);
    expect(img.length).toBeGreaterThan(0);
    expect(img[0].props.source.uri).toContain('api.mapbox.com/styles/v1/mapbox/dark-v11/static/');
  });

  it('if the static map fails the sketch stays and the image is dropped', () => {
    const t = render(<RideMapPreview token="pk.t" points={POINTS} />);
    const img = t.root.findAll((n) => n.props.source && n.props.source.uri && typeof n.props.onError === 'function')[0];
    act(() => img.props.onError());
    expect(t.root.findAll((n) => n.props.source && n.props.source.uri)).toHaveLength(0);
  });

  it('without a token it shows only the sketch (no network image)', () => {
    const t = render(<RideMapPreview token={null} points={POINTS} />);
    expect(t.root.findAll((n) => n.props.source && n.props.source.uri)).toHaveLength(0);
    expect(t.root.findAll((n) => (n.type as unknown) === 'View').length).toBeGreaterThan(2);
  });

  it('is hidden from accessibility (the card carries the label)', () => {
    const t = render(<RideMapPreview points={POINTS} />);
    expect(t.root.findAll((n) => n.props.accessibilityElementsHidden === true).length).toBeGreaterThan(0);
  });
});
