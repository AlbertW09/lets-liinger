import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ShadowSurface } from '@/components/ui/shadow-surface';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '../supabaseClient';

// Reached from a password-recovery email link (the root layout routes here on
// the PASSWORD_RECOVERY auth event). Sets a new password, then signs out so
// the user logs in fresh with it.
export default function ResetPasswordScreen() {
  const colors = useTheme();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);

  async function handleSave() {
    setErrorMsg('');
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setSaving(false);
      setErrorMsg(error.message);
      return;
    }
    setDone(true);
    setSaving(false);
    // Sign out → root layout clears recovery + routes to /auth to sign in fresh.
    setTimeout(() => supabase.auth.signOut(), 1500);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <ThemedText style={[styles.title, { color: colors.text }]}>Set a new password</ThemedText>

          {done ? (
            <ThemedText style={styles.info} themeColor="accentGreen">
              Password updated! Taking you back to sign in…
            </ThemedText>
          ) : (
            <>
              <TextField label="New password" secureTextEntry value={password} onChangeText={setPassword} />
              <TextField label="Confirm password" secureTextEntry value={confirm} onChangeText={setConfirm} />

              {errorMsg ? <ThemedText style={styles.error}>{errorMsg}</ThemedText> : null}

              <ShadowSurface
                backgroundColor={colors.accentYellow}
                radius={14}
                offset={3}
                wrapperStyle={styles.btnShadow}
                style={styles.btn}
                onPress={handleSave}
                disabled={saving}
              >
                <ThemedText style={styles.btnText}>{saving ? '...' : 'Update password'}</ThemedText>
              </ShadowSurface>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  title: { fontFamily: 'Helvetica', fontWeight: '900', fontSize: 28, letterSpacing: -1, textAlign: 'center', marginBottom: Spacing.four },
  btnShadow: { marginTop: Spacing.four },
  btn: { paddingVertical: Spacing.three, alignItems: 'center' },
  btnText: { fontWeight: '900', color: '#000', fontSize: 15 },
  error: { color: '#ff6b6b', fontWeight: '700', marginTop: Spacing.three, textAlign: 'center' },
  info: { fontWeight: '800', textAlign: 'center', fontSize: 15 },
});
