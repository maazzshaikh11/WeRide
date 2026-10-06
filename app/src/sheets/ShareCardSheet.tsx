/**
 * ShareCardSheet — placeholder until implemented (docs/DEMO_PARITY_SPEC.md §1/§3). Keep the default export and props.
 */
import React from 'react';
import { Text } from 'react-native';
import { Sheet } from '../ui';

export interface ShareCardSheetProps {
  visible: boolean;
  onClose: () => void;
  [extra: string]: any;
}

export default function ShareCardSheet({ visible, onClose }: ShareCardSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-ShareCard">
      <Text>ShareCard</Text>
    </Sheet>
  );
}
