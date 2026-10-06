/**
 * CrewMenuSheet — placeholder until implemented (docs/DEMO_PARITY_SPEC.md §1/§3). Keep the default export and props.
 */
import React from 'react';
import { Text } from 'react-native';
import { Sheet } from '../ui';

export interface CrewMenuSheetProps {
  visible: boolean;
  onClose: () => void;
  [extra: string]: any;
}

export default function CrewMenuSheet({ visible, onClose }: CrewMenuSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-CrewMenu">
      <Text>CrewMenu</Text>
    </Sheet>
  );
}
