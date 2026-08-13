import { supabase } from '../supabaseClient';
import type { PublicProfile } from './follows';
import { getFollowerNotifications } from './follows';

// ---- "Last seen" markers (power the tab-bar dots) -----------------------
//
// We reuse the same coarse pattern as notifications_seen_at: a single
// timestamp per user per channel. Unread = rows newer than that timestamp.
// Opening the relevant tab stamps the marker to "now", clearing the dot.

async function getSeen(userId: string, column: 'messages_seen_at' | 'events_seen_at'): Promise<string | null> {
  const { data } = await supabase.from('profiles').select(column).eq('id', userId).single();
  return (data as any)?.[column] ?? null;
}

// Count of DMs I've received since I last opened the inbox.
export async function getUnreadMessageCount(userId: string): Promise<number> {
  const seenAt = await getSeen(userId, 'messages_seen_at');
  let req = supabase
    .from('direct_messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId);
  if (seenAt) req = req.gt('created_at', seenAt);
  const { count } = await req;
  return count ?? 0;
}

export async function markMessagesSeen(userId: string): Promise<void> {
  await supabase.from('profiles').update({ messages_seen_at: new Date().toISOString() }).eq('id', userId);
}

// Count of events created by other people since I last opened the home feed.
export async function getNewEventCount(userId: string): Promise<number> {
  const seenAt = await getSeen(userId, 'events_seen_at');
  let req = supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .neq('created_by', userId);
  if (seenAt) req = req.gt('created_at', seenAt);
  const { count } = await req;
  return count ?? 0;
}

export async function markEventsSeen(userId: string): Promise<void> {
  await supabase.from('profiles').update({ events_seen_at: new Date().toISOString() }).eq('id', userId);
}

// ---- Unified notifications feed -----------------------------------------

export type NotificationItem =
  | { kind: 'follow'; key: string; createdAt: string; profile: PublicProfile; followsBack: boolean }
  | { kind: 'message'; key: string; createdAt: string; profile: PublicProfile; preview: string }
  | { kind: 'event'; key: string; createdAt: string; profile: PublicProfile | null; eventId: string; title: string };

// Most recent DM per sender that I've received (so the feed shows one row per
// person, not every message).
async function getMessageNotifications(userId: string): Promise<NotificationItem[]> {
  const { data } = await supabase
    .from('direct_messages')
    .select('id, content, created_at, sender:profiles!direct_messages_sender_id_fkey(id, username, display_name, avatar_url, bio)')
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);

  const seen = new Set<string>();
  const items: NotificationItem[] = [];
  for (const r of (data ?? []) as any[]) {
    if (!r.sender || seen.has(r.sender.id)) continue;
    seen.add(r.sender.id);
    items.push({
      kind: 'message',
      key: `msg-${r.sender.id}`,
      createdAt: r.created_at,
      profile: r.sender,
      preview: r.content,
    });
  }
  return items;
}

// Recent events created by other people.
async function getEventNotifications(userId: string): Promise<NotificationItem[]> {
  const { data } = await supabase
    .from('events')
    .select('id, title, created_at, creator:profiles!events_created_by_fkey(id, username, display_name, avatar_url, bio)')
    .neq('created_by', userId)
    .order('created_at', { ascending: false })
    .limit(20);

  return ((data ?? []) as any[]).map((r) => ({
    kind: 'event' as const,
    key: `evt-${r.id}`,
    createdAt: r.created_at,
    profile: r.creator ?? null,
    eventId: r.id,
    title: r.title ?? 'Untitled event',
  }));
}

// Everything, newest first — follows + received messages + new events.
export async function getAllNotifications(userId: string): Promise<NotificationItem[]> {
  const [follows, messages, events] = await Promise.all([
    getFollowerNotifications(userId),
    getMessageNotifications(userId),
    getEventNotifications(userId),
  ]);

  const followItems: NotificationItem[] = follows.map((f) => ({
    kind: 'follow',
    key: `fol-${f.profile.id}`,
    createdAt: f.createdAt,
    profile: f.profile,
    followsBack: f.followsBack,
  }));

  return [...followItems, ...messages, ...events].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
}
