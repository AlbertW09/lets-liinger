import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, useColorScheme, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseClient';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: string;
}

interface EventDetail {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_time: string | null;
  hostName: string;
}

export default function EventDetailScreen() {
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'unspecified' ? 'light' : systemScheme;
  const colors = Colors[scheme];
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [likeCount, setLikeCount] = useState(0);
  const [likedByMe, setLikedByMe] = useState(false);
  const [rsvpers, setRsvpers] = useState<string[]>([]);
  const [rsvpedByMe, setRsvpedByMe] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const [eventRes, likesRes, rsvpsRes, commentsRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, description, location, event_time, creator:profiles!events_created_by_fkey(username, display_name)')
        .eq('id', id)
        .single(),
      supabase.from('event_likes').select('user_id').eq('event_id', id),
      supabase
        .from('rsvps')
        .select('user_id, profile:profiles!rsvps_user_id_fkey(username, display_name)')
        .eq('event_id', id),
      supabase
        .from('event_comments')
        .select('id, content, created_at, author:profiles!event_comments_user_id_fkey(username, display_name)')
        .eq('event_id', id)
        .order('created_at', { ascending: true }),
    ]);

    if (eventRes.data) {
      const e: any = eventRes.data;
      setEvent({
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        event_time: e.event_time,
        hostName: e.creator?.username ? `@${e.creator.username}` : e.creator?.display_name ?? 'Someone',
      });
    }

    const likes = likesRes.data ?? [];
    setLikeCount(likes.length);
    setLikedByMe(!!user && likes.some((l) => l.user_id === user.id));

    const rsvps = rsvpsRes.data ?? [];
    setRsvpers(
      rsvps.map((r: any) => (r.profile?.username ? `@${r.profile.username}` : r.profile?.display_name)).filter(Boolean)
    );
    setRsvpedByMe(!!user && rsvps.some((r) => r.user_id === user.id));

    setComments(
      (commentsRes.data ?? []).map((c: any) => ({
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        author: c.author?.username ? `@${c.author.username}` : c.author?.display_name ?? 'Someone',
      }))
    );

    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  async function toggleRsvp() {
    if (!userId || !id) return;
    if (rsvpedByMe) {
      await supabase.from('rsvps').delete().eq('event_id', id).eq('user_id', userId);
    } else {
      await supabase.from('rsvps').insert({ event_id: id, user_id: userId });
    }
    fetchAll();
  }

  async function toggleLike() {
    if (!userId || !id) return;
    if (likedByMe) {
      await supabase.from('event_likes').delete().eq('event_id', id).eq('user_id', userId);
    } else {
      await supabase.from('event_likes').insert({ event_id: id, user_id: userId });
    }
    fetchAll();
  }

  async function postComment() {
    if (!newComment.trim() || !userId || !id) return;
    setPosting(true);
    const { error } = await supabase
      .from('event_comments')
      .insert({ event_id: id, user_id: userId, content: newComment.trim() });
    setPosting(false);
    if (!error) {
      setNewComment('');
      fetchAll();
    }
  }

  const dynamicStyles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    headerText: {
      color: colors.text, fontFamily: 'ui-rounded', fontWeight: '900',
      fontSize: 24, letterSpacing: -1,
    },
    cardShadow: { backgroundColor: colors.border, borderRadius: 20, marginBottom: Spacing.four },
    card: {
      backgroundColor: colors.backgroundElement, borderWidth: 3, borderColor: colors.border,
      borderRadius: 20, padding: Spacing.four,
      transform: [{ translateX: -5 }, { translateY: -5 }],
    },
    actionBtn: {
      flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: 12,
      paddingVertical: Spacing.two, alignItems: 'center',
    },
    commentInput: {
      flex: 1, backgroundColor: colors.backgroundElement, color: colors.text,
      padding: Spacing.three, borderRadius: 12, borderWidth: 2, borderColor: colors.border, fontSize: 14,
    },
    sendBtn: {
      backgroundColor: colors.accentCyan, borderWidth: 2, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: Spacing.three, justifyContent: 'center',
    },
    commentCard: {
      backgroundColor: colors.backgroundElement, borderWidth: 2, borderColor: colors.border,
      borderRadius: 12, padding: Spacing.three, marginBottom: Spacing.two,
    },
  });

  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.text} /></View>
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.content}>
          <TouchableOpacity onPress={() => router.replace('/')}>
            <ThemedText style={dynamicStyles.headerText}>‹ back</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.noteText} themeColor="textSecondary">Event not found.</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn}>
          <ThemedText style={dynamicStyles.headerText}>‹ back</ThemedText>
        </TouchableOpacity>

        <View style={dynamicStyles.cardShadow}>
          <View style={dynamicStyles.card}>
            <ThemedText style={styles.title}>{event.title}</ThemedText>
            <View style={styles.metaRow}>
              <ThemedText style={styles.metaLabel}>HOSTED BY:</ThemedText>
              <ThemedText style={styles.metaValue}>{event.hostName}</ThemedText>
            </View>

            {!!event.description && (
              <ThemedText style={styles.description}>{event.description}</ThemedText>
            )}

            <View style={styles.detailItem}>
              <ThemedText style={styles.detailEmoji}>📍</ThemedText>
              <ThemedText style={styles.detailText}>{event.location ?? 'TBD'}</ThemedText>
            </View>
            <View style={styles.detailItem}>
              <ThemedText style={styles.detailEmoji}>🗓️</ThemedText>
              <ThemedText style={styles.detailText}>{formatEventTime(event.event_time)}</ThemedText>
            </View>

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[dynamicStyles.actionBtn, { backgroundColor: rsvpedByMe ? colors.accentGreen : colors.accentYellow }]}
                onPress={toggleRsvp}
              >
                <ThemedText style={styles.buttonText}>{rsvpedByMe ? "✓ RSVP'D!" : 'RSVP'}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dynamicStyles.actionBtn, { backgroundColor: likedByMe ? colors.accentPink : colors.accentCyan, flex: 0.5 }]}
                onPress={toggleLike}
              >
                <ThemedText style={styles.buttonText}>{likedByMe ? '💖' : '🤍'} {likeCount}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <ThemedText style={styles.sectionTitle}>🎟️ WHO'S GOING ({rsvpers.length})</ThemedText>
        {rsvpers.length === 0 ? (
          <ThemedText style={styles.noteText} themeColor="textSecondary">No RSVPs yet — be the first!</ThemedText>
        ) : (
          <View style={styles.rsvpWrap}>
            {rsvpers.map((r, i) => (
              <View key={`${r}-${i}`} style={[styles.rsvpChip, { borderColor: colors.border, backgroundColor: colors.accentGreen }]}>
                <ThemedText style={styles.rsvpChipText}>{r}</ThemedText>
              </View>
            ))}
          </View>
        )}

        <ThemedText style={styles.sectionTitle}>💬 COMMENTS ({comments.length})</ThemedText>

        <View style={styles.commentRow}>
          <TextInput
            style={dynamicStyles.commentInput}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textSecondary}
            value={newComment}
            onChangeText={setNewComment}
            multiline
          />
          <TouchableOpacity style={dynamicStyles.sendBtn} onPress={postComment} disabled={posting}>
            <ThemedText style={styles.buttonText}>{posting ? '...' : 'Send'}</ThemedText>
          </TouchableOpacity>
        </View>

        {comments.length === 0 ? (
          <ThemedText style={styles.noteText} themeColor="textSecondary">No comments yet. Start the conversation!</ThemedText>
        ) : (
          comments.map((c) => (
            <View key={c.id} style={dynamicStyles.commentCard}>
              <ThemedText style={styles.commentAuthor}>{c.author}</ThemedText>
              <ThemedText style={styles.commentText}>{c.content}</ThemedText>
              <ThemedText style={styles.commentTime} themeColor="textSecondary">{formatEventTime(c.created_at)}</ThemedText>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatEventTime(iso: string | null): string {
  if (!iso) return 'Date TBD';
  const d = new Date(iso.includes('T') ? iso : `${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const hasTime = iso.includes('T') && !iso.endsWith('T00:00:00');
  if (!hasTime) return date;
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, paddingBottom: 130 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  backBtn: { marginBottom: Spacing.three },
  title: { fontSize: 24, fontWeight: '900', lineHeight: 28, marginBottom: Spacing.two },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.two },
  metaLabel: { fontSize: 11, fontWeight: 'bold', opacity: 0.6 },
  metaValue: { fontSize: 12, fontWeight: '900' },
  description: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.three, lineHeight: 20 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.one },
  detailEmoji: { fontSize: 16 },
  detailText: { fontSize: 13, fontWeight: 'bold' },
  actionsRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  buttonText: { fontWeight: '900', color: '#000', fontSize: 14 },
  sectionTitle: { fontWeight: '900', fontSize: 16, letterSpacing: 0.5, marginTop: Spacing.two, marginBottom: Spacing.two },
  noteText: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.three },
  rsvpWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.three },
  rsvpChip: { borderWidth: 2, borderRadius: 999, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one },
  rsvpChipText: { fontSize: 12, fontWeight: '900', color: '#000' },
  commentRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  commentAuthor: { fontSize: 13, fontWeight: '900', marginBottom: 2 },
  commentText: { fontSize: 14, fontWeight: '500', lineHeight: 19 },
  commentTime: { fontSize: 10, fontWeight: '600', marginTop: Spacing.one },
});
