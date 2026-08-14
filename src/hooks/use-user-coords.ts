import { useEffect, useState } from 'react';

import type { Coords } from '@/lib/places';

// The user's current location, used to bias place search toward them. Uses
// browser geolocation (guarded for SSR/native, same as the map + home feed).
// Returns null until/unless a fix is available — search still works without it.
export function useUserCoords(): Coords | null {
  const [coords, setCoords] = useState<Coords | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}, // denied/unavailable → stay null, search falls back to unbiased
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 }
    );
  }, []);

  return coords;
}
