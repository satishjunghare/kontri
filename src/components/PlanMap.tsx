import { useEffect, useRef, useState } from 'react';
import type { ComponentType, Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewMessageEvent, WebViewProps } from 'react-native-webview';
import { MAP_HTML } from '../map/mapHtml.ts';
import { buildMapState, parseMapMessage } from './planMapTypes.ts';
import type { PlanMapProps } from './planMapTypes.ts';

// The library's own typings reject props with this React version, so the WebView is typed here
// with just what this component uses.
type WebViewHandle = { postMessage: (message: string) => void };
const MapWebView = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

// A page address gives the map tile servers a proper referrer, as their usage policy asks.
const SOURCE = { html: MAP_HTML, baseUrl: 'https://github.com/satishjunghare/kontri' };

/** Map of the trip's stops. Draws an OpenStreetMap inside a WebView; all pins and lines come from props. */
export default function PlanMap(props: PlanMapProps) {
  const webView = useRef<WebViewHandle>(null);
  const [ready, setReady] = useState(false);
  const state = buildMapState(props);
  const { onMarkerPress, onMapTap } = props;

  // Send the latest state to the page whenever it changes (and once the page says it is ready).
  useEffect(() => {
    if (ready) webView.current?.postMessage(state);
  }, [ready, state]);

  const onMessage = (event: WebViewMessageEvent) => {
    const msg = parseMapMessage(event.nativeEvent.data);
    if (!msg) return;
    if (msg.type === 'ready') setReady(true);
    else if (msg.type === 'marker') onMarkerPress?.(msg.id);
    else if (msg.type === 'tap') onMapTap?.({ lat: msg.lat, lng: msg.lng });
  };

  return (
    <View style={styles.container}>
      <MapWebView
        ref={webView}
        source={SOURCE}
        originWhitelist={['*']}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        overScrollMode="never"
        style={styles.web}
        // The page asks for nothing from the phone; keep it that way.
        geolocationEnabled={false}
        allowFileAccess={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E2E8F0' },
  web: { flex: 1, backgroundColor: '#E2E8F0' },
});
