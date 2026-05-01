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

const NVDB_HEIGHT_RESTRICTIONS_URL =
  'https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/591?antall=500&inkluder=alle&srid=4326';
const DATEX_SITUATION_URL =
  'https://datex-server-get-v3-1.atlas.vegvesen.no/datexapi/GetSituation/pullsnapshotdata';
const ROUTE_MATCH_DISTANCE_METERS = 300;
const ROADWORK_ROUTE_MATCH_DISTANCE_METERS = 1000;
const MAX_TRAFFIC_WARNINGS = 10;
const MAX_DATEX_RECORDS = 200;

function createDebug(usedRouteFilter: boolean): RouteWarningDebug {
  return {
    nvdbFetchedCount: 0,
    nvdbMatchedRouteCount: 0,
    nvdbHeightFilteredCount: 0,
    datexFetchedCount: 0,
    datexMatchedRouteCount: 0,
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

function buildNvdbBbox(route: Coordinate[]) {
  const padding = 0.1;
  const lats = route.map(([lat]) => lat);
  const lons = route.map(([, lon]) => lon);
  const minLat = Math.min(...lats) - padding;
  const maxLat = Math.max(...lats) + padding;
  const minLon = Math.min(...lons) - padding;
  const maxLon = Math.max(...lons) + padding;
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

    const roadwork = records
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
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
      .slice(0, MAX_TRAFFIC_WARNINGS);

    debug.datexMatchedRouteCount = route ? roadwork.length : 0;
    return roadwork;
  } catch {
    debug.datexFetchedCount = 0;
    debug.datexMatchedRouteCount = 0;
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

  try {
    const [warnings, roadwork] = await Promise.all([
      fetchNvdbHeightWarnings(vehicleHeightMm, undefined, debug),
      fetchDatexRoadworkWarnings(undefined, debug),
    ]);
    return NextResponse.json({
      warnings,
      roadwork,
      source: 'nvdb-test',
      message: 'Høydebegrensninger hentet fra NVDB testutvalg',
      debug,
    });
  } catch {
    return NextResponse.json({
      warnings: [],
      roadwork: await fetchDatexRoadworkWarnings(undefined, debug),
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
    return NextResponse.json({
      warnings: [],
      roadwork: await fetchDatexRoadworkWarnings(undefined, debug),
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
    const [warnings, roadwork] = await Promise.all([
      fetchNvdbHeightWarnings(vehicleHeightMm, route, debug),
      fetchDatexRoadworkWarnings(route, debug),
    ]);

    return NextResponse.json({
      warnings,
      roadwork,
      source: 'nvdb-route',
      message: 'Høydebegrensninger hentet fra NVDB testutvalg og filtrert mot rute',
      debug,
    });
  } catch {
    return fetchNvdbTestWarnings(vehicleHeightMm);
  }
}
