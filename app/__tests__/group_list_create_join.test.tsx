/**
 * GroupListScreen (T-19): list states, join, copy code, leave, create FAB, sign out.
 * Service boundaries (firebase, GroupService, clipboard) are mocked; the screen,
 * stores and theme are real.
 */
import React from 'react';
import { timeOfDay } from '../src/utils/rides';
import { Alert, LayoutAnimation } from 'react-native';
import { act, create, ReactTestInstance } from 'react-test-renderer';

const mockFirebaseAuth: { currentUser: { uid: string } | null; signOut: jest.Mock } = {
  currentUser: { uid: 'test-user-123' },
  signOut: jest.fn(),
};
jest.mock('../src/services/firebaseService', () => ({
  get firebaseAuth() {
    return mockFirebaseAuth;
  },
}));

const mockSetString = jest.fn();
jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: (...a: unknown[]) => mockSetString(...a) },
}));

const mockCalls: string[] = [];
jest.mock('../src/store/rideSession', () => ({
  resetRideSession: () => {
    mockCalls.push('reset');
  },
}));

let mockModalProps: any = null;
jest.mock('../src/components/CreateRideModal', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockModalProps = props;
    return null;
  },
}));

const mockUnsubscribe = jest.fn();
const mockSvc = {
  joinGroup: jest.fn(),
  leaveGroup: jest.fn(),
  myGroups: jest.fn(),
};
let mockHandlers: { onGroups: (g: any[]) => void; onError?: (e: unknown) => void } | null = null;
const mockCtor = jest.fn();
jest.mock('@routing/group/groupService', () => ({
  GroupService: function GroupService() {
    mockCtor();
    return mockSvc;
  },
}));

import GroupListScreen from '../src/screens/GroupListScreen';
import { useAppStore } from '../src/store/appStore';
import { Skeleton, TextField } from '../src/ui';

const ORIGINAL_SET_GROUP_ID = useAppStore.getState().setGroupId;
const NOW = Date.now();
const G1 = {
  id: 'group-1',
  name: 'Morning Ride',
  created_by: 'user-456',
  member_ids: ['test-user-123', 'user-456'],
  created_at: null,
  active_ride_id: null,
  join_code: 'K7M2QX',
  ride_type: 'Sport',
  start_time_ms: NOW + 25 * 60_000,
};
const G2_LEGACY = {
  id: 'legacy-uuid-2',
  name: 'Evening Ride',
  created_by: 'test-user-123',
  member_ids: ['test-user-123'],
  created_at: null,
  active_ride_id: null,
};

const mounted: ReturnType<typeof create>[] = [];
function render(navigation: any = { navigate: jest.fn(), reset: jest.fn() }) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<GroupListScreen navigation={navigation} />);
  });
  mounted.push(tree);
  return { tree, navigation };
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

async function deliver(groups: any[]) {
  await act(async () => {
    mockHandlers!.onGroups(groups);
  });
}
/** The real touchable (carries onPressIn); findByProps would return the outer wrapper. */
function realPressable(tree: ReturnType<typeof create>, label: string): ReactTestInstance {
  const found = tree.root.findAll(
    (n) => n.props.accessibilityLabel === label && typeof n.props.onPressIn === 'function'
  );
  if (!found.length) throw new Error(`no pressable labelled "${label}"`);
  return found[0];
}
async function pressReal(tree: ReturnType<typeof create>, label: string) {
  await act(async () => {
    await realPressable(tree, label).props.onPress({ nativeEvent: {} });
  });
}
async function press(tree: ReturnType<typeof create>, label: string) {
  await act(async () => {
    await byLabel(tree, label).props.onPress();
  });
}
function typeJoin(tree: ReturnType<typeof create>, v: string) {
  act(() => byLabel(tree, 'Join code input').props.onChangeText(v));
}

beforeEach(() => {
  mockCalls.length = 0;
  mockModalProps = null;
  mockHandlers = null;
  mockCtor.mockClear();
  mockSetString.mockReset();
  mockUnsubscribe.mockReset();
  mockFirebaseAuth.currentUser = { uid: 'test-user-123' };
  mockFirebaseAuth.signOut.mockReset().mockResolvedValue(undefined);
  mockSvc.joinGroup.mockReset().mockResolvedValue(undefined);
  mockSvc.leaveGroup.mockReset().mockResolvedValue(undefined);
  mockSvc.myGroups.mockReset().mockImplementation((onGroups, onError) => {
    mockHandlers = { onGroups, onError };
    return mockUnsubscribe;
  });
  useAppStore.setState({ userId: 'test-user-123', groupId: 'old', setGroupId: ORIGINAL_SET_GROUP_ID });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  mounted.splice(0).forEach((t) => act(() => t.unmount()));
});

describe('GroupListScreen states', () => {
  test('shows the title, Sign out, join row and create FAB', () => {
    const { tree } = render();
    // Greeting header (time-of-day + "rider") with the date eyebrow above it.
    expect(hasText(tree, ', rider')).toBe(true);
    expect(hasLabel(tree, 'Sign out')).toBe(true);
    expect(hasLabel(tree, 'Join code input')).toBe(true);
    expect(hasLabel(tree, 'Join group')).toBe(true);
    expect(hasLabel(tree, 'Create new ride')).toBe(true);
  });

  test('skeleton cards show while loading and are replaced by the real cards', async () => {
    const { tree } = render();
    expect(tree.root.findAllByType(Skeleton).length).toBeGreaterThanOrEqual(3);
    expect(hasLabel(tree, 'Open ride Morning Ride')).toBe(false);
    await deliver([G1, G2_LEGACY]);
    expect(tree.root.findAllByType(Skeleton)).toHaveLength(0);
    expect(hasLabel(tree, 'Open ride Morning Ride')).toBe(true);
    expect(hasLabel(tree, 'Open ride Evening Ride')).toBe(true);
  });

  test('loading state until the first snapshot, then the rides', async () => {
    const { tree } = render();
    expect(hasLabel(tree, 'Loading rides')).toBe(true);
    expect(hasText(tree, 'No rides yet')).toBe(false);
    await deliver([G1, G2_LEGACY]);
    expect(hasLabel(tree, 'Loading rides')).toBe(false);
    expect(hasLabel(tree, 'Open ride Morning Ride')).toBe(true);
    expect(hasLabel(tree, 'Open ride Evening Ride')).toBe(true);
  });

  test('empty state tells the user how to start', async () => {
    const { tree } = render();
    await deliver([]);
    expect(hasText(tree, 'No rides yet')).toBe(true);
    expect(hasText(tree, 'Create one with the + button, or join with a code.')).toBe(true);
  });

  test('error state shows a message and Try again resubscribes', async () => {
    const { tree } = render();
    expect(mockSvc.myGroups).toHaveBeenCalledTimes(1);
    await act(async () => {
      mockHandlers!.onError!(new Error('permission-denied'));
    });
    expect(hasText(tree, "Couldn't load your rides")).toBe(true);
    expect(hasText(tree, 'permission-denied')).toBe(true);
    // an error must not be presented as "no rides"
    expect(hasText(tree, 'No rides yet')).toBe(false);
    await press(tree, 'Try again');
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    expect(mockSvc.myGroups).toHaveBeenCalledTimes(2);
    expect(hasLabel(tree, 'Loading rides')).toBe(true);
    await deliver([G1]);
    expect(hasLabel(tree, 'Open ride Morning Ride')).toBe(true);
  });

  test('creates a single GroupService and unsubscribes on unmount', async () => {
    const { tree } = render();
    await deliver([G1]);
    await deliver([G1, G2_LEGACY]);
    expect(mockCtor).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('GroupListScreen cards', () => {
  test('cards show badge, date, stats (riders, type, start time) and the join code, grouped in sections', async () => {
    const { tree } = render();
    await deliver([G1, G2_LEGACY]);
    // Sections: the scheduled ride is "Up next"; the unscheduled legacy ride is under "Your rides".
    expect(hasText(tree, 'Up next')).toBe(true);
    expect(hasText(tree, 'Your rides')).toBe(true);
    // Badges reflect the schedule only.
    expect(hasText(tree, 'Upcoming')).toBe(true);
    expect(hasText(tree, 'Planned')).toBe(true);
    // Stats come from real fields.
    expect(hasText(tree, 'Sport')).toBe(true);
    expect(hasText(tree, timeOfDay(new Date(G1.start_time_ms as number)))).toBe(true);
    expect(hasText(tree, 'riders')).toBe(true);
    expect(hasText(tree, 'rider')).toBe(true);
    expect(hasLabel(tree, 'Join code K7M2QX')).toBe(true);
    // Legacy ride: no invented start/code, and a Copy ID action instead
    expect(hasLabel(tree, 'Copy ride ID for Evening Ride')).toBe(true);
    expect(hasLabel(tree, 'Copy join code for Evening Ride')).toBe(false);
    expect(hasText(tree, 'Copy ID')).toBe(true);
  });

  test('opening a ride resets the session, sets the group, then navigates', async () => {
    useAppStore.setState({
      setGroupId: (id: string | null) => {
        mockCalls.push(`set:${id}`);
        ORIGINAL_SET_GROUP_ID(id);
      },
    });
    const { tree, navigation } = render();
    await deliver([G1]);
    await press(tree, 'Open ride Morning Ride');
    expect(mockCalls).toEqual(['reset', 'set:group-1']);
    expect(navigation.navigate).toHaveBeenCalledWith('MainApp', { groupId: 'group-1' });
  });

  test('pressing the card itself opens the ride', async () => {
    const { tree, navigation } = render();
    await deliver([G1]);
    await pressReal(tree, 'Open ride Morning Ride');
    expect(mockCalls).toEqual(['reset']);
    expect(navigation.navigate).toHaveBeenCalledWith('MainApp', { groupId: 'group-1' });
  });

  test('pressing Copy does not open the ride', async () => {
    const { tree, navigation } = render();
    await deliver([G1]);
    const card = realPressable(tree, 'Open ride Morning Ride');
    const copyBtn = realPressable(tree, 'Copy join code for Morning Ride');
    // a separate pressable nested inside the card, not the card's own handler
    expect(copyBtn).not.toBe(card);
    expect(card.findAll((n) => n === copyBtn)).toHaveLength(1);
    await pressReal(tree, 'Copy join code for Morning Ride');
    expect(mockSetString).toHaveBeenCalledWith('K7M2QX');
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(mockCalls).toEqual([]);
  });

  test('pressing Leave does not open the ride', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { tree, navigation } = render();
    await deliver([G1]);
    await pressReal(tree, 'Leave Morning Ride');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(navigation.navigate).not.toHaveBeenCalled();
    expect(mockCalls).toEqual([]);
  });

  test('a removed ride animates out and the remaining card stays', async () => {
    const configure = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => undefined);
    const { tree } = render();
    await deliver([G1, G2_LEGACY]);
    expect(configure).not.toHaveBeenCalled(); // first load is not animated
    await deliver([G2_LEGACY]);
    expect(configure).toHaveBeenCalledTimes(1);
    expect(hasLabel(tree, 'Open ride Morning Ride')).toBe(false);
    expect(hasLabel(tree, 'Open ride Evening Ride')).toBe(true);
  });

  test('Copy puts the join code on the clipboard and flips to Copied for ~1.8s', async () => {
    jest.useFakeTimers();
    const { tree } = render();
    await deliver([G1]);
    await press(tree, 'Copy join code for Morning Ride');
    expect(mockSetString).toHaveBeenCalledWith('K7M2QX');
    expect(hasText(tree, 'Copied')).toBe(true);
    act(() => {
      jest.advanceTimersByTime(1700);
    });
    expect(hasText(tree, 'Copied')).toBe(true);
    act(() => {
      jest.advanceTimersByTime(200);
    });
    // reverted: the "Copied" label fades out (stays mounted ~200ms) then unmounts
    expect(hasText(tree, 'Copy')).toBe(true);
    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(hasText(tree, 'Copied')).toBe(false);
    expect(hasText(tree, 'Copy')).toBe(true);
  });

  test('Copy ID copies the raw id for legacy rides', async () => {
    const { tree } = render();
    await deliver([G2_LEGACY]);
    await press(tree, 'Copy ride ID for Evening Ride');
    expect(mockSetString).toHaveBeenCalledWith('legacy-uuid-2');
  });

  test('a clipboard failure is reported, not thrown', async () => {
    mockSetString.mockImplementation(() => {
      throw new Error('no clipboard');
    });
    const { tree } = render();
    await deliver([G1]);
    await press(tree, 'Copy join code for Morning Ride');
    expect(hasText(tree, 'Could not copy. Try again.')).toBe(true);
    expect(hasText(tree, 'Copied')).toBe(false);
  });

  test('Leave asks for confirmation, then calls leaveGroup', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { tree } = render();
    await deliver([G1]);
    await press(tree, 'Leave Morning Ride');
    expect(alert).toHaveBeenCalledTimes(1);
    expect(mockSvc.leaveGroup).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons.map((b) => b.text)).toEqual(['Cancel', 'Leave']);
    await act(async () => {
      buttons[1].onPress!();
    });
    expect(mockSvc.leaveGroup).toHaveBeenCalledWith('group-1');
  });

  test('cancelling the confirm does not leave', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { tree } = render();
    await deliver([G1]);
    await press(tree, 'Leave Morning Ride');
    const buttons = alert.mock.calls[0][2]!;
    expect(buttons[0].onPress).toBeUndefined();
    expect(mockSvc.leaveGroup).not.toHaveBeenCalled();
  });

  test('a failed leave shows an inline error on that card', async () => {
    mockSvc.leaveGroup.mockRejectedValue(new Error('Missing permissions'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { tree } = render();
    await deliver([G1, G2_LEGACY]);
    await press(tree, 'Leave Morning Ride');
    await act(async () => {
      alert.mock.calls[0][2]![1].onPress!();
    });
    expect(hasText(tree, 'Missing permissions')).toBe(true);
  });
});

describe('GroupListScreen join', () => {
  test('Join is disabled while the field is empty', () => {
    const { tree } = render();
    expect(byLabel(tree, 'Join group').props.disabled).toBe(true);
    typeJoin(tree, 'abc');
    expect(byLabel(tree, 'Join group').props.disabled).toBe(false);
  });

  test('short codes are uppercased as typed; long raw ids keep their case', () => {
    const { tree } = render();
    typeJoin(tree, 'k7m2');
    expect(byLabel(tree, 'Join code input').props.value).toBe('K7M2');
    typeJoin(tree, '3f2a9b1c-aaaa-bbbb-cccc-0123456789ab');
    expect(byLabel(tree, 'Join code input').props.value).toBe('3f2a9b1c-aaaa-bbbb-cccc-0123456789ab');
  });

  test('success joins with the trimmed code, clears the field, shows an inline line', async () => {
    const { tree } = render();
    await deliver([]);
    typeJoin(tree, ' K7M2QX ');
    await press(tree, 'Join group');
    expect(mockSvc.joinGroup).toHaveBeenCalledWith('K7M2QX');
    expect(byLabel(tree, 'Join code input').props.value).toBe('');
    expect(hasText(tree, 'Joined the ride')).toBe(true);
  });

  test('success line names the ride once it shows up in the list', async () => {
    const { tree } = render();
    await deliver([]);
    typeJoin(tree, 'k7m2qx');
    await press(tree, 'Join group');
    expect(hasText(tree, 'Joined the ride')).toBe(true);
    await deliver([G1]);
    expect(hasText(tree, 'Joined Morning Ride')).toBe(true);
  });

  test('failure shows the service message inline and keeps the code', async () => {
    mockSvc.joinGroup.mockRejectedValue(new Error('Group "ZZZZZZ" not found'));
    const alert = jest.spyOn(Alert, 'alert');
    const { tree } = render();
    await deliver([]);
    typeJoin(tree, 'zzzzzz');
    await press(tree, 'Join group');
    expect(hasText(tree, 'Group "ZZZZZZ" not found')).toBe(true);
    expect(hasText(tree, 'Joined')).toBe(false);
    expect(byLabel(tree, 'Join code input').props.value).toBe('ZZZZZZ');
    expect(alert).not.toHaveBeenCalled();
  });

  test('a failed join passes the message to the field (shake + error text)', async () => {
    mockSvc.joinGroup.mockRejectedValue(new Error('Group "ZZZZZZ" not found'));
    const { tree } = render();
    await deliver([]);
    expect(tree.root.findByType(TextField).props.error).toBeNull();
    typeJoin(tree, 'zzzzzz');
    await press(tree, 'Join group');
    expect(tree.root.findByType(TextField).props.error).toBe('Group "ZZZZZZ" not found');
    typeJoin(tree, 'zzzzz');
    expect(tree.root.findByType(TextField).props.error).toBeNull();
  });

  test('Join is disabled while in flight and does not double-submit', async () => {
    let resolve!: () => void;
    mockSvc.joinGroup.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    const { tree } = render();
    await deliver([]);
    typeJoin(tree, 'K7M2QX');
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = byLabel(tree, 'Join group').props.onPress();
    });
    expect(byLabel(tree, 'Join group').props.disabled).toBe(true);
    await act(async () => {
      await byLabel(tree, 'Join group').props.onPress();
    });
    expect(mockSvc.joinGroup).toHaveBeenCalledTimes(1);
    await act(async () => {
      resolve();
      await pending;
    });
    expect(byLabel(tree, 'Join code input').props.value).toBe('');
  });

  test('typing clears the previous message', async () => {
    mockSvc.joinGroup.mockRejectedValue(new Error('nope'));
    const { tree } = render();
    await deliver([]);
    typeJoin(tree, 'ABC');
    await press(tree, 'Join group');
    expect(hasText(tree, 'nope')).toBe(true);
    typeJoin(tree, 'ABCD');
    expect(hasText(tree, 'nope')).toBe(false);
  });
});

describe('GroupListScreen create FAB', () => {
  test('resets the ride session and opens the create modal', async () => {
    const { tree } = render();
    expect(mockModalProps.visible).toBe(false);
    await press(tree, 'Create new ride');
    expect(mockCalls).toEqual(['reset']);
    expect(mockModalProps.visible).toBe(true);
  });

  test('onCreated closes the modal and opens the new ride', async () => {
    const { tree, navigation } = render();
    await press(tree, 'Create new ride');
    act(() => mockModalProps.onCreated('new-group-id-123'));
    expect(mockModalProps.visible).toBe(false);
    expect(navigation.navigate).toHaveBeenCalledWith('MainApp', { groupId: 'new-group-id-123' });
  });
});

describe('GroupListScreen sign out', () => {
  test('signs out, clears user/group/session, resets navigation to Login', async () => {
    const { tree, navigation } = render();
    await deliver([]);
    await press(tree, 'Sign out');
    expect(mockFirebaseAuth.signOut).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().userId).toBeNull();
    expect(useAppStore.getState().groupId).toBeNull();
    expect(mockCalls).toContain('reset');
    expect(navigation.reset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Login' }] });
  });

  test('a sign-out failure stays on the screen with an inline error', async () => {
    mockFirebaseAuth.signOut.mockRejectedValue(new Error('network down'));
    const { tree, navigation } = render();
    await deliver([]);
    await press(tree, 'Sign out');
    expect(hasText(tree, 'network down')).toBe(true);
    expect(navigation.reset).not.toHaveBeenCalled();
    expect(useAppStore.getState().userId).toBe('test-user-123');
  });
});
