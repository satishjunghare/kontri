/// <reference types="node" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateTravel, parseNominatimReverse, parseOsrmResponse, parsePhotonResponse, resolveMapText, searchPlaces } from './geo.ts';

const photon = {
  type: 'FeatureCollection',
  features: [
    { geometry: { coordinates: [73.6535, 18.3293] }, properties: { name: 'Rohida Fort', district: 'Bhor', state: 'Maharashtra' } },
    { geometry: { coordinates: [73.6535, 18.3293] }, properties: { name: 'Rohida Fort', district: 'Bhor', state: 'Maharashtra' } }, // duplicate
    { geometry: { coordinates: [73.8, 18.5] }, properties: { street: 'MG Road', city: 'Pune', state: 'Maharashtra' } },
    { geometry: { coordinates: ['x', 1] }, properties: { name: 'Broken' } },
    { geometry: { coordinates: [73.9, 18.6] }, properties: {} }, // no name at all
  ],
};

test('Photon search results are parsed, de-duplicated and cleaned', () => {
  assert.deepEqual(parsePhotonResponse(photon), [
    { name: 'Rohida Fort', detail: 'Bhor, Maharashtra', lat: 18.3293, lng: 73.6535 },
    { name: 'MG Road', detail: 'Pune, Maharashtra', lat: 18.5, lng: 73.8 },
  ]);
  assert.deepEqual(parsePhotonResponse(null), []);
  assert.deepEqual(parsePhotonResponse({ features: 'nope' }), []);
});

test('OSRM response gives minutes and km', () => {
  const r = parseOsrmResponse({ code: 'Ok', routes: [{ duration: 3720, distance: 28400.4 }] }, 'k');
  assert.deepEqual(r, { min: 62, km: 28.4, source: 'road', key: 'k' });
  assert.equal(parseOsrmResponse({ code: 'NoRoute', routes: [] }, 'k'), null);
  assert.equal(parseOsrmResponse(undefined, 'k'), null);
});

test('Nominatim reverse result', () => {
  assert.deepEqual(parseNominatimReverse({ name: 'Kenjalgad', display_name: 'Kenjalgad, Bhor, Pune, Maharashtra, India' }), {
    name: 'Kenjalgad',
    address: 'Kenjalgad, Bhor, Pune, Maharashtra, India',
  });
  assert.deepEqual(parseNominatimReverse({ name: '', display_name: 'Some Road, Wai, Satara' }), { name: 'Some Road', address: 'Some Road, Wai, Satara' });
  assert.equal(parseNominatimReverse({ error: 'Unable to geocode' }), null);
});

// The functions below call fetch; these tests replace it with fake responses.
const realFetch = globalThis.fetch;
const fakeFetch = (handler: (url: string) => { ok?: boolean; json?: unknown; url?: string; text?: string } | 'throw') => {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const r = handler(String(input));
    if (r === 'throw') throw new Error('offline');
    return { ok: r.ok ?? true, json: async () => r.json, url: r.url ?? String(input), text: async () => r.text ?? '' } as unknown as Response;
  }) as typeof fetch;
};
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test('searchPlaces asks Photon near the trip area, and ignores very short text', async () => {
  let asked = '';
  fakeFetch((url) => ((asked = url), { json: photon }));
  assert.deepEqual(await searchPlaces('a'), []);
  assert.equal(asked, '');
  const results = await searchPlaces('Rohida', { lat: 18.5, lng: 73.8 });
  assert.equal(results.length, 2);
  assert.match(asked, /^https:\/\/photon\.komoot\.io\/api\/\?q=Rohida&limit=6&lang=en&lat=18\.5&lon=73\.8$/);
});

test('searchPlaces returns nothing when offline', async () => {
  fakeFetch(() => 'throw');
  assert.deepEqual(await searchPlaces('Pune'), []);
});

test('calculateTravel uses the road service, and falls back to a straight-line estimate offline', async () => {
  fakeFetch(() => ({ json: { code: 'Ok', routes: [{ duration: 3600, distance: 30000 }] } }));
  const road = await calculateTravel({ lat: 18.3, lng: 73.6 }, { lat: 18.5, lng: 73.8 });
  assert.equal(road.source, 'road');
  assert.equal(road.min, 60);

  fakeFetch(() => 'throw');
  const offline = await calculateTravel({ lat: 18.3, lng: 73.6 }, { lat: 18.5, lng: 73.8 });
  assert.equal(offline.source, 'estimate');
  assert.ok(offline.min > 0 && offline.km > 0);

  fakeFetch(() => ({ ok: false }));
  assert.equal((await calculateTravel({ lat: 18.3, lng: 73.6 }, { lat: 18.5, lng: 73.8 })).source, 'estimate');
});

test('resolveMapText: plain coordinates, a link inside a message, and a short link', async () => {
  fakeFetch(() => 'throw');
  assert.deepEqual(await resolveMapText('18.5, 73.8'), { lat: 18.5, lng: 73.8 });
  assert.deepEqual(await resolveMapText('Check this out https://maps.google.com/?q=18.3,73.6 great place'), { lat: 18.3, lng: 73.6, name: undefined });
  assert.equal(await resolveMapText('no link here'), null);
  assert.equal(await resolveMapText('https://example.com/page'), null);

  fakeFetch(() => ({ url: 'https://www.google.com/maps/place/Kenjalgad/@18.4,73.7,15z/data=!3d18.41!4d73.71' }));
  assert.deepEqual(await resolveMapText('https://maps.app.goo.gl/abc'), { lat: 18.41, lng: 73.71, name: 'Kenjalgad' });

  fakeFetch(() => 'throw');
  assert.equal(await resolveMapText('https://maps.app.goo.gl/abc'), null); // offline
});
