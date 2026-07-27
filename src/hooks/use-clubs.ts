import { useCallback, useEffect, useState } from 'react';

import { addClub, Club, fetchClubs } from '@/lib/clubs';

// Loads the shared clubs list and exposes a `create` helper that merges a
// newly-added club into the list (sorted), so every "add a new club" form
// in the app shares the same de-dupe/merge/sort behavior.
export function useClubs() {
  const [clubs, setClubs] = useState<Club[]>([]);

  useEffect(() => {
    fetchClubs().then(setClubs);
  }, []);

  const create = useCallback(async (name: string, emoji: string): Promise<Club | null> => {
    const created = await addClub(name, emoji);
    if (created) {
      setClubs((prev) =>
        prev.some((c) => c.id === created.id)
          ? prev
          : [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
      );
    }
    return created;
  }, []);

  return { clubs, create };
}
