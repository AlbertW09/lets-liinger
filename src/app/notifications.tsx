import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ShadowSurface } from '@/components/ui/shadow-surface';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  FollowNotification, followUser, getFollowerNotifications, markNotificationsSeen, unfollowUser,
} from '../lib/follows';
import { supabase } from '../supabaseClient';

function relative(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const colors = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [selfId, setSelfId] = useState<string | null>(null);
  const [items, setItems] = useState<FollowNotification[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) { setLoading(false); return; }
        setSelfId(user.id);
        const list = await getFollowerNotifications(user.id);
        if (cancelled) return;
        setItems(list);
        setFollowingIds(new Set(list.filter((i) => i.followsBack).map((i) => i.profile.id)));
        setLoading(false);
        markNotificationsSeen(user.id); // clear the unread badge
      })();
      return () => { cancelled = true; };
    }, [])
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
        <ThemedText style={[styles.title, { color: colors.text }]}>🔔 notifications</ThemedText>

        {loading ? (
          <ActivityIndicator size="large" color={colors.text} style={{ marginTop: Spacing.four }} />
        ) : items.length === 0 ? (
          <ThemedText style={styles.note} themeColor="textSecondary">
            No notifications yet. When someone follows you, it shows up here.
          </ThemedText>
        ) : (
          items.map((it) => {
            const name = it.profile.display_name || it.profile.username || 'Someone';
            const following = followingIds.has(it.profile.id);
            return (
              <ShadowSurface
                key={it.profile.id}
                backgroundColor={colors.backgroundElement}
                radius={14} offset={3} borderWidth={2}
                wrapperStyle={styles.rowWrap} style={styles.row}
                onPress={() => router.push(`/user?id=${it.profile.id}`)}
              >
                <View style={[styles.avatar, { borderColor: colors.border, backgroundColor: colors.accentYellow }]}>
                  {it.profile.avatar_url ? (
                    <Image source={{ uri: it.profile.avatar_url }} style={styles.avatarImg} resizeMode="cover" />
                  ) : (
                    <ThemedText style={styles.avatarInitial}>{name.charAt(0).toUpperCase()}</ThemedText>
                  )}
                </View>
                <View style={styles.info}>
                  <ThemedText style={styles.text} numberOfLines={2}>
                    <ThemedText style={styles.bold}>@{it.profile.username || 'user'}</ThemedText> started following you
                  </ThemedText>
                  <ThemedText style={styles.time} themeColor="textSecondary">{relative(it.createdAt)}</ThemedText>
                </View>
                <ShadowSurface
                  backgroundColor={following ? colors.backgroundElement : colors.accentPink}
                  radius={10} offset={2} borderWidth={2}
                  onPress={() => toggleFollow(it.profile.id)} style={styles.followBtn}
                >
                  <ThemedText style={[styles.followText, { color: following ? colors.text : '#000' }]}>
                    {following ? 'Following' : 'Follow back'}
                  </ThemedText>
                </ShadowSurface>
              </ShadowSurface>
            );
          })
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
  title: { fontFamily: 'ui-rounded', fontWeight: '900', fontSize: 26, letterSpacing: -1, marginBottom: Spacing.three },
  note: { fontSize: 13, fontWeight: '600', marginTop: Spacing.four, textAlign: 'center' },
  rowWrap: { marginBottom: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.two, gap: Spacing.two },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { fontSize: 18, fontWeight: '900', color: '#000' },
  info: { flex: 1 },
  text: { fontSize: 13, fontWeight: '600' },
  bold: { fontSize: 13, fontWeight: '900' },
  time: { fontSize: 11, fontWeight: '700', marginTop: 2 },
  followBtn: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  followText: { fontWeight: '900', fontSize: 11 },
});
