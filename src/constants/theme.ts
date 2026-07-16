import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#FFFDF0',
    backgroundElement: '#FFF5C2',
    backgroundSelected: '#FFDE4D',
    textSecondary: '#3C3C3C',
    accentGreen: '#39FF14',
    accentPink: '#FF007F',
    accentCyan: '#00F0FF',
    accentYellow: '#FFC72C',
    border: '#000000',
  },
  dark: {
    text: '#FFFFFF',
    background: '#0D0D0D',
    backgroundElement: '#1A1A1A',
    backgroundSelected: '#39FF14',
    textSecondary: '#A0A0A0',
    accentGreen: '#39FF14',
    accentPink: '#FF007F',
    accentCyan: '#00F0FF',
    accentYellow: '#FFC72C',
    border: '#FFFFFF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;