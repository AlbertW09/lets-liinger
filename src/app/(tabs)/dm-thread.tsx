import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, StyleSheet, TextInput, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  DirectMessage, ProfileLite, fetchProfile, fetchThread, profileLabel, sendDirectMessage, subscribeToMyMessages,
} from '@/lib/messages';
import { checkClean } from '../../lib/profanity';
import { supabase } from '../../supabaseClient';

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export default function DmThreadScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { userId: otherUserId } = useLocalSearchParams<{ userId: string }>();

  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [otherProfile, setOtherProfile] = useState<ProfileLite | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const seenIds = useRef<Set<string>>(new Set());

  const fetchAll = useCallback(async () => {
    if (!otherUserId) {
      setLoading(false);
      return;
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }
    setMyUserId(user.id);

    const [profile, thread] = await Promise.all([
      fetchProfile(otherUserId),
      fetchThread(user.id, otherUserId),
    ]);

    setOtherProfile(profile);
    setMessages(thread);
    seenIds.current = new Set(thread.map((m) => m.id));
    setLoading(false);
  }, [otherUserId]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();

      if (!myUserId) return;
      const unsubscribe = subscribeToMyMessages(myUserId, (row) => {
        if (row.sender_id !== otherUserId && row.recipient_id !== otherUserId) return;
        if (seenIds.current.has(row.id)) return;
        seenIds.current.add(row.id);
        setMessages((prev) => [...prev, row]);
      });
      return unsubscribe;
      // fetchAll intentionally omitted: myUserId is only known after the
      // first fetch resolves, so this effect re-runs once fetchAll sets it.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fetchAll, myUserId, otherUserId])
  );

  async function handleSend() {
    const text = newMessage.trim();
    if (!text || !myUserId || !otherUserId || sending) return;
    const badWord = checkClean(text);
    if (badWord) {
      setSendError(badWord);
      return;
    }
    setSendError('');
    setSending(true);
    const { error } = await sendDirectMessage(myUserId, otherUserId, text);
    setSending(false);
    if (error) return;
    setNewMessage('');
    fetchAll();
  }

  const dynamicStyles = useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    headerText: {
      color: colors.text, fontFamily: 'ui-rounded', fontWeight: '900',
      fontSize: 20, letterSpacing: -1,
    },
    bubbleMine: {
      backgroundColor: colors.accentCyan, borderColor: colors.border,
      alignSelf: 'flex-end',
    },
    bubbleTheirs: {
      backgroundColor: colors.backgroundElement, borderColor: colors.border,
      alignSelf: 'flex-start',
    },
    input: {
      flex: 1, backgroundColor: colors.backgroundElement, color: colors.text,
      padding: Spacing.three, borderRadius: 12, borderWidth: 2, borderColor: colors.border, fontSize: 14,
    },
    sendBtn: {
      backgroundColor: colors.accentCyan, borderWidth: 2, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: Spacing.three, justifyContent: 'center',
    },
  }), [colors]);

  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.loadingWrap}><ActivityIndicator size="large" color={colors.text} /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.push('/messages')}>
          <ThemedText style={dynamicStyles.headerText}>‹ back</ThemedText>
        </TouchableOpacity>
        <ThemedText style={dynamicStyles.headerText} numberOfLines={1}>
          {profileLabel(otherProfile)}
        </ThemedText>
        <View style={styles.spacer} />
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={[...messages].reverse()}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const mine = item.sender_id === myUserId;
          return (
            <View
              style={[
                styles.bubble,
                mine ? dynamicStyles.bubbleMine : dynamicStyles.bubbleTheirs,
              ]}
            >
              <ThemedText style={styles.bubbleText}>{item.content}</ThemedText>
              <ThemedText style={styles.bubbleTime} themeColor="textSecondary">
                {formatMessageTime(item.created_at)}
              </ThemedText>
            </View>
          );
        }}
        ListEmptyComponent={
          <ThemedText style={styles.emptyText} themeColor="textSecondary">
            No messages yet. Say hello!
          </ThemedText>
        }
      />

      {sendError ? (
        <ThemedText style={styles.sendError}>{sendError}</ThemedText>
      ) : null}

      <View style={styles.composerRow}>
        <TextInput
          style={dynamicStyles.input}
          placeholder="Message..."
          placeholderTextColor={colors.textSecondary}
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity style={dynamicStyles.sendBtn} onPress={handleSend} disabled={sending}>
          <ThemedText style={styles.sendBtnText}>{sending ? '...' : 'Send'}</ThemedText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.four, paddingBottom: Spacing.two,
  },
  spacer: { width: 50 },
  list: { flex: 1 },
  listContent: { padding: Spacing.four, flexGrow: 1 },
  bubble: {
    maxWidth: '80%', borderWidth: 2, borderRadius: 14,
    paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, marginBottom: Spacing.two,
  },
  bubbleText: { fontSize: 14, fontWeight: '600' },
  bubbleTime: { fontSize: 10, fontWeight: '600', marginTop: Spacing.one, textAlign: 'right' },
  emptyText: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: Spacing.six },
  composerRow: {
    flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-end',
    padding: Spacing.four, paddingTop: Spacing.two,
  },
  sendBtnText: { fontWeight: '900', color: '#000', fontSize: 14 },
  sendError: { color: '#ff6b6b', fontWeight: '700', fontSize: 12, paddingHorizontal: Spacing.three, marginBottom: Spacing.one },
});
