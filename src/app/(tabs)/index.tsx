import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EventFormModal, EventFormSubmitValues } from '@/components/event-form-modal';
import { ThemedText } from '@/components/themed-text';
import { Chip } from '@/components/ui/chip';
import { IconButton } from '@/components/ui/icon-button';
import { ShadowSurface } from '@/components/ui/shadow-surface';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getFollowingIds, getUnreadFollowerCount } from '../../lib/follows';
import { getBlockedIds } from '../../lib/moderation';
import { supabase } from '../../supabaseClient';

type SortMode = 'popular' | 'recent' | 'nearby';

interface Coords {
  lat: number;
  lng: number;
}

interface EnrichedEvent {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_time: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  hostName: string;
  postedBy: string;
  createdBy: string | null;
  likeCount: number;
  likedByMe: boolean;
  rsvpCount: number;
  rsvpers: string[];
  rsvpedByMe: boolean;
  distance: number | null;
}

// "Posted 3h ago" style relative label.
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

// Haversine distance in km between two coordinates.
function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// `event_time` is stored as a naive local timestamp (no timezone — see
// toEventTimeIso in event-form-modal.tsx), so "now" for comparison has to be
// built the same way instead of via toISOString(), which would shift by the
// device's UTC offset and mis-filter events near the day boundary.
function nowAsNaiveTimestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const PAGE_SIZE = 20;

// Browser-only geolocation, guarded for SSR.
function getCurrentCoords(): Promise<Coords | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000 }
    );
  });
}

export default function HomeScreen() {
  const colors = useTheme();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [followingOnly, setFollowingOnly] = useState(false);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [createVisible, setCreateVisible] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    // Default to upcoming events only (plus ones with no time set yet); page
    // through the rest with `limit` instead of pulling the whole table.
    let eventsQuery = supabase
      .from('events')
      .select(
        'id, title, description, location, event_time, latitude, longitude, created_at, host, created_by, creator:profiles!events_created_by_fkey(username, display_name)',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(0, limit - 1);

    if (!showPast) {
      eventsQuery = eventsQuery.or(`event_time.is.null,event_time.gte.${nowAsNaiveTimestamp()}`);
    }

    const [eventsRes, following, blocked, unread] = await Promise.all([
      eventsQuery,
      user ? getFollowingIds(user.id) : Promise.resolve(new Set<string>()),
      user ? getBlockedIds(user.id) : Promise.resolve(new Set<string>()),
      user ? getUnreadFollowerCount(user.id) : Promise.resolve(0),
    ]);

    setFollowingIds(following);
    setUnreadNotifs(unread);

    // Hide events posted by people you've blocked (or who blocked you).
    const rawEvents = (eventsRes.data ?? []).filter((e: any) => !e.created_by || !blocked.has(e.created_by));
    setHasMore((eventsRes.count ?? 0) > limit);

    // Likes/RSVPs only need to cover the events actually on this page.
    const eventIds = rawEvents.map((e: any) => e.id);
    const [likesRes, rsvpsRes] = eventIds.length
      ? await Promise.all([
          supabase.from('event_likes').select('event_id, user_id').in('event_id', eventIds),
          supabase
            .from('rsvps')
            .select('event_id, user_id, profile:profiles!rsvps_user_id_fkey(username, display_name)')
            .in('event_id', eventIds),
        ])
      : [{ data: [] as any[] }, { data: [] as any[] }];
    const likes = likesRes.data ?? [];
    const rsvps = rsvpsRes.data ?? [];

    const enriched: EnrichedEvent[] = rawEvents.map((e: any) => {
      const eventLikes = likes.filter((l) => l.event_id === e.id);
      const eventRsvps = rsvps.filter((r) => r.event_id === e.id);
      const hasCoords = e.latitude != null && e.longitude != null;

      return {
        id: e.id,
        title: e.title,
        description: e.description,
        location: e.location,
        event_time: e.event_time,
        latitude: e.latitude,
        longitude: e.longitude,
        created_at: e.created_at,
        hostName: e.host?.trim()
          ? e.host
          : e.creator?.username
            ? `@${e.creator.username}`
            : e.creator?.display_name ?? 'Someone',
        postedBy: e.creator?.username ? `@${e.creator.username}` : e.creator?.display_name ?? 'someone',
        createdBy: e.created_by ?? null,
        likeCount: eventLikes.length,
        likedByMe: !!user && eventLikes.some((l) => l.user_id === user.id),
        rsvpCount: eventRsvps.length,
        rsvpers: eventRsvps
          .map((r: any) => r.profile?.username)
          .filter(Boolean)
          .map((u: string) => `@${u}`),
        rsvpedByMe: !!user && eventRsvps.some((r) => r.user_id === user.id),
        distance:
          hasCoords && userCoords
            ? distanceKm(userCoords, { lat: e.latitude, lng: e.longitude })
            : null,
      };
    });

    setEvents(enriched);
    setLoading(false);
    setLoadingMore(false);
  }, [userCoords, limit, showPast]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    setLimit((l) => l + PAGE_SIZE);
  }

  function togglePast() {
    setLimit(PAGE_SIZE);
    setShowPast((v) => !v);
  }

  // Optimistic: flip local state immediately, hit the DB in the background,
  // and roll back only if the write actually fails. Avoids refetching every
  // event/like/rsvp in the feed for a single-row change.
  async function toggleRsvp(ev: EnrichedEvent) {
    if (!userId) return;
    const wasRsvped = ev.rsvpedByMe;
    const prevEvents = events;

    setEvents((prev) =>
      prev.map((e) =>
        e.id === ev.id
          ? { ...e, rsvpedByMe: !wasRsvped, rsvpCount: e.rsvpCount + (wasRsvped ? -1 : 1) }
          : e
      )
    );

    const { error } = wasRsvped
      ? await supabase.from('rsvps').delete().eq('event_id', ev.id).eq('user_id', userId)
      : await supabase.from('rsvps').insert({ event_id: ev.id, user_id: userId });

    if (error) setEvents(prevEvents);
  }

  async function toggleLike(ev: EnrichedEvent) {
    if (!userId) return;
    const wasLiked = ev.likedByMe;
    const prevEvents = events;

    setEvents((prev) =>
      prev.map((e) =>
        e.id === ev.id
          ? { ...e, likedByMe: !wasLiked, likeCount: e.likeCount + (wasLiked ? -1 : 1) }
          : e
      )
    );

    const { error } = wasLiked
      ? await supabase.from('event_likes').delete().eq('event_id', ev.id).eq('user_id', userId)
      : await supabase.from('event_likes').insert({ event_id: ev.id, user_id: userId });

    if (error) setEvents(prevEvents);
  }

  async function handleCreateSubmit(values: EventFormSubmitValues) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'You need to be signed in.' };

    const { error } = await supabase.from('events').insert({
      title: values.title,
      description: values.description || null,
      location: values.place.name,
      event_time: values.eventTimeIso,
      created_by: user.id,
      host: values.host || null,
      latitude: values.place.lat,
      longitude: values.place.lng,
    });

    if (error) return { error: error.message };
  }

  async function enableNearby() {
    let coords = userCoords;
    if (!coords) {
      coords = await getCurrentCoords();
      setUserCoords(coords);
    }
    setSortMode('nearby');
  }

  // Filter + sort for display
  const visibleEvents = events
    .filter((e) => (followingOnly ? !!e.createdBy && followingIds.has(e.createdBy) : true))
    .filter((e) => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        e.title.toLowerCase().includes(q) ||
        (e.location ?? '').toLowerCase().includes(q) ||
        e.hostName.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortMode === 'popular') {
        if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
        return b.created_at.localeCompare(a.created_at);
      }
      if (sortMode === 'nearby') {
        if (a.distance == null && b.distance == null) return 0;
        if (a.distance == null) return 1;
        if (b.distance == null) return -1;
        return a.distance - b.distance;
      }
      // recent
      return b.created_at.localeCompare(a.created_at);
    });

  const dynamicStyles = useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    headerText: {
      color: colors.text, fontFamily: 'Helvetica', fontWeight: '900',
      fontSize: 32, letterSpacing: -1,
    },
    input: {
      flex: 1, paddingHorizontal: Spacing.two, fontSize: 15,
      fontWeight: 'bold', color: colors.text,
    },
    searchBtn: {
      backgroundColor: colors.accentCyan, padding: Spacing.two,
      borderRadius: 10, borderWidth: 2, borderColor: colors.border,
    },
    actionBtn: {
      flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: 12,
      paddingVertical: Spacing.two, alignItems: 'center',
    },
  }), [colors]);

  const sortOptions: { key: SortMode; label: string }[] = [
    { key: 'recent', label: '🆕 Recent' },
    { key: 'popular', label: '🔥 Popular' },
    { key: 'nearby', label: '📍 Nearby' },
  ];

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={dynamicStyles.headerText}>LetsLiinger</ThemedText>
          <View style={styles.headerActions}>
            <IconButton emoji="🔎" size={20} onPress={() => router.push('/search')} />
            <View>
              <IconButton emoji="🔔" size={20} onPress={() => router.push('/notifications')} />
              {unreadNotifs > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.accentPink, borderColor: colors.border }]}>
                  <ThemedText style={styles.badgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>

        <ShadowSurface
          backgroundColor={colors.backgroundElement}
          radius={16}
          offset={4}
          wrapperStyle={styles.searchShadow}
          style={styles.searchContainer}
        >
          <ThemedText style={styles.searchIcon}>🔍</ThemedText>
          <TextInput
            style={dynamicStyles.input}
            placeholder="Search events…"
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity style={dynamicStyles.searchBtn} onPress={() => setSearchQuery('')}>
              <ThemedText style={styles.boldText}>✕</ThemedText>
            </TouchableOpacity>
          )}
        </ShadowSurface>

        <ShadowSurface
          backgroundColor={colors.accentGreen}
          radius={14}
          offset={3}
          wrapperStyle={styles.createShadow}
          style={styles.createBtn}
          onPress={() => setCreateVisible(true)}
        >
          <ThemedText style={styles.boldText}>+ CREATE EVENT</ThemedText>
        </ShadowSurface>

        <View style={styles.sortRow}>
          {sortOptions.map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              selected={sortMode === opt.key}
              onPress={() => (opt.key === 'nearby' ? enableNearby() : setSortMode(opt.key))}
            />
          ))}
          <Chip
            label="🕰️ Past"
            selected={showPast}
            selectedColor={colors.accentCyan}
            onPress={togglePast}
          />
          <Chip
            label="👥 Following"
            selected={followingOnly}
            selectedColor={colors.accentGreen}
            onPress={() => setFollowingOnly((v) => !v)}
            style={styles.followingChip}
          />
        </View>

        {followingOnly && visibleEvents.length === 0 && !loading && (
          <ThemedText style={styles.noteText} themeColor="textSecondary">
            No events from people you follow yet. Follow classmates to fill this up!
          </ThemedText>
        )}

        {sortMode === 'nearby' && !userCoords && (
          <ThemedText style={styles.noteText} themeColor="textSecondary">
            Location unavailable — showing events with coordinates first.
          </ThemedText>
        )}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.text} />
          </View>
        ) : visibleEvents.length === 0 ? (
          <ThemedText style={styles.noteText} themeColor="textSecondary">
            No events yet. Tap “+ CREATE EVENT” to add the first one!
          </ThemedText>
        ) : (
          visibleEvents.map((event) => (
            <ShadowSurface
              key={event.id}
              backgroundColor={colors.backgroundElement}
              radius={20}
              offset={6}
              wrapperStyle={styles.cardShadow}
              style={styles.card}
              onPress={() => router.push(`/event-detail?id=${event.id}`)}
            >
              <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>

              <View style={styles.metaRow}>
                <ThemedText style={styles.metaLabel}>HOSTED BY:</ThemedText>
                <ThemedText style={styles.metaValue}>{event.hostName}</ThemedText>
              </View>

              <View style={styles.detailItem}>
                <ThemedText style={styles.detailEmoji}>📍</ThemedText>
                <ThemedText style={styles.detailText}>{event.location ?? 'TBD'}</ThemedText>
              </View>

              <View style={styles.detailItem}>
                <ThemedText style={styles.detailEmoji}>🗓️</ThemedText>
                <ThemedText style={styles.detailText}>
                  {formatEventTime(event.event_time)}
                </ThemedText>
              </View>

              {sortMode === 'nearby' && event.distance != null && (
                <View style={styles.detailItem}>
                  <ThemedText style={styles.detailEmoji}>🧭</ThemedText>
                  <ThemedText style={styles.detailText}>
                    {event.distance < 1
                      ? `${Math.round(event.distance * 1000)} m away`
                      : `${event.distance.toFixed(1)} km away`}
                  </ThemedText>
                </View>
              )}

              {event.rsvpCount > 0 && (
                <ThemedText style={styles.rsvpLine} themeColor="textSecondary">
                  🎟️ {rsvpSummary(event.rsvpers, event.rsvpCount)}
                </ThemedText>
              )}

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[
                    dynamicStyles.actionBtn,
                    { backgroundColor: event.rsvpedByMe ? colors.accentGreen : colors.accentYellow },
                  ]}
                  onPress={() => toggleRsvp(event)}
                >
                  <ThemedText style={styles.buttonText}>
                    {event.rsvpedByMe ? "✓ RSVP'D!" : 'RSVP'}
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    dynamicStyles.actionBtn,
                    { backgroundColor: event.likedByMe ? colors.accentPink : colors.accentCyan, flex: 0.5 },
                  ]}
                  onPress={() => toggleLike(event)}
                >
                  <ThemedText style={styles.buttonText}>
                    {event.likedByMe ? '💖' : '🤍'} {event.likeCount}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <View style={styles.cardFooter}>
                {event.createdBy && event.createdBy !== userId ? (
                  <TouchableOpacity onPress={() => router.push(`/user?id=${event.createdBy}`)}>
                    <ThemedText style={styles.postedText} themeColor="textSecondary">
                      Posted {formatPosted(event.created_at)} by {event.postedBy}
                    </ThemedText>
                  </TouchableOpacity>
                ) : (
                  <ThemedText style={styles.postedText} themeColor="textSecondary">
                    Posted {formatPosted(event.created_at)} by {event.postedBy}
                  </ThemedText>
                )}
                <ThemedText style={styles.commentHint} themeColor="textSecondary">
                  Tap to view & comment →
                </ThemedText>
              </View>
            </ShadowSurface>
          ))
        )}

        {!loading && hasMore && (
          <TouchableOpacity
            style={[styles.loadMoreBtn, { borderColor: colors.border }]}
            onPress={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <ActivityIndicator size="small" color={colors.text} />
            ) : (
              <ThemedText style={styles.loadMoreText}>Load more events</ThemedText>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>

      <EventFormModal
        visible={createVisible}
        mode="create"
        onClose={() => setCreateVisible(false)}
        onSubmit={handleCreateSubmit}
        onSuccess={fetchAll}
      />
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

function rsvpSummary(usernames: string[], count: number): string {
  if (usernames.length === 0) return `${count} going`;
  const shown = usernames.slice(0, 3).join(', ');
  const extra = count - Math.min(usernames.length, 3);
  return extra > 0 ? `${shown} +${extra} going` : `${shown} going`;
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, paddingBottom: 130 },
  loadingWrap: { paddingVertical: Spacing.six, alignItems: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.two,
  },
  boldText: { fontWeight: '900', color: '#000', fontSize: 14 },
  headerActions: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center' },
  searchShadow: { marginTop: Spacing.two, marginBottom: Spacing.three },
  searchContainer: { flexDirection: 'row', alignItems: 'center', padding: Spacing.one },
  searchIcon: { fontSize: 15, paddingLeft: Spacing.two },
  createShadow: { marginBottom: Spacing.three },
  createBtn: { paddingVertical: Spacing.two, alignItems: 'center' },
  sortRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  followingChip: { marginLeft: 'auto' },
  noteText: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.three },
  cardShadow: { marginBottom: Spacing.four },
  card: { padding: Spacing.three },
  eventTitle: { fontSize: 22, fontWeight: '900', lineHeight: 26, marginBottom: Spacing.one },
  metaRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.one, marginBottom: Spacing.two,
  },
  metaLabel: { fontSize: 11, fontWeight: 'bold', opacity: 0.6 },
  metaValue: { fontSize: 12, fontWeight: '900' },
  detailItem: {
    flexDirection: 'row', alignItems: 'center',
    gap: Spacing.one, marginBottom: Spacing.one,
  },
  detailEmoji: { fontSize: 16 },
  detailText: { fontSize: 13, fontWeight: 'bold' },
  rsvpLine: { fontSize: 12, fontWeight: '700', marginTop: Spacing.one, marginBottom: Spacing.two },
  cardActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  buttonText: { fontWeight: '900', color: '#000', fontSize: 14 },
  commentHint: { fontSize: 11, fontWeight: '700' },
  badge: {
    position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { fontSize: 10, fontWeight: '900', color: '#000' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: Spacing.two, gap: Spacing.two, flexWrap: 'wrap',
  },
  postedText: { fontSize: 11, fontWeight: '700' },
  loadMoreBtn: {
    borderWidth: 2, borderRadius: 12, paddingVertical: Spacing.two,
    alignItems: 'center', marginTop: Spacing.two,
  },
  loadMoreText: { fontSize: 13, fontWeight: '900' },
});
