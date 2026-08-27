/**
 * Login / Signup screen (P0).
 * Not explicitly assigned to one person — coordinate in sync.
 * Replaces login_screen.dart.
 */
import React, { useState } from 'react';
import { View, TextInput, Button, Text, StyleSheet, Alert } from 'react-native';
import { firebaseAuth } from '../services/firebaseService';
import { useAppStore } from '../store/appStore';
import { WeRideColors } from '../theme/theme';

export default function LoginScreen({ navigation }: any) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const setUserId = useAppStore((s) => s.setUserId);

  const signIn = async () => {
    try {
      const cred = await firebaseAuth.signInWithEmailAndPassword(email, password);
      setUserId(cred.user.uid);
      navigation.replace('Groups');
    } catch (e: any) {
      setError(e.message ?? 'Authentication failed');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <Button title="Sign In" color={WeRideColors.primary} onPress={signIn} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: WeRideColors.background },
  input: { borderWidth: 1, borderColor: WeRideColors.textSecondary, borderRadius: 8, padding: 12, marginBottom: 12 },
  error: { color: WeRideColors.error, marginTop: 12, textAlign: 'center' },
});