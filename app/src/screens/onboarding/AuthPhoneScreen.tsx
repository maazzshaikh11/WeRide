/**
 * AuthPhone — step 1 of 5 (demo `auth-phone`): +91 chip and a 10-digit field; "Send code" really texts a code via
 * Firebase phone auth. "Use email instead" opens the email sign-in. Errors (bad number, too many requests,
 * no network) are shown inline.
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Button, Icon, PressableScale, Screen, Stepper, TextField, TopBar } from '../../ui';
import { useStyles, useTheme } from '../../theme/ThemeProvider';
import { AuthFlowError, startPhoneSignIn } from '../../services/authService';
import Kav from './parts/Kav';

export const COUNTRY_CODE = '+91';
export const PHONE_DIGITS = 10;

export function phoneErrorMessage(e: unknown): string {
  return e instanceof AuthFlowError ? e.message : 'Something went wrong. Please try again.';
}

export default function AuthPhoneScreen({ navigation }: any) {
  const { colors, type } = useTheme();
  const s = useStyles(({ colors: c, type: t }) => ({
    row: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    chip: { height: 60, borderRadius: 18, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: c.card, borderWidth: 1.5, borderColor: c.line2 },
    err: { ...t.sm, color: c.bad, marginTop: 10, marginLeft: 2 },
    link: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', minHeight: 44, marginTop: 6 },
    lock: { flexDirection: 'row', gap: 10, marginTop: 18 },
  }));
  const [digits, setDigits] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = digits.length === PHONE_DIGITS;

  const send = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      await startPhoneSignIn(`${COUNTRY_CODE}${digits}`);
      navigation.navigate('AuthOtp');
    } catch (e) {
      setError(phoneErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Kav>
      <Screen
        testID="screen-AuthPhone"
        cta={<Button label="Send code" onPress={send} disabled={!ready} loading={busy} testID="send-code" />}
      >
        <TopBar onBack={() => navigation.goBack()} />
        <Stepper step={1} />
        <Text style={type.label}>STEP 1 OF 5</Text>
        <Text style={[type.h1, { marginTop: 12 }]} accessibilityRole="header">Your number{'\n'}is your key.</Text>
        <Text style={[type.body, { marginTop: 12 }]}>We text you a code. No passwords to forget on a cold morning.</Text>
        <Text style={[type.fieldLabel, { marginTop: 32, marginBottom: 8, marginLeft: 2 }]}>MOBILE NUMBER</Text>
        <View style={s.row}>
          <View style={s.chip} accessible accessibilityLabel="Country code plus 91">
            <Text style={[type.num, { fontSize: 18, lineHeight: 22 }]}>{COUNTRY_CODE}</Text>
          </View>
          <TextField
            containerStyle={{ flex: 1 }}
            value={digits}
            onChangeText={(v) => {
              setDigits(v.replace(/\D/g, '').slice(0, PHONE_DIGITS));
              if (error) setError(null);
            }}
            placeholder="98765 43210"
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={PHONE_DIGITS}
            autoComplete="tel"
            textContentType="telephoneNumber"
            returnKeyType="go"
            onSubmitEditing={send}
            editable={!busy}
            accessibilityLabel="Mobile number input"
            testID="phone-input"
          />
        </View>
        {error ? (
          <Text style={s.err} accessibilityRole="alert" accessibilityLiveRegion="polite" testID="phone-error">{error}</Text>
        ) : null}
        <PressableScale
          style={s.link}
          onPress={() => navigation.navigate('AuthEmail')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Use email instead"
          testID="use-email"
        >
          <Icon name="me" size={18} color={colors.ink} />
          <Text style={[type.bodyStrong, { textDecorationLine: 'underline', textDecorationColor: colors.pri }]}>Use email instead</Text>
        </PressableScale>
        <View style={s.lock}>
          <Icon name="lock" size={18} color={colors.ink2} />
          <Text style={[type.sm, { flex: 1 }]}>Only your crew sees you, and only during a ride. We never sell location data.</Text>
        </View>
      </Screen>
    </Kav>
  );
}
