import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PersonRow } from '@/components/person-row';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { followUser, getConnections, getFollowingIds, PublicProfile, unfollowUser } from '../lib/follows';
import { supabase } from '../supabaseClient';

export default function ConnectionsScreen() {
  const colors = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ userId: string; type: string }>();
  const userId = params.userId;
  const initialType: 'followers' | 'following' = params.type === 'following' ? 'following' : 'followers';

  const [tab, setTab] = useState<'followers' | 'following'>(initialType);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [people, setPeople] = useState<PublicProfile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!userId) { setLoading(false); return; }
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        setSelfId(user?.id ?? null);
        const [list, ids] = await Promise.all([
          getConnections(userId, tab),
          user ? getFollowingIds(user.id) : Promise.resolve(new Set<string>()),
        ]);
        if (cancelled) return;
        setPeople(list);
        setFollowingIds(ids);
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [userId, tab])
  );

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
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText style={[styles.back, { color: colors.text }]}>‹ back</ThemedText>
        </TouchableOpacity>

        <View style={styles.tabs}>
          <Chip label="Followers" selected={tab === 'followers'} onPress={() => setTab('followers')} />
          <Chip label="Following" selected={tab === 'following'} onPress={() => setTab('following')} />
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.text} style={{ marginTop: Spacing.four }} />
        ) : people.length === 0 ? (
          <ThemedText style={styles.note} themeColor="textSecondary">
            {tab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
          </ThemedText>
        ) : (
          people.map((p) => (
            <PersonRow
              key={p.id}
              profile={p}
              isSelf={p.id === selfId}
              isFollowing={followingIds.has(p.id)}
              onToggleFollow={() => toggleFollow(p.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: 130 },
  backBtn: { marginBottom: Spacing.two },
  back: { fontFamily: 'ui-rounded', fontWeight: '900', fontSize: 22, letterSpacing: -1 },
  tabs: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  note: { fontSize: 13, fontWeight: '600', marginTop: Spacing.four, textAlign: 'center' },
});
