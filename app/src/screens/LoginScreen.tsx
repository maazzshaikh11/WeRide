/**
 * Login / Signup screen (P0) — dark WeRide restyle (spec §3.1).
 * Auth flow unchanged: firebaseAuth.signInWithEmailAndPassword → setUserId → Groups.
 */
import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { firebaseAuth, saveFcmToken } from '../services/firebaseService';
import { useAppStore } from '../store/appStore';
import { WeRideColors, WeRideFonts } from '../theme/theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setUserId = useAppStore((s) => s.setUserId);

  const signIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
      setUserId(cred.user.uid);
      // Register this device for SOS push (best-effort; must not block login).
      saveFcmToken(cred.user.uid).catch((e) =>
        console.warn('[LoginScreen] FCM token save failed:', e)
      );
      navigation.replace('Groups');
    } catch (e: any) {
      setError(e.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>WE<Text style={styles.logoAccent}>RIDE</Text></Text>
          <Text style={styles.subtitle}>Group riding, safer together.</Text>
        </View>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={WeRideColors.textSub}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel="Email input"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={WeRideColors.textSub}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          accessibilityLabel="Password input"
        />

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, loading && styles.buttonLoading]}
          onPress={signIn}
          disabled={loading}
          accessibilityLabel="Sign in"
          accessibilityRole="button"
          accessibilityState={{ disabled: loading }}
        >
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={WeRideColors.white} size="small" />
              <Text style={styles.buttonText}>Signing in…</Text>
            </View>
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WeRideColors.dark },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  logoWrap: { alignItems: 'center' },
  logo: {
    fontFamily: WeRideFonts.heading,
    fontSize: 32,
    color: WeRideColors.text,
    letterSpacing: 1,
  },
  logoAccent: { color: WeRideColors.primary },
  subtitle: {
    fontFamily: WeRideFonts.body,
    fontSize: 12,
    color: WeRideColors.textSub,
    marginTop: 8,
  },
  input: {
    height: 48,
    backgroundColor: WeRideColors.dark3,
    borderWidth: 1,
    borderColor: WeRideColors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontFamily: WeRideFonts.body,
    fontSize: 14,
    color: WeRideColors.text,
    marginTop: 12,
  },
  button: {
    height: 48,
    backgroundColor: WeRideColors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  buttonPressed: { opacity: 0.85 },
  buttonLoading: { opacity: 0.6 },
  buttonText: {
    fontFamily: WeRideFonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: WeRideColors.onPrimary,
  },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: {
    fontFamily: WeRideFonts.body,
    fontSize: 12,
    color: WeRideColors.error,
    marginTop: 12,
    textAlign: 'center',
  },
});