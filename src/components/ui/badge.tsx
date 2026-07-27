import { StyleProp, StyleSheet, TextStyle, View, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface BadgeProps {
  label: string;
  backgroundColor: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// Small bordered, filled label — used for host tags, @handles, status pills,
// and role tags. Always renders black text, matching every other colored
// surface in the app.
export function Badge({ label, backgroundColor, radius = 8, style, textStyle }: BadgeProps) {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor, borderColor: theme.border, borderRadius: radius }, style]}>
      <ThemedText style={[styles.text, textStyle]}>{label}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderWidth: 2,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 11, fontWeight: '900', color: '#000' },
});
