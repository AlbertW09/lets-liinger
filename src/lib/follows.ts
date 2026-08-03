import { supabase } from '../supabaseClient';

export interface PublicProfile {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
}

// Search people by username or display name (case-insensitive), excluding self.
export async function searchProfiles(query: string, selfId: string | null): Promise<PublicProfile[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  const like = `%${q}%`;
  let req = supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio')
    .or(`username.ilike.${like},display_name.ilike.${like}`)
    .limit(30);
  if (selfId) req = req.neq('id', selfId);
  const { data } = await req;
  return (data ?? []) as PublicProfile[];
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followersRes, followingRes] = await Promise.all([
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', userId),
  ]);
  return { followers: followersRes.count ?? 0, following: followingRes.count ?? 0 };
}

export async function isFollowing(followerId: string, followingId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();
  return !!data;
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  await supabase.from('follows').insert({ follower_id: followerId, following_id: followingId });
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  await supabase.from('follows').delete().eq('follower_id', followerId).eq('following_id', followingId);
}

// The set of profile ids the current user already follows (to badge "Following").
export async function getFollowingIds(followerId: string): Promise<Set<string>> {
  const { data } = await supabase.from('follows').select('following_id').eq('follower_id', followerId);
  return new Set((data ?? []).map((r: any) => r.following_id));
}

// People who follow `userId`, or people `userId` follows.
export async function getConnections(userId: string, type: 'followers' | 'following'): Promise<PublicProfile[]> {
  if (type === 'followers') {
    const { data } = await supabase
      .from('follows')
      .select('profile:profiles!follows_follower_id_fkey(id, username, display_name, avatar_url, bio)')
      .eq('following_id', userId);
    return (data ?? []).map((r: any) => r.profile).filter(Boolean) as PublicProfile[];
  }
  const { data } = await supabase
    .from('follows')
    .select('profile:profiles!follows_following_id_fkey(id, username, display_name, avatar_url, bio)')
    .eq('follower_id', userId);
  return (data ?? []).map((r: any) => r.profile).filter(Boolean) as PublicProfile[];
}
