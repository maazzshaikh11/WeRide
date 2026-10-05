/**
 * CreateRideModal: ride meta, disabled reason, geocode empty/error states, toast with join code.
 */
import React from 'react';
import { act, create, ReactTestInstance } from 'react-test-renderer';

const mockGeocode = jest.fn();
jest.mock('../src/utils/geocode', () => ({
  geocodeSearchStrict: (...a: unknown[]) => mockGeocode(...a),
}));

const mockSvc = { createGroup: jest.fn(), getGroup: jest.fn() };
jest.mock('@routing/group/groupService', () => ({
  RIDE_TYPES: ['Casual', 'Touring', 'Sport', 'Off-road'],
  GroupService: function GroupService() {
    return mockSvc;
  },
}));

import CreateRideModal from '../src/components/CreateRideModal';
import { useRidePlanStore } from '../src/store/ridePlanStore';
import { useToastStore } from '../src/store/toastStore';
import { useAppStore } from '../src/store/appStore';

const ORIGINAL_SET_GROUP_ID = useAppStore.getState().setGroupId;
const DEST = { label: 'Lonavala, Maharashtra, India', lat: 18.75, lng: 73.4 };
const FIXED_NOW = new Date(2026, 9, 5, 12, 0, 0, 0).getTime();

const mounted: ReturnType<typeof create>[] = [];
function render(props: Partial<React.ComponentProps<typeof CreateRideModal>> = {}) {
  const onClose = jest.fn();
  const onCreated = jest.fn();
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<CreateRideModal visible onClose={onClose} onCreated={onCreated} {...props} />);
  });
  mounted.push(tree);
  return { tree, onClose, onCreated };
}

function byLabel(tree: ReturnType<typeof create>, label: string): ReactTestInstance {
  const found = tree.root.findAll((n) => n.props.accessibilityLabel === label);
  if (!found.length) throw new Error(`no node labelled "${label}"`);
  return found[0];
}
const hasLabel = (tree: ReturnType<typeof create>, label: string) =>
  tree.root.findAll((n) => n.props.accessibilityLabel === label).length > 0;
function texts(tree: ReturnType<typeof create>): string[] {
  return tree.root
    .findAll((n) => (n.type as unknown) === 'Text')
    .map((n) => n.children.map((c) => (typeof c === 'string' ? c : '')).join(''));
}
const hasText = (tree: ReturnType<typeof create>, s: string) => texts(tree).some((t) => t.includes(s));
const selected = (tree: ReturnType<typeof create>, label: string) =>
  byLabel(tree, label).props.accessibilityState.selected;

async function press(tree: ReturnType<typeof create>, label: string) {
  await act(async () => {
    await byLabel(tree, label).props.onPress();
  });
}

async function search(tree: ReturnType<typeof create>, q: string) {
  act(() => byLabel(tree, 'Location search input').props.onChangeText(q));
  await act(async () => {
    jest.advanceTimersByTime(450);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Date, 'now').mockReturnValue(FIXED_NOW);
  mockGeocode.mockReset().mockResolvedValue([]);
  mockSvc.createGroup.mockReset().mockResolvedValue('gid-1');
  mockSvc.getGroup.mockReset().mockResolvedValue({ id: 'gid-1', join_code: 'K7M2QX' });
  useRidePlanStore.getState().clearPlan();
  useToastStore.setState({ toasts: [] });
  useAppStore.setState({ groupId: null });
});

afterEach(() => {
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
  useAppStore.setState({ setGroupId: ORIGINAL_SET_GROUP_ID });
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const lastToast = () => {
  const t = useToastStore.getState().toasts;
  return t[t.length - 1];
};

describe('CreateRideModal disabled reason', () => {
  test('explains why Create is disabled until a destination is chosen', () => {
    const { tree } = render();
    expect(hasText(tree, 'Choose a destination to continue')).toBe(true);
    expect(byLabel(tree, 'Create ride').props.disabled).toBe(true);
  });

  test('reason disappears and Create enables once a destination exists', () => {
    act(() => useRidePlanStore.getState().setDestination(DEST));
    const { tree } = render();
    expect(hasText(tree, 'Choose a destination to continue')).toBe(false);
    expect(byLabel(tree, 'Create ride').props.disabled).toBe(false);
  });
});

describe('CreateRideModal ride meta', () => {
  beforeEach(() => {
    act(() => useRidePlanStore.getState().setDestination(DEST));
  });

  test('offers every ride type and the five start presets', () => {
    const { tree } = render();
    ['Casual', 'Touring', 'Sport', 'Off-road'].forEach((l) => expect(hasLabel(tree, l)).toBe(true));
    ['Now', 'In 30 min', 'In 1 hour', 'In 2 hours', 'Tomorrow 6:00'].forEach((l) =>
      expect(hasLabel(tree, l)).toBe(true)
    );
  });

  test('passes the chosen ride type and start time to createGroup', async () => {
    const { tree } = render();
    await press(tree, 'Sport');
    await press(tree, 'In 1 hour');
    await press(tree, 'Create ride');
    expect(mockSvc.createGroup).toHaveBeenCalledTimes(1);
    const [name, plan, meta] = mockSvc.createGroup.mock.calls[0];
    expect(name).toBe('Ride to Lonavala');
    expect(plan.destination).toEqual(DEST);
    expect(meta).toEqual({ ride_type: 'Sport', start_time_ms: FIXED_NOW + 60 * 60_000 });
  });

  test('Tomorrow 6:00 is sent as 06:00 local the next day', async () => {
    const { tree } = render();
    await press(tree, 'Tomorrow 6:00');
    await press(tree, 'Create ride');
    const meta = mockSvc.createGroup.mock.calls[0][2];
    expect(meta.start_time_ms).toBe(new Date(2026, 9, 6, 6, 0, 0, 0).getTime());
    expect(meta).not.toHaveProperty('ride_type');
  });

  test('picking nothing sends neither field', async () => {
    const { tree } = render();
    await press(tree, 'Create ride');
    const meta = mockSvc.createGroup.mock.calls[0][2];
    expect(meta).not.toHaveProperty('ride_type');
    expect(meta).not.toHaveProperty('start_time_ms');
  });

  test('chips are single-select and can be deselected', async () => {
    const { tree } = render();
    await press(tree, 'Sport');
    expect(selected(tree, 'Sport')).toBe(true);
    await press(tree, 'Touring');
    expect(selected(tree, 'Sport')).toBe(false);
    expect(selected(tree, 'Touring')).toBe(true);
    await press(tree, 'Touring');
    expect(selected(tree, 'Touring')).toBe(false);
    await press(tree, 'Now');
    await press(tree, 'Now');
    await press(tree, 'Create ride');
    expect(mockSvc.createGroup.mock.calls[0][2]).toEqual({});
  });

  test('selections reset when the modal is reopened', async () => {
    const { tree, onClose, onCreated } = render();
    await press(tree, 'Sport');
    act(() => tree.update(<CreateRideModal visible={false} onClose={onClose} onCreated={onCreated} />));
    act(() => tree.update(<CreateRideModal visible onClose={onClose} onCreated={onCreated} />));
    expect(selected(tree, 'Sport')).toBe(false);
  });
});

describe('CreateRideModal after create', () => {
  beforeEach(() => {
    act(() => useRidePlanStore.getState().setDestination(DEST));
  });

  test('toasts the join code, then setGroupId, onCreated, onClose', async () => {
    const order: string[] = [];
    useAppStore.setState({
      setGroupId: (id) => {
        order.push(`set:${id}`);
        ORIGINAL_SET_GROUP_ID(id);
      },
    });
    const onCreated = jest.fn(() => order.push('created'));
    const onClose = jest.fn(() => order.push('close'));
    const { tree } = render({ onCreated, onClose });
    await press(tree, 'Create ride');
    expect(mockSvc.getGroup).toHaveBeenCalledWith('gid-1');
    expect(lastToast()).toMatchObject({ message: 'Ride created — join code K7M2QX', variant: 'success' });
    expect(order).toEqual(['set:gid-1', 'created', 'close']);
    expect(onCreated).toHaveBeenCalledWith('gid-1');
  });

  test('falls back to the generic message when the group read fails', async () => {
    mockSvc.getGroup.mockRejectedValue(new Error('offline'));
    const { tree, onCreated } = render();
    await press(tree, 'Create ride');
    expect(lastToast().message).toBe('Ride created — share the join code with your group');
    expect(onCreated).toHaveBeenCalledWith('gid-1');
  });

  test('falls back when the group has no join code', async () => {
    mockSvc.getGroup.mockResolvedValue({ id: 'gid-1', join_code: null });
    const { tree } = render();
    await press(tree, 'Create ride');
    expect(lastToast().message).toBe('Ride created — share the join code with your group');
  });

  test('a createGroup failure toasts an error and keeps the modal open', async () => {
    mockSvc.createGroup.mockRejectedValue(new Error('boom'));
    const { tree, onCreated, onClose } = render();
    await press(tree, 'Create ride');
    expect(lastToast()).toMatchObject({ variant: 'error' });
    expect(onCreated).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(byLabel(tree, 'Create ride').props.disabled).toBe(false);
  });
});

describe('CreateRideModal place search', () => {
  test('lists results and picks one for the active field', async () => {
    mockGeocode.mockResolvedValue([{ label: 'Pune, India', lat: 18.5, lng: 73.8 }]);
    const { tree } = render();
    await press(tree, 'Destination field');
    await search(tree, 'pune');
    expect(mockGeocode).toHaveBeenCalledWith('pune');
    await press(tree, 'Select Pune, India');
    expect(useRidePlanStore.getState().destination).toMatchObject({ label: 'Pune, India' });
  });

  test('no results shows "No places found" with the query', async () => {
    mockGeocode.mockResolvedValue([]);
    const { tree } = render();
    await search(tree, 'qzxqzx');
    expect(hasText(tree, 'No places found for "qzxqzx"')).toBe(true);
    expect(hasText(tree, 'Search is unavailable')).toBe(false);
  });

  test('a network failure shows "Search is unavailable" and keeps the query editable', async () => {
    mockGeocode.mockRejectedValue(new Error('offline'));
    const { tree } = render();
    await search(tree, 'pune');
    expect(hasText(tree, 'Search is unavailable — check your connection')).toBe(true);
    expect(hasText(tree, 'No places found')).toBe(false);
    expect(byLabel(tree, 'Location search input').props.value).toBe('pune');
    expect(byLabel(tree, 'Location search input').props.editable).not.toBe(false);
  });

  test('Retry searches again and recovers', async () => {
    mockGeocode.mockRejectedValueOnce(new Error('offline'));
    mockGeocode.mockResolvedValue([{ label: 'Pune, India', lat: 18.5, lng: 73.8 }]);
    const { tree } = render();
    await search(tree, 'pune');
    expect(hasText(tree, 'Search is unavailable')).toBe(true);
    act(() => byLabel(tree, 'Retry search').props.onPress());
    await act(async () => {
      jest.advanceTimersByTime(450);
    });
    expect(hasText(tree, 'Search is unavailable')).toBe(false);
    expect(hasLabel(tree, 'Select Pune, India')).toBe(true);
  });

  test('queries under 3 characters do not search or show a message', async () => {
    const { tree } = render();
    await search(tree, 'pu');
    expect(mockGeocode).not.toHaveBeenCalled();
    expect(hasText(tree, 'No places found')).toBe(false);
  });
});
