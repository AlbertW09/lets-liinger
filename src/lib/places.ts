export interface Coords {
  lat: number;
  lng: number;
}

export interface PlaceResult {
  name: string;
  subtitle?: string; // e.g. "San Jose, California" — the address/context line
  lat: number;
  lng: number;
}

// When set, we use Mapbox (great business/POI data + real proximity bias).
// Otherwise we fall back to the free OpenStreetMap Nominatim geocoder.
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

// Roughly 500 miles expressed in degrees of latitude (1° lat ≈ 69 mi).
const RANGE_DEG = 7.25;

// Great-circle distance in km, used to sort results nearest-first.
function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Entry point used by the location field. Biases toward `near` (the user's
// current location) so results are local, not scattered across the globe.
export async function searchPlaces(query: string, near?: Coords): Promise<PlaceResult[]> {
  if (typeof fetch === 'undefined') return [];
  const q = query.trim();
  if (!q) return [];

  if (MAPBOX_TOKEN) {
    const viaMapbox = await searchMapbox(q, near);
    // If Mapbox hiccups (network/quota), fall back so the field still works.
    if (viaMapbox.length > 0) return viaMapbox;
  }
  return searchNominatim(q, near);
}

// --- Mapbox Search Box (single-call forward search; knows businesses) ------
async function searchMapbox(q: string, near?: Coords): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    q,
    access_token: MAPBOX_TOKEN!,
    limit: '7',
    types: 'poi,address,place,locality,neighborhood',
  });
  if (near) params.set('proximity', `${near.lng},${near.lat}`);

  try {
    const res = await fetch(`https://api.mapbox.com/search/searchbox/v1/forward?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.features ?? [])
      .map((f: any): PlaceResult | null => {
        const coords = f.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;
        return {
          name: f.properties?.name ?? f.properties?.name_preferred ?? 'Unnamed place',
          subtitle: f.properties?.place_formatted ?? f.properties?.full_address ?? undefined,
          lng: coords[0],
          lat: coords[1],
        };
      })
      .filter(Boolean) as PlaceResult[];
  } catch {
    return [];
  }
}

// --- Nominatim (free OSM geocoder; biased + sorted + de-duped) -------------
async function searchNominatim(q: string, near?: Coords): Promise<PlaceResult[]> {
  const params = new URLSearchParams({
    format: 'json',
    addressdetails: '1',
    limit: '10',
    q,
  });

  // Prefer results within ~500mi of the user, and don't return anything
  // outside that box (avoids "Oakland" in another country).
  if (near) {
    const lonRange = RANGE_DEG / Math.max(0.2, Math.cos((near.lat * Math.PI) / 180));
    const west = near.lng - lonRange;
    const east = near.lng + lonRange;
    const north = near.lat + RANGE_DEG;
    const south = near.lat - RANGE_DEG;
    params.set('viewbox', `${west},${north},${east},${south}`);
    params.set('bounded', '1');
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    const data = await res.json();
    let results: PlaceResult[] = (data ?? []).map((d: any) => {
      const city = d.address?.city || d.address?.town || d.address?.village;
      const region = d.address?.state;
      const subtitle = [city, region].filter(Boolean).join(', ') || undefined;
      return {
        name:
          d.name && d.name.trim()
            ? d.name.trim()
            : String(d.display_name).split(',')[0].trim(),
        subtitle,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
      };
    });

    // De-duplicate by name + rounded coordinates.
    const seen = new Set<string>();
    results = results.filter((r) => {
      const key = `${r.name.toLowerCase()}|${r.lat.toFixed(2)}|${r.lng.toFixed(2)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Nearest-first when we know where the user is.
    if (near) {
      results.sort((a, b) => distanceKm(near, a) - distanceKm(near, b));
    }

    return results.slice(0, 7);
  } catch {
    return [];
  }
}
