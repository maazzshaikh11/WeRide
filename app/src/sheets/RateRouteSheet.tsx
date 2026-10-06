/**
 * RateRouteSheet — placeholder until implemented (docs/DEMO_PARITY_SPEC.md §1/§3). Keep the default export and props.
 */
import React from 'react';
import { Text } from 'react-native';
import { Sheet } from '../ui';

export interface RateRouteSheetProps {
  visible: boolean;
  onClose: () => void;
  [extra: string]: any;
}

export default function RateRouteSheet({ visible, onClose }: RateRouteSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} testID="sheet-RateRoute">
      <Text>RateRoute</Text>
    </Sheet>
  );
}
