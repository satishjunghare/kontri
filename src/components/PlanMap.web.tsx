import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MAP_HTML } from '../map/mapHtml.ts';
import { buildMapState, parseMapMessage } from './planMapTypes.ts';
import type { PlanMapProps } from './planMapTypes.ts';

/** Browser version of the map (used by the web preview): the same page inside an iframe. */
export default function PlanMap(props: PlanMapProps) {
  const frame = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const state = buildMapState(props);
  const { onMarkerPress, onMapTap } = props;

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const msg = parseMapMessage(e.data);
      if (!msg) return;
      if (msg.type === 'ready') setReady(true);
      else if (msg.type === 'marker') onMarkerPress?.(msg.id);
      else if (msg.type === 'tap') onMapTap?.({ lat: msg.lat, lng: msg.lng });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onMarkerPress, onMapTap]);

  useEffect(() => {
    if (ready) frame.current?.contentWindow?.postMessage(state, '*');
  }, [ready, state]);

  return (
    <View style={styles.container}>
      <iframe
        ref={frame}
        title="Trip map"
        srcDoc={MAP_HTML}
        style={{ border: 0, width: '100%', height: '100%' }}
        sandbox="allow-scripts allow-same-origin"
      />
    </View>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#E2E8F0' } });
