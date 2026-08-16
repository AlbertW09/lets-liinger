import { LEAFLET_CSS, LEAFLET_JS } from './leaflet-vendor';
import {
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  FIT_BOUNDS_OPTS,
  OSM_ATTRIBUTION,
  OSM_MAX_ZOOM,
  OSM_TILE_URL,
  SINGLE_POINT_ZOOM,
} from './map-config';

// Defends against a vendored asset that happens to contain a literal
// "</script>" or "</style>" substring, which would otherwise prematurely
// close the surrounding tag when the WebView parses this as HTML.
function escapeForInlineTag(source: string, closingTag: string): string {
  return source.split(closingTag).join(closingTag.slice(0, -1) + '\\' + closingTag.slice(-1));
}

const SAFE_LEAFLET_JS = escapeForInlineTag(LEAFLET_JS, '</script>');
const SAFE_LEAFLET_CSS = escapeForInlineTag(LEAFLET_CSS, '</style>');

// Builds a self-contained HTML document (vendored Leaflet + a small bridge
// script) for the WebView-based native map. Mirrors the web map's Leaflet
// setup in src/app/(tabs)/map.tsx almost exactly, just driven by postMessage
// instead of React state/effects:
//   RN -> WebView: { type: 'setMarkers', markers: MapMarker[] }
//   WebView -> RN: { type: 'ready' } | { type: 'mapTap' } | { type: 'markerTap', id }
export function buildLeafletMapHtml(): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<style>
  html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
  ${SAFE_LEAFLET_CSS}
</style>
</head>
<body>
<div id="map"></div>
<script>${SAFE_LEAFLET_JS}</script>
<script>
(function () {
  var map = L.map('map', { zoomControl: true }).setView(
    [${DEFAULT_MAP_CENTER[0]}, ${DEFAULT_MAP_CENTER[1]}],
    ${DEFAULT_MAP_ZOOM}
  );
  L.tileLayer(${JSON.stringify(OSM_TILE_URL)}, {
    attribution: ${JSON.stringify(OSM_ATTRIBUTION)},
    maxZoom: ${OSM_MAX_ZOOM},
  }).addTo(map);

  var markerLayer = L.layerGroup().addTo(map);
  var lastFitKey = '';

  function post(msg) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  map.on('click', function () { post({ type: 'mapTap' }); });

  function setMarkers(markers) {
    markerLayer.clearLayers();
    var pts = [];
    (markers || []).forEach(function (m) {
      var icon = L.divIcon({ className: '', html: m.iconHtml, iconSize: m.iconSize, iconAnchor: m.iconAnchor });
      var marker = L.marker([m.lat, m.lng], { icon: icon });
      if (!m.isUser) {
        marker.on('click', function () { post({ type: 'markerTap', id: m.id }); });
      }
      marker.addTo(markerLayer);
      pts.push([m.lat, m.lng]);
    });

    // Fit bounds only when the set of points actually changes (mirrors the
    // web map's fitKeyRef logic), not on every marker redraw.
    var fitKey = pts.map(function (p) { return p.join(','); }).sort().join('|');
    if (fitKey && fitKey !== lastFitKey) {
      if (pts.length === 1) {
        map.setView(pts[0], ${SINGLE_POINT_ZOOM});
      } else if (pts.length > 1) {
        map.fitBounds(pts, ${JSON.stringify(FIT_BOUNDS_OPTS)});
      }
      lastFitKey = fitKey;
    }
  }

  function handleMessage(event) {
    try {
      var msg = JSON.parse(event.data);
      if (msg.type === 'setMarkers') setMarkers(msg.markers);
    } catch (e) {}
  }
  // Android delivers postMessage on 'document', iOS on 'window' — listen on
  // both since react-native-webview's behavior has varied across versions.
  document.addEventListener('message', handleMessage);
  window.addEventListener('message', handleMessage);

  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
}
