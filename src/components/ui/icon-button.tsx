import { StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface IconButtonProps {
  emoji: string;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// The small circular emoji button used in every screen header.
export function IconButton({ emoji, onPress, size = 18, style }: IconButtonProps) {
  const theme = useTheme();
  return (
    <TouchableOpacity style={[styles.btn, { borderColor: theme.border }, style]} onPress={onPress}>
      <ThemedText style={{ fontSize: size }}>{emoji}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: Spacing.two, borderRadius: 50, borderWidth: 2 },
});
