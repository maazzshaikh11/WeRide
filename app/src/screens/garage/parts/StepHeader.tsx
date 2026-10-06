/** Top of each Plan step: back chip, 3-bar progress, "PLAN A RIDE ∙ n OF 3" eyebrow and the title. */
import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../../../theme/ThemeProvider';
import { Stepper, TopBar } from '../../../ui';

export default function StepHeader({ step, title, onBack }: { step: 1 | 2 | 3; title: string; onBack: () => void }) {
  const { type } = useTheme();
  return (
    <>
      <TopBar onBack={onBack} style={{ marginBottom: 10 }} />
      <Stepper step={step} of={3} style={{ marginBottom: 14 }} />
      <Text style={type.label}>{`PLAN A RIDE ∙ ${step} OF 3`}</Text>
      <Text style={[type.h1, { marginTop: 8 }]} accessibilityRole="header">{title}</Text>
    </>
  );
}
