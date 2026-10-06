/**
 * MemberSheet — placeholder until implemented (docs/DEMO_PARITY_SPEC.md §1/§3). Keep the default export and props.
 */
import React from 'react';
import { Text } from 'react-native';
import { Sheet } from '../ui';

export interface MemberSheetProps {
  visible: boolean;
  onClose: () => void;
  [extra: string]: any;
}

export default function MemberSheet({ visible, onClose }: MemberSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-Member">
      <Text>Member</Text>
    </Sheet>
  );
}
