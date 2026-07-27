import { useCallback, useRef, useState } from 'react';

import { PlaceResult, searchPlaces } from '@/lib/places';

// Debounced Nominatim place search backing the location field on both the
// create and edit event forms. A selection is cleared as soon as the query
// text changes again, since at that point it no longer matches the pin.
export function usePlaceSearch(initial: PlaceResult | null = null) {
  const [query, setQuery] = useState(initial?.name ?? '');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [selected, setSelected] = useState<PlaceResult | null>(initial);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const found = await searchPlaces(text.trim());
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
