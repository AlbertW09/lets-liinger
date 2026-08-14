import { useCallback, useEffect, useRef, useState } from 'react';

import { Coords, PlaceResult, searchPlaces } from '@/lib/places';

// Debounced place search backing the location field on both the create and
// edit event forms. A selection is cleared as soon as the query text changes
// again, since at that point it no longer matches the pin. `near` biases
// results toward the user's location (nearest-first, local).
export function usePlaceSearch(initial: PlaceResult | null = null, near: Coords | null = null) {
  const [query, setQuery] = useState(initial?.name ?? '');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selected, setSelected] = useState<PlaceResult | null>(initial);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest coords in a ref so onQueryChange stays stable but always
  // searches against the freshest location (which may arrive after mount).
  const nearRef = useRef<Coords | null>(near);
  useEffect(() => { nearRef.current = near; }, [near]);

  const onQueryChange = useCallback((text: string) => {
    setQuery(text);
    setSelected(null);
    if (timer.current) clearTimeout(timer.current);
    if (text.trim().length < 3) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(async () => {
      const found = await searchPlaces(text.trim(), nearRef.current ?? undefined);
      setResults(found);
      setSearching(false);
    }, 450);
  }, []);

  const pick = useCallback((p: PlaceResult) => {
    setSelected(p);
    setQuery(p.name);
    setResults([]);
  }, []);

  const reset = useCallback((next: PlaceResult | null = null) => {
    if (timer.current) clearTimeout(timer.current);
    setQuery(next?.name ?? '');
    setSelected(next);
    setResults([]);
    setSearching(false);
  }, []);

  return { query, results, selected, searching, onQueryChange, pick, reset };
}
