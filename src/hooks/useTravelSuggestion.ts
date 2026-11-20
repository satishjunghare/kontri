import { useEffect, useState } from 'react';
import { calculateTravel } from '../lib/geo.ts';
import { legKey } from '../lib/plan.ts';
import type { LatLng } from '../lib/plan.ts';
import type { TravelSuggestion } from '../types.ts';

/**
 * The app's own calculation of the travel time between two places (road time when online, a
 * straight-line guess when offline). It is only ever shown next to your own estimate, never mixed in.
 * `calculating` is true until the answer for the current pair of places has arrived.
 */
export function useTravelSuggestion(from: LatLng | null, to: LatLng | null): {
  suggestion: TravelSuggestion | null;
  calculating: boolean;
} {
  const [result, setResult] = useState<TravelSuggestion | null>(null);
  const fromLat = from?.lat;
  const fromLng = from?.lng;
  const toLat = to?.lat;
  const toLng = to?.lng;
  const key =
    fromLat !== undefined && fromLng !== undefined && toLat !== undefined && toLng !== undefined
      ? legKey({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng })
      : null;

  useEffect(() => {
    if (fromLat === undefined || fromLng === undefined || toLat === undefined || toLng === undefined) return;
    let cancelled = false;
    calculateTravel({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [fromLat, fromLng, toLat, toLng]);

  // An answer for an earlier pair of places does not count.
  const suggestion = key !== null && result?.key === key ? result : null;
  return { suggestion, calculating: key !== null && suggestion === null };
}
