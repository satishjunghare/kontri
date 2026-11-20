import { estimateTravel, isShortMapLink, legKey, parseMapLink } from './plan.ts';
import type { LatLng, ParsedPoint } from './plan.ts';
import type { TravelSuggestion } from '../types.ts';

/**
 * Free services used for the map features (no account or API key):
 *  - Photon (photon.komoot.io): place search, built on OpenStreetMap data
 *  - Nominatim (nominatim.openstreetmap.org): name for a dropped pin
 *  - OSRM (router.project-osrm.org): driving distance and time between two places
 * All calls fail softly (return null / []) so the planner still works offline.
 */
const USER_AGENT = 'Kontri/1.0 (personal trip planner; https://github.com/satishjunghare/kontri)';
const TIMEOUT_MS = 8000;

async function getJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json', 'User-Agent': USER_AGENT } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// --- Place search (Photon) --------------------------------------------------

export interface PlaceResult extends LatLng {
  name: string;
  /** Town, district and state, to tell places with the same name apart. */
  detail: string;
}

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function parsePhotonResponse(json: unknown): PlaceResult[] {
  if (!isObj(json) || !Array.isArray(json.features)) return [];
  const out: PlaceResult[] = [];
  const seen = new Set<string>();
  for (const f of json.features) {
    if (!isObj(f) || !isObj(f.geometry) || !isObj(f.properties)) continue;
    const c = f.geometry.coordinates;
    if (!Array.isArray(c) || typeof c[0] !== 'number' || typeof c[1] !== 'number') continue;
    const p = f.properties;
    const name = str(p.name) || str(p.street) || str(p.city) || str(p.district);
    if (!name) continue;
    const detail = [str(p.street) && str(p.name) ? str(p.street) : '', str(p.district), str(p.city), str(p.state)]
      .filter((x, i, arr) => x && x !== name && arr.indexOf(x) === i)
      .join(', ');
    const key = `${name}|${c[1].toFixed(3)},${c[0].toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, detail, lat: c[1], lng: c[0] });
  }
  return out;
}

/** Searches for places by name, preferring results near `near` (the trip's area). */
export async function searchPlaces(query: string, near?: LatLng): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const bias = near ? `&lat=${near.lat}&lon=${near.lng}` : '';
  const json = await getJson(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en${bias}`);
  return parsePhotonResponse(json);
}

// --- Name for a dropped pin (Nominatim) -------------------------------------

export function parseNominatimReverse(json: unknown): { name: string; address: string } | null {
  if (!isObj(json) || json.error) return null;
  const display = str(json.display_name);
  const name = str(json.name) || display.split(',')[0]?.trim();
  if (!name && !display) return null;
  return { name: name || display, address: display };
}

export async function reverseGeocode(point: LatLng): Promise<{ name: string; address: string } | null> {
  const json = await getJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=17&lat=${point.lat}&lon=${point.lng}&accept-language=en`,
  );
  return parseNominatimReverse(json);
}

// --- Travel time (OSRM) ------------------------------------------------------

export function parseOsrmResponse(json: unknown, key: string): TravelSuggestion | null {
  if (!isObj(json) || json.code !== 'Ok' || !Array.isArray(json.routes) || !isObj(json.routes[0])) return null;
  const { duration, distance } = json.routes[0] as Json;
  if (typeof duration !== 'number' || typeof distance !== 'number') return null;
  return { min: Math.max(1, Math.round(duration / 60)), km: Math.round(distance / 100) / 10, source: 'road', key };
}

/**
 * The app's own calculation of driving time and distance between two places. Uses a road routing
 * service; if that is not reachable (offline), falls back to a straight-line estimate.
 */
export async function calculateTravel(from: LatLng, to: LatLng): Promise<TravelSuggestion> {
  const key = legKey(from, to);
  const json = await getJson(
    `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`,
  );
  return parseOsrmResponse(json, key) ?? estimateTravel(from, to);
}

// --- Pasted links -------------------------------------------------------------

/**
 * Finds a place in pasted text: coordinates, a full Google Maps link, or a short link
 * (maps.app.goo.gl), which is opened to find the full address it leads to.
 */
export async function resolveMapText(text: string): Promise<ParsedPoint | null> {
  const direct = parseMapLink(text);
  if (direct) return direct;
  const trimmed = text.trim();
  // The pasted text may be a sentence containing a link, such as a "share" message.
  const url = trimmed.match(/https?:\/\/\S+/)?.[0];
  if (!url) return null;
  const fromUrl = parseMapLink(url);
  if (fromUrl) return fromUrl;
  if (!isShortMapLink(url)) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': USER_AGENT } });
    return parseMapLink(res.url) ?? parseMapLink(await res.text().then((t) => t.slice(0, 200000)));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
