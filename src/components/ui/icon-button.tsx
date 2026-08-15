import { Image, ImageSourcePropType, StyleProp, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface IconButtonProps {
  emoji?: string;
  icon?: ImageSourcePropType;
  onPress?: () => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

// The small circular button used in every screen header — either an emoji
// glyph or a custom image icon (pass exactly one of `emoji` / `icon`).
export function IconButton({ emoji, icon, onPress, size = 18, style }: IconButtonProps) {
  const theme = useTheme();
  return (
    <TouchableOpacity style={[styles.btn, { borderColor: theme.border }, style]} onPress={onPress}>
      {icon ? (
        <Image source={icon} style={{ width: size, height: size }} resizeMode="contain" />
      ) : (
        <ThemedText style={{ fontSize: size }}>{emoji}</ThemedText>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: { padding: Spacing.two, borderRadius: 50, borderWidth: 2 },
});
