import { NextRequest, NextResponse } from 'next/server';

type RouteWarningRequest = {
  from?: unknown;
  to?: unknown;
  vehicleHeightMm?: unknown;
  vehicleWidthMm?: unknown;
  vehicleLengthMm?: unknown;
  totalWeightKg?: unknown;
};

type HeightWarning = {
  type: 'height';
  severity: 'critical' | 'caution';
  value: number;
  description: string;
  location?: string;
  coordinates?: [number, number];
};

const NVDB_HEIGHT_RESTRICTIONS_URL =
  'https://nvdbapiles-v3.atlas.vegvesen.no/vegobjekter/591?antall=20&inkluder=alle';

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

function extractCoordinates(objekt: Record<string, unknown>): [number, number] | undefined {
  const geometri = asRecord(objekt.geometri);
  const wkt = typeof geometri?.wkt === 'string' ? geometri.wkt : '';
  const match = wkt.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (!match) return undefined;

  const lon = Number(match[1]);
  const lat = Number(match[2]);
  return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : undefined;
}

function mapNvdbWarning(objekt: Record<string, unknown>, vehicleHeightMm: number): HeightWarning | null {
  const height = extractHeightMeters(objekt);
  if (height === null) return null;

  const restrictionHeightMm = Math.round(height * 1000);
  if (restrictionHeightMm > vehicleHeightMm + 200) return null;

  return {
    type: 'height',
    severity: restrictionHeightMm < vehicleHeightMm ? 'critical' : 'caution',
    value: height,
    description: `Høydebegrensning ${height.toLocaleString('nb-NO')} meter`,
    location: extractLocation(objekt),
    coordinates: extractCoordinates(objekt),
  };
}

export async function POST(request: NextRequest) {
  let vehicleHeightMm: number | null = null;

  try {
    const body = (await request.json()) as RouteWarningRequest;
    vehicleHeightMm = parseVehicleHeightMm(body.vehicleHeightMm);
  } catch {
    // Request fields are accepted now, but route filtering is intentionally added later.
  }

  if (vehicleHeightMm === null) {
    return NextResponse.json({
      warnings: [],
      source: 'nvdb-test',
      message: 'Kjøretøyhøyde mangler. Ingen høydevarsler filtrert.',
    });
  }

  try {
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
    const warnings = objekter
      .map((objekt) => {
        const record = asRecord(objekt);
        return record ? mapNvdbWarning(record, vehicleHeightMm) : null;
      })
      .filter((warning): warning is HeightWarning => warning !== null);

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
