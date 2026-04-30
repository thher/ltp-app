import type { VehicleLookupResponse, Powertrain } from '../types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getPath = (source: unknown, path: string[]) =>
  path.reduce<unknown>((current, key) => (isRecord(current) ? current[key] : undefined), source);

const asRecordArray = (value: unknown) =>
  Array.isArray(value) ? value.filter(isRecord) : isRecord(value) ? [value] : [];

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const collectValuesByKey = (
  source: unknown,
  keyNames: string[],
  values: unknown[] = [],
  visited = new WeakSet<object>(),
) => {
  if (!isRecord(source) && !Array.isArray(source)) {
    return values;
  }

  if (typeof source === 'object' && source !== null) {
    if (visited.has(source)) {
      return values;
    }
    visited.add(source);
  }

  if (Array.isArray(source)) {
    source.forEach((item) => collectValuesByKey(item, keyNames, values, visited));
    return values;
  }

  Object.entries(source).forEach(([key, value]) => {
    if (keyNames.includes(key)) {
      values.push(value);
    }
    collectValuesByKey(value, keyNames, values, visited);
  });

  return values;
};

const collectNumbersByKey = (source: unknown, keyNames: string[]) => {
  const numbers = collectValuesByKey(source, keyNames)
    .flatMap((value) => {
      if (Array.isArray(value)) {
        return value.map(toNumber);
      }

      return [toNumber(value)];
    })
    .filter((value): value is number => value !== null && value > 0);

  return [...new Set(numbers.map((value) => Math.round(value)))];
};

const collectNumbersFromRecordsByKey = (
  source: unknown,
  recordKeyNames: string[],
  valueKeyNames: string[],
) => {
  const records = collectValuesByKey(source, recordKeyNames);
  const numbers = records.flatMap((record) => collectNumbersByKey(record, valueKeyNames));

  return [...new Set(numbers)];
};

const firstNumberByKey = (source: unknown, keyNames: string[]) =>
  collectNumbersByKey(source, keyNames)[0] ?? null;

const firstTextByKey = (source: unknown, keyNames: string[]) => {
  const text = collectValuesByKey(source, keyNames).find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );

  return typeof text === 'string' ? text.trim() : null;
};

const formatSlashNumbers = (numbers: number[]) => (numbers.length > 0 ? numbers.join('/') : null);

const pickSlashNumbers = (...groups: number[][]) => {
  const firstGroup = groups.find((group) => group.length > 0);
  return firstGroup ? formatSlashNumbers(firstGroup) : null;
};

const unwrapVehicleData = (payload: unknown) => {
  if (!isRecord(payload)) {
    return payload;
  }

  const list = payload.kjoretoydataListe;
  if (Array.isArray(list) && list.length > 0) {
    return list[0];
  }

  return payload;
};

const extractAxleData = (vehicleData: unknown) => {
  const technicalData = getPath(vehicleData, ['godkjenning', 'tekniskGodkjenning', 'tekniskeData']);
  const axleGroups = asRecordArray(getPath(technicalData, ['akslinger', 'akselGruppe']));

  const groupLoads = axleGroups
    .map((group) => toNumber(group.tekniskTillattAkselGruppeLast))
    .filter((value): value is number => value !== null);
  const groupOwnWeights = axleGroups
    .map((group) => toNumber(group.egenvektAkselGruppe))
    .filter((value): value is number => value !== null);
  const axles = axleGroups.flatMap((group) => asRecordArray(getPath(group, ['akselListe', 'aksel'])));
  const distances = axles
    .map((axle) => toNumber(axle.avstandTilNesteAksling))
    .filter((value): value is number => value !== null);
  const driveAxleCount = axles.filter((axle) => axle.drivAksel === true).length || null;
  const driveAxles = axles.filter((axle) => axle.drivAksel === true);
  const hasAirSuspension =
    driveAxles.length > 0 ? driveAxles.some((axle) => axle.luftfjaering === true) : null;
  const allDriveAxlesAtOrUnderNinePointFiveTons =
    driveAxles.length > 0
      ? driveAxles.every((axle) => {
          const load = toNumber(axle.tekniskTillattAkselLast);
          return load !== null && load <= 9500;
        })
      : null;
  const wheelRecords = asRecordArray(
    getPath(technicalData, ['dekkOgFelg', 'akselDekkOgFelgKombinasjon']),
  ).flatMap((combination) => asRecordArray(getPath(combination, ['akselDekkOgFelg'])));
  const wheelSetupByAxleId = new Map<number, 'single' | 'double' | 'multiple'>();

  wheelRecords.forEach((wheelRecord) => {
    const axleId = toNumber(wheelRecord.akselId);
    if (axleId === null) {
      return;
    }

    wheelSetupByAxleId.set(axleId, wheelRecord.tvilling === true ? 'double' : 'single');
  });

  const firstAxleId = toNumber(axles[0]?.id);
  const firstDriveAxleId = toNumber(driveAxles[0]?.id);

  return {
    allowedAxleLoads: formatSlashNumbers(groupLoads),
    axleOwnWeights: formatSlashNumbers(groupOwnWeights),
    axleDistances: formatSlashNumbers(distances),
    driveAxleCount,
    hasAirSuspension,
    frontWheelSetup: firstAxleId !== null ? wheelSetupByAxleId.get(firstAxleId) ?? null : null,
    rearWheelSetup:
      firstDriveAxleId !== null ? wheelSetupByAxleId.get(firstDriveAxleId) ?? null : null,
    allDriveAxlesAtOrUnderNinePointFiveTons,
  };
};

const detectTwoSteeringAxles = (source: unknown) => {
  const text = JSON.stringify(source).toLowerCase();

  if (
    text.includes('begge foraksler er styrende') ||
    text.includes('to styrende aksler') ||
    text.includes('2 styrende aksler') ||
    text.includes('friksjonsstyrt')
  ) {
    return true;
  }

  return null;
};

const detectPowertrain = (source: unknown): Powertrain | null => {
  const drivstoffTexts = collectValuesByKey(source, [
    'drivstoff',
    'drivstoffKode',
    'drivstoffKodeMiljodata',
    'drivstoffBeskrivelse',
  ])
    .flatMap((value) => {
      if (typeof value === 'string') {
        return [value];
      }

      if (isRecord(value)) {
        return [value.kodeBeskrivelse, value.kodeNavn, value.kodeVerdi].filter(
          (text): text is string => typeof text === 'string',
        );
      }

      return [];
    })
    .join(' ')
    .toLowerCase();

  if (!drivstoffTexts) {
    return null;
  }

  if (drivstoffTexts.includes('elektr') || drivstoffTexts.includes('hydrogen')) {
    return 'zeroEmission';
  }

  if (
    drivstoffTexts.includes('gass') ||
    drivstoffTexts.includes('bio') ||
    drivstoffTexts.includes('hybrid')
  ) {
    return 'alternativeFuel';
  }

  if (drivstoffTexts.includes('diesel')) {
    return 'diesel';
  }

  return null;
};

const detectTechnologyWeightKg = (source: unknown) =>
  firstNumberByKey(source, [
    'batterivekt',
    'batteriVekt',
    'batterietsVekt',
    'vektBatteri',
    'teknologivekt',
    'teknologiVekt',
    'drivstoffteknologiVekt',
    'alternativDrivstoffteknologiVekt',
    'nullutslippsteknologiVekt',
    'ekstraTeknologiVekt',
  ]);

const extractVehicleDimensions = (vehicleData: unknown) => {
  const technicalData = getPath(vehicleData, ['godkjenning', 'tekniskGodkjenning', 'tekniskeData']);
  const dimensions = getPath(technicalData, ['dimensjoner']);

  return {
    vehicleHeightMm: firstNumberByKey(dimensions, [
      'hoyde',
      'høyde',
      'kjoretoyHoyde',
      'kjøretøyHøyde',
      'totalHoyde',
      'totalHøyde',
    ]),
    vehicleLengthMm: firstNumberByKey(dimensions, [
      'lengde',
      'kjoretoyLengde',
      'kjøretøyLengde',
      'totalLengde',
      'storsteLengde',
      'størsteLengde',
    ]),
    vehicleWidthMm: firstNumberByKey(dimensions, [
      'bredde',
      'kjoretoyBredde',
      'kjøretøyBredde',
      'totalBredde',
      'storsteBredde',
      'størsteBredde',
    ]),
  };
};

const makeNotes = (vehicle: VehicleLookupResponse) => {
  const notes: string[] = [];

  if (vehicle.allowedAxleLoads) {
    notes.push('Tillatt aksellast ble hentet fra punkt 8 hvis API-et hadde verdien.');
  } else {
    notes.push('Fant ikke tillatt aksellast automatisk. Sjekk punkt 8 i vognkortet.');
  }

  if (vehicle.axleDistances) {
    notes.push('Akselavstander ble hentet fra punkt 9 hvis API-et hadde verdien.');
  } else {
    notes.push('Fant ikke akselavstander automatisk. Sjekk punkt 9 (M) i vognkortet.');
  }

  if (!vehicle.grossOwnWeightWithDriver) {
    notes.push('Fant ikke egenvekt med forer automatisk. Sjekk punkt 8 i vognkortet.');
  }

  if (vehicle.hasAirSuspension !== null) {
    notes.push(`Luftfjaering funnet: ${vehicle.hasAirSuspension ? 'ja' : 'nei'}.`);
  }

  if (vehicle.rearWheelSetup) {
    notes.push(`Hjul pa drivaksel funnet: ${vehicle.rearWheelSetup === 'double' ? 'tvilling' : 'enkelt'}.`);
  }

  if (vehicle.hasTwoSteeringAxles) {
    notes.push('Mulig to styrende aksler/friksjonsstyring funnet i merknader.');
  }

  if (vehicle.powertrainHint && vehicle.powertrainHint !== 'diesel') {
    notes.push(
      vehicle.technologyWeightKg
        ? 'Batteri-/teknologivekt ble hentet automatisk hvis API-et hadde verdien.'
        : 'Drivstofftype ble funnet, men egen batteri-/teknologivekt ble ikke funnet. Fyll inn vekten manuelt hvis fotnotetillegg skal brukes.',
    );
  }

  return notes;
};

export {
  isRecord,
  getPath,
  asRecordArray,
  toNumber,
  collectValuesByKey,
  collectNumbersByKey,
  collectNumbersFromRecordsByKey,
  firstNumberByKey,
  firstTextByKey,
  formatSlashNumbers,
  pickSlashNumbers,
  unwrapVehicleData,
  extractAxleData,
  extractVehicleDimensions,
  detectTwoSteeringAxles,
  detectPowertrain,
  detectTechnologyWeightKg,
  makeNotes,
};
