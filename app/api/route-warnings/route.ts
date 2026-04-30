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

type HeightWarning = {
  type: 'height';
  severity: 'critical' | 'caution';
  value: number;
  description: string;
  lat: number;
  lon: number;
  location?: string;
  coordinates?: Coordinate;
};

const NVDB_HEIGHT_RESTRICTIONS_URL =
  'https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/591?antall=20&inkluder=alle';
const ROUTE_MATCH_DISTANCE_METERS = 500;

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
  const match = wkt.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;

  const lon = Number(match[1]);
  const lat = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return undefined;
  return [lat, lon];
}

function mapNvdbWarning(objekt: Record<string, unknown>, vehicleHeightMm: number): HeightWarning | null {
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

function isCloseToRoute(point: Coordinate, route: Coordinate[]) {
  return route.some((routePoint) => haversineMeters(point, routePoint) < ROUTE_MATCH_DISTANCE_METERS);
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

async function fetchNvdbHeightWarnings(vehicleHeightMm: number, route?: Coordinate[]) {
  const response = await fetch(NVDB_HEIGHT_RESTRICTIONS_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ai-search-app route-warnings test',
    },
    next: { revalidate: 3600 },
  });

  if (!response.ok) throw new Error('NVDB request failed');

  const data = (await response.json()) as unknown;
  const root = asRecord(data);
  const objekter = Array.isArray(root?.objekter) ? root.objekter : [];
  return objekter
    .map((objekt) => asRecord(objekt))
    .filter((objekt): objekt is Record<string, unknown> => objekt !== null)
    .filter((objekt) => {
      if (!route) return true;
      const coordinates = extractCoordinates(objekt);
      return coordinates ? isCloseToRoute(coordinates, route) : false;
    })
    .map((objekt) => mapNvdbWarning(objekt, vehicleHeightMm))
    .filter((warning): warning is HeightWarning => warning !== null);
}

async function fetchNvdbTestWarnings(vehicleHeightMm: number) {
  try {
    const warnings = await fetchNvdbHeightWarnings(vehicleHeightMm);
    return NextResponse.json({
      warnings,
      source: 'nvdb-test',
      message: 'Høydebegrensninger hentet fra NVDB testutvalg',
    });
  } catch {
    return NextResponse.json({
      warnings: [],
      source: 'nvdb-test',
      message: 'NVDB var ikke tilgjengelig. Ingen varsler funnet i foreløpig sjekk.',
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
    return NextResponse.json({
      warnings: [],
      source: 'nvdb-test',
      message: 'Kjøretøyhøyde mangler. Ingen høydevarsler filtrert.',
    });
  }

  if (!from || !to) {
    return fetchNvdbTestWarnings(vehicleHeightMm);
  }

  try {
    const [fromCoord, toCoord] = await Promise.all([geocodeLocation(from), geocodeLocation(to)]);
    const route = await fetchOsrmRoute(fromCoord, toCoord);
    const warnings = await fetchNvdbHeightWarnings(vehicleHeightMm, route);

    return NextResponse.json({
      warnings,
      source: 'nvdb-route',
      message: 'Høydebegrensninger hentet fra NVDB testutvalg og filtrert mot rute',
    });
  } catch {
    return fetchNvdbTestWarnings(vehicleHeightMm);
  }
}
