import { queryBuilder } from './supabaseTestUtils';

jest.mock('../../supabaseClient', () => ({
  supabase: { from: jest.fn() },
}));

import { supabase } from '../../supabaseClient';
import { addClub, Club, clubLabel, fetchClubs } from '../clubs';

const mockFrom = supabase.from as jest.Mock;

describe('clubLabel', () => {
  it('prefixes the emoji when present', () => {
    const club: Club = { id: '1', name: 'Chess Club', emoji: '♟️' };
    expect(clubLabel(club)).toBe('♟️ Chess Club');
  });

  it('falls back to the bare name when there is no emoji', () => {
    const club: Club = { id: '1', name: 'Chess Club', emoji: null };
    expect(clubLabel(club)).toBe('Chess Club');
  });
});

describe('fetchClubs', () => {
  it('returns the ordered list of clubs', async () => {
    const clubs = [{ id: '1', name: 'A', emoji: null }];
    mockFrom.mockReturnValueOnce(queryBuilder({ data: clubs }));

    expect(await fetchClubs()).toEqual(clubs);
  });

  it('returns an empty array when there is no data', async () => {
    mockFrom.mockReturnValueOnce(queryBuilder({ data: null }));

    expect(await fetchClubs()).toEqual([]);
  });
});

describe('addClub', () => {
  it('returns null without querying for a blank name', async () => {
    expect(await addClub('   ', '🎨')).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('trims the name and nulls out a blank emoji on insert', async () => {
    const builder = queryBuilder({ data: { id: '1', name: 'Debate', emoji: null }, error: null });
    mockFrom.mockReturnValueOnce(builder);

    const result = await addClub('  Debate  ', '   ');

    expect(builder.insert).toHaveBeenCalledWith({ name: 'Debate', emoji: null });
    expect(result).toEqual({ id: '1', name: 'Debate', emoji: null });
  });

  it('falls back to the existing row on a unique-constraint conflict', async () => {
    const insertBuilder = queryBuilder({ data: null, error: { code: '23505' } });
    const existing = { id: '9', name: 'Debate', emoji: '🎤' };
    const selectBuilder = queryBuilder({ data: existing });
    mockFrom.mockReturnValueOnce(insertBuilder).mockReturnValueOnce(selectBuilder);

    const result = await addClub('Debate', '🎤');

    expect(mockFrom).toHaveBeenNthCalledWith(2, 'clubs');
    expect(selectBuilder.eq).toHaveBeenCalledWith('name', 'Debate');
    expect(result).toEqual(existing);
  });

  it('returns null if the conflict fallback lookup also finds nothing', async () => {
    const insertBuilder = queryBuilder({ data: null, error: { code: '23505' } });
    const selectBuilder = queryBuilder({ data: null });
    mockFrom.mockReturnValueOnce(insertBuilder).mockReturnValueOnce(selectBuilder);

    expect(await addClub('Debate', '🎤')).toBeNull();
  });

  it('returns null for any other insert error', async () => {
    const builder = queryBuilder({ data: null, error: { code: '500', message: 'boom' } });
    mockFrom.mockReturnValueOnce(builder);

    expect(await addClub('Debate', '🎤')).toBeNull();
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
