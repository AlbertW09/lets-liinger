import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import type { Coords } from '@/lib/places';

export type LocationStatus = 'idle' | 'requesting' | 'granted' | 'denied';

interface UseUserCoordsResult {
  coords: Coords | null;
  status: LocationStatus;
  request: () => Promise<Coords | null>;
}

// The user's current location, backed by expo-location (works uniformly on
// iOS, Android, and web — its web implementation wraps navigator.geolocation
// internally). `requestForegroundPermissionsAsync` only prompts the OS
// dialog once; it silently returns the cached grant/deny on later calls, so
// auto-fetching on mount doesn't risk repeated nagging.
//
// Pass `auto: false` to skip the mount-time fetch and only request location
// when `request()` is called explicitly (e.g. a "Nearby" button tap).
export function useUserCoords(auto: boolean = true): UseUserCoordsResult {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');

  const request = useCallback(async (): Promise<Coords | null> => {
    setStatus('requesting');
    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== 'granted') {
        setStatus('denied');
        return null;
      }
      let position: Location.LocationObject | null = null;
      try {
        position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      } catch (err) {
        // The Fused Location Provider can report "unavailable" even when a
        // location is genuinely known (e.g. transiently indoors on a real
        // device, or reliably on some Android emulators regardless of a
        // manually-set mock location) — fall back to the last cached fix
        // read straight from LocationManager instead of failing outright.
        if (__DEV__) console.warn('[useUserCoords] getCurrentPositionAsync failed, trying last known position:', err);
        position = await Location.getLastKnownPositionAsync();
      }

      if (!position) {
        setStatus('denied');
        return null;
      }
      const next = { lat: position.coords.latitude, lng: position.coords.longitude };
      setCoords(next);
      setStatus('granted');
      return next;
    } catch (err) {
      if (__DEV__) console.warn('[useUserCoords] location request failed:', err);
      setStatus('denied');
      return null;
    }
  }, []);

  // request() is the standard "fetch on mount" entry point; its setState
  // calls are gated behind an async permission/position lookup, not
  // synchronous, so this is safe despite the lint rule's static warning.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (auto) request();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  return { coords, status, request };
}
