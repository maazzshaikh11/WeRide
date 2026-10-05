/**
 * SosModal safety flow: clear consequence copy with the real rider count, a
 * red confirm that cannot fire without a location fix, and Cancel never sends.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Platform, Text, Vibration } from 'react-native';

const mockTriggerSos = jest.fn();
jest.mock('@hazard/services/sosService', () => ({
  triggerSos: (...args: unknown[]) => mockTriggerSos(...args),
}));

import SosModal from '../src/components/SosModal';
import { WeRideColors } from '../src/theme/theme';
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

function allText(tree: ReturnType<typeof create>): string {
  return tree.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat().join(''))
    .join('|');
}

/** The real pressable (findByProps returns the outer wrapper component). */
const pressable = (tree: ReturnType<typeof create>, label: string) =>
  tree.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPressIn === 'function')[0];

const press = (tree: ReturnType<typeof create>, label: string) =>
  act(() => {
    tree.root.findByProps({ accessibilityLabel: label }).props.onPress();
  });

describe('SosModal', () => {
  beforeEach(() => {
    mockTriggerSos.mockReset();
    useToastStore.setState({ toasts: [] });
  });
  afterEach(() => {
    mounted.splice(0).forEach((t) => act(() => t.unmount()));
  });

  const base = { visible: true, riderId: 'r1', groupId: 'g1', onCancel: jest.fn(), onSent: jest.fn() };

  it('states the consequence with the real rider count (singular and plural)', () => {
    const many = render(<SosModal {...base} riderCount={3} location={{ lat: 1, lng: 2 }} />);
    expect(allText(many)).toContain('all 3 riders');
    const one = render(<SosModal {...base} riderCount={1} location={{ lat: 1, lng: 2 }} />);
    expect(allText(one)).toContain('all 1 rider.');
  });

  it('confirm is red and sends the SOS with the current location', async () => {
    mockTriggerSos.mockResolvedValue('sos-1');
    const onSent = jest.fn();
    const tree = render(<SosModal {...base} onSent={onSent} riderCount={2} location={{ lat: 18.5, lng: 73.8 }} />);

    // Confirm is the red (danger) Button; the danger fill is the Button's own variant style.
    const send = tree.root.findByProps({ accessibilityLabel: 'Send SOS to group' });
    expect(send.props.variant).toBe('danger');
    const realSend = pressable(tree, 'Send SOS to group');
    const flat = ([] as any[]).concat(realSend.props.style).flat(3).filter(Boolean);
    expect(flat.some((s: any) => s.backgroundColor === WeRideColors.red)).toBe(true);

    await act(async () => {
      send.props.onPress();
    });
    expect(mockTriggerSos).toHaveBeenCalledWith('r1', 'g1', 18.5, 73.8);
    expect(onSent).toHaveBeenCalledWith('sos-1');
  });

  it('without a fix: confirm is disabled, says why, and never sends', () => {
    const tree = render(<SosModal {...base} riderCount={2} location={null} />);
    const send = tree.root.findByProps({ accessibilityLabel: 'Send SOS to group' });
    expect(send.props.disabled).toBe(true);
    expect(allText(tree)).toContain('Waiting for your location');
    press(tree, 'Send SOS to group');
    expect(mockTriggerSos).not.toHaveBeenCalled();
  });

  it('Cancel calls onCancel and does not send', () => {
    const onCancel = jest.fn();
    const tree = render(<SosModal {...base} onCancel={onCancel} riderCount={2} location={{ lat: 1, lng: 2 }} />);
    press(tree, 'Cancel, do not send SOS');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(mockTriggerSos).not.toHaveBeenCalled();
  });

  it('Cancel is a secondary Button and Send is a danger Button', () => {
    const tree = render(<SosModal {...base} riderCount={2} location={{ lat: 1, lng: 2 }} />);
    expect(tree.root.findByProps({ accessibilityLabel: 'Cancel, do not send SOS' }).props.variant).toBe('secondary');
    expect(tree.root.findByProps({ accessibilityLabel: 'Send SOS to group' }).props.variant).toBe('danger');
  });

  it('sending shows the loading state, calls triggerSos once, and gives one heavy haptic when sent', async () => {
    (Platform as any).OS = 'android';
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    vibrate.mockClear(); // RN's jest setup already mocks Vibration: drop earlier tests' calls
    let resolveSend!: (id: string) => void;
    mockTriggerSos.mockReturnValue(new Promise<string>((r) => { resolveSend = r; }));
    const onSent = jest.fn();
    const tree = render(<SosModal {...base} onSent={onSent} riderCount={2} location={{ lat: 18.5, lng: 73.8 }} />);

    const send = () => tree.root.findByProps({ accessibilityLabel: 'Send SOS to group' });
    expect(send().props.loading).toBe(false);

    await act(async () => {
      send().props.onPress();
      send().props.onPress(); // a second tap while sending must not send again
    });
    expect(send().props.loading).toBe(true);
    expect(pressable(tree, 'Send SOS to group').props.disabled).toBe(true);
    expect(mockTriggerSos).toHaveBeenCalledTimes(1);
    expect(vibrate).not.toHaveBeenCalled(); // no haptic until it actually went out

    await act(async () => {
      resolveSend('sos-9');
    });
    expect(onSent).toHaveBeenCalledWith('sos-9');
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(45); // haptic('heavy'), never the error pattern
    expect(send().props.loading).toBe(false);

    vibrate.mockRestore();
    (Platform as any).OS = 'ios';
  });

  it('a failed send gives no heavy haptic and re-enables the button', async () => {
    (Platform as any).OS = 'android';
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
    vibrate.mockClear();
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockTriggerSos.mockRejectedValue(new Error('offline'));
    const onSent = jest.fn();
    const tree = render(<SosModal {...base} onSent={onSent} riderCount={2} location={{ lat: 1, lng: 2 }} />);
    await act(async () => {
      tree.root.findByProps({ accessibilityLabel: 'Send SOS to group' }).props.onPress();
    });
    expect(onSent).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalledWith(45);
    expect(useToastStore.getState().toasts.map((t: any) => t.message)).toEqual(['Failed to send SOS']);
    expect(tree.root.findByProps({ accessibilityLabel: 'Send SOS to group' }).props.loading).toBe(false);
    errSpy.mockRestore();
    vibrate.mockRestore();
    (Platform as any).OS = 'ios';
  });
});
