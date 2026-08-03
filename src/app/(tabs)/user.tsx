import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { ShadowSurface } from '@/components/ui/shadow-surface';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { followUser, getFollowCounts, isFollowing as checkFollowing, unfollowUser } from '../../lib/follows';
import { supabase } from '../../supabaseClient';

interface ViewProfile {
  id: string;
  display_name: string | null;
  username: string | null;
  bio: string | null;
  avatar_url: string | null;
  interests: string[] | null;
  extracurriculars: { name: string; role: string }[] | null;
}

export default function UserProfileScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ViewProfile | null>(null);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!id) { setLoading(false); return; }
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        // Viewing yourself → send to your own editable profile.
        if (user && user.id === id) {
          router.replace('/profile');
          return;
        }
        setSelfId(user?.id ?? null);

        const [profRes, c, isF] = await Promise.all([
          supabase.from('profiles').select('id, display_name, username, bio, avatar_url, interests, extracurriculars').eq('id', id).single(),
          getFollowCounts(id),
          user ? checkFollowing(user.id, id) : Promise.resolve(false),
        ]);
        if (cancelled) return;
        if (!profRes.error) setProfile(profRes.data as ViewProfile);
        setCounts(c);
        setFollowing(isF);
        setLoading(false);
      })();
      return () => { cancelled = true; };
    }, [id])
  );

  async function toggleFollow() {
    if (!selfId || !id || busy) return;
    setBusy(true);
    if (following) {
      setFollowing(false);
      setCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }));
      await unfollowUser(selfId, id);
    } else {
      setFollowing(true);
      setCounts((c) => ({ ...c, followers: c.followers + 1 }));
      await followUser(selfId, id);
    }
    setBusy(false);
  }

  const clubColors = [colors.accentPink, colors.accentCyan, colors.accentYellow, colors.accentGreen];

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.text} /></View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <TouchableOpacity onPress={() => router.back()}><ThemedText style={[styles.back, { color: colors.text }]}>‹ back</ThemedText></TouchableOpacity>
          <ThemedText style={styles.note} themeColor="textSecondary">Profile not found.</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const name = (profile.display_name || 'Student').toUpperCase();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText style={[styles.back, { color: colors.text }]}>‹ back</ThemedText>
        </TouchableOpacity>

        <ShadowSurface backgroundColor={colors.backgroundElement} radius={24} offset={6} wrapperStyle={styles.mb4} style={styles.card}>
          <View style={[styles.avatar, { borderColor: colors.border, backgroundColor: colors.accentYellow }]}>
            {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} resizeMode="cover" /> : null}
          </View>

          <ThemedText style={styles.userName}>{name}</ThemedText>
          <Badge label={`@${profile.username || 'username'}`} backgroundColor={colors.accentCyan} radius={12} style={styles.handleBadge} />
          <ThemedText style={styles.bio}>{profile.bio || 'No bio yet.'}</ThemedText>

          {!!profile.interests?.length && (
            <View style={styles.interestsWrap}>
              {profile.interests.map((tag) => (
                <View key={tag} style={[styles.interestChip, { borderColor: colors.border }]}>
                  <ThemedText style={styles.interestChipText}>{tag}</ThemedText>
                </View>
              ))}
            </View>
          )}

          {selfId && (
            <ShadowSurface
              backgroundColor={following ? colors.backgroundElement : colors.accentPink}
              radius={14}
              offset={3}
              wrapperStyle={styles.followWrap}
              style={styles.followBtn}
              onPress={toggleFollow}
            >
              <ThemedText style={[styles.followText, { color: following ? colors.text : '#000' }]}>
                {following ? '✓ FOLLOWING' : '+ FOLLOW'}
              </ThemedText>
            </ShadowSurface>
          )}
        </ShadowSurface>

        <View style={styles.statsRow}>
          <ShadowSurface
            backgroundColor={colors.backgroundElement} radius={16} offset={4}
            wrapperStyle={styles.statBox} style={styles.statInner}
            onPress={() => router.push(`/connections?userId=${profile.id}&type=followers`)}
          >
            <ThemedText style={styles.statNum}>{counts.followers}</ThemedText>
            <ThemedText style={styles.statLabel}>FOLLOWERS</ThemedText>
          </ShadowSurface>
          <ShadowSurface
            backgroundColor={colors.backgroundElement} radius={16} offset={4}
            wrapperStyle={styles.statBox} style={styles.statInner}
            onPress={() => router.push(`/connections?userId=${profile.id}&type=following`)}
          >
            <ThemedText style={styles.statNum}>{counts.following}</ThemedText>
            <ThemedText style={styles.statLabel}>FOLLOWING</ThemedText>
          </ShadowSurface>
        </View>

        {!!profile.extracurriculars?.length && (
          <>
            <ThemedText style={[styles.section, { color: colors.text }]}>🏷️ CLUBS</ThemedText>
            {profile.extracurriculars.map((club, i) => (
              <ShadowSurface
                key={`${club.name}-${i}`}
                backgroundColor={clubColors[i % clubColors.length]}
                radius={14} offset={3} wrapperStyle={styles.mb2} style={styles.clubTag}
              >
                <ThemedText style={styles.clubName}>{club.name}</ThemedText>
                <View style={[styles.roleBadge, { borderColor: colors.border }]}>
                  <ThemedText style={styles.roleText}>{club.role}</ThemedText>
                </View>
              </ShadowSurface>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: 130 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: { marginBottom: Spacing.two },
  back: { fontFamily: 'ui-rounded', fontWeight: '900', fontSize: 22, letterSpacing: -1 },
  mb2: { marginBottom: Spacing.two },
  mb4: { marginBottom: Spacing.four },
  card: { padding: Spacing.four, alignItems: 'center' },
  avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, marginBottom: Spacing.two, overflow: 'hidden', justifyContent: 'center', alignItems: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  userName: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  handleBadge: { marginTop: Spacing.one, marginBottom: Spacing.two },
  bio: { fontSize: 13, fontWeight: '600', textAlign: 'center', opacity: 0.8, marginVertical: Spacing.one },
  interestsWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.one, marginBottom: Spacing.one },
  interestChip: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: Spacing.two, paddingVertical: 3 },
  interestChipText: { fontSize: 10, fontWeight: '800' },
  followWrap: { marginTop: Spacing.two, width: '100%' },
  followBtn: { paddingVertical: Spacing.two, alignItems: 'center' },
  followText: { fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },
  statsRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.four },
  statBox: { flex: 1 },
  statInner: { paddingVertical: Spacing.three, alignItems: 'center' },
  statNum: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', opacity: 0.6, letterSpacing: 0.5 },
  section: { fontWeight: '900', fontSize: 16, letterSpacing: 0.5, marginBottom: Spacing.two },
  clubTag: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  clubName: { fontSize: 14, fontWeight: '900', color: '#000' },
  roleBadge: { backgroundColor: '#FFF', borderWidth: 1.5, borderRadius: 8, paddingHorizontal: Spacing.two, paddingVertical: 2 },
  roleText: { fontSize: 10, fontWeight: '900', color: '#000' },
  note: { fontSize: 13, fontWeight: '600', marginTop: Spacing.three },
});
