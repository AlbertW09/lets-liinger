import { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../supabaseClient';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSignUp() {
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setErrorMsg(error.message);
    setLoading(false);
  }

  async function handleSignIn() {
    setLoading(true);
    setErrorMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setErrorMsg(error.message);
    setLoading(false);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>LetsLiinger</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
      <TouchableOpacity style={styles.button} onPress={handleSignIn} disabled={loading}>
        <Text style={styles.buttonText}>Sign In</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.buttonSecondary} onPress={handleSignUp} disabled={loading}>
        <Text style={styles.buttonText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#000' },
  title: { fontSize: 32, fontWeight: '900', color: '#fff', marginBottom: 24, textAlign: 'center' },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', padding: 14, borderRadius: 12,
    marginBottom: 12, borderWidth: 2, borderColor: '#333',
  },
  button: { backgroundColor: '#FFD93D', padding: 14, borderRadius: 12, marginTop: 8 },
  buttonSecondary: { backgroundColor: '#7FE7E1', padding: 14, borderRadius: 12, marginTop: 12 },
  buttonText: { textAlign: 'center', fontWeight: '900', color: '#000' },
  error: { color: '#ff6b6b', marginBottom: 8, textAlign: 'center' },
});