import { supabase } from '../supabaseClient';

// Per-event engagement stats for the events a user has posted.
export interface EventStat {
  id: string;
  title: string;
  eventTime: string | null;
  rsvps: number;
  likes: number;
  comments: number;
  engagement: number;
}

export interface CreatorInsights {
  totalEvents: number;
  totalRsvps: number;
  totalLikes: number;
  totalComments: number;
  totalEngagement: number;
  avgRsvps: number;
  topEvent: EventStat | null;
  // All the user's events, sorted by engagement (highest first).
  events: EventStat[];
}

// Weighting: an RSVP (someone committing to show up) is worth the most,
// a comment (active discussion) next, a like the least.
export function engagementScore(rsvps: number, likes: number, comments: number): number {
  return rsvps * 3 + comments * 2 + likes;
}

function countByEvent(rows: { event_id: string }[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rows) map[r.event_id] = (map[r.event_id] ?? 0) + 1;
  return map;
}

const EMPTY: CreatorInsights = {
  totalEvents: 0,
  totalRsvps: 0,
  totalLikes: 0,
  totalComments: 0,
  totalEngagement: 0,
  avgRsvps: 0,
  topEvent: null,
  events: [],
};

export async function fetchCreatorInsights(userId: string): Promise<CreatorInsights> {
  const { data: events } = await supabase
    .from('events')
    .select('id, title, event_time')
    .eq('created_by', userId);

  const rows = events ?? [];
  if (rows.length === 0) return EMPTY;

  const ids = rows.map((e: any) => e.id);

  const [rsvpsRes, likesRes, commentsRes] = await Promise.all([
    supabase.from('rsvps').select('event_id').in('event_id', ids),
    supabase.from('event_likes').select('event_id').in('event_id', ids),
    supabase.from('event_comments').select('event_id').in('event_id', ids),
  ]);

  const rsvpCounts = countByEvent(rsvpsRes.data ?? []);
  const likeCounts = countByEvent(likesRes.data ?? []);
  const commentCounts = countByEvent(commentsRes.data ?? []);

  const stats: EventStat[] = rows.map((e: any) => {
    const rsvps = rsvpCounts[e.id] ?? 0;
    const likes = likeCounts[e.id] ?? 0;
    const comments = commentCounts[e.id] ?? 0;
    return {
      id: e.id,
      title: e.title,
      eventTime: e.event_time,
      rsvps,
      likes,
      comments,
      engagement: engagementScore(rsvps, likes, comments),
    };
  });

  stats.sort((a, b) => b.engagement - a.engagement);

  const totalRsvps = stats.reduce((s, e) => s + e.rsvps, 0);
  const totalLikes = stats.reduce((s, e) => s + e.likes, 0);
  const totalComments = stats.reduce((s, e) => s + e.comments, 0);
  const topEvent = stats.reduce<EventStat | null>(
    (top, e) => (top === null || e.rsvps > top.rsvps ? e : top),
    null
  );

  return {
    totalEvents: stats.length,
    totalRsvps,
    totalLikes,
    totalComments,
    totalEngagement: stats.reduce((s, e) => s + e.engagement, 0),
    avgRsvps: stats.length ? Math.round((totalRsvps / stats.length) * 10) / 10 : 0,
    topEvent,
    events: stats,
  };
}
