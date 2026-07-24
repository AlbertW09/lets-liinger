import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Image, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { addClub, Club, clubLabel, fetchClubs } from '../lib/clubs';
import { pickImageFile, uploadAvatar } from '../lib/avatar';
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
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [myClubs, setMyClubs] = useState<string[]>([]);
  const [creatingClub, setCreatingClub] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmoji, setCreateEmoji] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchClubs().then(setClubs);
  }, []);

  function toggleInterest(tag: string) {
    setInterests(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  function toggleClub(label: string) {
    setMyClubs(prev => (prev.includes(label) ? prev.filter(c => c !== label) : [...prev, label]));
  }

  async function handlePickAvatar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const file = await pickImageFile();
    if (!file) return;
    setUploadingAvatar(true);
    const url = await uploadAvatar(user.id, file);
    setUploadingAvatar(false);
    if (url) setAvatarUrl(url);
  }

  async function handleCreateClub() {
    const created = await addClub(createName, createEmoji);
    if (created) {
      setClubs(prev =>
        prev.some(c => c.id === created.id) ? prev : [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      const label = clubLabel(created);
      setMyClubs(prev => (prev.includes(label) ? prev : [...prev, label]));
      setCreateName('');
      setCreateEmoji('');
      setCreatingClub(false);
    }
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
        avatar_url: avatarUrl,
        interests,
        extracurriculars: myClubs.map(name => ({ name, role: 'Member' })),
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

    // Mirror the flag onto the auth user so the session carries it.
    // This fires an auth-state-change event, which the root layout listens for.
    const { error: metaError } = await supabase.auth.updateUser({
      data: { onboarded: true },
    });

    if (metaError) {
      setErrorMsg(metaError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
 
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.subtitle}>
        This is how other students will see you.
      </Text>

      <View style={styles.avatarWrap}>
        <TouchableOpacity style={styles.avatarCircle} onPress={handlePickAvatar} activeOpacity={0.8}>
          {uploadingAvatar ? (
            <Text style={styles.avatarPlaceholder}>…</Text>
          ) : avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} resizeMode="cover" />
          ) : (
            <Text style={styles.avatarPlaceholder}>📷</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handlePickAvatar}>
          <Text style={styles.avatarBtnText}>{avatarUrl ? 'Change photo' : 'Add a photo'}</Text>
        </TouchableOpacity>
      </View>

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

      <Text style={styles.label}>Your clubs</Text>
      <Text style={styles.hint}>Pick the clubs you're in — or add a new one.</Text>
      <View style={styles.chipWrap}>
        {clubs.map(c => {
          const label = clubLabel(c);
          const selected = myClubs.includes(label);
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => toggleClub(label)}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity
          style={[styles.chip, styles.dashedChip]}
          onPress={() => setCreatingClub(v => !v)}
        >
          <Text style={styles.chipText}>➕ New club</Text>
        </TouchableOpacity>
      </View>

      {creatingClub && (
        <View style={styles.createClubRow}>
          <TextInput
            style={[styles.input, styles.emojiInput]}
            placeholder="🎸"
            placeholderTextColor="#777"
            value={createEmoji}
            onChangeText={setCreateEmoji}
            maxLength={2}
          />
          <TextInput
            style={[styles.input, styles.flex1]}
            placeholder="New club name"
            placeholderTextColor="#777"
            value={createName}
            onChangeText={setCreateName}
          />
          <TouchableOpacity style={styles.createClubBtn} onPress={handleCreateClub}>
            <Text style={styles.createClubBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      )}

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
  dashedChip: { borderStyle: 'dashed' },
  avatarWrap: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: {
    width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#fff',
    backgroundColor: '#FFD93D', justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: { fontSize: 30 },
  avatarBtnText: { color: '#7FE7E1', fontWeight: '900', fontSize: 12, marginTop: 8 },
  createClubRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  emojiInput: { width: 56, textAlign: 'center' },
  flex1: { flex: 1 },
  createClubBtn: {
    backgroundColor: '#7FE7E1', borderRadius: 12, paddingHorizontal: 16,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff',
  },
  createClubBtnText: { fontWeight: '900', color: '#000', fontSize: 14 },
  button: {
    backgroundColor: '#FFD93D', padding: 16,
    borderRadius: 12, marginTop: 32,
  },
  buttonText: {
    textAlign: 'center', fontWeight: '900', color: '#000', fontSize: 16,
  },
error: { color: '#ff6b6b', marginTop: 16, textAlign: 'center' },
   });