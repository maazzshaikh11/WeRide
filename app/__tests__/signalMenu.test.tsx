/**
 * SignalMenu must not claim a signal was sent when the socket is down.
 * Online it emits 'signal:send' (the server relays it to the group).
 */
import React from 'react';
import { act, create } from 'react-test-renderer';

const mockSocket = { connected: true, emit: jest.fn() };
jest.mock('../src/services/socketService', () => ({
  getLocationSocket: () => mockSocket,
}));

import SignalMenu from '../src/components/SignalMenu';
import { useToastStore } from '../src/store/toastStore';

const mounted: ReturnType<typeof create>[] = [];
function render(el: React.ReactElement) {
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(el);
  });
  mounted.push(tree);
  return tree;
}

function pressOption(tree: ReturnType<typeof create>, label: string) {
  const node = tree.root.findByProps({ accessibilityLabel: `Send signal: ${label}` });
  act(() => node.props.onPress());
}

describe('SignalMenu', () => {
  afterEach(() => {
    // Unmount so Animated effects don't flush after environment teardown.
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
  });

  beforeEach(() => {
    mockSocket.emit.mockClear();
    useToastStore.setState({ toasts: [] });
  });

  it('emits signal:send with group, rider and label when online', () => {
    mockSocket.connected = true;
    const onSend = jest.fn();
    const tree = render(<SignalMenu visible groupId="g1" riderId="r1" onSend={onSend} />);
    pressOption(tree, 'Pull over');
    expect(mockSocket.emit).toHaveBeenCalledWith('signal:send', {
      group_id: 'g1',
      rider_id: 'r1',
      label: 'Pull over',
    });
    expect(onSend).toHaveBeenCalledWith('Pull over');
    expect(useToastStore.getState().toasts.map((t: any) => t.message)).toEqual([
      expect.stringContaining('Signal sent'),
    ]);
  });

  it('offline: does NOT emit, does NOT report success, tells the rider', () => {
    mockSocket.connected = false;
    const onSend = jest.fn();
    const tree = render(<SignalMenu visible groupId="g1" riderId="r1" onSend={onSend} />);
    pressOption(tree, 'Need fuel');
    expect(mockSocket.emit).not.toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
    const msgs = useToastStore.getState().toasts.map((t: any) => t.message);
    expect(msgs).toEqual([expect.stringContaining('not sent')]);
  });
});
