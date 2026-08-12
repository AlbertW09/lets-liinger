import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PRIVACY_TEXT, TERMS_TEXT } from '../../lib/legal';

export default function LegalScreen() {
  const colors = useTheme();
  const router = useRouter();
  const { doc } = useLocalSearchParams<{ doc?: string }>();

  const isPrivacy = doc === 'privacy';
  const body = isPrivacy ? PRIVACY_TEXT : TERMS_TEXT;
  const heading = isPrivacy ? '‹ privacy' : '‹ terms';

  const dynamicStyles = useMemo(() => StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    headerText: { color: colors.text, fontFamily: 'ui-rounded', fontWeight: '900', fontSize: 28, letterSpacing: -1, marginBottom: Spacing.three },
  }), [colors]);

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()}>
          <ThemedText style={dynamicStyles.headerText}>{heading}</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.body}>{body}</ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: Spacing.four, paddingBottom: 130 },
  body: { fontSize: 14, fontWeight: '500', lineHeight: 22 },
});
