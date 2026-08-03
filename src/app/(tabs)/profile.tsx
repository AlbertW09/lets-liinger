import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/icon-button';
import { ShadowSurface } from '@/components/ui/shadow-surface';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '../../supabaseClient';

export default function ProfileScreen() {
  const colors = useTheme();
  const router = useRouter();

  const [profile, setProfile] = useState<{
    display_name: string;
    username: string;
    bio: string;
    avatar_url: string | null;
    interests: string[];
    extracurriculars: { name: string; role: string }[];
  } | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savedEvents, setSavedEvents] = useState<{
    id: string;
    title: string;
    host: string;
    location: string;
  }[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);

  async function handleLogOut() {
    setMenuVisible(false);
    await supabase.auth.signOut();
    // Root layout listens for the auth-state change and redirects to /auth
  }

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function fetchProfile() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setLoadingProfile(false);
          return;
        }

        const [profileRes, rsvpRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('display_name, username, bio, avatar_url, interests, extracurriculars')
            .eq('id', user.id)
            .single(),
          supabase
            .from('rsvps')
            .select('event:events!rsvps_event_id_fkey(id, title, location, creator:profiles!events_created_by_fkey(username, display_name))')
            .eq('user_id', user.id),
        ]);

        if (cancelled) return;

        if (!profileRes.error) {
          setProfile(profileRes.data);
        }

        const rsvped = (rsvpRes.data ?? [])
          .map((r: any) => r.event)
          .filter(Boolean)
          .map((e: any) => ({
            id: e.id,
            title: e.title,
            location: e.location ?? 'TBD',
            host: e.creator?.username ? `@${e.creator.username}` : e.creator?.display_name ?? 'Someone',
          }));
        setSavedEvents(rsvped);

        setLoadingProfile(false);
      }

      fetchProfile();
      return () => { cancelled = true; };
    }, [])
  );

  const clubColors = [colors.accentPink, colors.accentCyan, colors.accentYellow, colors.accentGreen];

  const dynamicStyles = useMemo(() => StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerText: {
      color: colors.text,
      fontFamily: 'ui-rounded',
      fontWeight: '900',
      fontSize: 28,
      letterSpacing: -1,
    },
    avatarContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 3,
      borderColor: colors.border,
      backgroundColor: colors.accentYellow,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: Spacing.two,
      overflow: 'hidden',
    },
  }), [colors]);

  if (loadingProfile) {
    return (
      <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <ThemedText style={dynamicStyles.headerText}>my profile</ThemedText>
          <IconButton emoji="⚙️" onPress={() => setMenuVisible(true)} />
        </View>

        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuVisible(false)}>
            <ShadowSurface backgroundColor={colors.backgroundElement} radius={16} offset={4} wrapperStyle={styles.menuShadow} style={styles.menu}>
              <TouchableOpacity style={styles.menuItem} onPress={handleLogOut}>
                <ThemedText style={styles.menuItemText}>🚪 Log Out</ThemedText>
              </TouchableOpacity>
            </ShadowSurface>
          </Pressable>
        </Modal>

        <ShadowSurface backgroundColor={colors.backgroundElement} radius={24} offset={6} wrapperStyle={styles.profileCardShadow} style={styles.profileCard}>
          <View style={dynamicStyles.avatarContainer}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} resizeMode="cover" />
            ) : null}
          </View>

          <ThemedText style={styles.userName}>
            {(profile?.display_name || 'New Student').toUpperCase()}
          </ThemedText>

          <Badge label={`@${profile?.username || 'username'}`} backgroundColor={colors.accentCyan} radius={12} style={styles.handleBadge} />

          <ThemedText style={styles.bioText}>
            {profile?.bio || 'No bio yet.'}
          </ThemedText>

          {!!profile?.interests?.length && (
            <View style={styles.interestsWrap}>
              {profile.interests.map((tag) => (
                <View key={tag} style={[styles.interestChip, { borderColor: colors.border }]}>
                  <ThemedText style={styles.interestChipText}>{tag}</ThemedText>
                </View>
              ))}
            </View>
          )}

          <ShadowSurface
            backgroundColor={colors.accentPink}
            radius={14}
            offset={3}
            wrapperStyle={styles.editBtnShadow}
            style={styles.editBtn}
            onPress={() => router.push('/edit-profile')}
          >
            <ThemedText style={styles.boldBtnText}>EDIT PROFILE</ThemedText>
          </ShadowSurface>
        </ShadowSurface>

        <View style={styles.statsRow}>
          <ShadowSurface backgroundColor={colors.backgroundElement} radius={16} offset={4} wrapperStyle={styles.statBoxShadow} style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{savedEvents.length}</ThemedText>
            <ThemedText style={styles.statLabel}>RSVPS</ThemedText>
          </ShadowSurface>

          <ShadowSurface backgroundColor={colors.backgroundElement} radius={16} offset={4} wrapperStyle={styles.statBoxShadow} style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{profile?.extracurriculars?.length ?? 0}</ThemedText>
            <ThemedText style={styles.statLabel}>CLUBS</ThemedText>
          </ShadowSurface>
        </View>

        <ShadowSurface
          backgroundColor={colors.accentYellow}
          radius={14}
          offset={4}
          wrapperStyle={styles.insightsBtnShadow}
          style={styles.insightsBtn}
          onPress={() => router.push('/insights')}
        >
          <ThemedText style={styles.insightsBtnText}>📊 MY EVENT INSIGHTS</ThemedText>
        </ShadowSurface>

        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>🏷️ MY CLUBS</ThemedText>
        </View>

        {!profile?.extracurriculars?.length && (
          <ThemedText style={styles.emptyText} themeColor="textSecondary">
            No extracurriculars added yet. Add some from Edit Profile.
          </ThemedText>
        )}

        {profile?.extracurriculars?.map((club, index) => (
          <ShadowSurface
            key={`${club.name}-${index}`}
            backgroundColor={clubColors[index % clubColors.length]}
            radius={14}
            offset={3}
            wrapperStyle={styles.clubTagShadow}
            style={styles.clubTag}
          >
            <ThemedText style={styles.clubNameText}>{club.name}</ThemedText>
            <View style={[styles.roleBadge, { borderColor: colors.border }]}>
              <ThemedText style={styles.roleText}>{club.role}</ThemedText>
            </View>
          </ShadowSurface>
        ))}

        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>⚡️ MY ACTIVITY</ThemedText>
        </View>

        {savedEvents.length === 0 && (
          <ThemedText style={styles.emptyText} themeColor="textSecondary">
            No RSVPs yet. RSVP to events from the home feed.
          </ThemedText>
        )}

        {savedEvents.map((event) => (
          <ShadowSurface
            key={event.id}
            backgroundColor={colors.backgroundElement}
            radius={16}
            offset={4}
            borderWidth={2}
            wrapperStyle={styles.eventCardShadow}
            style={styles.eventCard}
            onPress={() => router.push(`/event-detail?id=${event.id}`)}
          >
            <Badge label="RSVP'D" backgroundColor={colors.accentGreen} style={styles.statusBadge} />
            <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
            <ThemedText style={styles.eventMeta}>Hosted by {event.host} • 📍 {event.location}</ThemedText>
          </ShadowSurface>
        ))}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 130,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  profileCardShadow: { marginBottom: Spacing.four },
  profileCard: { padding: Spacing.four, alignItems: 'center' },
  handleBadge: { marginTop: Spacing.one, marginBottom: Spacing.two },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  bioText: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    opacity: 0.8,
    marginVertical: Spacing.one,
  },
  interestsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.one,
  },
  interestChip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
  },
  interestChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  editBtnShadow: { marginTop: Spacing.two, width: '100%' },
  editBtn: { paddingVertical: Spacing.two, alignItems: 'center' },
  boldBtnText: {
    fontWeight: '900',
    color: '#000',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.four,
  },
  statBoxShadow: { flex: 1 },
  statBox: { paddingVertical: Spacing.two, alignItems: 'center' },
  insightsBtnShadow: { marginBottom: Spacing.four },
  insightsBtn: { paddingVertical: Spacing.three, alignItems: 'center' },
  insightsBtnText: { fontWeight: '900', color: '#000', fontSize: 14, letterSpacing: 0.5 },
  statNumber: {
    fontSize: 20,
    fontWeight: '900',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    opacity: 0.6,
  },
  sectionHeader: {
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: Spacing.two,
  },
  clubTagShadow: { marginBottom: Spacing.two },
  clubTag: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  clubNameText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000',
  },
  roleBadge: {
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
  statusBadge: { marginBottom: Spacing.one },
  eventCardShadow: { marginBottom: Spacing.two },
  eventCard: { padding: Spacing.three },
  eventTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 2,
  },
  eventMeta: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.6,
  },
  menuBackdrop: {
    flex: 1,
    alignItems: 'flex-end',
  },
  menuShadow: { marginTop: 60, marginRight: Spacing.four },
  menu: { minWidth: 160, paddingVertical: Spacing.one },
  menuItem: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '900',
  },
});
