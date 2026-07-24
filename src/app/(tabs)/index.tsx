import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseClient';
import { addClub, Club, clubLabel, fetchClubs } from '../../lib/clubs';

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
  likeCount: number;
  likedByMe: boolean;
  rsvpCount: number;
  rsvpers: string[];
  rsvpedByMe: boolean;
  distance: number | null;
}

interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

// Geocode against OpenStreetMap's Nominatim so the location is always a real map place.
async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (typeof fetch === 'undefined') return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    return (data ?? []).map((d: any) => ({
      name: d.name && d.name.trim()
        ? `${d.name}${d.address?.city || d.address?.town ? `, ${d.address.city ?? d.address.town}` : ''}`
        : String(d.display_name).split(',').slice(0, 2).join(',').trim(),
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
  } catch {
    return [];
  }
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
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'unspecified' ? 'light' : systemScheme;
  const colors = Colors[scheme];
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState<EnrichedEvent[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  // Create-event modal state
  const [createVisible, setCreateVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Location place-picker (Nominatim)
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeSelected, setPlaceSelected] = useState<PlaceResult | null>(null);
  const [searchingPlace, setSearchingPlace] = useState(false);
  const placeTimer = useRef<any>(null);

  // Hosting club (from the shared clubs list)
  const [host, setHost] = useState('');
  const [clubs, setClubs] = useState<Club[]>([]);
  const [addingClub, setAddingClub] = useState(false);
  const [newClubName, setNewClubName] = useState('');
  const [newClubEmoji, setNewClubEmoji] = useState('');

  const fetchAll = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const [eventsRes, likesRes, rsvpsRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, description, location, event_time, latitude, longitude, created_at, host, creator:profiles!events_created_by_fkey(username, display_name)'),
      supabase.from('event_likes').select('event_id, user_id'),
      supabase
        .from('rsvps')
        .select('event_id, user_id, profile:profiles!rsvps_user_id_fkey(username, display_name)'),
    ]);

    const rawEvents = eventsRes.data ?? [];
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
  }, [userCoords]);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll])
  );

  async function toggleRsvp(ev: EnrichedEvent) {
    if (!userId) return;
    if (ev.rsvpedByMe) {
      await supabase.from('rsvps').delete().eq('event_id', ev.id).eq('user_id', userId);
    } else {
      await supabase.from('rsvps').insert({ event_id: ev.id, user_id: userId });
    }
    fetchAll();
  }

  async function toggleLike(ev: EnrichedEvent) {
    if (!userId) return;
    if (ev.likedByMe) {
      await supabase.from('event_likes').delete().eq('event_id', ev.id).eq('user_id', userId);
    } else {
      await supabase.from('event_likes').insert({ event_id: ev.id, user_id: userId });
    }
    fetchAll();
  }

  async function openCreate() {
    setCreateVisible(true);
    setClubs(await fetchClubs());
  }

  async function handleAddClub() {
    const created = await addClub(newClubName, newClubEmoji);
    if (created) {
      setClubs((prev) =>
        prev.some((c) => c.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
      setHost(clubLabel(created));
      setNewClubName('');
      setNewClubEmoji('');
      setAddingClub(false);
    }
  }

  function onPlaceQueryChange(text: string) {
    setPlaceQuery(text);
    setPlaceSelected(null); // editing invalidates a prior selection
    if (placeTimer.current) clearTimeout(placeTimer.current);
    if (text.trim().length < 3) {
      setPlaceResults([]);
      setSearchingPlace(false);
      return;
    }
    setSearchingPlace(true);
    placeTimer.current = setTimeout(async () => {
      const results = await searchPlaces(text.trim());
      setPlaceResults(results);
      setSearchingPlace(false);
    }, 450);
  }

  function pickPlace(p: PlaceResult) {
    setPlaceSelected(p);
    setPlaceQuery(p.name);
    setPlaceResults([]);
  }

  async function enableNearby() {
    let coords = userCoords;
    if (!coords) {
      coords = await getCurrentCoords();
      setUserCoords(coords);
    }
    setSortMode('nearby');
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setDateStr('');
    setTimeStr('');
    setPlaceQuery('');
    setPlaceResults([]);
    setPlaceSelected(null);
    setHost('');
    setAddingClub(false);
    setNewClubName('');
    setNewClubEmoji('');
    setFormError('');
  }

  async function createEvent() {
    setFormError('');
    if (!title.trim()) {
      setFormError('Give your event a title.');
      return;
    }
    if (!dateStr.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
      setFormError('Enter a date as YYYY-MM-DD.');
      return;
    }
    if (timeStr.trim() && !/^\d{2}:\d{2}$/.test(timeStr.trim())) {
      setFormError('Enter time as HH:MM (24h), or leave it blank.');
      return;
    }
    if (!placeSelected) {
      setFormError('Pick a location from the search results.');
      return;
    }

    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setFormError('You need to be signed in.');
      setSaving(false);
      return;
    }

    const eventTime = `${dateStr.trim()}T${(timeStr.trim() || '00:00')}:00`;

    const { error } = await supabase.from('events').insert({
      title: title.trim(),
      description: description.trim() || null,
      location: placeSelected.name,
      event_time: eventTime,
      created_by: user.id,
      host: host.trim() || null,
      latitude: placeSelected.lat,
      longitude: placeSelected.lng,
    });

    setSaving(false);
    if (error) {
      setFormError(error.message);
      return;
    }
    setCreateVisible(false);
    resetForm();
    fetchAll();
  }

  // Filter + sort for display
  const visibleEvents = events
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

  const dynamicStyles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    headerText: {
      color: colors.text, fontFamily: 'Helvetica', fontWeight: '900',
      fontSize: 32, letterSpacing: -1,
    },
    searchContainerShadow: {
      backgroundColor: colors.border, borderRadius: 16,
      marginTop: Spacing.two, marginBottom: Spacing.three,
    },
    searchContainer: {
      flexDirection: 'row', backgroundColor: colors.backgroundElement,
      borderWidth: 3, borderColor: colors.border, borderRadius: 16,
      padding: Spacing.one, alignItems: 'center',
      transform: [{ translateX: -4 }, { translateY: -4 }],
    },
    input: {
      flex: 1, paddingHorizontal: Spacing.two, fontSize: 15,
      fontWeight: 'bold', color: colors.text,
    },
    searchBtn: {
      backgroundColor: colors.accentCyan, padding: Spacing.two,
      borderRadius: 10, borderWidth: 2, borderColor: colors.border,
    },
    createBtnShadow: { backgroundColor: colors.border, borderRadius: 14, marginBottom: Spacing.three },
    createBtn: {
      backgroundColor: colors.accentGreen, borderWidth: 2, borderColor: colors.border,
      borderRadius: 14, paddingVertical: Spacing.two, alignItems: 'center',
      transform: [{ translateX: -3 }, { translateY: -3 }],
    },
    sortChip: {
      paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: 999,
      borderWidth: 2, borderColor: colors.border, backgroundColor: colors.backgroundElement,
    },
    sortChipActive: { backgroundColor: colors.accentPink },
    cardShadow: { backgroundColor: colors.border, borderRadius: 20, marginBottom: Spacing.four },
    card: {
      backgroundColor: colors.backgroundElement, borderWidth: 3, borderColor: colors.border,
      borderRadius: 20, padding: Spacing.three,
      transform: [{ translateX: -6 }, { translateY: -6 }],
    },
    actionBtn: {
      flex: 1, borderWidth: 2, borderColor: colors.border, borderRadius: 12,
      paddingVertical: Spacing.two, alignItems: 'center',
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
  });

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
          <TouchableOpacity style={[styles.ringBtn, { borderColor: colors.border }]}>
            <ThemedText style={styles.emojiText}>🔔</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.searchContainerShadow}>
          <View style={dynamicStyles.searchContainer}>
            <TextInput
              style={dynamicStyles.input}
              placeholder="Search flyers, clubs, events..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity style={dynamicStyles.searchBtn}>
              <ThemedText style={styles.boldText}>GO!</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <View style={dynamicStyles.createBtnShadow}>
          <TouchableOpacity style={dynamicStyles.createBtn} onPress={openCreate}>
            <ThemedText style={styles.boldText}>+ CREATE EVENT</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.sortRow}>
          {sortOptions.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[dynamicStyles.sortChip, sortMode === opt.key && dynamicStyles.sortChipActive]}
              onPress={() => (opt.key === 'nearby' ? enableNearby() : setSortMode(opt.key))}
            >
              <ThemedText style={styles.sortChipText}>{opt.label}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>

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
            <View key={event.id} style={dynamicStyles.cardShadow}>
              <TouchableOpacity
                style={dynamicStyles.card}
                activeOpacity={0.9}
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
                  <ThemedText style={styles.postedText} themeColor="textSecondary">
                    Posted {formatPosted(event.created_at)} by {event.postedBy}
                  </ThemedText>
                  <ThemedText style={styles.commentHint} themeColor="textSecondary">
                    Tap to view & comment →
                  </ThemedText>
                </View>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Create event modal */}
      <Modal visible={createVisible} animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <SafeAreaView style={dynamicStyles.modalSafe} edges={['top', 'left', 'right']}>
          <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => { setCreateVisible(false); resetForm(); }}>
                <ThemedText style={styles.modalCancel}>Cancel</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.modalTitle}>New event</ThemedText>
              <View style={{ width: 50 }} />
            </View>

            <ThemedText style={dynamicStyles.label}>Title</ThemedText>
            <TextInput
              style={dynamicStyles.formInput}
              placeholder="House Party & Indie Jam"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />

            <ThemedText style={dynamicStyles.label}>Description</ThemedText>
            <TextInput
              style={[dynamicStyles.formInput, styles.multiline]}
              placeholder="What's the vibe?"
              placeholderTextColor={colors.textSecondary}
              multiline
              value={description}
              onChangeText={setDescription}
            />

            <ThemedText style={dynamicStyles.label}>Location</ThemedText>
            <TextInput
              style={dynamicStyles.formInput}
              placeholder="Search a real place…"
              placeholderTextColor={colors.textSecondary}
              value={placeQuery}
              onChangeText={onPlaceQueryChange}
              autoCapitalize="none"
            />
            {searchingPlace && (
              <ThemedText style={styles.placeHint} themeColor="textSecondary">Searching…</ThemedText>
            )}
            {placeSelected && (
              <ThemedText style={styles.placeHint} themeColor="textSecondary">
                ✓ Pinned: {placeSelected.name}
              </ThemedText>
            )}
            {placeResults.length > 0 && (
              <View style={dynamicStyles.placeList}>
                {placeResults.map((p, i) => (
                  <TouchableOpacity
                    key={`${p.lat}-${p.lng}-${i}`}
                    style={[styles.placeRow, i < placeResults.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                    onPress={() => pickPlace(p)}
                  >
                    <ThemedText style={styles.placeRowText}>📍 {p.name}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <ThemedText style={dynamicStyles.label}>Hosting club (optional)</ThemedText>
            <View style={styles.hostChipWrap}>
              {clubs.map((c) => {
                const label = clubLabel(c);
                const selected = host === label;
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[dynamicStyles.hostChip, selected && dynamicStyles.hostChipSelected]}
                    onPress={() => setHost(selected ? '' : label)}
                  >
                    <ThemedText style={styles.hostChipText}>{label}</ThemedText>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                style={[dynamicStyles.hostChip, styles.addClubChip]}
                onPress={() => setAddingClub((v) => !v)}
              >
                <ThemedText style={styles.hostChipText}>➕ Add club</ThemedText>
              </TouchableOpacity>
            </View>
            {addingClub && (
              <View style={styles.addClubRow}>
                <TextInput
                  style={[dynamicStyles.formInput, styles.emojiInput]}
                  placeholder="🎸"
                  placeholderTextColor={colors.textSecondary}
                  value={newClubEmoji}
                  onChangeText={setNewClubEmoji}
                  maxLength={2}
                />
                <TextInput
                  style={[dynamicStyles.formInput, styles.clubNameInput]}
                  placeholder="New club name"
                  placeholderTextColor={colors.textSecondary}
                  value={newClubName}
                  onChangeText={setNewClubName}
                />
                <TouchableOpacity style={dynamicStyles.addClubBtn} onPress={handleAddClub}>
                  <ThemedText style={styles.buttonText}>Add</ThemedText>
                </TouchableOpacity>
              </View>
            )}

            <ThemedText style={dynamicStyles.label}>Date</ThemedText>
            <TextInput
              style={dynamicStyles.formInput}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textSecondary}
              value={dateStr}
              onChangeText={setDateStr}
            />

            <ThemedText style={dynamicStyles.label}>Time (optional)</ThemedText>
            <TextInput
              style={dynamicStyles.formInput}
              placeholder="HH:MM (24h)"
              placeholderTextColor={colors.textSecondary}
              value={timeStr}
              onChangeText={setTimeStr}
            />

            {formError ? <ThemedText style={styles.error}>{formError}</ThemedText> : null}

            <View style={dynamicStyles.primaryBtnShadow}>
              <TouchableOpacity style={dynamicStyles.primaryBtn} onPress={createEvent} disabled={saving}>
                <ThemedText style={styles.buttonText}>{saving ? 'Posting...' : 'Post event'}</ThemedText>
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
  ringBtn: { padding: Spacing.two, borderRadius: 50, borderWidth: 2 },
  emojiText: { fontSize: 20 },
  boldText: { fontWeight: '900', color: '#000', fontSize: 14 },
  sortRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  sortChipText: { fontWeight: '900', fontSize: 12 },
  noteText: { fontSize: 13, fontWeight: '600', marginBottom: Spacing.three },
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
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: Spacing.two, gap: Spacing.two, flexWrap: 'wrap',
  },
  postedText: { fontSize: 11, fontWeight: '700' },
  // Modal
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
