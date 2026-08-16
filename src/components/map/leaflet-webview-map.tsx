import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { buildLeafletMapHtml } from '@/lib/leaflet-map-html';
import { buildMarkerPayload, MapPinColors, PinEvent } from '@/lib/map-markers';
import type { Coords } from '@/lib/places';

// react-native-webview's ref type doesn't expose `postMessage` in its public
// typings even though the instance has it at runtime — this is the accepted
// workaround used across the RN ecosystem for this library.
interface WebViewRef {
  postMessage: (data: string) => void;
}

interface LeafletWebViewMapProps {
  pins: PinEvent[];
  userCoords: Coords | null;
  colors: MapPinColors;
  onMarkerPress: (id: string) => void;
  onMapPress: () => void;
  onReady: () => void;
  onError: () => void;
}

// Native (iOS/Android) counterpart to the web map's Leaflet DOM effects in
// src/app/(tabs)/map.tsx — same OpenStreetMap tiles and pin styling (shared
// via buildMarkerPayload), rendered inside a WebView instead of a <div>
// since there's no free native map renderer for Android without a Google
// Maps billing account.
export function LeafletWebViewMap({
  pins,
  userCoords,
  colors,
  onMarkerPress,
  onMapPress,
  onReady,
  onError,
}: LeafletWebViewMapProps) {
  const webViewRef = useRef<WebViewRef>(null);
  const html = useMemo(() => buildLeafletMapHtml(), []);
  const readyRef = useRef(false);

  function sendMarkers() {
    const markers = buildMarkerPayload(pins, userCoords, colors);
    if (__DEV__) {
      console.log('[LeafletWebViewMap] sendMarkers', {
        ready: readyRef.current,
        hasWebViewRef: !!webViewRef.current,
        pinCount: pins.length,
        userCoords,
        markerCount: markers.length,
        hasUserMarker: markers.some((m) => m.isUser),
      });
    }
    webViewRef.current?.postMessage(JSON.stringify({ type: 'setMarkers', markers }));
  }

  useEffect(() => {
    if (readyRef.current) {
      sendMarkers();
    } else if (__DEV__) {
      console.log('[LeafletWebViewMap] skipped sendMarkers — not ready yet', { userCoords });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins, userCoords, colors]);

  function handleMessage(event: WebViewMessageEvent) {
    let msg: any;
    try {
      msg = JSON.parse(event.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.type === 'ready') {
      readyRef.current = true;
      sendMarkers();
      onReady();
    } else if (msg.type === 'markerTap' && typeof msg.id === 'string') {
      onMarkerPress(msg.id);
    } else if (msg.type === 'mapTap') {
      onMapPress();
    }
  }

  return (
    <WebView
      ref={webViewRef as any}
      source={{ html }}
      originWhitelist={['*']}
      onMessage={handleMessage}
      onError={onError}
      style={StyleSheet.absoluteFill}
      // Android only: without this, the page-level vertical ScrollView
      // (src/app/(tabs)/map.tsx) steals vertical drags before Leaflet's own
      // touch handling sees them, so only horizontal panning works. iOS
      // already behaves correctly without it.
      nestedScrollEnabled
    />
  );
}
