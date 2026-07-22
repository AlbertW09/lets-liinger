import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { supabase } from '../supabaseClient';

const INTEREST_OPTIONS = [
  'Music', 'Greek Life', 'Sports', 'Gaming / Esports', 'Art & Design',
  'Academic', 'Cultural', 'Volunteering', 'Business', 'Tech / Engineering',
  'Film & Media', 'Dance', 'Outdoors', 'Health & Wellness', 'Food',
];

export default function OnboardingScreen() {
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  function toggleInterest(tag: string) {
    setInterests(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  async function handleSave() {
    setErrorMsg('');

    if (!displayName.trim()) {
      setErrorMsg('Please enter a name.');
      return;
    }
    if (!username.trim()) {
      setErrorMsg('Please pick a username.');
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrorMsg('No signed-in user found. Try signing in again.');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim(),
        username: username.trim().toLowerCase().replace(/\s+/g, '_'),
        bio: bio.trim(),
        interests,
        onboarded: true,
      })
      .eq('id', user.id);

    if (error) {
      // 23505 = unique constraint violation (username already taken)
      setErrorMsg(
        error.code === '23505'
          ? 'That username is already taken — try another.'
          : error.message
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    router.replace('/(tabs)');
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.subtitle}>
        This is how other students will see you.
      </Text>

      <Text style={styles.label}>Your name</Text>
      <TextInput
        style={styles.input}
        placeholder="Alex Rivera"
        placeholderTextColor="#777"
        value={displayName}
        onChangeText={setDisplayName}
      />

      <Text style={styles.label}>Username</Text>
      <View style={styles.usernameRow}>
        <Text style={styles.at}>@</Text>
        <TextInput
          style={[styles.input, styles.usernameInput]}
          placeholder="alex_y2k"
          placeholderTextColor="#777"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
      </View>

      <Text style={styles.label}>Bio</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        placeholder="Senior @ Campus | Music & retro gaming"
        placeholderTextColor="#777"
        multiline
        maxLength={160}
        value={bio}
        onChangeText={setBio}
      />
      <Text style={styles.counter}>{bio.length}/160</Text>

      <Text style={styles.label}>What are you into?</Text>
      <Text style={styles.hint}>Pick as many as you like.</Text>
      <View style={styles.chipWrap}>
        {INTEREST_OPTIONS.map(tag => {
          const selected = interests.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleInterest(tag)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <TouchableOpacity
        style={styles.button}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.buttonText}>
          {saving ? 'Saving...' : "Let's go!"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  content: { padding: 24, paddingTop: 60, paddingBottom: 60 },
  title: { fontSize: 30, fontWeight: '900', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#999', marginBottom: 28 },
  label: {
    fontSize: 12, fontWeight: '900', color: '#7FE7E1',
    marginBottom: 6, marginTop: 16, letterSpacing: 0.5,
  },
  hint: { fontSize: 12, color: '#777', marginBottom: 10 },
  input: {
    backgroundColor: '#1a1a1a', color: '#fff', padding: 14,
    borderRadius: 12, borderWidth: 2, borderColor: '#333', fontSize: 15,
  },
  usernameRow: { flexDirection: 'row', alignItems: 'center' },
  at: { color: '#FFD93D', fontSize: 20, fontWeight: '900', marginRight: 8 },
  usernameInput: { flex: 1 },
  bioInput: { height: 90, textAlignVertical: 'top' },
  counter: { fontSize: 11, color: '#666', textAlign: 'right', marginTop: 4 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999,
    borderWidth: 2, borderColor: '#333', backgroundColor: '#1a1a1a',
  },
  chipSelected: { backgroundColor: '#E6007A', borderColor: '#fff' },
  chipText: { color: '#bbb', fontWeight: 'bold', fontSize: 13 },
  chipTextSelected: { color: '#fff' },
  button: {
    backgroundColor: '#FFD93D', padding: 16,
    borderRadius: 12, marginTop: 32,
  },
  buttonText: {
    textAlign: 'center', fontWeight: '900', color: '#000', fontSize: 16,
  },
  error: { color: '#ff6b6b', marginTop: 16, textAlign: 'center' },
});