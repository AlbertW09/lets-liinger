import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface EventItem {
  id: string;
  title: string;
  host: string;
  location: string;
  image?: string;
  upvotes: number;
}

export default function HomeScreen() {
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'unspecified' ? 'light' : systemScheme;
  const colors = Colors[scheme];

  const [searchQuery, setSearchQuery] = useState('');
  const [rsvps, setRsvps] = useState<Record<string, boolean>>({});
  const [events, setEvents] = useState<EventItem[]>([
    {
      id: '1',
      title: 'HOUSE PARTY & INDIE JAM',
      host: '🎸 MUSIC COLLECTIVE',
      location: 'STUDENT PLAZA',
      upvotes: 42,
    },
    {
      id: '2',
      title: 'RETRO GAMING TOURNAMENT',
      host: '🕹️ ESPORTS CLUB',
      location: 'SUTTER ROOM 102',
      upvotes: 19,
    },
    {
      id: '3',
      title: 'FREE SLICE IN THE QUAD',
      host: '🍕 STUDENT UNION',
      location: 'THE QUAD',
      upvotes: 88,
    }
  ]);

  const toggleRSVP = (eventId: string) => {
    setRsvps(prev => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  const handleUpvote = (eventId: string) => {
    setEvents(prev => 
      prev.map(item => 
        item.id === eventId ? { ...item, upvotes: item.upvotes + 1 } : item
      )
    );
  };

  const dynamicStyles = StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    headerText: {
      color: colors.text,
      fontFamily: 'Helvetica',
      fontWeight: '900',
      fontSize: 32,
      letterSpacing: -1,
    },
    searchContainerShadow: {
      backgroundColor: colors.border,
      borderRadius: 16,
      marginTop: Spacing.two,
      marginBottom: Spacing.four,
    },
    searchContainer: {
      flexDirection: 'row',
      backgroundColor: colors.backgroundElement,
      borderWidth: 3,
      borderColor: colors.border,
      borderRadius: 16,
      padding: Spacing.one,
      alignItems: 'center',
      transform: [{ translateX: -4 }, { translateY: -4 }],
    },
    input: {
      flex: 1,
      paddingHorizontal: Spacing.two,
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
    },
    searchBtn: {
      backgroundColor: colors.accentCyan,
      padding: Spacing.two,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: colors.border,
    },
    cardShadow: {
      backgroundColor: colors.border,
      borderRadius: 20,
      marginBottom: Spacing.four,
    },
    card: {
      backgroundColor: colors.backgroundElement,
      borderWidth: 3,
      borderColor: colors.border,
      borderRadius: 20,
      padding: Spacing.three,
      transform: [{ translateX: -6 }, { translateY: -6 }],
    },
    cardImage: {
      width: '100%',
      height: 180,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
      marginBottom: Spacing.two,
    },
    actionBtn: {
      flex: 1,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: Spacing.two,
      alignItems: 'center',
    }
  });

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <ThemedText style={dynamicStyles.headerText}>LetsLiinger</ThemedText>
          </View>
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

        {events.map((event) => {
          const isRsvped = rsvps[event.id] || false;
          return (
            <View key={event.id} style={dynamicStyles.cardShadow}>
              <View style={dynamicStyles.card}>
                <ThemedText style={styles.eventTitle}>{event.title}</ThemedText>
                
                <View style={styles.metaRow}>
                  <ThemedText style={styles.metaLabel}>HOSTED BY:</ThemedText>
                  <ThemedText style={styles.metaValue}>{event.host}</ThemedText>
                </View>

                {event.image && (
                  <Image 
                    source={{ uri: event.image }} 
                    style={dynamicStyles.cardImage} 
                    resizeMode="cover"
                  />
                )}

                <View style={styles.detailItem}>
                  <ThemedText style={styles.detailEmoji}>📍</ThemedText>
                  <ThemedText style={styles.detailText}>{event.location}</ThemedText>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity 
                    style={[
                      dynamicStyles.actionBtn, 
                      { backgroundColor: isRsvped ? colors.accentGreen : colors.accentYellow }
                    ]}
                    onPress={() => toggleRSVP(event.id)}
                  >
                    <ThemedText style={styles.buttonText}>
                      {isRsvped ? "✓ RSVP'D!" : 'RSVP'}
                    </ThemedText>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={[
                      dynamicStyles.actionBtn, 
                      { backgroundColor: colors.accentCyan, flex: 0.4 }
                    ]}
                    onPress={() => handleUpvote(event.id)}
                  >
                    <ThemedText style={styles.buttonText}>💖 {event.upvotes}</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  sticker: {
    paddingHorizontal: Spacing.one,
    paddingVertical: 2,
    borderRadius: 4,
    transform: [{ rotate: '-8deg' }],
  },
  stickerText: {
    fontWeight: '900',
    fontSize: 10,
    color: '#000',
  },
  ringBtn: {
    padding: Spacing.two,
    borderRadius: 50,
    borderWidth: 2,
  },
  emojiText: {
    fontSize: 20,
  },
  boldText: {
    fontWeight: '900',
    color: '#000',
    fontSize: 14,
  },
  eventTitle: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
    marginBottom: Spacing.one,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.two,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    opacity: 0.6,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '900',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  detailEmoji: {
    fontSize: 16,
  },
  detailText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  buttonText: {
    fontWeight: '900',
    color: '#000',
    fontSize: 14,
  }
});