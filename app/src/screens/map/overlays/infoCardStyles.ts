/**
 * Shared styles for the floating info cards (rider / hazard / SOS) so they read
 * as one family: dark2 surface, hairline border, WeRideRadius.xxl, 16 padding,
 * 12 gap, label/value rows and 48 px actions. Cards flow inside MapScreen's
 * bottom stack (no absolute positioning).
 */
import { StyleSheet } from 'react-native';
import { WeRideColors, WeRideRadius } from '../../../theme/theme';
import { type } from '../../../theme/typography';

export const infoCardStyles = StyleSheet.create({
  card: {
    backgroundColor: WeRideColors.dark2,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: WeRideRadius.xxl,
    padding: 16,
    gap: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { ...type.heading, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  label: { ...type.caption },
  value: { ...type.bodyStrong },
  actions: { flexDirection: 'row', gap: 12 },
  action: {
    flex: 1,
    minHeight: 48,
    borderRadius: WeRideRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  actionText: { ...type.buttonSm },
  actionPrimary: { backgroundColor: WeRideColors.primary },
  actionDanger: { backgroundColor: WeRideColors.red },
  actionSecondary: {
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
  },
  actionSecondaryText: { ...type.buttonSm, color: WeRideColors.text },
  hint: { ...type.caption },
});
