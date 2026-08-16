// Shared Leaflet/OpenStreetMap constants, used by both the web DOM map
// (src/app/(tabs)/map.tsx) and the WebView-based native map
// (src/components/map/leaflet-webview-map.tsx) so the two stay in sync.

export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors';
export const OSM_MAX_ZOOM = 19;

// Fallback center/zoom used until the map has real points to fit to.
export const DEFAULT_MAP_CENTER: [number, number] = [37.9, -122.1];
export const DEFAULT_MAP_ZOOM = 9;

export const SINGLE_POINT_ZOOM = 15;

export const FIT_BOUNDS_OPTS = { padding: [50, 50] as [number, number], maxZoom: 16 };
