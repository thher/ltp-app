import { NextRequest, NextResponse } from 'next/server';
import type { VehicleLookupResponse } from '../../types';
import {
  isRecord,
  getPath,
  toNumber,
  collectNumbersByKey,
  collectNumbersFromRecordsByKey,
  firstNumberByKey,
  firstTextByKey,
  pickSlashNumbers,
  unwrapVehicleData,
  extractAxleData,
  extractVehicleDimensions,
  detectTwoSteeringAxles,
  detectPowertrain,
  detectTechnologyWeightKg,
  makeNotes,
} from '../../lib/vehicle-parser';

const VEHICLE_ENDPOINT =
  'https://www.vegvesen.no/ws/no/vegvesen/kjoretoy/felles/datautlevering/enkeltoppslag/kjoretoydata';



export async function GET(request: NextRequest) {
  const rawRegistration = request.nextUrl.searchParams.get('registration');

  if (!rawRegistration) {
    return NextResponse.json({ message: 'Skriv inn registreringsnummer forst.' }, { status: 400 });
  }

  // Normalize: trim, uppercase, remove spaces and hyphens
  const normalized = rawRegistration.trim().toUpperCase().replace(/[-\s]+/g, '');

  // Validation: allow only A-Z, ÆØÅ and digits; reject empty or too-long values
  const MAX_REGISTRATION_LENGTH = 8;
  if (normalized.length === 0 || normalized.length > MAX_REGISTRATION_LENGTH) {
    return NextResponse.json(
      { message: 'Ugyldig registreringsnummer. Sjekk at det ikke er tomt og ikke for langt.' },
      { status: 400 },
    );
  }

  const validPlateRegex = /^[A-ZÆØÅ0-9]+$/;
  if (!validPlateRegex.test(normalized)) {
    return NextResponse.json(
      { message: 'Ugyldig registreringsnummer. Tillatte tegn: A-Z, ÆØÅ, 0-9.' },
      { status: 400 },
    );
  }

  const registration = normalized;

  const apiKey = process.env.VEGVESEN_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        message: 'Vegvesen API-nokkel mangler, sa skiltoppslag er ikke aktivert enna.',
        notes: ['Legg VEGVESEN_API_KEY i .env.local for a hente vognkortdata automatisk.'],
      },
      { status: 503 },
    );
  }

  let response: Response;

  try {
    response = await fetch(`${VEHICLE_ENDPOINT}?kjennemerke=${encodeURIComponent(registration)}`, {
      headers: {
        Accept: 'application/json',
        'SVV-Authorization': `Apikey ${apiKey}`,
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json(
      { message: 'Kunne ikke kontakte Vegvesen akkurat na. Prov igjen om litt.' },
      { status: 502 },
    );
  }

  if (response.status === 204 || response.status === 404) {
    return NextResponse.json(
      { message: 'Fant ikke kjoretoydata for dette registreringsnummeret.' },
      { status: 404 },
    );
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');

    return NextResponse.json(
      {
        message:
          response.status === 401 || response.status === 403
            ? 'Vegvesen avviste API-nokkelen. Sjekk at nokkelen har tilgang til enkeltoppslag.'
            : 'Vegvesen svarte ikke med gyldige kjoretoydata akkurat na.',
        notes: errorText ? [errorText.slice(0, 180)] : [],
      },
      { status: response.status },
    );
  }

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!payload) {
    return NextResponse.json(
      { message: 'Vegvesen svarte, men svaret var ikke JSON som appen kunne lese.' },
      { status: 502 },
    );
  }

  const vehicleData = unwrapVehicleData(payload);
  const axleData = extractAxleData(vehicleData);
  const dimensions = extractVehicleDimensions(vehicleData);
  const technicalData = getPath(vehicleData, ['godkjenning', 'tekniskGodkjenning', 'tekniskeData']);
  const classification = getPath(vehicleData, [
    'godkjenning',
    'tekniskGodkjenning',
    'kjoretoyklassifisering',
  ]);
  const weights = getPath(technicalData, ['vekter']);
  const allowedAxleLoads = pickSlashNumbers(
    axleData.allowedAxleLoads ? axleData.allowedAxleLoads.split('/').map(Number) : [],
    collectNumbersByKey(vehicleData, ['tillattAksellast']),
    collectNumbersFromRecordsByKey(vehicleData, ['aksellast', 'aksellastListe'], [
      'tillattAksellast',
      'last',
      'vekt',
    ]),
  );
  const axleOwnWeights = pickSlashNumbers(
    axleData.axleOwnWeights ? axleData.axleOwnWeights.split('/').map(Number) : [],
    collectNumbersByKey(vehicleData, ['egenvektAksel']),
    collectNumbersFromRecordsByKey(vehicleData, ['egenvektAkselListe', 'egenvekterAksel'], [
      'egenvektAksel',
      'egenvekt',
      'vekt',
    ]),
  );
  const axleDistances = pickSlashNumbers(
    axleData.axleDistances ? axleData.axleDistances.split('/').map(Number) : [],
    collectNumbersByKey(vehicleData, ['akselavstand']),
    collectNumbersFromRecordsByKey(vehicleData, ['akselavstand', 'akselavstander'], [
      'avstand',
      'verdi',
      'akselavstand',
    ]),
  );
  const passengerNumbers = getPath(technicalData, ['persontall']);

  const vehicle = {
    registration,
    vehicleCategory:
      firstTextByKey(classification, ['beskrivelse', 'kodeNavn', 'kodeVerdi']) ??
      firstTextByKey(vehicleData, ['kjoretoygruppe', 'tekniskKode']) ??
      null,
    vehicleLabel:
      firstTextByKey(getPath(classification, ['tekniskKode']), ['kodeNavn', 'kodeVerdi']) ??
      firstTextByKey(vehicleData, ['kjoretoygruppeTekst', 'avgiftskodeTekst']) ??
      null,
    axleCount: firstNumberByKey(vehicleData, ['antallAksler']),
    driveAxleCount: axleData.driveAxleCount ?? firstNumberByKey(vehicleData, ['antallAkslerMedDrift']),
    seatCount: isRecord(passengerNumbers) ? toNumber(passengerNumbers.sitteplasserTotalt) : null,
    standingCount: isRecord(passengerNumbers) ? toNumber(passengerNumbers.staaplasserTotalt) : null,
    hasAirSuspension: axleData.hasAirSuspension,
    frontWheelSetup: axleData.frontWheelSetup,
    rearWheelSetup: axleData.rearWheelSetup,
    hasTwoSteeringAxles: detectTwoSteeringAxles(vehicleData),
    allDriveAxlesAtOrUnderNinePointFiveTons: axleData.allDriveAxlesAtOrUnderNinePointFiveTons,
    allowedAxleLoads,
    axleOwnWeights,
    axleDistances,
    grossOwnWeightWithDriver:
      firstNumberByKey(vehicleData, ['egenvektMedForer']) ??
      (isRecord(weights) ? toNumber(weights.egenvekt) : null),
    vehicleHeightMm: dimensions.vehicleHeightMm,
    vehicleLengthMm: dimensions.vehicleLengthMm,
    vehicleWidthMm: dimensions.vehicleWidthMm,
    powertrainHint: detectPowertrain(vehicleData),
    technologyWeightKg: detectTechnologyWeightKg(vehicleData),
    notes: [],
    rawFound: true,
  } as VehicleLookupResponse & { rawFound: boolean };

  vehicle.notes = makeNotes(vehicle);

  return NextResponse.json({ vehicle });
}
