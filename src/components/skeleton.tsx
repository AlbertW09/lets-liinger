import { useEffect, useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// A softly pulsing grey bar — the building block of loading skeletons.
function Bar({ width, height = 14, radius = 6, style }: { width: number | string; height?: number; radius?: number; style?: any }) {
  const colors = useTheme();
  const opacity = useMemo(() => new Animated.Value(0.4), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius: radius, backgroundColor: colors.backgroundElement, opacity }, style]}
    />
  );
}

// A placeholder card matching the shape of a feed event card.
export function EventCardSkeleton() {
  const colors = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
      <Bar width="100%" height={140} radius={12} style={styles.cover} />
      <Bar width="70%" height={18} style={styles.line} />
      <Bar width="45%" height={12} style={styles.line} />
      <View style={styles.actions}>
        <Bar width="65%" height={34} radius={12} />
        <Bar width="28%" height={34} radius={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 20, padding: Spacing.three, marginBottom: Spacing.three },
  cover: { marginBottom: Spacing.two },
  line: { marginBottom: Spacing.two },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.one },
});
