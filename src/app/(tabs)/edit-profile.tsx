import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, useColorScheme, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseClient';

const INTEREST_OPTIONS = [
  'Music', 'Greek Life', 'Sports', 'Gaming / Esports', 'Art & Design',
  'Academic', 'Cultural', 'Volunteering', 'Business', 'Tech / Engineering',
  'Film & Media', 'Dance', 'Outdoors', 'Health & Wellness', 'Food',
];

export default function EditProfileScreen() {
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'unspecified' ? 'light' : systemScheme;
  const colors = Colors[scheme];
  const router = useRouter();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [extracurriculars, setExtracurriculars] = useState<{ name: string; role: string }[]>([]);
  const [newClubName, setNewClubName] = useState('');
  const [newClubRole, setNewClubRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingProfile(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, username, bio, interests, extracurriculars')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setDisplayName(data.display_name ?? '');
        setUsername(data.username ?? '');
        setBio(data.bio ?? '');
        setInterests(data.interests ?? []);
        setExtracurriculars(data.extracurriculars ?? []);
      }
      setLoadingProfile(false);
    }

    fetchProfile();
  }, []);

  function toggleInterest(tag: string) {
    setInterests(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }

  function addExtracurricular() {
    if (!newClubName.trim() || !newClubRole.trim()) return;
    setExtracurriculars(prev => [...prev, { name: newClubName.trim(), role: newClubRole.trim() }]);
    setNewClubName('');
    setNewClubRole('');
  }

  function removeExtracurricular(index: number) {
    setExtracurriculars(prev => prev.filter((_, i) => i !== index));
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
        extracurriculars,
      })
      .eq('id', user.id);

    if (error) {
      setErrorMsg(
        error.code === '23505'
          ? 'That username is already taken — try another.'
          : error.message
      );
      setSaving(false);
      return;
    }

    setSaving(false);
    router.replace('/profile');
  }

  const dynamicStyles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    headerText: {
      color: colors.text, fontFamily: 'ui-rounded', fontWeight: '900',
      fontSize: 24, letterSpacing: -1,
    },
    label: {
      fontSize: 12, fontWeight: '900', color: colors.accentCyan,
      marginBottom: Spacing.two, marginTop: Spacing.three, letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.backgroundElement, color: colors.text,
      padding: Spacing.three, borderRadius: 12, borderWidth: 2,
      borderColor: colors.border, fontSize: 15,
    },
    at: { color: colors.accentYellow, fontSize: 20, fontWeight: '900', marginRight: Spacing.two },
    chip: {
      paddingVertical: 9, paddingHorizontal: Spacing.three, borderRadius: 999,
      borderWidth: 2, borderColor: colors.border, backgroundColor: colors.backgroundElement,
    },
    chipSelected: { backgroundColor: colors.accentPink },
    clubRow: {
      backgroundColor: colors.backgroundElement, borderWidth: 2, borderColor: colors.border,
      borderRadius: 12,
    },
    removeText: { color: colors.accentPink, fontWeight: '900', fontSize: 16 },
    addBtn: {
      backgroundColor: colors.backgroundElement, borderWidth: 2, borderColor: colors.border,
      borderRadius: 12, paddingVertical: Spacing.two, alignItems: 'center', marginTop: Spacing.two,
    },
    saveBtnShadow: { backgroundColor: colors.border, borderRadius: 14, marginTop: Spacing.four },
    saveBtn: {
      backgroundColor: colors.accentYellow, borderWidth: 2, borderColor: colors.border,
      borderRadius: 14, paddingVertical: Spacing.three, alignItems: 'center',
      transform: [{ translateX: -3 }, { translateY: -3 }],
    },
  });

  if (loadingProfile) {
    return (
      <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/profile')}>
            <ThemedText style={dynamicStyles.headerText}>‹ back</ThemedText>
          </TouchableOpacity>
        </View>

        <ThemedText style={dynamicStyles.headerText}>Edit profile</ThemedText>

        <ThemedText style={dynamicStyles.label}>Your name</ThemedText>
        <TextInput
          style={dynamicStyles.input}
          placeholder="Alex Rivera"
          placeholderTextColor={colors.textSecondary}
          value={displayName}
          onChangeText={setDisplayName}
        />

        <ThemedText style={dynamicStyles.label}>Username</ThemedText>
        <View style={styles.usernameRow}>
          <ThemedText style={dynamicStyles.at}>@</ThemedText>
          <TextInput
            style={[dynamicStyles.input, styles.usernameInput]}
            placeholder="alex_y2k"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            value={username}
            onChangeText={setUsername}
          />
        </View>

        <ThemedText style={dynamicStyles.label}>Bio</ThemedText>
        <TextInput
          style={[dynamicStyles.input, styles.bioInput]}
          placeholder="Senior @ Campus | Music & retro gaming"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={160}
          value={bio}
          onChangeText={setBio}
        />
        <ThemedText style={styles.counter}>{bio.length}/160</ThemedText>

        <ThemedText style={dynamicStyles.label}>What are you into?</ThemedText>
        <View style={styles.chipWrap}>
          {INTEREST_OPTIONS.map(tag => {
            const selected = interests.includes(tag);
            return (
              <TouchableOpacity
                key={tag}
                style={[dynamicStyles.chip, selected && dynamicStyles.chipSelected]}
                onPress={() => toggleInterest(tag)}
              >
                <ThemedText style={styles.chipText}>{tag}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <ThemedText style={dynamicStyles.label}>Extracurriculars</ThemedText>
        {extracurriculars.map((item, index) => (
          <View key={`${item.name}-${index}`} style={[dynamicStyles.clubRow, styles.clubRow]}>
            <ThemedText style={styles.clubRowText}>
              {item.name} <ThemedText style={styles.clubRowRole} themeColor="textSecondary">— {item.role}</ThemedText>
            </ThemedText>
            <TouchableOpacity onPress={() => removeExtracurricular(index)}>
              <ThemedText style={dynamicStyles.removeText}>✕</ThemedText>
            </TouchableOpacity>
          </View>
        ))}

        <View style={styles.addClubRow}>
          <TextInput
            style={[dynamicStyles.input, styles.addClubNameInput]}
            placeholder="Club or activity"
            placeholderTextColor={colors.textSecondary}
            value={newClubName}
            onChangeText={setNewClubName}
          />
          <TextInput
            style={[dynamicStyles.input, styles.addClubRoleInput]}
            placeholder="Your role"
            placeholderTextColor={colors.textSecondary}
            value={newClubRole}
            onChangeText={setNewClubRole}
          />
        </View>
        <TouchableOpacity style={dynamicStyles.addBtn} onPress={addExtracurricular}>
          <ThemedText style={styles.addBtnText}>+ ADD</ThemedText>
        </TouchableOpacity>

        {errorMsg ? <ThemedText style={styles.error}>{errorMsg}</ThemedText> : null}

        <View style={dynamicStyles.saveBtnShadow}>
          <TouchableOpacity style={dynamicStyles.saveBtn} onPress={handleSave} disabled={saving}>
            <ThemedText style={styles.saveBtnText}>
              {saving ? 'Saving...' : 'Save changes'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, paddingBottom: 80 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { marginBottom: Spacing.three },
  usernameRow: { flexDirection: 'row', alignItems: 'center' },
  usernameInput: { flex: 1 },
  bioInput: { height: 90, textAlignVertical: 'top' },
  counter: { fontSize: 11, opacity: 0.6, textAlign: 'right', marginTop: Spacing.one },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipText: { fontWeight: 'bold', fontSize: 13 },
  clubRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, marginBottom: Spacing.two,
  },
  clubRowText: { fontWeight: '900', fontSize: 14 },
  clubRowRole: { fontWeight: '600', fontSize: 13 },
  addClubRow: { flexDirection: 'row', gap: Spacing.two },
  addClubNameInput: { flex: 3 },
  addClubRoleInput: { flex: 2 },
  addBtnText: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  saveBtnText: { textAlign: 'center', fontWeight: '900', color: '#000', fontSize: 16 },
  error: { color: '#ff6b6b', marginTop: Spacing.three, textAlign: 'center' },
});
