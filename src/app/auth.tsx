import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ShadowSurface } from '@/components/ui/shadow-surface';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '../supabaseClient';

export default function AuthScreen() {
  const colors = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  async function handleSignUp() {
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setErrorMsg(error.message);
    } else if (!data.session) {
      // Email confirmation is switched on in Supabase, so no session yet
      setInfoMsg('Check your email to confirm your account, then sign in.');
    }
    // On success with a session, the root layout takes over and routes to onboarding
    setLoading(false);
  }

  async function handleSignIn() {
    setLoading(true);
    setErrorMsg('');
    setInfoMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg(error.message);
    }
    // On success, the root layout takes over and routes onward
    setLoading(false);
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <ThemedText style={[styles.title, { color: colors.text }]}>LetsLiinger</ThemedText>
          <ThemedText style={styles.subtitle} themeColor="textSecondary">
            See what's happenin
          </ThemedText>

          <TextField label="Email" placeholder="you@email.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" value={email} onChangeText={setEmail} />
          <TextField label="Password" secureTextEntry value={password} onChangeText={setPassword} />

          {errorMsg ? <ThemedText style={styles.error}>{errorMsg}</ThemedText> : null}
          {infoMsg ? (
            <ThemedText style={styles.info} themeColor="accentCyan">{infoMsg}</ThemedText>
          ) : null}

          <ShadowSurface
            backgroundColor={colors.accentYellow}
            radius={14}
            offset={3}
            wrapperStyle={styles.signInShadow}
            style={styles.btn}
            onPress={handleSignIn}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>{loading ? '...' : 'Sign In'}</ThemedText>
          </ShadowSurface>

          <ShadowSurface
            backgroundColor={colors.accentCyan}
            radius={14}
            offset={3}
            wrapperStyle={styles.signUpShadow}
            style={styles.btn}
            onPress={handleSignUp}
            disabled={loading}
          >
            <ThemedText style={styles.buttonText}>Create Account</ThemedText>
          </ShadowSurface>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  title: {
    fontFamily: 'Helvetica', fontWeight: '900',
    fontSize: 40, letterSpacing: -1, textAlign: 'center',
  },
  subtitle: { textAlign: 'center', marginTop: Spacing.two, marginBottom: Spacing.six },
  btn: { paddingVertical: Spacing.three, alignItems: 'center' },
  signInShadow: { marginTop: Spacing.five },
  signUpShadow: { marginTop: Spacing.three },
  buttonText: { fontWeight: '900', color: '#000', fontSize: 14 },
  error: { color: '#ff6b6b', fontWeight: '700', marginTop: Spacing.three, textAlign: 'center' },
  info: { fontWeight: '700', marginTop: Spacing.three, textAlign: 'center' },
});
