/** SecureRoot waits for the key before it loads the app (so stores open their encrypted MMKV), and wires the SOS queue opener. */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

const mockOrder: string[] = [];
let mockResolveInit: () => void = () => undefined;

jest.mock('../src/services/secureStorage', () => ({
  initSecureStorage: jest.fn(() => new Promise<void>((res) => { mockResolveInit = () => { mockOrder.push('key-loaded'); res(); }; })),
  getEncryptedMMKV: jest.fn(),
}));
jest.mock('@hazard/crdt/storageOpener', () => ({ setStorageOpener: jest.fn(() => { mockOrder.push('opener-set'); }) }));
jest.mock('../src/App', () => {
  mockOrder.push('app-loaded');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react');
  return { __esModule: true, default: () => R.createElement(Text, null, 'APP') };
});

import SecureRoot from '../src/SecureRoot';
import { setStorageOpener } from '@hazard/crdt/storageOpener';
import { getEncryptedMMKV } from '../src/services/secureStorage';

describe('SecureRoot', () => {
  it('renders nothing and does not load the app until the key is ready, then wires the SOS storage opener', async () => {
    let r!: TestRenderer.ReactTestRenderer;
    await act(async () => { r = TestRenderer.create(<SecureRoot />); });
    expect(r.toJSON()).toBeNull();
    expect(mockOrder).toEqual([]);
    await act(async () => { mockResolveInit(); });
    expect(mockOrder).toEqual(['key-loaded', 'opener-set', 'app-loaded']);
    expect(JSON.stringify(r.toJSON())).toContain('APP');
    expect(setStorageOpener).toHaveBeenCalledWith(getEncryptedMMKV);
  });
});
