import { queryBuilder } from './supabaseTestUtils';

jest.mock('../../supabaseClient', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../supabaseClient';
import {
  followUser,
  getConnections,
  getFollowCounts,
  getFollowerNotifications,
  getFollowingIds,
  getMutualFollowers,
  getNotificationsSeenAt,
  getSuggestions,
  getUnreadFollowerCount,
  isFollowing,
  markNotificationsSeen,
  searchProfiles,
  unfollowUser,
} from '../follows';

const mockFrom = supabase.from as jest.Mock;

describe('searchProfiles', () => {
  it('returns an empty array without querying for a blank query', async () => {
    expect(await searchProfiles('   ', 'me')).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('searches by username or display name and excludes self when given', async () => {
    const results = [{ id: 'a', username: 'alice', display_name: 'Alice', avatar_url: null, bio: null }];
    const builder = queryBuilder({ data: results });
    mockFrom.mockReturnValueOnce(builder);

    const found = await searchProfiles('ali', 'me');

    expect(builder.or).toHaveBeenCalledWith('username.ilike.%ali%,display_name.ilike.%ali%');
    expect(builder.limit).toHaveBeenCalledWith(30);
    expect(builder.neq).toHaveBeenCalledWith('id', 'me');
    expect(found).toEqual(results);
  });

  it('does not exclude anyone when selfId is null', async () => {
    const builder = queryBuilder({ data: [] });
    mockFrom.mockReturnValueOnce(builder);

    await searchProfiles('ali', null);

    expect(builder.neq).not.toHaveBeenCalled();
  });

  it('returns an empty array when there is no data', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: null }));

    expect(await searchProfiles('ali', null)).toEqual([]);
  });
});

describe('getFollowCounts', () => {
  it('returns follower and following counts', async () => {
    mockFrom
      .mockReturnValueOnce(queryBuilder({ count: 5 }))
      .mockReturnValueOnce(queryBuilder({ count: 2 }));

    expect(await getFollowCounts('me')).toEqual({ followers: 5, following: 2 });
  });

  it('defaults null counts to 0', async () => {
    mockFrom
      .mockReturnValueOnce(queryBuilder({ count: null }))
      .mockReturnValueOnce(queryBuilder({ count: null }));

    expect(await getFollowCounts('me')).toEqual({ followers: 0, following: 0 });
  });
});

describe('isFollowing', () => {
  it('is true when a row exists', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: { id: 'row-1' } }));
    expect(await isFollowing('me', 'them')).toBe(true);
  });

  it('is false when no row exists', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: null }));
    expect(await isFollowing('me', 'them')).toBe(false);
  });
});

describe('followUser / unfollowUser', () => {
  it('inserts a follow row', async () => {
    const builder = queryBuilder({ data: null });
    mockFrom.mockReturnValueOnce(builder);

    await followUser('me', 'them');

    expect(mockFrom).toHaveBeenCalledWith('follows');
    expect(builder.insert).toHaveBeenCalledWith({ follower_id: 'me', following_id: 'them' });
  });

  it('deletes the matching follow row', async () => {
    const builder = queryBuilder({ data: null });
    mockFrom.mockReturnValueOnce(builder);

    await unfollowUser('me', 'them');

    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenNthCalledWith(1, 'follower_id', 'me');
    expect(builder.eq).toHaveBeenNthCalledWith(2, 'following_id', 'them');
  });
});

describe('getFollowingIds', () => {
  it('returns the set of ids I follow', async () => {
    mockFrom.mockReturnValueOnce(
      queryBuilder({ data: [{ following_id: 'a' }, { following_id: 'b' }] })
    );

    expect(await getFollowingIds('me')).toEqual(new Set(['a', 'b']));
  });

  it('returns an empty set when there is no data', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: null }));
    expect(await getFollowingIds('me')).toEqual(new Set());
  });
});

describe('getFollowerNotifications', () => {
  it('maps follower rows and flags mutual follows, dropping rows with no profile', async () => {
    mockFrom
      // main query: people who follow me
      .mockReturnValueOnce(
        queryBuilder({
          data: [
            { created_at: '2026-08-01T00:00:00Z', profile: { id: 'a', username: 'alice' } },
            { created_at: '2026-08-02T00:00:00Z', profile: null },
            { created_at: '2026-08-03T00:00:00Z', profile: { id: 'b', username: 'bob' } },
          ],
        })
      )
      // getFollowingIds(userId) — people I follow back
      .mockReturnValueOnce(queryBuilder({ data: [{ following_id: 'b' }] }));

    const result = await getFollowerNotifications('me');

    expect(result).toEqual([
      { profile: { id: 'a', username: 'alice' }, createdAt: '2026-08-01T00:00:00Z', followsBack: false },
      { profile: { id: 'b', username: 'bob' }, createdAt: '2026-08-03T00:00:00Z', followsBack: true },
    ]);
  });

  it('returns an empty array when there is no data', async () => {
    mockFrom
      .mockReturnValueOnce(queryBuilder({ data: null }))
      .mockReturnValueOnce(queryBuilder({ data: [] }));

    expect(await getFollowerNotifications('me')).toEqual([]);
  });
});

describe('getNotificationsSeenAt', () => {
  it('returns the timestamp when present', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: { notifications_seen_at: '2026-08-01T00:00:00Z' } }));
    expect(await getNotificationsSeenAt('me')).toBe('2026-08-01T00:00:00Z');
  });

  it('returns null when there is no row', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: null }));
    expect(await getNotificationsSeenAt('me')).toBeNull();
  });
});

describe('getUnreadFollowerCount', () => {
  it('counts all-time followers when notifications have never been seen', async () => {
    mockFrom
      .mockReturnValueOnce(queryBuilder({ data: null })) // getNotificationsSeenAt -> null
      .mockReturnValueOnce(queryBuilder({ count: 4 }));

    expect(await getUnreadFollowerCount('me')).toBe(4);
  });

  it('only counts followers newer than the last-seen timestamp', async () => {
    const countBuilder = queryBuilder({ count: 2 });
    mockFrom
      .mockReturnValueOnce(queryBuilder({ data: { notifications_seen_at: '2026-08-01T00:00:00Z' } }))
      .mockReturnValueOnce(countBuilder);

    const count = await getUnreadFollowerCount('me');

    expect(countBuilder.gt).toHaveBeenCalledWith('created_at', '2026-08-01T00:00:00Z');
    expect(count).toBe(2);
  });

  it('defaults a null count to 0', async () => {
    mockFrom
      .mockReturnValueOnce(queryBuilder({ data: null }))
      .mockReturnValueOnce(queryBuilder({ count: null }));

    expect(await getUnreadFollowerCount('me')).toBe(0);
  });
});

describe('markNotificationsSeen', () => {
  it('updates notifications_seen_at to an ISO timestamp for this user', async () => {
    const builder = queryBuilder({ data: null });
    mockFrom.mockReturnValueOnce(builder);

    await markNotificationsSeen('me');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    const updatePayload = builder.update.mock.calls[0][0];
    expect(updatePayload.notifications_seen_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(builder.eq).toHaveBeenCalledWith('id', 'me');
  });
});

describe('getMutualFollowers', () => {
  it('short-circuits without querying when I follow no one', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: [] })); // getFollowingIds -> empty

    const result = await getMutualFollowers('me', 'them');

    expect(result).toEqual({ names: [], count: 0 });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it('lists mutuals by username, falling back to display name, dropping empty profiles', async () => {
    mockFrom
      .mockReturnValueOnce(queryBuilder({ data: [{ following_id: 'a' }, { following_id: 'b' }] }))
      .mockReturnValueOnce(
        queryBuilder({
          data: [
            { profile: { username: 'alice', display_name: 'Alice A' } },
            { profile: { username: null, display_name: 'Bob B' } },
            { profile: null },
          ],
        })
      );

    const result = await getMutualFollowers('me', 'them');

    expect(result).toEqual({ names: ['@alice', 'Bob B'], count: 2 });
  });

  it('treats null data from the mutuals query as no mutuals', async () => {
    mockFrom
      .mockReturnValueOnce(queryBuilder({ data: [{ following_id: 'a' }] }))
      .mockReturnValueOnce(queryBuilder({ data: null }));

    expect(await getMutualFollowers('me', 'them')).toEqual({ names: [], count: 0 });
  });
});

describe('getSuggestions', () => {
  it('returns an empty array without querying when I have no interests', async () => {
    expect(await getSuggestions('me', [], new Set())).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('filters out excluded ids and caps the result at 10', async () => {
    const people = Array.from({ length: 12 }, (_, i) => ({
      id: `p${i}`,
      username: `p${i}`,
      display_name: null,
      avatar_url: null,
      bio: null,
    }));
    const builder = queryBuilder({ data: people });
    mockFrom.mockReturnValueOnce(builder);

    const result = await getSuggestions('me', ['Music'], new Set(['p0', 'p1']));

    expect(builder.overlaps).toHaveBeenCalledWith('interests', ['Music']);
    expect(builder.neq).toHaveBeenCalledWith('id', 'me');
    expect(builder.limit).toHaveBeenCalledWith(30);
    expect(result).toHaveLength(10);
    expect(result.find((p) => p.id === 'p0' || p.id === 'p1')).toBeUndefined();
  });

  it('returns an empty array when there is no data', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: null }));

    expect(await getSuggestions('me', ['Music'], new Set())).toEqual([]);
  });
});

describe('getConnections', () => {
  it('fetches followers via the follower-side foreign key', async () => {
    const builder = queryBuilder({
      data: [{ profile: { id: 'a' } }, { profile: null }],
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await getConnections('user-1', 'followers');

    expect(builder.eq).toHaveBeenCalledWith('following_id', 'user-1');
    expect(result).toEqual([{ id: 'a' }]);
  });

  it('fetches following via the following-side foreign key', async () => {
    const builder = queryBuilder({
      data: [{ profile: { id: 'b' } }],
    });
    mockFrom.mockReturnValueOnce(builder);

    const result = await getConnections('user-1', 'following');

    expect(builder.eq).toHaveBeenCalledWith('follower_id', 'user-1');
    expect(result).toEqual([{ id: 'b' }]);
  });

  it('returns an empty array when there is no data, for either type', async () => {
    mockFrom
      .mockReturnValueOnce(queryBuilder({ data: null }))
      .mockReturnValueOnce(queryBuilder({ data: null }));

    expect(await getConnections('user-1', 'followers')).toEqual([]);
    expect(await getConnections('user-1', 'following')).toEqual([]);
  });
});
