import { channelBuilder, queryBuilder } from './supabaseTestUtils';

jest.mock('../../supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

import { supabase } from '../../supabaseClient';
import {
  fetchConversations,
  fetchProfile,
  fetchThread,
  profileLabel,
  searchProfilesByUsername,
  sendDirectMessage,
  subscribeToMyMessages,
} from '../messages';

const mockFrom = supabase.from as jest.Mock;
const mockRpc = supabase.rpc as jest.Mock;
const mockChannel = supabase.channel as jest.Mock;
const mockRemoveChannel = supabase.removeChannel as jest.Mock;

describe('fetchConversations', () => {
  it('returns an empty array without querying profiles when there are no conversations', async () => {
    mockRpc.mockResolvedValueOnce({ data: [] });

    expect(await fetchConversations('me')).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('treats null rows the same as no conversations', async () => {
    mockRpc.mockResolvedValueOnce({ data: null });

    expect(await fetchConversations('me')).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('treats a null profiles response as nobody found', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ other_user_id: 'a', last_content: 'hi', last_created_at: '2026-08-01T00:00:00Z', last_sender_id: 'a' }],
    });
    mockFrom.mockReturnValueOnce(queryBuilder({ data: null }));

    const result = await fetchConversations('me');

    expect(result[0].otherProfile).toBeNull();
  });

  it('joins in profiles, flags whose message was last, and sorts newest first', async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        { other_user_id: 'a', last_content: 'hi', last_created_at: '2026-08-01T00:00:00Z', last_sender_id: 'me' },
        { other_user_id: 'b', last_content: 'yo', last_created_at: '2026-08-03T00:00:00Z', last_sender_id: 'b' },
        { other_user_id: 'c', last_content: 'sup', last_created_at: '2026-08-02T00:00:00Z', last_sender_id: 'c' },
      ],
    });
    mockFrom.mockReturnValueOnce(
      queryBuilder({
        data: [
          { id: 'a', username: 'alice', display_name: 'Alice', avatar_url: null },
          // 'b' intentionally missing to exercise the not-found path
          { id: 'c', username: 'carl', display_name: 'Carl', avatar_url: null },
        ],
      })
    );

    const result = await fetchConversations('me');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(result.map((c) => c.otherUserId)).toEqual(['b', 'c', 'a']); // newest first
    expect(result[0].otherProfile).toBeNull();
    expect(result[1].otherProfile?.username).toBe('carl');
    expect(result.find((c) => c.otherUserId === 'a')?.lastMessageMine).toBe(true);
    expect(result.find((c) => c.otherUserId === 'b')?.lastMessageMine).toBe(false);
  });
});

describe('fetchThread', () => {
  it('reverses the newest-first page into oldest-first order', async () => {
    const builder = queryBuilder({
      data: [
        { id: '3', sender_id: 'a', recipient_id: 'b', content: 'third', created_at: '2026-08-03T00:00:00Z' },
        { id: '2', sender_id: 'b', recipient_id: 'a', content: 'second', created_at: '2026-08-02T00:00:00Z' },
        { id: '1', sender_id: 'a', recipient_id: 'b', content: 'first', created_at: '2026-08-01T00:00:00Z' },
      ],
    });
    mockFrom.mockReturnValueOnce(builder);

    const thread = await fetchThread('a', 'b');

    expect(builder.or).toHaveBeenCalledWith(
      'and(sender_id.eq.a,recipient_id.eq.b),and(sender_id.eq.b,recipient_id.eq.a)'
    );
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(builder.limit).toHaveBeenCalledWith(50); // default limit
    expect(thread.map((m) => m.id)).toEqual(['1', '2', '3']);
  });

  it('passes through a custom limit', async () => {
    const builder = queryBuilder({ data: [] });
    mockFrom.mockReturnValueOnce(builder);

    await fetchThread('a', 'b', 10);

    expect(builder.limit).toHaveBeenCalledWith(10);
  });

  it('returns an empty array when there is no data', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: null }));

    expect(await fetchThread('a', 'b')).toEqual([]);
  });
});

describe('sendDirectMessage', () => {
  it('inserts the message and returns no error on success', async () => {
    const builder = queryBuilder({ error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await sendDirectMessage('a', 'b', 'hello');

    expect(builder.insert).toHaveBeenCalledWith({ sender_id: 'a', recipient_id: 'b', content: 'hello' });
    expect(result).toEqual({});
  });

  it('surfaces the error message on failure', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ error: { message: 'blocked' } }));

    expect(await sendDirectMessage('a', 'b', 'hello')).toEqual({ error: 'blocked' });
  });
});

describe('fetchProfile', () => {
  it('returns the profile when found', async () => {
    const profile = { id: 'a', username: 'alice', display_name: 'Alice', avatar_url: null };
    mockFrom.mockReturnValueOnce(queryBuilder({ data: profile }));

    expect(await fetchProfile('a')).toEqual(profile);
  });

  it('returns null when not found', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: null }));

    expect(await fetchProfile('missing')).toBeNull();
  });
});

describe('searchProfilesByUsername', () => {
  it('returns an empty array without querying for a blank query', async () => {
    expect(await searchProfilesByUsername('   ', 'me')).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('searches by username, excludes self, and caps at 20', async () => {
    const results = [{ id: 'a', username: 'alice', display_name: null, avatar_url: null }];
    const builder = queryBuilder({ data: results });
    mockFrom.mockReturnValueOnce(builder);

    const found = await searchProfilesByUsername('ali', 'me');

    expect(builder.ilike).toHaveBeenCalledWith('username', '%ali%');
    expect(builder.neq).toHaveBeenCalledWith('id', 'me');
    expect(builder.limit).toHaveBeenCalledWith(20);
    expect(found).toEqual(results);
  });

  it('returns an empty array when there is no data', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: null }));

    expect(await searchProfilesByUsername('ali', 'me')).toEqual([]);
  });
});

describe('subscribeToMyMessages', () => {
  it('registers listeners for messages sent to and by me, and forwards inserts', () => {
    const channel = channelBuilder();
    mockChannel.mockReturnValueOnce(channel);

    const onInsert = jest.fn();
    subscribeToMyMessages('me', onInsert);

    expect(channel.on).toHaveBeenCalledTimes(2);
    expect(channel.subscribe).toHaveBeenCalled();

    const filters = channel.__registrations.map((r: any) => r.filter.filter);
    expect(filters).toEqual(
      expect.arrayContaining(['recipient_id=eq.me', 'sender_id=eq.me'])
    );

    const incoming = { id: 'm1', sender_id: 'them', recipient_id: 'me', content: 'hi', created_at: 'now' };
    channel.__registrations[0].callback({ new: incoming });
    expect(onInsert).toHaveBeenCalledWith(incoming);

    // The second registration (messages I sent) forwards inserts the same way.
    const outgoing = { id: 'm2', sender_id: 'me', recipient_id: 'them', content: 'yo', created_at: 'now' };
    channel.__registrations[1].callback({ new: outgoing });
    expect(onInsert).toHaveBeenCalledWith(outgoing);
  });

  it('returns an unsubscribe function that removes the channel', () => {
    const channel = channelBuilder();
    mockChannel.mockReturnValueOnce(channel);

    const unsubscribe = subscribeToMyMessages('me', jest.fn());
    unsubscribe();

    expect(mockRemoveChannel).toHaveBeenCalledWith(channel);
  });
});

describe('profileLabel', () => {
  it('returns "Someone" for null or undefined', () => {
    expect(profileLabel(null)).toBe('Someone');
    expect(profileLabel(undefined)).toBe('Someone');
  });

  it('prefers the @username when present', () => {
    expect(profileLabel({ id: '1', username: 'alice', display_name: 'Alice', avatar_url: null })).toBe('@alice');
  });

  it('falls back to the display name when there is no username', () => {
    expect(profileLabel({ id: '1', username: null, display_name: 'Alice', avatar_url: null })).toBe('Alice');
  });

  it('falls back to "Someone" when neither is set', () => {
    expect(profileLabel({ id: '1', username: null, display_name: null, avatar_url: null })).toBe('Someone');
  });
});
