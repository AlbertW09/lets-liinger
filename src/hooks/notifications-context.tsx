import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import {
  getNewEventCount,
  getUnreadMessageCount,
  markEventsSeen as persistEventsSeen,
  markMessagesSeen as persistMessagesSeen,
} from '@/lib/notifications';
import { supabase } from '../supabaseClient';

type NotificationsState = {
  hasUnreadMessages: boolean;
  hasNewEvents: boolean;
  markMessagesSeen: () => void;
  markEventsSeen: () => void;
  refresh: () => void;
};

const NotificationsContext = createContext<NotificationsState>({
  hasUnreadMessages: false,
  hasNewEvents: false,
  markMessagesSeen: () => {},
  markEventsSeen: () => {},
  refresh: () => {},
});

export function useNotifications() {
  return useContext(NotificationsContext);
}

// Tracks whether the current user has unread DMs / unseen new events, so the
// tab bar can show a dot. Backed by the *_seen_at markers in the DB plus
// realtime INSERT subscriptions, and re-pulled whenever the session changes.
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [hasNewEvents, setHasNewEvents] = useState(false);

  // Track the signed-in user (and clear state on sign-out).
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
      if (!session) {
        setHasUnreadMessages(false);
        setHasNewEvents(false);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refresh = useCallback(() => {
    if (!userId) return;
    getUnreadMessageCount(userId).then((n) => setHasUnreadMessages(n > 0));
    getNewEventCount(userId).then((n) => setHasNewEvents(n > 0));
  }, [userId]);

  // Initial + on-user-change load, plus realtime subscriptions.
  useEffect(() => {
    if (!userId) return;
    refresh();

    const channel = supabase
      .channel(`notif-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'direct_messages', filter: `recipient_id=eq.${userId}` },
        () => setHasUnreadMessages(true)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        (payload) => {
          if ((payload.new as any)?.created_by !== userId) setHasNewEvents(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, refresh]);

  const markMessagesSeen = useCallback(() => {
    setHasUnreadMessages(false);
    if (userId) persistMessagesSeen(userId);
  }, [userId]);

  const markEventsSeen = useCallback(() => {
    setHasNewEvents(false);
    if (userId) persistEventsSeen(userId);
  }, [userId]);

  return (
    <NotificationsContext.Provider
      value={{ hasUnreadMessages, hasNewEvents, markMessagesSeen, markEventsSeen, refresh }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}
