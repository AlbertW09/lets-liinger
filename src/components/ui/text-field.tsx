import { StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface TextFieldProps extends TextInputProps {
  label?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

// A labeled, themed text input — the "label above a bordered box" pattern
// repeated on every form screen (auth, onboarding, create/edit event, profile).
export function TextField({ label, style, containerStyle, ...rest }: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={containerStyle}>
      {label ? <ThemedText style={styles.label} themeColor="accentCyan">{label}</ThemedText> : null}
      <TextInput
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.border },
          style,
        ]}
        placeholderTextColor={theme.textSecondary}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    fontWeight: '900',
    marginBottom: Spacing.two,
    marginTop: Spacing.three,
    letterSpacing: 0.5,
  },
  input: {
    padding: Spacing.three,
    borderRadius: 12,
    borderWidth: 2,
    fontSize: 15,
  },
});
