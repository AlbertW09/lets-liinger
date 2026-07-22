import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
    useColorScheme
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  time: string;
  location: string;
  host: string;
  color: string;
}

export default function CalendarScreen() {
  const systemScheme = useColorScheme();
  const scheme = systemScheme === 'unspecified' ? 'light' : systemScheme;
  const colors = Colors[scheme];

  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDateStr, setSelectedDateStr] = useState(
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  );

  const [scheduledEvents] = useState<CalendarEvent[]>([
    {
      id: '1',
      date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
      title: 'HOUSE PARTY & INDIE JAM',
      time: '8:00 PM',
      location: 'STUDENT PLAZA',
      host: '🎸 MUSIC COLLECTIVE',
      color: colors.accentPink,
    },
    {
      id: '2',
      date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
      title: 'Y2K DANCE BASH',
      time: '10:30 PM',
      location: 'CAMPUS CENTER',
      host: '💃 DANCE CLUB',
      color: colors.accentYellow,
    },
    {
      id: '3',
      date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(Math.min(today.getDate() + 2, 28)).padStart(2, '0')}`,
      title: 'RETRO GAMING TOURNAMENT',
      time: '6:30 PM',
      location: 'SUTTER ROOM 102',
      host: '🕹️ ESPORTS CLUB',
      color: colors.accentCyan,
    },
    {
      id: '4',
      date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(Math.min(today.getDate() + 5, 28)).padStart(2, '0')}`,
      title: 'FREE SLICE IN THE QUAD',
      time: '12:00 PM',
      location: 'THE QUAD',
      host: '🍕 STUDENT UNION',
      color: colors.accentGreen,
    }
  ]);

  const monthNames = [
    'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
    'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
  ];
  const dayLabels = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const getFormattedDate = (yearNum: number, monthNum: number, dayNum: number) => {
    return `${yearNum}-${String(monthNum + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  };

  const selectedEvents = scheduledEvents.filter(e => e.date === selectedDateStr);

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
    calendarCardShadow: {
      backgroundColor: colors.border,
      borderRadius: 20,
      marginBottom: Spacing.four,
    },
    calendarCard: {
      backgroundColor: colors.backgroundElement,
      borderWidth: 3,
      borderColor: colors.border,
      borderRadius: 20,
      padding: Spacing.three,
      transform: [{ translateX: -5 }, { translateY: -5 }],
    },
    navBtn: {
      backgroundColor: colors.accentYellow,
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: Spacing.two,
      paddingVertical: Spacing.one,
    },
    dayCell: {
      width: '14.28%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 2,
    },
    dayInner: {
      width: '90%',
      height: '90%',
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    eventDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: colors.accentPink,
      position: 'absolute',
      bottom: 3,
    },
    eventCardShadow: {
      backgroundColor: colors.border,
      borderRadius: 18,
      marginBottom: Spacing.three,
    },
    eventCard: {
      backgroundColor: colors.backgroundElement,
      borderWidth: 3,
      borderColor: colors.border,
      borderRadius: 18,
      padding: Spacing.three,
      transform: [{ translateX: -4 }, { translateY: -4 }],
    },
    badge: {
      borderWidth: 2,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: Spacing.two,
      paddingVertical: 2,
      alignSelf: 'flex-start',
      marginBottom: Spacing.two,
    }
  });

  const renderGrid = () => {
    const TOTAL_SLOTS = 42; // Always 6 weeks (6 rows * 7 days = 42 cells)
    const gridCells = [];

    // Calculate previous month padding days
    const prevMonthDays = new Date(year, month, 0).getDate();

    for (let i = 0; i < TOTAL_SLOTS; i++) {
      let cellDay: number;
      let cellMonth = month;
      let cellYear = year;
      let isCurrentMonth = true;

      if (i < firstDayIndex) {
        // Leading days from previous month
        isCurrentMonth = false;
        cellDay = prevMonthDays - firstDayIndex + i + 1;
        cellMonth = month === 0 ? 11 : month - 1;
        cellYear = month === 0 ? year - 1 : year;
      } else if (i >= firstDayIndex + daysInMonth) {
        // Trailing days for next month
        isCurrentMonth = false;
        cellDay = i - (firstDayIndex + daysInMonth) + 1;
        cellMonth = month === 11 ? 0 : month + 1;
        cellYear = month === 11 ? year + 1 : year;
      } else {
        // Days in current month
        cellDay = i - firstDayIndex + 1;
      }

      const dateStr = getFormattedDate(cellYear, cellMonth, cellDay);
      const isSelected = dateStr === selectedDateStr;
      const isToday = 
        cellDay === today.getDate() && 
        cellMonth === today.getMonth() && 
        cellYear === today.getFullYear();

      const hasEvents = scheduledEvents.some(e => e.date === dateStr);

      gridCells.push(
        <TouchableOpacity
          key={`slot-${i}`}
          style={dynamicStyles.dayCell}
          onPress={() => setSelectedDateStr(dateStr)}
          activeOpacity={0.7}
        >
          <View style={[
            dynamicStyles.dayInner,
            isSelected && { backgroundColor: colors.accentCyan, borderColor: colors.border, borderWidth: 2 },
            !isSelected && isToday && { backgroundColor: colors.accentYellow, borderColor: colors.border, borderWidth: 2 },
          ]}>
            <ThemedText style={{
              fontWeight: isSelected || isToday ? '900' : '700',
              color: isSelected || isToday 
                ? '#000' 
                : isCurrentMonth 
                  ? colors.text 
                  : colors.text + '33', // Faded color for outside-month days
              fontSize: 13,
            }}>
              {cellDay}
            </ThemedText>
            {hasEvents && !isSelected && <View style={dynamicStyles.eventDot} />}
          </View>
        </TouchableOpacity>
      );
    }

    return gridCells;
  };

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <ThemedText style={dynamicStyles.headerText}>event calendar</ThemedText>
          <TouchableOpacity style={[styles.iconBtn, { borderColor: colors.border }]}>
            <ThemedText style={styles.emojiText}>⚡️</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.calendarCardShadow}>
          <View style={dynamicStyles.calendarCard}>
            
            <View style={styles.monthHeader}>
              <TouchableOpacity onPress={prevMonth} style={dynamicStyles.navBtn}>
                <ThemedText style={styles.boldText}>◀</ThemedText>
              </TouchableOpacity>

              <ThemedText style={styles.monthTitle}>
                {monthNames[month]} {year}
              </ThemedText>

              <TouchableOpacity onPress={nextMonth} style={dynamicStyles.navBtn}>
                <ThemedText style={styles.boldText}>▶</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.dayLabelsRow}>
              {dayLabels.map((lbl, idx) => (
                <View key={idx} style={dynamicStyles.dayCell}>
                  <ThemedText style={styles.dayLabelText}>{lbl}</ThemedText>
                </View>
              ))}
            </View>

            <View style={styles.gridContainer}>
              {renderGrid()}
            </View>

          </View>
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>
            📅 EVENTS FOR {selectedDateStr}
          </ThemedText>
        </View>

        {selectedEvents.length === 0 ? (
          <View style={dynamicStyles.eventCardShadow}>
            <View style={dynamicStyles.eventCard}>
              <ThemedText style={styles.noEventsText}>
                NO EVENTS LINED UP FOR THIS DAY YET! 😴
              </ThemedText>
            </View>
          </View>
        ) : (
          selectedEvents.map((evt) => (
            <View key={evt.id} style={dynamicStyles.eventCardShadow}>
              <View style={dynamicStyles.eventCard}>
                <View style={[dynamicStyles.badge, { backgroundColor: evt.color }]}>
                  <ThemedText style={styles.badgeText}>{evt.host}</ThemedText>
                </View>

                <ThemedText style={styles.eventTitle}>{evt.title}</ThemedText>

                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <ThemedText style={styles.detailEmoji}>🕒</ThemedText>
                    <ThemedText style={styles.detailText}>{evt.time}</ThemedText>
                  </View>
                  <View style={styles.detailItem}>
                    <ThemedText style={styles.detailEmoji}>📍</ThemedText>
                    <ThemedText style={styles.detailText}>{evt.location}</ThemedText>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: Spacing.four,
    paddingBottom: 130,
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
  boldText: {
    fontWeight: '900',
    color: '#000',
    fontSize: 14,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  dayLabelsRow: {
    flexDirection: 'row',
    marginBottom: Spacing.one,
  },
  dayLabelText: {
    fontSize: 10,
    fontWeight: '900',
    opacity: 0.5,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  sectionHeader: {
    marginTop: Spacing.two,
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    fontWeight: '900',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: Spacing.two,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: Spacing.four,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  detailEmoji: {
    fontSize: 14,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '800',
  },
  noEventsText: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    opacity: 0.6,
  }
});