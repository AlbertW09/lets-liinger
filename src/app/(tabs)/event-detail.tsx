import { DateTimeField } from '@/components/date-time-field';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, useColorScheme, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addClub, Club, clubLabel, fetchClubs } from '../../lib/clubs';
import { PlaceResult, searchPlaces } from '../../lib/places';
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
  hostRaw: string | null;
  postedBy: string;
  created_at: string | null;
  createdBy: string | null;
  latitude: number | null;
  longitude: number | null;
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

  // Delete confirmation
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPickedDate, setEditPickedDate] = useState<Date | null>(null);
  const [editPickedTime, setEditPickedTime] = useState<Date | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editFormError, setEditFormError] = useState('');

  const [editPlaceQuery, setEditPlaceQuery] = useState('');
  const [editPlaceResults, setEditPlaceResults] = useState<PlaceResult[]>([]);
  const [editPlaceSelected, setEditPlaceSelected] = useState<PlaceResult | null>(null);
  const [editSearchingPlace, setEditSearchingPlace] = useState(false);
  const editPlaceTimer = useRef<any>(null);

  const [editHost, setEditHost] = useState('');
  const [editClubs, setEditClubs] = useState<Club[]>([]);
  const [editAddingClub, setEditAddingClub] = useState(false);
  const [editNewClubName, setEditNewClubName] = useState('');
  const [editNewClubEmoji, setEditNewClubEmoji] = useState('');

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
        .select('id, title, description, location, event_time, host, created_at, created_by, latitude, longitude, creator:profiles!events_created_by_fkey(username, display_name)')
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
        hostName: e.host?.trim()
          ? e.host
          : e.creator?.username ? `@${e.creator.username}` : e.creator?.display_name ?? 'Someone',
        hostRaw: e.host ?? null,
        postedBy: e.creator?.username ? `@${e.creator.username}` : e.creator?.display_name ?? 'someone',
        created_at: e.created_at,
        createdBy: e.created_by ?? null,
        latitude: e.latitude ?? null,
        longitude: e.longitude ?? null,
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

  const isOwner = !!userId && !!event?.createdBy && userId === event.createdBy;

  function openEdit() {
    if (!event) return;
    setEditTitle(event.title);
    setEditDescription(event.description ?? '');
    setEditHost(event.hostRaw ?? '');
    setEditFormError('');

    const [datePart, timePart] = (event.event_time ?? '').split('T');
    if (datePart) {
      const [y, m, d] = datePart.split('-').map(Number);
      setEditPickedDate(new Date(y, m - 1, d));
    } else {
      setEditPickedDate(null);
    }
    if (timePart && timePart !== '00:00:00') {
      const [hh, mm] = timePart.split(':').map(Number);
      setEditPickedTime(new Date(1970, 0, 1, hh, mm));
    } else {
      setEditPickedTime(null);
    }

    setEditPlaceQuery(event.location ?? '');
    setEditPlaceSelected(
      event.latitude != null && event.longitude != null
        ? { name: event.location ?? '', lat: event.latitude, lng: event.longitude }
        : null
    );
    setEditPlaceResults([]);
    setEditAddingClub(false);
    setEditNewClubName('');
    setEditNewClubEmoji('');

    fetchClubs().then(setEditClubs);
    setEditVisible(true);
  }

  function onEditPlaceQueryChange(text: string) {
    setEditPlaceQuery(text);
    setEditPlaceSelected(null); // editing invalidates a prior selection
    if (editPlaceTimer.current) clearTimeout(editPlaceTimer.current);
    if (text.trim().length < 3) {
      setEditPlaceResults([]);
      setEditSearchingPlace(false);
      return;
    }
    setEditSearchingPlace(true);
    editPlaceTimer.current = setTimeout(async () => {
      const results = await searchPlaces(text.trim());
      setEditPlaceResults(results);
      setEditSearchingPlace(false);
    }, 450);
  }

  function pickEditPlace(p: PlaceResult) {
    setEditPlaceSelected(p);
    setEditPlaceQuery(p.name);
    setEditPlaceResults([]);
  }

  async function handleAddEditClub() {
    const created = await addClub(editNewClubName, editNewClubEmoji);
    if (created) {
      setEditClubs((prev) =>
        prev.some((c) => c.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditHost(clubLabel(created));
      setEditNewClubName('');
      setEditNewClubEmoji('');
      setEditAddingClub(false);
    }
  }

  async function saveEdit() {
    setEditFormError('');
    if (!editTitle.trim()) {
      setEditFormError('Give your event a title.');
      return;
    }
    if (!editPickedDate) {
      setEditFormError('Pick a date.');
      return;
    }
    if (!editPlaceSelected) {
      setEditFormError('Pick a location from the search results.');
      return;
    }

    setEditSaving(true);

    const y = editPickedDate.getFullYear();
    const m = String(editPickedDate.getMonth() + 1).padStart(2, '0');
    const d = String(editPickedDate.getDate()).padStart(2, '0');
    const hh = editPickedTime ? String(editPickedTime.getHours()).padStart(2, '0') : '00';
    const mm = editPickedTime ? String(editPickedTime.getMinutes()).padStart(2, '0') : '00';
    const eventTimeIso = `${y}-${m}-${d}T${hh}:${mm}:00`;

    const { error } = await supabase
      .from('events')
      .update({
        title: editTitle.trim(),
        description: editDescription.trim() || null,
        location: editPlaceSelected.name,
        event_time: eventTimeIso,
        host: editHost.trim() || null,
        latitude: editPlaceSelected.lat,
        longitude: editPlaceSelected.lng,
      })
      .eq('id', id);

    setEditSaving(false);
    if (error) {
      setEditFormError(error.message);
      return;
    }
    setEditVisible(false);
    fetchAll();
  }

  async function confirmDelete() {
    if (!id) return;
    setDeleting(true);
    setDeleteError('');
    const { error } = await supabase.from('events').delete().eq('id', id);
    setDeleting(false);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setDeleteVisible(false);
    router.replace('/');
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
    iconBtn: {
      padding: Spacing.two, borderRadius: 50, borderWidth: 2, borderColor: colors.border,
    },
    modalSafe: { flex: 1, backgroundColor: colors.background },
    label: {
      fontSize: 12, fontWeight: '900', color: colors.accentCyan,
      marginBottom: Spacing.two, marginTop: Spacing.three, letterSpacing: 0.5,
    },
    formInput: {
      backgroundColor: colors.backgroundElement, color: colors.text, padding: Spacing.three,
      borderRadius: 12, borderWidth: 2, borderColor: colors.border, fontSize: 15,
    },
    placeList: {
      borderWidth: 2, borderColor: colors.border, borderRadius: 12,
      marginTop: Spacing.two, backgroundColor: colors.backgroundElement, overflow: 'hidden',
    },
    hostChip: {
      paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: 999,
      borderWidth: 2, borderColor: colors.border, backgroundColor: colors.backgroundElement,
    },
    hostChipSelected: { backgroundColor: colors.accentPink },
    addClubBtn: {
      backgroundColor: colors.accentCyan, borderWidth: 2, borderColor: colors.border,
      borderRadius: 12, paddingHorizontal: Spacing.three, justifyContent: 'center', alignItems: 'center',
    },
    primaryBtnShadow: { backgroundColor: colors.border, borderRadius: 14, marginTop: Spacing.four },
    primaryBtn: {
      backgroundColor: colors.accentYellow, borderWidth: 2, borderColor: colors.border,
      borderRadius: 14, paddingVertical: Spacing.three, alignItems: 'center',
      transform: [{ translateX: -3 }, { translateY: -3 }],
    },
    deleteCardShadow: {
      backgroundColor: colors.border, borderRadius: 20, marginHorizontal: Spacing.four,
    },
    deleteCard: {
      backgroundColor: colors.backgroundElement, borderWidth: 3, borderColor: colors.border,
      borderRadius: 20, padding: Spacing.four,
    },
    deleteCancelBtn: {
      flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: 12,
      paddingVertical: Spacing.two, alignItems: 'center', backgroundColor: colors.backgroundElement,
    },
    deleteConfirmBtn: {
      flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: 12,
      paddingVertical: Spacing.two, alignItems: 'center', backgroundColor: colors.accentPink,
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
        <View style={styles.topRow}>
          <TouchableOpacity onPress={() => router.replace('/')} style={styles.backBtn}>
            <ThemedText style={dynamicStyles.headerText}>‹ back</ThemedText>
          </TouchableOpacity>

          {isOwner && (
            <View style={styles.ownerActions}>
              <TouchableOpacity style={dynamicStyles.iconBtn} onPress={openEdit}>
                <ThemedText style={styles.emojiText}>✏️</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={dynamicStyles.iconBtn}
                onPress={() => { setDeleteError(''); setDeleteVisible(true); }}
              >
                <ThemedText style={styles.emojiText}>🗑️</ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>

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

            <ThemedText style={styles.postedText} themeColor="textSecondary">
              📣 Posted {formatPosted(event.created_at)} by {event.postedBy}
            </ThemedText>

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

      {/* Delete confirmation */}
      <Modal visible={deleteVisible} transparent animationType="fade" onRequestClose={() => setDeleteVisible(false)}>
        <View style={styles.deleteOverlay}>
          <View style={dynamicStyles.deleteCardShadow}>
            <View style={dynamicStyles.deleteCard}>
              <ThemedText style={styles.deleteTitle}>Delete this event?</ThemedText>
              <ThemedText style={styles.deleteBody} themeColor="textSecondary">
                This can't be undone. RSVPs, likes, and comments will be gone too.
              </ThemedText>
              {deleteError ? <ThemedText style={styles.error}>{deleteError}</ThemedText> : null}
              <View style={styles.deleteActions}>
                <TouchableOpacity
                  style={dynamicStyles.deleteCancelBtn}
                  onPress={() => setDeleteVisible(false)}
                  disabled={deleting}
                >
                  <ThemedText style={styles.deleteCancelText}>Cancel</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={dynamicStyles.deleteConfirmBtn}
                  onPress={confirmDelete}
                  disabled={deleting}
                >
                  <ThemedText style={styles.buttonText}>{deleting ? 'Deleting...' : 'Delete'}</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit event */}
      <Modal visible={editVisible} animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <SafeAreaView style={dynamicStyles.modalSafe} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <ThemedText style={styles.modalCancel}>Cancel</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.modalTitle}>Edit event</ThemedText>
              <View style={{ width: 50 }} />
            </View>

            <ThemedText style={dynamicStyles.label}>Title</ThemedText>
            <TextInput
              style={dynamicStyles.formInput}
              placeholder="House Party & Indie Jam"
              placeholderTextColor={colors.textSecondary}
              value={editTitle}
              onChangeText={setEditTitle}
            />

            <ThemedText style={dynamicStyles.label}>Description</ThemedText>
            <TextInput
              style={[dynamicStyles.formInput, styles.multiline]}
              placeholder="What's the vibe?"
              placeholderTextColor={colors.textSecondary}
              multiline
              value={editDescription}
              onChangeText={setEditDescription}
            />

            <ThemedText style={dynamicStyles.label}>Location</ThemedText>
            <TextInput
              style={dynamicStyles.formInput}
              placeholder="Search a real place…"
              placeholderTextColor={colors.textSecondary}
              value={editPlaceQuery}
              onChangeText={onEditPlaceQueryChange}
              autoCapitalize="none"
            />
            {editSearchingPlace && (
              <ThemedText style={styles.placeHint} themeColor="textSecondary">Searching…</ThemedText>
            )}
            {editPlaceSelected && (
              <ThemedText style={styles.placeHint} themeColor="textSecondary">
                ✓ Pinned: {editPlaceSelected.name}
              </ThemedText>
            )}
            {editPlaceResults.length > 0 && (
              <View style={dynamicStyles.placeList}>
                {editPlaceResults.map((p, i) => (
                  <TouchableOpacity
                    key={`${p.lat}-${p.lng}-${i}`}
                    style={[styles.placeRow, i < editPlaceResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                    onPress={() => pickEditPlace(p)}
                  >
                    <ThemedText style={styles.placeRowText}>📍 {p.name}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <ThemedText style={dynamicStyles.label}>Hosting club (optional)</ThemedText>
            <View style={styles.hostChipWrap}>
              {editClubs.map((c) => {
                const label = clubLabel(c);
                const selected = editHost === label;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[dynamicStyles.hostChip, selected && dynamicStyles.hostChipSelected]}
                    onPress={() => setEditHost(selected ? '' : label)}
                  >
                    <ThemedText style={styles.hostChipText}>{label}</ThemedText>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[dynamicStyles.hostChip, styles.addClubChip]}
                onPress={() => setEditAddingClub((v) => !v)}
              >
                <ThemedText style={styles.hostChipText}>➕ Add club</ThemedText>
              </TouchableOpacity>
            </View>
            {editAddingClub && (
              <View style={styles.addClubRow}>
                <TextInput
                  style={[dynamicStyles.formInput, styles.emojiInput]}
                  placeholder="🎸"
                  placeholderTextColor={colors.textSecondary}
                  value={editNewClubEmoji}
                  onChangeText={setEditNewClubEmoji}
                  maxLength={2}
                />
                <TextInput
                  style={[dynamicStyles.formInput, styles.clubNameInput]}
                  placeholder="New club name"
                  placeholderTextColor={colors.textSecondary}
                  value={editNewClubName}
                  onChangeText={setEditNewClubName}
                />
                <TouchableOpacity style={dynamicStyles.addClubBtn} onPress={handleAddEditClub}>
                  <ThemedText style={styles.buttonText}>Add</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            <ThemedText style={dynamicStyles.label}>Date</ThemedText>
            <DateTimeField
              mode="date"
              value={editPickedDate}
              onChange={setEditPickedDate}
              placeholder="Pick a date"
              colors={colors}
            />

            <ThemedText style={dynamicStyles.label}>Time (optional)</ThemedText>
            <DateTimeField
              mode="time"
              value={editPickedTime}
              onChange={setEditPickedTime}
              placeholder="Pick a time"
              colors={colors}
            />

            {editFormError ? <ThemedText style={styles.error}>{editFormError}</ThemedText> : null}

            <View style={dynamicStyles.primaryBtnShadow}>
              <TouchableOpacity style={dynamicStyles.primaryBtn} onPress={saveEdit} disabled={editSaving}>
                <ThemedText style={styles.buttonText}>{editSaving ? 'Saving...' : 'Save changes'}</ThemedText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
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

function formatPosted(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, paddingBottom: 130 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.three,
  },
  backBtn: {},
  ownerActions: { flexDirection: 'row', gap: Spacing.two },
  emojiText: { fontSize: 18 },
  title: { fontSize: 24, fontWeight: '900', lineHeight: 28, marginBottom: Spacing.two },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.two },
  metaLabel: { fontSize: 11, fontWeight: 'bold', opacity: 0.6 },
  metaValue: { fontSize: 12, fontWeight: '900' },
  description: { fontSize: 14, fontWeight: '600', marginBottom: Spacing.three, lineHeight: 20 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, marginBottom: Spacing.one },
  detailEmoji: { fontSize: 16 },
  detailText: { fontSize: 13, fontWeight: 'bold' },
  postedText: { fontSize: 12, fontWeight: '700', marginTop: Spacing.two },
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
  // Delete confirmation
  deleteOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  deleteTitle: { fontSize: 18, fontWeight: '900', marginBottom: Spacing.two },
  deleteBody: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginBottom: Spacing.four },
  deleteActions: { flexDirection: 'row', gap: Spacing.two },
  deleteCancelText: { fontWeight: '900', fontSize: 14 },
  // Edit modal (mirrors the create-event modal in index.tsx)
  modalContent: { padding: Spacing.four, paddingBottom: 80 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.two,
  },
  modalCancel: { fontSize: 15, fontWeight: '700', width: 50 },
  modalTitle: { fontSize: 18, fontWeight: '900' },
  multiline: { height: 80, textAlignVertical: 'top' },
  placeHint: { fontSize: 12, fontWeight: '700', marginTop: Spacing.one },
  placeRow: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  placeRowText: { fontSize: 14, fontWeight: '700' },
  hostChipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, marginBottom: Spacing.two },
  hostChipText: { fontWeight: '900', fontSize: 12 },
  addClubChip: { borderStyle: 'dashed' },
  addClubRow: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
  emojiInput: { width: 56, textAlign: 'center' },
  clubNameInput: { flex: 1 },
  error: { color: '#ff6b6b', marginTop: Spacing.three, textAlign: 'center' },
});
