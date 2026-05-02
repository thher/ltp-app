import { NextRequest, NextResponse } from 'next/server';

type RouteWarningRequest = {
  from?: unknown;
  to?: unknown;
  vehicleHeightMm?: unknown;
  vehicleWidthMm?: unknown;
  vehicleLengthMm?: unknown;
  totalWeightKg?: unknown;
};

type Coordinate = [number, number];

type RouteWarningDebug = {
  nvdbFetchedCount: number;
  nvdbMatchedRouteCount: number;
  nvdbHeightFilteredCount: number;
  datexFetchedCount: number;
  datexMatchedRouteCount: number;
  datexReturnedCount: number;
  datexDebugReason: string;
  restStopCount: number;
  restStopsFetchedCount: number;
  restStopsMissingCoordinatesCount: number;
  restStopsRouteMatchedCount: number;
  restStopsReturnedCount: number;
  restStopsDebugReason: string;
  usedRouteFilter: boolean;
};

type HeightWarning = {
  type: 'height';
  severity: 'critical' | 'caution';
  value: number;
  description: string;
  lat: number;
  lon: number;
  distanceKm?: number;
  location?: string;
  coordinates?: Coordinate;
};

type RoadworkWarning = {
  type: 'roadwork';
  description: string;
  lat: number;
  lon: number;
  distanceKm?: number;
};

type RestStop = {
  type: 'rest-stop';
  name: string;
  lat: number;
  lon: number;
  distanceKm?: number | null;
};

const NVDB_HEIGHT_RESTRICTIONS_URL =
  'https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/591?antall=500&inkluder=alle&srid=4326';
const DATEX_SITUATION_URL =
  'https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetSituation/pullsnapshotdata';
const ROUTE_MATCH_DISTANCE_METERS = 300;
const ROADWORK_ROUTE_MATCH_DISTANCE_METERS = 1000;
const REST_STOP_ROUTE_MATCH_DISTANCE_METERS = 2000;
const MAX_TRAFFIC_WARNINGS = 10;
const MAX_DATEX_RECORDS = 200;
const MAX_REST_STOPS = 10;

function createDebug(usedRouteFilter: boolean): RouteWarningDebug {
  return {
    nvdbFetchedCount: 0,
    nvdbMatchedRouteCount: 0,
    nvdbHeightFilteredCount: 0,
    datexFetchedCount: 0,
    datexMatchedRouteCount: 0,
    datexReturnedCount: 0,
    datexDebugReason: 'not checked',
    restStopCount: 0,
    restStopsFetchedCount: 0,
    restStopsMissingCoordinatesCount: 0,
    restStopsRouteMatchedCount: 0,
    restStopsReturnedCount: 0,
    restStopsDebugReason: 'not checked',
    usedRouteFilter,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function parseNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseVehicleHeightMm(value: unknown) {
  const parsed = parseNumber(value);
  return parsed !== null && parsed > 0 ? Math.round(parsed) : null;
}

function parseText(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeHeightMeters(value: number) {
  if (value > 1000) return value / 1000;
  if (value > 100) return value / 100;
  return value;
}

function extractHeightMeters(objekt: Record<string, unknown>) {
  const egenskaper = Array.isArray(objekt.egenskaper) ? objekt.egenskaper : [];

  for (const item of egenskaper) {
    const egenskap = asRecord(item);
    if (!egenskap) continue;

    const name = String(egenskap.navn ?? egenskap.egenskapstype ?? '').toLowerCase();
    if (!name.includes('høyde') && !name.includes('hoyde')) continue;

    const rawValue = egenskap.verdi ?? egenskap.value;
    const parsed = parseNumber(rawValue);
    if (parsed !== null && parsed > 0) return normalizeHeightMeters(parsed);
  }

  return null;
}

function extractLocation(objekt: Record<string, unknown>) {
  const lokasjon = asRecord(objekt.lokasjon);
  const vegsystemreferanser = Array.isArray(lokasjon?.vegsystemreferanser)
    ? lokasjon.vegsystemreferanser
    : [];
  const firstReference = vegsystemreferanser[0];
  if (typeof firstReference === 'string' && firstReference.trim()) return firstReference;

  const id = objekt.id;
  return typeof id === 'number' || typeof id === 'string' ? `NVDB objekt ${id}` : undefined;
}

function extractCoordinates(objekt: Record<string, unknown>): Coordinate | undefined {
  const geometri = asRecord(objekt.geometri);
  const wkt = typeof geometri?.wkt === 'string' ? geometri.wkt : '';
  const match = wkt.match(/(?:POINT|LINESTRING)\s+Z?\s*\(?\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)(?:\s+-?\d+(?:\.\d+)?)?/i);
  if (!match) return undefined;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const isNorwegianLatLon = first >= 58 && first <= 72 && second >= 4 && second <= 32;
  const lat = isNorwegianLatLon ? first : second;
  const lon = isNorwegianLatLon ? second : first;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
  return [lat, lon];
}

function mapNvdbWarning(
  objekt: Record<string, unknown>,
  vehicleHeightMm: number,
  distanceKm?: number,
): HeightWarning | null {
  const height = extractHeightMeters(objekt);
  if (height === null) return null;

  const coordinates = extractCoordinates(objekt);
  if (!coordinates) return null;

  const restrictionHeightMm = Math.round(height * 1000);
  if (restrictionHeightMm > vehicleHeightMm + 200) return null;

  const [lat, lon] = coordinates;
  return {
    type: 'height',
    severity: restrictionHeightMm < vehicleHeightMm ? 'critical' : 'caution',
    value: height,
    description: `Høydebegrensning ${height.toLocaleString('nb-NO')} meter`,
    lat,
    lon,
    distanceKm,
    location: extractLocation(objekt),
    coordinates,
  };
}

function haversineMeters(a: Coordinate, b: Coordinate) {
  const radiusMeters = 6371000;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(b[0] - a[0]);
  const dLon = toRadians(b[1] - a[1]);
  const lat1 = toRadians(a[0]);
  const lat2 = toRadians(b[0]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * radiusMeters * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function pointToSegmentDistanceMeters(point: Coordinate, start: Coordinate, end: Coordinate) {
  const averageLatRadians = ((start[0] + end[0] + point[0]) / 3) * (Math.PI / 180);
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLon = 111320 * Math.cos(averageLatRadians);
  const px = point[1] * metersPerDegreeLon;
  const py = point[0] * metersPerDegreeLat;
  const ax = start[1] * metersPerDegreeLon;
  const ay = start[0] * metersPerDegreeLat;
  const bx = end[1] * metersPerDegreeLon;
  const by = end[0] * metersPerDegreeLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  const closestX = ax + t * dx;
  const closestY = ay + t * dy;
  return Math.hypot(px - closestX, py - closestY);
}

function routeDistanceKmToNearestPoint(
  point: Coordinate,
  route: Coordinate[],
  maxDistanceMeters = ROUTE_MATCH_DISTANCE_METERS,
) {
  let nearestIndex = -1;
  let nearestDistanceMeters = Infinity;
  let distanceFromStartMeters = 0;
  let distanceAtNearestMeters = 0;

  for (let index = 0; index < route.length; index += 1) {
    if (index > 0) {
      distanceFromStartMeters += haversineMeters(route[index - 1], route[index]);
    }

    const distanceToPointMeters = haversineMeters(point, route[index]);
    if (distanceToPointMeters < nearestDistanceMeters) {
      nearestDistanceMeters = distanceToPointMeters;
      nearestIndex = index;
      distanceAtNearestMeters = distanceFromStartMeters;
    }
  }

  if (nearestIndex === -1 || nearestDistanceMeters >= maxDistanceMeters) return null;
  return Math.round((distanceAtNearestMeters / 1000) * 10) / 10;
}

function routeLengthKm(route: Coordinate[]) {
  let distanceMeters = 0;
  for (let index = 1; index < route.length; index += 1) {
    distanceMeters += haversineMeters(route[index - 1], route[index]);
  }
  return distanceMeters / 1000;
}

function routeDistanceKmToNearbySegment(point: Coordinate, route: Coordinate[]) {
  if (route.length < 2) return null;

  let nearestSegmentIndex = -1;
  let nearestSegmentDistanceMeters = Infinity;
  let distanceFromStartMeters = 0;
  let distanceAtNearestMeters = 0;
  const nearbyRoutePointCount = route.filter(
    (routePoint) => haversineMeters(point, routePoint) < ROUTE_MATCH_DISTANCE_METERS,
  ).length;

  for (let index = 1; index < route.length; index += 1) {
    const segmentStart = route[index - 1];
    const segmentEnd = route[index];
    const segmentLengthMeters = haversineMeters(segmentStart, segmentEnd);
    const segmentDistanceMeters = pointToSegmentDistanceMeters(point, segmentStart, segmentEnd);

    if (segmentDistanceMeters < nearestSegmentDistanceMeters) {
      nearestSegmentDistanceMeters = segmentDistanceMeters;
      nearestSegmentIndex = index;
      distanceAtNearestMeters = distanceFromStartMeters;
    }

    distanceFromStartMeters += segmentLengthMeters;
  }

  if (
    nearestSegmentIndex === -1 ||
    nearestSegmentDistanceMeters >= ROUTE_MATCH_DISTANCE_METERS ||
    nearbyRoutePointCount < 2
  ) {
    return null;
  }

  return Math.round((distanceAtNearestMeters / 1000) * 10) / 10;
}

function prioritizeHeightWarnings(warnings: HeightWarning[]) {
  const sorted = [...warnings].sort(
    (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
  );

  const merged: HeightWarning[] = [];
  for (const warning of sorted) {
    const similarExistingIndex = merged.findIndex(
      (existing) =>
        haversineMeters([warning.lat, warning.lon], [existing.lat, existing.lon]) < 1000 &&
        Math.abs(existing.value - warning.value) <= 0.2,
    );
    if (similarExistingIndex === -1) {
      merged.push(warning);
    } else if (warning.value < merged[similarExistingIndex].value) {
      merged[similarExistingIndex] = warning;
    }
  }

  return merged
    .sort((a, b) => {
      const distanceDelta = (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
      if (Math.abs(distanceDelta) > 0.5) return distanceDelta;
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
      if (a.value !== b.value) return a.value - b.value;
      return distanceDelta;
    })
    .slice(0, 10);
}

function buildRouteBbox(route: Coordinate[]) {
  const padding = 0.1;
  const lats = route.map(([lat]) => lat);
  const lons = route.map(([, lon]) => lon);
  return {
    minLat: Math.min(...lats) - padding,
    maxLat: Math.max(...lats) + padding,
    minLon: Math.min(...lons) - padding,
    maxLon: Math.max(...lons) + padding,
  };
}

function buildNvdbBbox(route: Coordinate[]) {
  const { minLat, maxLat, minLon, maxLon } = buildRouteBbox(route);
  return `${minLon},${minLat},${maxLon},${maxLat}`;
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)));
}

function stripXmlTags(value: string) {
  return decodeXmlEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

function firstXmlValue(xml: string, tagName: string) {
  const match = xml.match(new RegExp(`<(?:\\w+:)?${tagName}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tagName}>`, 'i'));
  return match ? stripXmlTags(match[1]) : null;
}

function splitSituationRecords(xml: string) {
  const matches = xml.match(/<(?:\w+:)?situationRecord\b[\s\S]*?<\/(?:\w+:)?situationRecord>/gi);
  return matches ?? [];
}

function extractDatexCoordinate(recordXml: string): Coordinate | null {
  const latitude = parseNumber(firstXmlValue(recordXml, 'latitude'));
  const longitude = parseNumber(firstXmlValue(recordXml, 'longitude'));
  if (latitude !== null && longitude !== null) return [latitude, longitude];

  const pos = firstXmlValue(recordXml, 'pos');
  if (!pos) return null;
  const [first, second] = pos.split(/\s+/).map((part) => Number(part));
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  if (first >= -90 && first <= 90 && second >= -180 && second <= 180) return [first, second];
  if (second >= -90 && second <= 90 && first >= -180 && first <= 180) return [second, first];
  return null;
}

function extractDatexDescription(recordXml: string) {
  return (
    firstXmlValue(recordXml, 'description') ??
    firstXmlValue(recordXml, 'comment') ??
    firstXmlValue(recordXml, 'value') ??
    'Trafikkmelding'
  );
}

async function fetchDatexRoadworkWarnings(route: Coordinate[] | undefined, debug: RouteWarningDebug) {
  try {
    const response = await fetch(DATEX_SITUATION_URL, {
      headers: {
        Accept: 'application/xml,text/xml',
        'User-Agent': 'ai-search-app route-warnings test',
      },
      next: { revalidate: 300 },
    });
    if (!response.ok) throw new Error('DATEX request failed');

    const xml = await response.text();
    const records = splitSituationRecords(xml).slice(0, MAX_DATEX_RECORDS);
    debug.datexFetchedCount = records.length;

    const matchedRoadwork = records
      .map((record): RoadworkWarning | null => {
        const coordinates = extractDatexCoordinate(record);
        if (!coordinates) return null;

        const distanceKm = route
          ? routeDistanceKmToNearestPoint(coordinates, route, ROADWORK_ROUTE_MATCH_DISTANCE_METERS)
          : undefined;
        if (route && distanceKm === null) return null;

        const [lat, lon] = coordinates;
        return {
          type: 'roadwork',
          description: extractDatexDescription(record),
          lat,
          lon,
          distanceKm: distanceKm ?? undefined,
        };
      })
      .filter((warning): warning is RoadworkWarning => warning !== null)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    const roadwork = matchedRoadwork.slice(0, MAX_TRAFFIC_WARNINGS);

    debug.datexMatchedRouteCount = route ? matchedRoadwork.length : roadwork.length;
    debug.datexReturnedCount = roadwork.length;
    if (records.length === 0) {
      debug.datexDebugReason = 'DATEX returned 0 records';
    } else if (route && roadwork.length === 0) {
      debug.datexDebugReason = 'route filtering removed all';
    } else {
      debug.datexDebugReason = 'ok';
    }
    return roadwork;
  } catch (error) {
    console.error('DATEX traffic fetch failed:', error);
    debug.datexFetchedCount = 0;
    debug.datexMatchedRouteCount = 0;
    debug.datexReturnedCount = 0;
    debug.datexDebugReason = 'DATEX request failed';
    return [];
  }
}

async function fetchRestStops(route: Coordinate[] | undefined, debug: RouteWarningDebug): Promise<RestStop[]> {
  if (!route || route.length < 2) {
    debug.restStopCount = 0;
    debug.restStopsFetchedCount = 0;
    debug.restStopsMissingCoordinatesCount = 0;
    debug.restStopsRouteMatchedCount = 0;
    debug.restStopsReturnedCount = 0;
    debug.restStopsDebugReason = 'missing route geometry';
    return [];
  }

  const { minLat: south, minLon: west, maxLat: north, maxLon: east } = buildRouteBbox(route);
  const overpassQuery = `
[out:json][timeout:25];
(
  node["highway"="rest_area"](${south},${west},${north},${east});
  way["highway"="rest_area"](${south},${west},${north},${east});
  node["amenity"="parking"]["hgv"="yes"](${south},${west},${north},${east});
  way["amenity"="parking"]["hgv"="yes"](${south},${west},${north},${east});
  node["amenity"="parking"]["truck"="yes"](${south},${west},${north},${east});
  way["amenity"="parking"]["truck"="yes"](${south},${west},${north},${east});
  node["amenity"="parking"]["name"](${south},${west},${north},${east});
  way["amenity"="parking"]["name"](${south},${west},${north},${east});
);
out center;
`;

  try {
    const body = `data=${encodeURIComponent(overpassQuery)}`;
    const overpassHeaders = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Accept: 'application/json',
      'User-Agent': 'LTP-Calculator/1.0 local-dev',
    };
    let response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: overpassHeaders,
      body,
    });

    if (response.status === 406) {
      response = await fetch('https://overpass.kumi.systems/api/interpreter', {
        method: 'POST',
        headers: overpassHeaders,
        body,
      });
    }

    const text = await response.text();

    if (!response.ok) {
      console.error(`Overpass rest stop request failed: ${response.status} ${response.statusText}`);
      debug.restStopsDebugReason = `Overpass failed: ${response.status} ${response.statusText}`;
      return [];
    }

    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      debug.restStopsDebugReason = 'Overpass JSON parse failed';
      return [];
    }
    const root = asRecord(json);
    const elements = Array.isArray(root?.elements) ? root.elements : [];
    debug.restStopsFetchedCount = elements.length;
    let missingCoordinatesCount = 0;
    let routeMatchedCount = 0;
    let startAreaExcludedCount = 0;
    const seen = new Set<string>();
    const shouldExcludeStartArea = routeLengthKm(route) >= 50;
    const stops = elements
      .map((element): RestStop | null => {
        const record = asRecord(element);
        if (!record) return null;

        const center = asRecord(record.center);
        const lat = parseNumber(record.lat ?? center?.lat);
        const lon = parseNumber(record.lon ?? center?.lon);
        if (lat === null || lon === null) {
          missingCoordinatesCount += 1;
          return null;
        }

        const tags = asRecord(record.tags);
        const access = String(tags?.access ?? '').toLowerCase();
        const bicycle = String(tags?.bicycle ?? '').toLowerCase();
        const motorcycle = String(tags?.motorcycle ?? '').toLowerCase();
        const parking = String(tags?.parking ?? '').toLowerCase();
        const highway = String(tags?.highway ?? '').toLowerCase();
        const amenity = String(tags?.amenity ?? '').toLowerCase();
        const hgv = String(tags?.hgv ?? '').toLowerCase();
        const truck = String(tags?.truck ?? '').toLowerCase();
        const hasName = Boolean(parseText(tags?.name) ?? parseText(tags?.operator));
        const capacity = parseNumber(tags?.capacity);
        if (access === 'private' || access === 'no') return null;
        if (parking === 'layby' || parking === 'street_side' || parking === 'bicycle') return null;
        if (bicycle === 'yes' || bicycle === 'designated') return null;
        if (motorcycle === 'yes' || motorcycle === 'designated') return null;
        if (capacity !== null && capacity > 0 && capacity < 5) return null;
        const isRestArea = highway === 'rest_area';
        const isTruckParking = amenity === 'parking' && (hgv === 'yes' || truck === 'yes');
        const isNamedParkingNearRoute = amenity === 'parking' && hasName;
        if (!isRestArea && !isTruckParking && !isNamedParkingNearRoute) return null;

        const distanceKm = routeDistanceKmToNearestPoint(
          [lat, lon],
          route,
          REST_STOP_ROUTE_MATCH_DISTANCE_METERS,
        );
        if (distanceKm === null) return null;
        routeMatchedCount += 1;
        if (shouldExcludeStartArea && distanceKm < 20) {
          startAreaExcludedCount += 1;
          return null;
        }

        const rawName = parseText(tags?.name) ?? parseText(tags?.operator);
        const name = rawName ?? (isRestArea ? 'Hvileplass' : 'Parkering');
        const key = `${Math.round(lat * 10000)}:${Math.round(lon * 10000)}:${name}`;
        if (seen.has(key)) return null;
        seen.add(key);

        return {
          type: 'rest-stop',
          name,
          lat,
          lon,
          distanceKm,
        };
      })
      .filter((stop): stop is RestStop => stop !== null)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      .slice(0, MAX_REST_STOPS);

    debug.restStopsMissingCoordinatesCount = missingCoordinatesCount;
    debug.restStopsRouteMatchedCount = routeMatchedCount;
    debug.restStopsReturnedCount = stops.length;
    debug.restStopCount = stops.length;
    if (elements.length === 0) {
      debug.restStopsDebugReason = 'Overpass returned 0 results';
    } else if (missingCoordinatesCount === elements.length) {
      debug.restStopsDebugReason = 'missing coordinates';
    } else if (routeMatchedCount === 0) {
      debug.restStopsDebugReason = 'route filtering removed all';
    } else if (stops.length === 0 && startAreaExcludedCount > 0) {
      debug.restStopsDebugReason = 'only start-area stops found';
    } else if (stops.length === 0) {
      debug.restStopsDebugReason = 'non-truck or duplicate stops removed all';
    } else {
      debug.restStopsDebugReason = 'ok';
    }
    return stops;
  } catch (error) {
    console.error('REST STOPS OVERPASS ERROR:', error);
    debug.restStopCount = 0;
    debug.restStopsReturnedCount = 0;
    debug.restStopsDebugReason =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Overpass failed: timeout'
        : 'Overpass failed: request error';
    return [];
  }
}

async function geocodeLocation(query: string): Promise<Coordinate> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ai-search-app route-warnings test',
      },
    },
  );
  if (!response.ok) throw new Error('Geocoding request failed');

  const json = (await response.json()) as unknown;
  const first = Array.isArray(json) ? asRecord(json[0]) : null;
  const lat = parseNumber(first?.lat);
  const lon = parseNumber(first?.lon);
  if (lat === null || lon === null) throw new Error('Geocoding returned no coordinates');

  return [lat, lon];
}

async function fetchOsrmRoute(fromCoord: Coordinate, toCoord: Coordinate): Promise<Coordinate[]> {
  const [fromLat, fromLon] = fromCoord;
  const [toLat, toLon] = toCoord;
  const response = await fetch(
    `http://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) throw new Error('OSRM request failed');

  const json = (await response.json()) as unknown;
  const root = asRecord(json);
  const routes = Array.isArray(root?.routes) ? root.routes : [];
  const firstRoute = asRecord(routes[0]);
  const geometry = asRecord(firstRoute?.geometry);
  const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  const route = coordinates
    .map((coord): Coordinate | null => {
      if (!Array.isArray(coord) || coord.length < 2) return null;
      const lon = parseNumber(coord[0]);
      const lat = parseNumber(coord[1]);
      return lat !== null && lon !== null ? [lat, lon] : null;
    })
    .filter((coord): coord is Coordinate => coord !== null);

  if (route.length < 2) throw new Error('OSRM returned no route geometry');
  return route;
}

async function fetchNvdbHeightWarnings(
  vehicleHeightMm: number,
  route: Coordinate[] | undefined,
  debug: RouteWarningDebug,
) {
  try {
    const bbox = route ? buildNvdbBbox(route) : null;
    const url = new URL(NVDB_HEIGHT_RESTRICTIONS_URL);
    if (bbox) {
      url.searchParams.set('kartutsnitt', bbox);
    }
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LTP-Calculator/1.0 contact: local-dev',
        Accept: 'application/json',
      },
      cache: 'no-store',
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error(`NVDB request failed with status ${response.status}: ${response.statusText}`);
      return [];
    }

    let data: unknown;
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      console.error('NVDB JSON parse failed:', error);
      return [];
    }

    const root = asRecord(data);
    const objekterRaw = root?.objekter ?? root?.vegobjekter;
    const objekter = Array.isArray(objekterRaw) ? objekterRaw : [];

    debug.nvdbFetchedCount = objekter.length;

    const routeMatches = objekter
      .map((objekt) => asRecord(objekt))
      .filter((objekt): objekt is Record<string, unknown> => objekt !== null)
      .map((objekt) => {
        if (!route) return { objekt, distanceKm: undefined };
        const coordinates = extractCoordinates(objekt);
        if (!coordinates) return null;
        const distanceKm = routeDistanceKmToNearbySegment(coordinates, route);
        return distanceKm !== null ? { objekt, distanceKm } : null;
      })
      .filter((match): match is { objekt: Record<string, unknown>; distanceKm?: number } => match !== null);

    console.log('NVDB height route candidates before filtering:', objekter.length);
    console.log('NVDB height route matches after filtering:', routeMatches.length);
    debug.nvdbMatchedRouteCount = route ? routeMatches.length : 0;
    const warnings = routeMatches
      .map(({ objekt, distanceKm }) => mapNvdbWarning(objekt, vehicleHeightMm, distanceKm))
      .filter((warning): warning is HeightWarning => warning !== null);
    debug.nvdbHeightFilteredCount = warnings.length;

    return prioritizeHeightWarnings(warnings);
  } catch (error) {
    console.error('NVDB height warning fetch failed:', error);
    debug.nvdbFetchedCount = 0;
    debug.nvdbMatchedRouteCount = 0;
    debug.nvdbHeightFilteredCount = 0;
    return [];
  }
}

async function fetchNvdbTestWarnings(vehicleHeightMm: number) {
  const debug = createDebug(false);
  const restStops: RestStop[] = [];

  try {
    const [warnings, roadwork] = await Promise.all([
      fetchNvdbHeightWarnings(vehicleHeightMm, undefined, debug),
      fetchDatexRoadworkWarnings(undefined, debug),
    ]);
    return NextResponse.json({
      warnings,
      roadwork,
      restStops,
      source: 'nvdb-test',
      message: 'Høydebegrensninger hentet fra NVDB testutvalg',
      debug,
    });
  } catch {
    return NextResponse.json({
      warnings: [],
      roadwork: await fetchDatexRoadworkWarnings(undefined, debug),
      restStops,
      source: 'nvdb-test',
      message: 'NVDB var ikke tilgjengelig. Ingen varsler funnet i foreløpig sjekk.',
      debug,
    });
  }
}

export async function POST(request: NextRequest) {
  let vehicleHeightMm: number | null = null;
  let from: string | null = null;
  let to: string | null = null;

  try {
    const body = (await request.json()) as RouteWarningRequest;
    vehicleHeightMm = parseVehicleHeightMm(body.vehicleHeightMm);
    from = parseText(body.from);
    to = parseText(body.to);
  } catch {
    // Request fields are accepted now, but warnings require at least vehicle height.
  }

  if (vehicleHeightMm === null) {
    const debug = createDebug(false);
    const restStops: RestStop[] = [];
    return NextResponse.json({
      warnings: [],
      roadwork: await fetchDatexRoadworkWarnings(undefined, debug),
      restStops,
      source: 'nvdb-test',
      message: 'Kjøretøyhøyde mangler. Ingen høydevarsler filtrert.',
      debug,
    });
  }

  if (!from || !to) {
    return fetchNvdbTestWarnings(vehicleHeightMm);
  }

  try {
    const debug = createDebug(true);
    const [fromCoord, toCoord] = await Promise.all([geocodeLocation(from), geocodeLocation(to)]);
    const route = await fetchOsrmRoute(fromCoord, toCoord);
    const [warnings, roadwork, restStops] = await Promise.all([
      fetchNvdbHeightWarnings(vehicleHeightMm, route, debug),
      fetchDatexRoadworkWarnings(route, debug),
      fetchRestStops(route, debug),
    ]);

    return NextResponse.json({
      warnings,
      roadwork,
      restStops,
      source: 'nvdb-route',
      message: 'Høydebegrensninger hentet fra NVDB testutvalg og filtrert mot rute',
      debug,
    });
  } catch {
    return fetchNvdbTestWarnings(vehicleHeightMm);
  }
}
