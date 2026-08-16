import type { Coords } from '@/lib/places';

export interface PinEvent {
  id: string;
  title: string;
  location: string | null;
  event_time: string | null;
  lat: number;
  lng: number;
  hostName: string;
  rsvpedByMe: boolean;
}

export interface MapPinColors {
  border: string;
  accentPink: string;
  accentCyan: string;
  accentYellow: string;
  accentGreen: string;
}

// A fully self-describing marker: everything Leaflet needs (position +
// pre-rendered divIcon html/size/anchor) with no further knowledge of
// colors/RSVP state required by the caller. This is what lets the web DOM
// map and the WebView-based native map share one source of pin styling
// instead of duplicating the divIcon HTML template in two places.
export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  iconHtml: string;
  iconSize: [number, number];
  iconAnchor: [number, number];
  isUser?: boolean;
}

function eventPinIcon(bg: string, border: string, glyph: string): string {
  return `<div style="width:28px;height:28px;border-radius:50%;background:${bg};border:3px solid ${border};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;color:#000;box-shadow:2px 2px 0 ${border};">${glyph}</div>`;
}

function userDotIcon(accentCyan: string, border: string): string {
  return `<div style="width:18px;height:18px;border-radius:50%;background:${accentCyan};border:3px solid ${border};box-shadow:0 0 0 6px ${accentCyan}55;"></div>`;
}

// Builds the full set of markers (event pins + optional "you are here" dot)
// for a given data snapshot. Cycles through the same 4 accent colors used
// on the web map for non-RSVP'd pins.
export function buildMarkerPayload(
  pins: PinEvent[],
  userCoords: Coords | null,
  colors: MapPinColors
): MapMarker[] {
  const pinAccents = [colors.accentPink, colors.accentCyan, colors.accentYellow, colors.accentGreen];

  const markers: MapMarker[] = pins.map((pin, idx) => {
    const bg = pin.rsvpedByMe ? colors.accentGreen : pinAccents[idx % pinAccents.length];
    const glyph = pin.rsvpedByMe ? '✓' : '📍';
    return {
      id: pin.id,
      lat: pin.lat,
      lng: pin.lng,
      iconHtml: eventPinIcon(bg, colors.border, glyph),
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    };
  });

  if (userCoords) {
    markers.push({
      id: '__user__',
      lat: userCoords.lat,
      lng: userCoords.lng,
      iconHtml: userDotIcon(colors.accentCyan, colors.border),
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      isUser: true,
    });
  }

  return markers;
}
