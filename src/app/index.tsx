import { StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

import { useState } from 'react';

export default function HomeScreen() {
  const [count, setCount] = useState(0);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">⚡️ Hot Reload Test</ThemedText>
          <ThemedText style={styles.subtitle}>
            HELLO ANGELICA! If you see this, your project updated successfully!
          </ThemedText>
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.counterBox}>
          <ThemedText style={styles.counterLabel}>TAPS</ThemedText>
          <ThemedText type="title" style={styles.counterNumber}>
            {count}
          </ThemedText>
        </ThemedView>

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => setCount(prev => prev + 1)}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.buttonText}>Tap Me!</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.resetButton} 
          onPress={() => setCount(0)}
        >
          <ThemedText type="small" style={styles.resetText}>
            Reset Counter
          </ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.four,
  },
  header: {
    alignItems: 'center',
    gap: Spacing.one,
    marginBottom: Spacing.three,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
  },
  counterBox: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  counterLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1.5,
    opacity: 0.5,
  },
  counterNumber: {
    fontSize: 48,
    lineHeight: 56,
  },
  button: {
    backgroundColor: '#007AFF', // Standard iOS Blue
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderRadius: 25,
    width: '80%',
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  resetButton: {
    padding: Spacing.two,
  },
  resetText: {
    opacity: 0.5,
    textDecorationLine: 'underline',
  },
});