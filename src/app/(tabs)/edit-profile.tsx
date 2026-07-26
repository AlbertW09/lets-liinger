import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, ScrollView, StyleSheet, TextInput, TouchableOpacity, useColorScheme, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addClub, Club, clubLabel, fetchClubs } from '../../lib/clubs';
import { pickImageFile, uploadAvatar } from '../../lib/avatar';
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
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [extracurriculars, setExtracurriculars] = useState<{ name: string; role: string }[]>([]);

  // Clubs list + the in-progress "add a club to my profile" entry
  const [clubs, setClubs] = useState<Club[]>([]);
  const [pickedClub, setPickedClub] = useState('');
  const [newRole, setNewRole] = useState('');
  const [creatingClub, setCreatingClub] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmoji, setCreateEmoji] = useState('');

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoadingProfile(false);
        return;
      }
      setUserId(user.id);
      setClubs(await fetchClubs());

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, username, bio, avatar_url, interests, extracurriculars')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        setDisplayName(data.display_name ?? '');
        setUsername(data.username ?? '');
        setBio(data.bio ?? '');
        setAvatarUrl(data.avatar_url ?? null);
        setInterests(data.interests ?? []);
        setExtracurriculars(data.extracurriculars ?? []);
      }
      setLoadingProfile(false);
    }
    load();
  }, []);

  async function handlePickAvatar() {
    if (!userId) return;
    const file = await pickImageFile();
    if (!file) return;
    setUploadingAvatar(true);
    const url = await uploadAvatar(userId, file);
    setUploadingAvatar(false);
    if (url) setAvatarUrl(url);
    else setErrorMsg('Could not upload that image. Try a different file.');
  }

  function toggleInterest(tag: string) {
    setInterests(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  }

  async function handleCreateClub() {
    const created = await addClub(createName, createEmoji);
    if (created) {
      setClubs(prev =>
        prev.some(c => c.id === created.id) ? prev : [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setPickedClub(clubLabel(created));
      setCreateName('');
      setCreateEmoji('');
      setCreatingClub(false);
    }
  }

  function addExtracurricular() {
    if (!pickedClub || !newRole.trim()) return;
    if (extracurriculars.some(e => e.name === pickedClub)) {
      setPickedClub('');
      setNewRole('');
      return;
    }
    setExtracurriculars(prev => [...prev, { name: pickedClub, role: newRole.trim() }]);
    setPickedClub('');
    setNewRole('');
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
        avatar_url: avatarUrl,
        interests,
        extracurriculars,
      })
      .eq('id', user.id);

    if (error) {
      setErrorMsg(error.code === '23505' ? 'That username is already taken — try another.' : error.message);
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
    avatarCircle: {
      width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.border,
      backgroundColor: colors.accentYellow, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
    },
    avatarImg: { width: '100%', height: '100%' },
    changeAvatarBtn: {
      marginTop: Spacing.two, borderWidth: 2, borderColor: colors.border, borderRadius: 10,
      paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, backgroundColor: colors.accentCyan,
    },
    clubRow: {
      backgroundColor: colors.backgroundElement, borderWidth: 2, borderColor: colors.border,
      borderRadius: 12,
    },
    removeText: { color: colors.accentPink, fontWeight: '900', fontSize: 16 },
    addBtn: {
      backgroundColor: colors.accentGreen, borderWidth: 2, borderColor: colors.border,
      borderRadius: 12, paddingVertical: Spacing.two, alignItems: 'center', marginTop: Spacing.two,
    },
    createClubBtn: {
      backgroundColor: colors.accentCyan, borderWidth: 2, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: Spacing.three, justifyContent: 'center', alignItems: 'center',
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

        <View style={styles.avatarWrap}>
          <TouchableOpacity style={dynamicStyles.avatarCircle} onPress={handlePickAvatar} activeOpacity={0.8}>
            {uploadingAvatar ? (
              <ActivityIndicator color="#000" />
            ) : avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={dynamicStyles.avatarImg} resizeMode="cover" />
            ) : (
              <ThemedText style={styles.avatarPlaceholder}>📷</ThemedText>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={dynamicStyles.changeAvatarBtn} onPress={handlePickAvatar}>
            <ThemedText style={styles.smallBtnText}>{avatarUrl ? 'Change photo' : 'Add photo'}</ThemedText>
          </TouchableOpacity>
        </View>

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

        <ThemedText style={dynamicStyles.label}>My clubs</ThemedText>
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

        <ThemedText style={styles.subLabel} themeColor="textSecondary">Pick a club</ThemedText>
        <View style={styles.chipWrap}>
          {clubs.map(c => {
            const label = clubLabel(c);
            const selected = pickedClub === label;
            return (
              <TouchableOpacity
                key={c.id}
                style={[dynamicStyles.chip, selected && dynamicStyles.chipSelected]}
                onPress={() => setPickedClub(selected ? '' : label)}
              >
                <ThemedText style={styles.chipText}>{label}</ThemedText>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[dynamicStyles.chip, styles.dashed]}
            onPress={() => setCreatingClub(v => !v)}
          >
            <ThemedText style={styles.chipText}>➕ New club</ThemedText>
          </TouchableOpacity>
        </View>

        {creatingClub && (
          <View style={styles.addClubRow}>
            <TextInput
              style={[dynamicStyles.input, styles.emojiInput]}
              placeholder="🎸"
              placeholderTextColor={colors.textSecondary}
              value={createEmoji}
              onChangeText={setCreateEmoji}
              maxLength={2}
            />
            <TextInput
              style={[dynamicStyles.input, styles.flex1]}
              placeholder="New club name"
              placeholderTextColor={colors.textSecondary}
              value={createName}
              onChangeText={setCreateName}
            />
            <TouchableOpacity style={dynamicStyles.createClubBtn} onPress={handleCreateClub}>
              <ThemedText style={styles.smallBtnText}>Add</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.addClubRow}>
          <TextInput
            style={[dynamicStyles.input, styles.flex1]}
            placeholder="Your role (e.g. Member)"
            placeholderTextColor={colors.textSecondary}
            value={newRole}
            onChangeText={setNewRole}
          />
        </View>
        <TouchableOpacity style={dynamicStyles.addBtn} onPress={addExtracurricular}>
          <ThemedText style={styles.addBtnText}>+ ADD CLUB TO PROFILE</ThemedText>
        </TouchableOpacity>

        {errorMsg ? <ThemedText style={styles.error}>{errorMsg}</ThemedText> : null}

        <View style={dynamicStyles.saveBtnShadow}>
          <TouchableOpacity style={dynamicStyles.saveBtn} onPress={handleSave} disabled={saving}>
            <ThemedText style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save changes'}</ThemedText>
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
  avatarWrap: { alignItems: 'center', marginTop: Spacing.three },
  avatarPlaceholder: { fontSize: 32 },
  smallBtnText: { fontWeight: '900', fontSize: 12, color: '#000' },
  usernameRow: { flexDirection: 'row', alignItems: 'center' },
  usernameInput: { flex: 1 },
  bioInput: { height: 90, textAlignVertical: 'top' },
  counter: { fontSize: 11, opacity: 0.6, textAlign: 'right', marginTop: Spacing.one },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chipText: { fontWeight: 'bold', fontSize: 13 },
  dashed: { borderStyle: 'dashed' },
  subLabel: { fontSize: 11, fontWeight: '800', marginTop: Spacing.three, marginBottom: Spacing.two },
  clubRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, marginBottom: Spacing.two,
  },
  clubRowText: { fontWeight: '900', fontSize: 14 },
  clubRowRole: { fontWeight: '600', fontSize: 13 },
  addClubRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  emojiInput: { width: 56, textAlign: 'center' },
  flex1: { flex: 1 },
  addBtnText: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5, color: '#000' },
  saveBtnText: { textAlign: 'center', fontWeight: '900', color: '#000', fontSize: 16 },
  error: { color: '#ff6b6b', marginTop: Spacing.three, textAlign: 'center' },
});
