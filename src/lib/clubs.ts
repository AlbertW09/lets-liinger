import { supabase } from '../supabaseClient';

export interface Club {
  id: string;
  name: string;
  emoji: string | null;
}

export function clubLabel(c: Club): string {
  return c.emoji ? `${c.emoji} ${c.name}` : c.name;
}

export async function fetchClubs(): Promise<Club[]> {
  const { data } = await supabase.from('clubs').select('id, name, emoji').order('name');
  return (data as Club[]) ?? [];
}

// Adds a club to the shared list. If it already exists, returns the existing row.
export async function addClub(name: string, emoji: string): Promise<Club | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { data, error } = await supabase
    .from('clubs')
    .insert({ name: trimmed, emoji: emoji.trim() || null })
    .select('id, name, emoji')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('clubs')
        .select('id, name, emoji')
        .eq('name', trimmed)
        .single();
      return (existing as Club) ?? null;
    }
    return null;
  }
  return data as Club;
}
