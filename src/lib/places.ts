export interface PlaceResult {
  name: string;
  lat: number;
  lng: number;
}

// Geocode against OpenStreetMap's Nominatim so the location is always a real map place.
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  if (typeof fetch === 'undefined') return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await res.json();
    return (data ?? []).map((d: any) => ({
      name: d.name && d.name.trim()
        ? `${d.name}${d.address?.city || d.address?.town ? `, ${d.address.city ?? d.address.town}` : ''}`
        : String(d.display_name).split(',').slice(0, 2).join(',').trim(),
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
    }));
  } catch {
    return [];
  }
}
