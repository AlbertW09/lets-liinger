import { Image, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

// A small circular avatar: shows the photo, or the first letter of the name as
// a fallback. Reused next to usernames across the app (event host, comments,
// RSVPs, etc.).
export function AvatarBubble({
  url, name, size = 32, bg,
}: {
  url?: string | null;
  name?: string | null;
  size?: number;
  bg?: string;
}) {
  const colors = useTheme();
  const letter = (name || '?').replace(/^@/, '').charAt(0).toUpperCase() || '?';
  return (
    <View
      style={[
        styles.wrap,
        { width: size, height: size, borderRadius: size / 2, borderColor: colors.border, backgroundColor: bg ?? colors.accentYellow },
      ]}
    >
      {url ? (
        <Image source={{ uri: url }} style={styles.img} resizeMode="cover" />
      ) : (
        <ThemedText style={[styles.letter, { fontSize: Math.round(size * 0.42) }]}>{letter}</ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 2, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  img: { width: '100%', height: '100%' },
  letter: { fontWeight: '900', color: '#000' },
});
