/**
 * SosModal safety flow: clear consequence copy with the real rider count, a
 * red confirm that cannot fire without a location fix, and Cancel never sends.
 */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

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

    const send = tree.root.findByProps({ accessibilityLabel: 'Send SOS to group' });
    const flat = ([] as any[]).concat(send.props.style).flat().filter(Boolean);
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
});
