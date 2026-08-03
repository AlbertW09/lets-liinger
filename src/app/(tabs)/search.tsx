import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { followUser, getFollowingIds, PublicProfile, searchProfiles, unfollowUser } from '../../lib/follows';
import { supabase } from '../../supabaseClient';

export default function SearchScreen() {
  const colors = useTheme();
  const router = useRouter();

  const [selfId, setSelfId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [touched, setTouched] = useState(false);
  const timer = useRef<any>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        setSelfId(user?.id ?? null);
        if (user) setFollowingIds(await getFollowingIds(user.id));
      })();
      return () => { cancelled = true; };
    }, [])
  );

  function onChange(text: string) {
    setQuery(text);
    setTouched(true);
    if (timer.current) clearTimeout(timer.current);
    if (!text.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const found = await searchProfiles(text, selfId);
      setResults(found);
      setSearching(false);
    }, 350);
  }

  async function toggleFollow(id: string) {
    if (!selfId) return;
    const next = new Set(followingIds);
    if (next.has(id)) {
      next.delete(id);
      setFollowingIds(next);
      await unfollowUser(selfId, id);
    } else {
      next.add(id);
      setFollowingIds(next);
      await followUser(selfId, id);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.replace('/profile')} style={styles.backBtn}>
          <ThemedText style={[styles.back, { color: colors.text }]}>‹ back</ThemedText>
        </TouchableOpacity>
        <ThemedText style={[styles.title, { color: colors.text }]}>🔎 find people</ThemedText>

        <TextField
          placeholder="Search by name or @username…"
          value={query}
          onChangeText={onChange}
          autoCapitalize="none"
          autoFocus
        />

        <View style={styles.results}>
          {searching ? (
            <ActivityIndicator size="large" color={colors.text} style={{ marginTop: Spacing.four }} />
          ) : results.length > 0 ? (
            results.map((p) => (
              <PersonRow
                key={p.id}
                profile={p}
                isFollowing={followingIds.has(p.id)}
                onToggleFollow={() => toggleFollow(p.id)}
              />
            ))
          ) : touched && query.trim() ? (
            <ThemedText style={styles.note} themeColor="textSecondary">No one found for “{query.trim()}”.</ThemedText>
          ) : (
            <ThemedText style={styles.note} themeColor="textSecondary">
              Search classmates by name or @username to follow them.
            </ThemedText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: 130 },
  backBtn: { marginBottom: Spacing.two },
  back: { fontFamily: 'ui-rounded', fontWeight: '900', fontSize: 22, letterSpacing: -1 },
  title: { fontFamily: 'ui-rounded', fontWeight: '900', fontSize: 26, letterSpacing: -1, marginBottom: Spacing.two },
  results: { marginTop: Spacing.three },
  note: { fontSize: 13, fontWeight: '600', marginTop: Spacing.three, textAlign: 'center' },
});
