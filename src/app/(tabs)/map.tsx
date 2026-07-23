import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Platform, ScrollView, StyleSheet, TouchableOpacity, useColorScheme, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseClient';

type DateFilter = 'all' | 'tonight' | 'week';

interface Coords {
  lat: number;
  lng: number;
}

interface PinEvent {
  id: string;
  title: string;
  location: string | null;
  event_time: string | null;
  lat: number;
  lng: number;
  hostName: string;
  rsvpedByMe: boolean;
}

const MAP_EL_ID = 'liinger-leaflet-map';
const IS_WEB = Platform.OS === 'web';

// Browser-only geolocation, guarded for SSR/native.
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

// Load Leaflet from CDN once (web only). Resolves with window.L.
function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('no dom'));
      return;
    }
    const w = window as any;
    if (w.L) { resolve(w.L); return; }

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const existing = document.getElementById('leaflet-js') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(w.L));
      existing.addEventListener('error', reject);
      return;
    }
    const script = document.createElement('script');
    script.id = 'leaflet-js';
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve(w.L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function formatEventTime(iso: string | null): string {
  if (!iso) return 'Date TBD';
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'));
  if (isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

export default function MapScreen() {
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'unspecified' ? 'light' : systemScheme;
  const colors = Colors[scheme];
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<Coords | null>(null);
  const [pins, setPins] = useState<PinEvent[]>([]);
  const [missingCoords, setMissingCoords] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const fitKeyRef = useRef<string>('');

  const pinAccents = [colors.accentPink, colors.accentCyan, colors.accentYellow, colors.accentGreen];

  const fetchAll = useCallback(async (filter: DateFilter) => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id ?? null);

    const [eventsRes, rsvpsRes] = await Promise.all([
      supabase
        .from('events')
        .select('id, title, location, event_time, latitude, longitude, creator:profiles!events_created_by_fkey(username, display_name)'),
      supabase.from('rsvps').select('event_id, user_id'),
    ]);

    const rawEvents = eventsRes.data ?? [];
    const rsvps = rsvpsRes.data ?? [];

    const now = new Date();
    const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const endWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59);

    const upcoming = rawEvents.filter((e: any) => {
      if (!e.event_time) return false;
      const t = new Date(e.event_time.replace(' ', 'T'));
      if (isNaN(t.getTime()) || t < now) return false;
      if (filter === 'tonight') return t <= endToday;
      if (filter === 'week') return t <= endWeek;
      return true;
    });

    const withCoords = upcoming.filter((e: any) => e.latitude != null && e.longitude != null);
    setMissingCoords(upcoming.length - withCoords.length);

    setPins(
      withCoords.map((e: any) => ({
        id: e.id,
        title: e.title,
        location: e.location,
        event_time: e.event_time,
        lat: e.latitude,
        lng: e.longitude,
        hostName: e.creator?.username ? `@${e.creator.username}` : e.creator?.display_name ?? 'Someone',
        rsvpedByMe: !!user && rsvps.some((r) => r.event_id === e.id && r.user_id === user.id),
      }))
    );
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!userCoords) {
          const c = await getCurrentCoords();
          if (!cancelled && c) setUserCoords(c);
        }
        if (!cancelled) await fetchAll(dateFilter);
      })();
      return () => { cancelled = true; };
    }, [fetchAll, dateFilter, userCoords])
  );

  // Initialise the Leaflet map once (web only).
  useEffect(() => {
    if (!IS_WEB || typeof document === 'undefined') return;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled) return;
        leafletRef.current = L;
        const el = document.getElementById(MAP_EL_ID);
        if (!el || mapRef.current) return;
        const map = L.map(el, { scrollWheelZoom: true, zoomControl: true }).setView([37.9, -122.1], 9);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);
        map.on('click', () => setSelectedId(null));
        mapRef.current = map;
        setMapReady(true);
      })
      .catch(() => setMapError(true));

    return () => { cancelled = true; };
  }, []);

  // Draw / redraw markers whenever the data or map readiness changes (web only).
  useEffect(() => {
    if (!IS_WEB || !mapReady || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    const border = colors.border;

    // clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    pins.forEach((pin, idx) => {
      const bg = pin.rsvpedByMe ? colors.accentGreen : pinAccents[idx % pinAccents.length];
      const glyph = pin.rsvpedByMe ? '✓' : '📍';
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${bg};border:3px solid ${border};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#000;box-shadow:2px 2px 0 ${border};">${glyph}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      const marker = L.marker([pin.lat, pin.lng], { icon }).addTo(map);
      marker.on('click', () => setSelectedId(pin.id));
      markersRef.current.push(marker);
    });

    if (userCoords) {
      const userIcon = L.divIcon({
        className: '',
        html: `<div style="width:18px;height:18px;border-radius:50%;background:${colors.accentCyan};border:3px solid ${border};box-shadow:0 0 0 6px ${colors.accentCyan}55;"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      markersRef.current.push(L.marker([userCoords.lat, userCoords.lng], { icon: userIcon }).addTo(map));
    }

    // Fit bounds only when the set of points actually changes (not on RSVP toggles).
    const pts: [number, number][] = pins.map((p) => [p.lat, p.lng]);
    if (userCoords) pts.push([userCoords.lat, userCoords.lng]);
    const fitKey = pts.map((p) => p.join(',')).sort().join('|');
    if (fitKey && fitKey !== fitKeyRef.current) {
      if (pts.length === 1) {
        map.setView(pts[0], 15);
      } else if (pts.length > 1) {
        map.fitBounds(pts, { padding: [50, 50], maxZoom: 16 });
      }
      fitKeyRef.current = fitKey;
    }
  }, [pins, userCoords, mapReady, colors.border, colors.accentGreen, colors.accentCyan]);

  async function toggleRsvp(pin: PinEvent) {
    if (!userId) return;
    if (pin.rsvpedByMe) {
      await supabase.from('rsvps').delete().eq('event_id', pin.id).eq('user_id', userId);
    } else {
      await supabase.from('rsvps').insert({ event_id: pin.id, user_id: userId });
    }
    fetchAll(dateFilter);
  }

  const selected = pins.find((p) => p.id === selectedId) ?? null;

  const filters: { key: DateFilter; label: string }[] = [
    { key: 'all', label: '🌐 All upcoming' },
    { key: 'tonight', label: '🌙 Tonight' },
    { key: 'week', label: '📆 This week' },
  ];

  const dynamicStyles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    headerText: {
      color: colors.text, fontFamily: 'ui-rounded', fontWeight: '900',
      fontSize: 28, letterSpacing: -1,
    },
    filterChip: {
      paddingVertical: Spacing.one, paddingHorizontal: Spacing.three, borderRadius: 999,
      borderWidth: 2, borderColor: colors.border, backgroundColor: colors.backgroundElement,
    },
    filterChipActive: { backgroundColor: colors.accentPink },
    mapShadow: { backgroundColor: colors.border, borderRadius: 20, marginBottom: Spacing.three },
    mapWrap: {
      backgroundColor: colors.backgroundElement,
      borderWidth: 3, borderColor: colors.border, borderRadius: 20,
      height: 460, overflow: 'hidden', position: 'relative',
      transform: [{ translateX: -5 }, { translateY: -5 }],
    },
    popupShadow: {
      position: 'absolute', left: Spacing.three, right: Spacing.three, bottom: Spacing.three,
      backgroundColor: colors.border, borderRadius: 16, zIndex: 1000,
    },
    popup: {
      backgroundColor: colors.background, borderWidth: 3, borderColor: colors.border, borderRadius: 16,
      padding: Spacing.three, transform: [{ translateX: -4 }, { translateY: -4 }],
    },
    rsvpBtn: {
      borderWidth: 2, borderColor: colors.border, borderRadius: 10,
      paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, alignItems: 'center',
    },
    seeMoreBtn: {
      borderWidth: 2, borderColor: colors.border, borderRadius: 10,
      paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, alignItems: 'center',
      backgroundColor: colors.accentCyan,
    },
    // native fallback list
    listCardShadow: { backgroundColor: colors.border, borderRadius: 16, marginBottom: Spacing.three },
    listCard: {
      backgroundColor: colors.backgroundElement, borderWidth: 2, borderColor: colors.border,
      borderRadius: 16, padding: Spacing.three, transform: [{ translateX: -3 }, { translateY: -3 }],
    },
  });

  const renderPopup = () =>
    selected ? (
      <View style={dynamicStyles.popupShadow}>
        <View style={dynamicStyles.popup}>
          <View style={styles.popupHeader}>
            <ThemedText style={styles.popupTitle} numberOfLines={1}>{selected.title}</ThemedText>
            <TouchableOpacity onPress={() => setSelectedId(null)}>
              <ThemedText style={styles.popupClose}>✕</ThemedText>
            </TouchableOpacity>
          </View>
          <ThemedText style={styles.popupMeta} themeColor="textSecondary">
            🕒 {formatEventTime(selected.event_time)}
          </ThemedText>
          <ThemedText style={styles.popupMeta} themeColor="textSecondary">
            📍 {selected.location ?? 'TBD'} · {selected.hostName}
          </ThemedText>
          <View style={styles.popupActions}>
            <TouchableOpacity
              style={[dynamicStyles.rsvpBtn, { backgroundColor: selected.rsvpedByMe ? colors.accentGreen : colors.accentYellow }]}
              onPress={() => toggleRsvp(selected)}
            >
              <ThemedText style={styles.btnText}>{selected.rsvpedByMe ? "✓ RSVP'D!" : 'RSVP'}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={dynamicStyles.seeMoreBtn} onPress={() => router.push(`/event-detail?id=${selected.id}`)}>
              <ThemedText style={styles.btnText}>See more →</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    ) : null;

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <ThemedText style={dynamicStyles.headerText}>campus map</ThemedText>
          <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]}>
            <ThemedText style={styles.emojiText}>🗺️</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.filterRow}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[dynamicStyles.filterChip, dateFilter === f.key && dynamicStyles.filterChipActive]}
              onPress={() => setDateFilter(f.key)}
            >
              <ThemedText style={styles.filterChipText}>{f.label}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {IS_WEB ? (
          <View style={dynamicStyles.mapShadow}>
            <View style={dynamicStyles.mapWrap}>
              {/* Leaflet mounts into this element */}
              <View nativeID={MAP_EL_ID} style={StyleSheet.absoluteFill} />

              {(!mapReady || loading) && !mapError && (
                <View style={styles.overlayCenter} pointerEvents="none">
                  <ActivityIndicator size="large" color={colors.text} />
                </View>
              )}
              {mapError && (
                <View style={styles.overlayCenter} pointerEvents="none">
                  <ThemedText style={styles.emptyText} themeColor="textSecondary">
                    Couldn’t load the map. Check your connection.
                  </ThemedText>
                </View>
              )}
              {mapReady && !loading && pins.length === 0 && (
                <View style={styles.overlayCenter} pointerEvents="none">
                  <View style={[styles.emptyPill, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <ThemedText style={styles.emptyText}>No upcoming events with a location here.</ThemedText>
                  </View>
                </View>
              )}

              {renderPopup()}
            </View>
          </View>
        ) : (
          // Native fallback: a simple tappable list
          <View>
            {loading ? (
              <ActivityIndicator size="large" color={colors.text} style={{ marginVertical: Spacing.six }} />
            ) : pins.length === 0 ? (
              <ThemedText style={styles.emptyText} themeColor="textSecondary">
                No upcoming events with a location.
              </ThemedText>
            ) : (
              pins.map((pin) => (
                <TouchableOpacity
                  key={pin.id}
                  style={dynamicStyles.listCardShadow}
                  activeOpacity={0.9}
                  onPress={() => router.push(`/event-detail?id=${pin.id}`)}
                >
                  <View style={dynamicStyles.listCard}>
                    <ThemedText style={styles.popupTitle}>{pin.title}</ThemedText>
                    <ThemedText style={styles.popupMeta} themeColor="textSecondary">
                      🕒 {formatEventTime(pin.event_time)}
                    </ThemedText>
                    <ThemedText style={styles.popupMeta} themeColor="textSecondary">
                      📍 {pin.location ?? 'TBD'} · {pin.hostName}
                    </ThemedText>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.accentPink, borderColor: colors.border }]} />
            <ThemedText style={styles.legendText}>Event</ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.accentGreen, borderColor: colors.border }]} />
            <ThemedText style={styles.legendText}>You're going</ThemedText>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.accentCyan, borderColor: colors.border }]} />
            <ThemedText style={styles.legendText}>You are here</ThemedText>
          </View>
        </View>

        {IS_WEB && !userCoords && (
          <ThemedText style={styles.noteText} themeColor="textSecondary">
            Turn on location to see where you are on the map.
          </ThemedText>
        )}
        {missingCoords > 0 && (
          <ThemedText style={styles.noteText} themeColor="textSecondary">
            {missingCoords} upcoming event{missingCoords > 1 ? 's' : ''} without a pinned location {missingCoords > 1 ? 'are' : 'is'} not shown.
          </ThemedText>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, paddingBottom: 130 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.three,
  },
  iconBtn: { padding: Spacing.two, borderRadius: 50, borderWidth: 2 },
  emojiText: { fontSize: 18 },
  filterRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.three },
  filterChipText: { fontWeight: '900', fontSize: 12 },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', padding: Spacing.four,
  },
  emptyPill: {
    borderWidth: 2, borderRadius: 12, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three,
  },
  emptyText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  popupHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: Spacing.one,
  },
  popupTitle: { fontSize: 16, fontWeight: '900', flex: 1, marginRight: Spacing.two },
  popupClose: { fontSize: 16, fontWeight: '900' },
  popupMeta: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  popupActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.three },
  btnText: { fontWeight: '900', color: '#000', fontSize: 13 },
  legendRow: { flexDirection: 'row', gap: Spacing.three, marginBottom: Spacing.two, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  legendDot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  legendText: { fontSize: 12, fontWeight: '800' },
  noteText: { fontSize: 12, fontWeight: '600', marginTop: Spacing.one },
});
