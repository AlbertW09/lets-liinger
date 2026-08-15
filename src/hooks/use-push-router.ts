import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

// Navigates to the right screen when the user taps a push notification.
// `data` shape must match what the send-push edge function attaches:
// { type: 'message', senderId } | { type: 'event', eventId }.
function openFromData(router: ReturnType<typeof useRouter>, data: any) {
  if (data?.type === 'message' && data.senderId) {
    router.push(`/dm-thread?userId=${data.senderId}`);
  } else if (data?.type === 'event' && data.eventId) {
    router.push(`/event-detail?id=${data.eventId}`);
  }
}

export function usePushNotificationRouting() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;

    // Cold start: the app was launched by tapping a notification.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) openFromData(router, response.notification.request.content.data);
    });

    // Warm: app already running, user taps a notification banner/list entry.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      openFromData(router, response.notification.request.content.data);
    });

    return () => sub.remove();
  }, [router]);
}
