import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// AsyncStorage's web version needs `window`, which doesn't exist during
// Expo Router's server-side rendering pass. Use a no-op storage there instead.
const isServer = typeof window === 'undefined';

const storage = isServer
  ? {
      getItem: async () => null,
      setItem: async () => {},
      removeItem: async () => {},
    }
  : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    // Process auth tokens that arrive in the URL (email confirmation +
    // password-recovery links) in the browser; skip during SSR where there's
    // no window/URL to read.
    detectSessionInUrl: !isServer,
  },
});