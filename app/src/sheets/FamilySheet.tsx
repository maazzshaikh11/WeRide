/**
 * FamilySheet — placeholder until implemented (docs/DEMO_PARITY_SPEC.md §1/§3). Keep the default export and props.
 */
import React from 'react';
import { Text } from 'react-native';
import { Sheet } from '../ui';

export interface FamilySheetProps {
  visible: boolean;
  onClose: () => void;
  [extra: string]: any;
}

export default function FamilySheet({ visible, onClose }: FamilySheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-Family">
      <Text>Family</Text>
    </Sheet>
  );
}
