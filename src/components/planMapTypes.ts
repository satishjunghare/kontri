export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Text inside the pin, such as the stop number. */
  label: string;
  /** Small text under the pin, such as the visit time. */
  sub?: string;
  color: string;
}

export interface MapLine {
  coords: [number, number][];
  color: string;
}

/** A small label in the middle of a leg, showing its travel time. */
export interface MapLeg {
  lat: number;
  lng: number;
  text: string;
  color: string;
}

export interface PlanMapProps {
  markers: MapMarker[];
  lines?: MapLine[];
  legs?: MapLeg[];
  selectedId?: string | null;
  /** A pin that is not a stop: the spot being chosen when picking a location. */
  pick?: { lat: number; lng: number } | null;
  /** 'pick' lets a tap (or dragging the pin) choose a spot. */
  mode?: 'view' | 'pick';
  /** Changing this re-centres the map on the markers; leave it unchanged to keep the current view. */
  fitKey: string;
  onMarkerPress?: (id: string) => void;
  onMapTap?: (point: { lat: number; lng: number }) => void;
}

/** Message the map page sends back. */
export type MapMessage =
  | { type: 'ready' }
  | { type: 'marker'; id: string }
  | { type: 'tap'; lat: number; lng: number }
  | { type: 'tiles'; ok: boolean };

export function buildMapState(p: PlanMapProps): string {
  return JSON.stringify({
    kind: 'state',
    markers: p.markers,
    lines: p.lines ?? [],
    legs: p.legs ?? [],
    selectedId: p.selectedId ?? null,
    pick: p.pick ?? null,
    mode: p.mode ?? 'view',
    fitKey: p.fitKey,
  });
}

export function parseMapMessage(data: unknown): MapMessage | null {
  if (typeof data !== 'string') return null;
  try {
    const m = JSON.parse(data) as MapMessage;
    return m && typeof m.type === 'string' ? m : null;
  } catch {
    return null;
  }
}
