import { NextRequest, NextResponse } from 'next/server';

type RouteWarningRequest = {
  from?: unknown;
  to?: unknown;
  vehicleHeightMm?: unknown;
  vehicleWidthMm?: unknown;
  vehicleLengthMm?: unknown;
  totalWeightKg?: unknown;
};

const PLACEHOLDER_RESPONSE = {
  warnings: [],
  source: 'placeholder',
  message: 'Tunnel- og høydevarsler kobles til NVDB senere',
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RouteWarningRequest;
    void body;
  } catch {
    // Placeholder endpoint: keep returning the stable mock response until NVDB is connected.
  }

  return NextResponse.json(PLACEHOLDER_RESPONSE);
}
