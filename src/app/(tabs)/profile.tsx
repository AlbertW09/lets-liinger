import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../supabaseClient';

export default function ProfileScreen() {
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'unspecified' ? 'light' : systemScheme;
  const colors = Colors[scheme];
  const router = useRouter();

  const [profile, setProfile] = useState<{
    display_name: string;
    username: string;
    bio: string;
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
            .select('display_name, username, bio, interests, extracurriculars')
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

  const dynamicStyles = StyleSheet.create({
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
    profileCardShadow: {
      backgroundColor: colors.border,
      borderRadius: 24,
      marginBottom: Spacing.four,
    },
    profileCard: {
      backgroundColor: colors.backgroundElement,
      borderWidth: 3,
      borderColor: colors.border,
      borderRadius: 24,
      padding: Spacing.four,
      alignItems: 'center',
      transform: [{ translateX: -6 }, { translateY: -6 }],
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
    },
    avatarImage: {
      width: 94,
      height: 94,
      borderRadius: 47,
    },
    handleBadge: {
      backgroundColor: colors.accentCyan,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.half,
      marginTop: Spacing.one,
      marginBottom: Spacing.two,
    },
    statBoxShadow: {
      flex: 1,
      backgroundColor: colors.border,
      borderRadius: 16,
    },
    statBox: {
      backgroundColor: colors.backgroundElement,
      borderWidth: 3,
      borderColor: colors.border,
      borderRadius: 16,
      paddingVertical: Spacing.two,
      alignItems: 'center',
      transform: [{ translateX: -4 }, { translateY: -4 }],
    },
    clubTagShadow: {
      backgroundColor: colors.border,
      borderRadius: 14,
      marginBottom: Spacing.two,
    },
    clubTag: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 14,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.two,
      transform: [{ translateX: -3 }, { translateY: -3 }],
    },
    eventCardShadow: {
      backgroundColor: colors.border,
      borderRadius: 16,
      marginBottom: Spacing.two,
    },
    eventCard: {
      backgroundColor: colors.backgroundElement,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 16,
      padding: Spacing.three,
      transform: [{ translateX: -4 }, { translateY: -4 }],
    },
    statusBadge: {
      backgroundColor: colors.accentGreen,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.half,
      alignSelf: 'flex-start',
      marginBottom: Spacing.one,
    },
    editBtnShadow: {
      backgroundColor: colors.border,
      borderRadius: 14,
      marginTop: Spacing.two,
      width: '100%',
    },
    editBtn: {
      backgroundColor: colors.accentPink,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: Spacing.two,
      alignItems: 'center',
      transform: [{ translateX: -3 }, { translateY: -3 }],
    }
  });

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
          <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]}>
            <ThemedText style={styles.emojiText}>⚙️</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.profileCardShadow}>
          <View style={dynamicStyles.profileCard}>
            <View style={dynamicStyles.avatarContainer}>
              
            </View>

            <ThemedText style={styles.userName}>
              {(profile?.display_name || 'New Student').toUpperCase()}
            </ThemedText>
            
            <View style={dynamicStyles.handleBadge}>
              <ThemedText style={styles.handleText}>
                @{profile?.username || 'username'}
              </ThemedText>
            </View>

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

            <View style={dynamicStyles.editBtnShadow}>
              <TouchableOpacity style={dynamicStyles.editBtn} onPress={() => router.push('/edit-profile')}>
                <ThemedText style={styles.boldBtnText}>EDIT PROFILE</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={dynamicStyles.statBoxShadow}>
            <View style={dynamicStyles.statBox}>
              <ThemedText style={styles.statNumber}>{savedEvents.length}</ThemedText>
              <ThemedText style={styles.statLabel}>RSVPS</ThemedText>
            </View>
          </View>

          <View style={dynamicStyles.statBoxShadow}>
            <View style={dynamicStyles.statBox}>
              <ThemedText style={styles.statNumber}>{profile?.extracurriculars?.length ?? 0}</ThemedText>
              <ThemedText style={styles.statLabel}>CLUBS</ThemedText>
            </View>
          </View>

          <View style={dynamicStyles.statBoxShadow}>
            <View style={dynamicStyles.statBox}>
              <ThemedText style={styles.statNumber}>45</ThemedText>
              <ThemedText style={styles.statLabel}>UPVOTES</ThemedText>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>🏷️ MY CLUBS</ThemedText>
        </View>

        {!profile?.extracurriculars?.length && (
          <ThemedText style={styles.emptyText} themeColor="textSecondary">
            No extracurriculars added yet. Add some from Edit Profile.
          </ThemedText>
        )}

        {profile?.extracurriculars?.map((club, index) => (
          <View key={`${club.name}-${index}`} style={dynamicStyles.clubTagShadow}>
            <View style={[dynamicStyles.clubTag, { backgroundColor: clubColors[index % clubColors.length] }]}>
              <ThemedText style={styles.clubNameText}>{club.name}</ThemedText>
              <View style={[styles.roleBadge, { borderColor: colors.border }]}>
                <ThemedText style={styles.roleText}>{club.role}</ThemedText>
              </View>
            </View>
          </View>
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
          <TouchableOpacity
            key={event.id}
            style={dynamicStyles.eventCardShadow}
            activeOpacity={0.9}
            onPress={() => router.push(`/event-detail?id=${event.id}`)}
          >
            <View style={dynamicStyles.eventCard}>
              <View style={dynamicStyles.statusBadge}>
                <ThemedText style={styles.statusText}>RSVP'D</ThemedText>
              </View>
              <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
              <ThemedText style={styles.eventMeta}>Hosted by {event.host} • 📍 {event.location}</ThemedText>
            </View>
          </TouchableOpacity>
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
  iconBtn: {
    padding: Spacing.two,
    borderRadius: 50,
    borderWidth: 2,
  },
  emojiText: {
    fontSize: 18,
  },
  userName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  handleText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000',
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
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#000',
  },
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
});