import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Friendly "nothing here yet" placeholder, used instead of a blank screen.
export function EmptyState({
  emoji, title, subtitle,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.wrap}>
      {emoji ? <ThemedText style={styles.emoji}>{emoji}</ThemedText> : null}
      <ThemedText style={styles.title}>{title}</ThemedText>
      {subtitle ? (
        <ThemedText style={styles.subtitle} themeColor="textSecondary">{subtitle}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: Spacing.six, paddingHorizontal: Spacing.four },
  emoji: { fontSize: 40, marginBottom: Spacing.two },
  title: { fontSize: 16, fontWeight: '900', textAlign: 'center', marginBottom: Spacing.one },
  subtitle: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 18 },
});
