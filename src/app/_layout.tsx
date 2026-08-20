import type { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NotificationsProvider } from '@/hooks/notifications-context';
import { usePushNotificationRouting } from '@/hooks/use-push-router';
import { refreshPushToken } from '@/lib/push';
import { supabase } from '../supabaseClient';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      SplashScreen.hideAsync();
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      // A password-recovery link establishes a temporary session; route the
      // user to set a new password instead of into the app.
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
      if (event === 'SIGNED_OUT') setRecovering(false);
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // While recovering, keep the user on the reset-password screen.
  useEffect(() => {
    // Cast: typed-routes regenerates to include this new route on next start.
    if (recovering) router.replace('/reset-password' as never);
  }, [recovering, router]);

  usePushNotificationRouting();

  useEffect(() => {
    if (session?.user?.id) refreshPushToken(session.user.id);
  }, [session?.user?.id]);

  useEffect(() => {
    if (loading) return;
    if (recovering) return; // password-recovery flow owns navigation

    const seg = segments[0];
    const onboarded = !!session?.user?.user_metadata?.onboarded;

    if (!session) {
      if (seg !== 'auth') router.replace('/auth');
    } else if (!onboarded) {
      if (seg !== 'onboarding') router.replace('/onboarding');
    } else if (seg === 'auth' || seg === 'onboarding' || seg === undefined) {
      // Only steer people off the gate screens (or the bare root on cold
      // start). Once signed in and onboarded, any other route — a (tabs)
      // screen or a pushed detail screen like /user or /event-detail — is a
      // valid destination and shouldn't be force-redirected to /(tabs).
      router.replace('/(tabs)');
    }
  }, [session, loading, segments, recovering]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <NotificationsProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </NotificationsProvider>
  );
}