import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../supabaseClient';

export default function AuthScreen() {
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'unspecified' ? 'light' : systemScheme;
  const colors = Colors[scheme];

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

  const dynamicStyles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    title: {
      color: colors.text, fontFamily: 'Helvetica', fontWeight: '900',
      fontSize: 40, letterSpacing: -1, textAlign: 'center',
    },
    subtitle: {
      textAlign: 'center', marginTop: Spacing.two, marginBottom: Spacing.six,
    },
    label: {
      fontSize: 12, fontWeight: '900', color: colors.accentCyan,
      marginBottom: Spacing.two, marginTop: Spacing.three, letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.backgroundElement, color: colors.text, padding: Spacing.three,
      borderRadius: 12, borderWidth: 2, borderColor: colors.border, fontSize: 15,
    },
    signInBtnShadow: { backgroundColor: colors.border, borderRadius: 14, marginTop: Spacing.five },
    signInBtn: {
      backgroundColor: colors.accentYellow, borderWidth: 2, borderColor: colors.border,
      borderRadius: 14, paddingVertical: Spacing.three, alignItems: 'center',
      transform: [{ translateX: -3 }, { translateY: -3 }],
    },
    signUpBtnShadow: { backgroundColor: colors.border, borderRadius: 14, marginTop: Spacing.three },
    signUpBtn: {
      backgroundColor: colors.accentCyan, borderWidth: 2, borderColor: colors.border,
      borderRadius: 14, paddingVertical: Spacing.three, alignItems: 'center',
      transform: [{ translateX: -3 }, { translateY: -3 }],
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <ThemedText style={dynamicStyles.title}>LetsLiinger</ThemedText>
          <ThemedText style={dynamicStyles.subtitle} themeColor="textSecondary">
            See what's happenin
          </ThemedText>

          <ThemedText style={dynamicStyles.label}>Email</ThemedText>
          <TextInput
            style={dynamicStyles.input}
            placeholder="you@email.com"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <ThemedText style={dynamicStyles.label}>Password</ThemedText>
          <TextInput
            style={dynamicStyles.input}
            placeholder=""
            placeholderTextColor={colors.textSecondary}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {errorMsg ? <ThemedText style={styles.error}>{errorMsg}</ThemedText> : null}
          {infoMsg ? (
            <ThemedText style={styles.info} themeColor="accentCyan">{infoMsg}</ThemedText>
          ) : null}

          <View style={dynamicStyles.signInBtnShadow}>
            <TouchableOpacity style={dynamicStyles.signInBtn} onPress={handleSignIn} disabled={loading}>
              <ThemedText style={styles.buttonText}>{loading ? '...' : 'Sign In'}</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={dynamicStyles.signUpBtnShadow}>
            <TouchableOpacity style={dynamicStyles.signUpBtn} onPress={handleSignUp} disabled={loading}>
              <ThemedText style={styles.buttonText}>Create Account</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: Spacing.four },
  buttonText: { fontWeight: '900', color: '#000', fontSize: 14 },
  error: { color: '#ff6b6b', fontWeight: '700', marginTop: Spacing.three, textAlign: 'center' },
  info: { fontWeight: '700', marginTop: Spacing.three, textAlign: 'center' },
});
