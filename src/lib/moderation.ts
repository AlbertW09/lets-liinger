import { supabase } from '../supabaseClient';

// All user ids the current user has a block relationship with, in EITHER
// direction (people I blocked + people who blocked me). Used to hide those
// users from search, feed, and connection lists.
export async function getBlockedIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('blocks')
    .select('blocker_id, blocked_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  const ids = new Set<string>();
  for (const r of data ?? []) {
    ids.add(r.blocker_id === userId ? r.blocked_id : r.blocker_id);
  }
  return ids;
}

// Just the ids I actively blocked (to show "Unblock" vs "Block").
export async function getMyBlockedIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase.from('blocks').select('blocked_id').eq('blocker_id', userId);
  return new Set((data ?? []).map((r: any) => r.blocked_id));
}

// Blocking also severs any follow relationship in both directions.
export async function blockUser(blockerId: string, blockedId: string): Promise<void> {
  await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: blockedId });
  await supabase
    .from('follows')
    .delete()
    .or(
      `and(follower_id.eq.${blockerId},following_id.eq.${blockedId}),and(follower_id.eq.${blockedId},following_id.eq.${blockerId})`
    );
}

export async function unblockUser(blockerId: string, blockedId: string): Promise<void> {
  await supabase.from('blocks').delete().eq('blocker_id', blockerId).eq('blocked_id', blockedId);
}

export async function reportUser(reporterId: string, targetUserId: string, reason: string): Promise<void> {
  await supabase.from('reports').insert({ reporter_id: reporterId, target_user_id: targetUserId, reason });
}

export async function reportEvent(reporterId: string, targetEventId: string, reason: string): Promise<void> {
  await supabase.from('reports').insert({ reporter_id: reporterId, target_event_id: targetEventId, reason });
}
