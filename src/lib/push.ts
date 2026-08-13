import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '../supabaseClient';

// Turns push notifications ON for a user: asks the OS for permission, fetches
// the Expo push token, and stores it (with push_enabled = true) on the profile.
//
// Real remote push only works in an installed native build (iOS/Android) that
// has EAS credentials configured — not on web and not in Expo Go. We fail
// gracefully everywhere else so the toggle still gives clear feedback.
export async function enablePush(userId: string): Promise<{ error?: string }> {
  if (Platform.OS === 'web') {
    return { error: 'Push notifications are only available in the iOS/Android app.' };
  }
  if (!Device.isDevice) {
    return { error: 'Push notifications need a real device, not a simulator.' };
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') {
    return { error: 'Notifications permission was not granted.' };
  }

  // Android needs a channel for notifications to appear.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;
  if (!projectId) {
    return { error: 'Push isn’t set up yet — run `eas init` to link a project, then rebuild.' };
  }

  let token: string;
  try {
    const res = await Notifications.getExpoPushTokenAsync({ projectId });
    token = res.data;
  } catch (e) {
    return { error: (e as Error).message ?? 'Could not get a push token.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ push_token: token, push_enabled: true })
    .eq('id', userId);
  if (error) return { error: error.message };
  return {};
}

// Turns push notifications OFF: clears the flag (and token) on the profile.
export async function disablePush(userId: string): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('profiles')
    .update({ push_enabled: false, push_token: null })
    .eq('id', userId);
  return error ? { error: error.message } : {};
}

// Current stored preference for the user (used to render the toggle state).
export async function getPushEnabled(userId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('push_enabled').eq('id', userId).single();
  return !!(data as any)?.push_enabled;
}
