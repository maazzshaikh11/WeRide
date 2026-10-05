import { useAppStore } from '../src/store/appStore';

describe('appStore ride name', () => {
  beforeEach(() => useAppStore.setState({ groupId: null, groupName: null }));

  it('remembers the name for the current ride', () => {
    useAppStore.getState().setGroupId('g1');
    useAppStore.getState().setGroupName('Sunday Ghat Ride');
    expect(useAppStore.getState().groupName).toBe('Sunday Ghat Ride');
  });

  it('re-selecting the same ride keeps the name', () => {
    useAppStore.getState().setGroupId('g1');
    useAppStore.getState().setGroupName('Sunday Ghat Ride');
    useAppStore.getState().setGroupId('g1');
    expect(useAppStore.getState().groupName).toBe('Sunday Ghat Ride');
  });

  it('a different ride (or none) clears it, so a stale name never shows', () => {
    useAppStore.getState().setGroupId('g1');
    useAppStore.getState().setGroupName('Sunday Ghat Ride');
    useAppStore.getState().setGroupId('g2');
    expect(useAppStore.getState().groupName).toBeNull();
    useAppStore.getState().setGroupName('Other');
    useAppStore.getState().setGroupId(null);
    expect(useAppStore.getState().groupName).toBeNull();
  });
});
