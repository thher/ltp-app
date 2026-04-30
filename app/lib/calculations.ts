import type {
  AxleCount,
  AxleVariantKey,
  BusPassengerLoadResult,
  LtpResult,
  Powertrain,
  RoadProfile,
  SemiTrailerLtpResult,
  VehicleType,
} from '../types';
import { ROAD_PROFILES, SEMI_TRAILER_TABLE_3B } from '../constants';
import { tx, type Language } from './i18n';

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('nb-NO', {
    maximumFractionDigits: digits,
  }).format(value);
}
export function parseDisplayWeights(value: string): number[] {
  if (!value.trim()) {
    return [];
  }

  return value
    .split('/')
    .map((part) => Number(part.trim().replace(',', '.')))
    .filter((part) => Number.isFinite(part));
}

export function buildAxleWeightRows(allowedLoads: number[], ownWeights: number[]) {
  const rowCount = Math.max(allowedLoads.length, ownWeights.length);

  return Array.from({ length: rowCount }, (_, index) => {
    const allowedKg = allowedLoads[index] ?? null;
    const ownKg = ownWeights[index] ?? null;

    return {
      axle: index + 1,
      allowedKg,
      ownKg,
      payloadKg: allowedKg !== null && ownKg !== null ? allowedKg - ownKg : null,
    };
  });
}

export type AxleWeightRow = {
  axle: number;
  calculatedAllowedKg: number | null;
  ownKg: number | null;
  availableKg: number | null;
};

export function deriveCalculatedAxleRows({
  baseAllowedLoads,
  ownWeights,
  targetAllowedTotalKg,
  language,
  missingRuleMessage,
}: {
  baseAllowedLoads: number[];
  ownWeights: number[];
  targetAllowedTotalKg: number | null;
  language: Language;
  missingRuleMessage: string;
}): { rows: AxleWeightRow[]; warnings: string[] } {
  const rowCount = Math.max(baseAllowedLoads.length, ownWeights.length);
  const warnings: string[] = [];

  if (rowCount === 0) {
    warnings.push(
      tx(
        language,
        'Kan ikke beregne akseltabell fordi aksellast og egenvekt per aksel mangler.',
        'Cannot calculate the axle table because axle load and tare weight per axle are missing.',
      ),
    );
    return { rows: [], warnings };
  }

  if (baseAllowedLoads.length === 0) {
    warnings.push(
      tx(
        language,
        'Mangler aksellast per aksel som fordelingsgrunnlag.',
        'Missing axle load per axle as the distribution basis.',
      ),
    );
  }

  if (ownWeights.length === 0) {
    warnings.push(tx(language, 'Mangler egenvekt per aksel.', 'Missing tare weight per axle.'));
  }

  if (targetAllowedTotalKg === null || !Number.isFinite(targetAllowedTotalKg) || targetAllowedTotalKg <= 0) {
    warnings.push(missingRuleMessage);
  }

  const baseAllowedTotalKg = baseAllowedLoads.reduce((sum, value) => sum + value, 0);

  if (baseAllowedLoads.length > 0 && baseAllowedTotalKg <= 0) {
    warnings.push(
      tx(
        language,
        'Aksellastene som skal brukes til fordeling mÃ¥ vÃ¦re stÃ¸rre enn 0.',
        'Axle loads used for distribution must be greater than 0.',
      ),
    );
  }

  const canDerive = warnings.length === 0 && targetAllowedTotalKg !== null;
  const scale = canDerive ? targetAllowedTotalKg / baseAllowedTotalKg : null;

  return {
    rows: Array.from({ length: rowCount }, (_, index) => {
      const baseAllowedKg = baseAllowedLoads[index] ?? null;
      const ownKg = ownWeights[index] ?? null;
      const calculatedAllowedKg = scale !== null && baseAllowedKg !== null ? baseAllowedKg * scale : null;

      return {
        axle: index + 1,
        calculatedAllowedKg,
        ownKg,
        availableKg: calculatedAllowedKg !== null && ownKg !== null ? calculatedAllowedKg - ownKg : null,
      };
    }),
    warnings,
  };
}

export function buildBusPassengerLoad(
  totalWeightTons: number,
  grossOwnWeightWithDriver: number,
  seatedPassengerCount: number,
  standingPassengerCount: number,
  passengerWeightKg: number,
  language: Language,
): BusPassengerLoadResult {
  const safeSeatedPassengerCount = Number.isFinite(seatedPassengerCount) ? seatedPassengerCount : 0;
  const safeStandingPassengerCount = Number.isFinite(standingPassengerCount) ? standingPassengerCount : 0;
  const passengerCount = safeSeatedPassengerCount + safeStandingPassengerCount;

  if (passengerCount <= 0) {
    return {
      status: 'missing',
      seatedPassengerCount: null,
      standingPassengerCount: null,
      passengerCount: null,
      passengerWeightKg,
      availablePayloadKg: null,
      remainingLoadKg: null,
      perPersonLoadKg: null,
      message: tx(language, 'Legg inn hvor mange passasjerer du vil regne med.', 'Enter how many passengers you want to account for.'),
    };
  }

  if (!Number.isFinite(passengerWeightKg) || passengerWeightKg <= 0) {
    return {
      status: 'invalid',
      seatedPassengerCount: safeSeatedPassengerCount,
      standingPassengerCount: safeStandingPassengerCount,
      passengerCount,
      passengerWeightKg: null,
      availablePayloadKg: null,
      remainingLoadKg: null,
      perPersonLoadKg: null,
      message: tx(language, 'Standardvekt per passasjer mÃ¥ vÃ¦re stÃ¸rre enn 0 kg.', 'Standard weight per passenger must be greater than 0 kg.'),
    };
  }

  const availablePayloadKg = totalWeightTons * 1000 - grossOwnWeightWithDriver;
  const remainingLoadKg = availablePayloadKg - passengerCount * passengerWeightKg;
  const perPersonLoadKg = remainingLoadKg / passengerCount;

  if (availablePayloadKg <= 0) {
    return {
      status: 'invalid',
      seatedPassengerCount: safeSeatedPassengerCount,
      standingPassengerCount: safeStandingPassengerCount,
      passengerCount,
      passengerWeightKg,
      availablePayloadKg,
      remainingLoadKg,
      perPersonLoadKg: null,
      message: tx(language, 'Det er ingen ledig nyttelast igjen til passasjerer og bagasje.', 'There is no available payload left for passengers and baggage.'),
    };
  }

  if (remainingLoadKg < 0) {
    return {
      status: 'invalid',
      seatedPassengerCount: safeSeatedPassengerCount,
      standingPassengerCount: safeStandingPassengerCount,
      passengerCount,
      passengerWeightKg,
      availablePayloadKg,
      remainingLoadKg,
      perPersonLoadKg,
      message: tx(language, 'Passasjervekten alene overstiger ledig nyttelast ved denne totalvekten.', 'The passenger weight alone exceeds the available payload at this total weight.'),
    };
  }

  return {
    status: 'ready',
    seatedPassengerCount: safeSeatedPassengerCount,
    standingPassengerCount: safeStandingPassengerCount,
    passengerCount,
    passengerWeightKg,
    availablePayloadKg,
    remainingLoadKg,
    perPersonLoadKg,
    message: tx(
      language,
      `Hver passasjer kan ha med ca. ${formatNumber(Math.floor(perPersonLoadKg), 0)} kg last uten at totalvekten overstiges.`,
      `Each passenger can carry about ${formatNumber(Math.floor(perPersonLoadKg), 0)} kg of load without exceeding the total weight.`,
    ),
  };
}

export function getRoadProfileLabel(roadProfile: RoadProfile): string {
  return ROAD_PROFILES.find((option) => option.value === roadProfile)?.label ?? roadProfile;
}

export function parseSlashSeparated(value: string, label: string): number[] {
  if (value.trim() === '') {
    throw new Error(`Feltet ${label} mÃ¥ fylles ut.`);
  }

  const parts = value
    .split('/')
    .map((item) => item.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error(`Feltet ${label} mÃ¥ inneholde minst Ã©n verdi.`);
  }

  return parts.map((part) => {
    const parsed = Number(part.replace(',', '.'));

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error(`Feltet ${label} inneholder en ugyldig verdi: ${part}`);
    }

    return parsed;
  });
}

function getResolvedAxleCount(vehicleType: VehicleType, axleCount: AxleCount): AxleCount {
  if (vehicleType === 'articulatedBus') {
    return '3';
  }

  return axleCount;
}

export function getCalculationAxleCount(vehicleType: VehicleType, axleVariant: AxleVariantKey, fallbackAxleCount: AxleCount): AxleCount {
  if (vehicleType === 'articulatedBus' || axleVariant === 'articulated_bus') {
    return '3';
  }

  if (vehicleType === 'bus') {
    return axleVariant === 'bus_3_rear_bogie' ? '3' : '2';
  }

  if (vehicleType === 'truck') {
    if (axleVariant === 'truck_2_single') return '2';
    if (axleVariant === 'truck_3_rear_bogie') return '3';
    if (axleVariant === 'truck_5_double_steer_tridem') return '5';
    return '4';
  }

  return getResolvedAxleCount(vehicleType, fallbackAxleCount);
}

export function getUnsupportedCalculationMessage(
  vehicleType: VehicleType,
  axleVariant: AxleVariantKey,
  language: Language,
): string | null {
  if (vehicleType === 'truck' && axleVariant === 'truck_5_double_steer_tridem') {
    return tx(
      language,
      'Dette akseloppsettet kan vises i diagrammet, men LTP-beregning for 5-akslet lastebil er ikke stÃ¸ttet ennÃ¥.',
      'This axle layout can be shown in the diagram, but LTP calculation for a 5-axle rigid truck is not supported yet.',
    );
  }

  return null;
}

export function getSemiTrailerTableWeight(
  tractorAxles: number,
  trailerAxles: number,
  minimumDistanceMeters: number,
  roadProfile: RoadProfile,
): { tableWeightKg: number; tableContext: string; distanceBand: string } {
  const tractorKey = tractorAxles >= 4 ? 4 : tractorAxles;
  const trailerKey = trailerAxles >= 3 ? 3 : trailerAxles >= 2 ? 2 : 1;
  const row = SEMI_TRAILER_TABLE_3B.find((item) => item.tractorAxles === tractorKey && item.trailerAxles === trailerKey);

  if (!row) {
    throw new Error('Denne kombinasjonen av trekkvogn og semitrailer er ikke lagt inn ennÃ¥.');
  }

  const band = row.bands.find((item) => {
    const lowerOk = item.min === undefined || minimumDistanceMeters >= item.min;
    const upperOk = item.max === undefined || minimumDistanceMeters < item.max;
    return lowerOk && upperOk;
  });

  if (!band) {
    throw new Error('Fant ikke riktig avstandsbÃ¥nd for denne minsteavstanden.');
  }

  return {
    tableWeightKg: band.weights[roadProfile] * 1000,
    tableContext: row.label,
    distanceBand: band.label,
  };
}

function getWeightByProfile(weights: Record<RoadProfile, number>, roadProfile: RoadProfile): number {
  return weights[roadProfile];
}

function getThreeAxleTruckWeight(roadProfile: RoadProfile): number {
  return getWeightByProfile(
    {
      Bk10_50: 26,
      Bk10_42: 26,
      BkT8_50: 22,
      BkT8_40: 22,
      Bk8_32: 20,
      Bk6_28: 15,
    },
    roadProfile,
  );
}

function qualifiesForTruckFootnote2({
  driveAxleCount,
  hasAirSuspension,
  hasTwinWheelsOnDriveAxles,
  allDriveAxlesAtOrUnderNinePointFiveTons,
}: {
  driveAxleCount: number;
  hasAirSuspension: boolean;
  hasTwinWheelsOnDriveAxles: boolean;
  allDriveAxlesAtOrUnderNinePointFiveTons: boolean;
}): boolean {
  if (!hasTwinWheelsOnDriveAxles) {
    return false;
  }

  if (driveAxleCount <= 1) {
    return hasAirSuspension;
  }

  return allDriveAxlesAtOrUnderNinePointFiveTons;
}

export function getVehicleTableWeight(
  vehicleType: VehicleType,
  axleCount: AxleCount,
  roadProfile: RoadProfile,
  totalAxleDistanceMm: number,
  powertrain: Powertrain,
  technologyWeightKg: number,
  hasAirSuspension: boolean,
  driveAxleCount: number,
  hasTwinWheelsOnDriveAxles: boolean,
  allDriveAxlesAtOrUnderNinePointFiveTons: boolean,
  hasTwoSteeringAxles: boolean,
): { weight: number; baseWeight: number; extraTechnologyWeightTons: number; context: string; notes: string[] } {
  const resolvedAxleCount = getResolvedAxleCount(vehicleType, axleCount);
  const notes: string[] = [];
  const meetsFootnote2 = qualifiesForTruckFootnote2({
    driveAxleCount,
    hasAirSuspension,
    hasTwinWheelsOnDriveAxles,
    allDriveAxlesAtOrUnderNinePointFiveTons,
  });
  const requestedTechnologyExtraTons = powertrain === 'diesel' ? 0 : technologyWeightKg / 1000;

  if (vehicleType === 'bus') {
    if (resolvedAxleCount === '3') {
      const baseWeight = getThreeAxleTruckWeight(roadProfile);
      const extraTechnologyWeightTons =
        roadProfile === 'Bk10_50' && powertrain !== 'diesel'
          ? Math.min(requestedTechnologyExtraTons, powertrain === 'alternativeFuel' ? 1 : 2)
          : 0;

      if (extraTechnologyWeightTons > 0) {
        notes.push(
          `Teknologitillegg brukt: ${formatNumber(extraTechnologyWeightTons, 1)} tonn ekstra for ${powertrain === 'alternativeFuel' ? 'alternativt drivstoff' : 'nullutslipp'}.`,
        );
      } else if (powertrain !== 'diesel') {
        notes.push('Ekstra teknologi-vekt for 3-akslet buss er bare lagt inn for kolonnen Bk10 / 50.');
      }

      return {
        weight: baseWeight + extraTechnologyWeightTons,
        baseWeight,
        extraTechnologyWeightTons,
        context: 'Buss med 3 aksler / bakboggi',
        notes: ['3-akslet buss behandles som motorvogn med 3 aksler i totalvekttabellen.', ...notes],
      };
    }

    const baseWeight = getWeightByProfile(
      {
        Bk10_50: 19.5,
        Bk10_42: 19,
        BkT8_50: 16,
        BkT8_40: 16,
        Bk8_32: 16,
        Bk6_28: 12,
      },
      roadProfile,
    );
    const extraTechnologyWeightTons =
      roadProfile === 'Bk10_50' && powertrain !== 'diesel'
        ? Math.min(requestedTechnologyExtraTons, powertrain === 'alternativeFuel' ? 1 : 2)
        : 0;

    if (extraTechnologyWeightTons > 0) {
      notes.push(
        `Buss-fotnote brukt: ${formatNumber(extraTechnologyWeightTons, 1)} tonn ekstra for ${powertrain === 'alternativeFuel' ? 'alternativt drivstoff' : 'nullutslipp'}.`,
      );
    } else if (powertrain !== 'diesel') {
      notes.push('Ekstra teknologi-vekt for buss kan bare brukes i kolonnen Bk10 / 50.');
    }

    return {
      weight: baseWeight + extraTechnologyWeightTons,
      baseWeight,
      extraTechnologyWeightTons,
      context: 'Buss med 2 aksler',
      notes: ['Buss med 2 aksler bruker egen rad i totalvekttabellen.', ...notes],
    };
  }

  if (vehicleType === 'articulatedBus') {
    const baseWeight = getWeightByProfile(
      {
        Bk10_50: 28,
        Bk10_42: 28,
        BkT8_50: 24,
        BkT8_40: 24,
        Bk8_32: 24,
        Bk6_28: 18,
      },
      roadProfile,
    );
    const extraTechnologyWeightTons =
      roadProfile === 'Bk10_50' && powertrain !== 'diesel'
        ? Math.min(requestedTechnologyExtraTons, powertrain === 'alternativeFuel' ? 1 : 2)
        : 0;

    if (extraTechnologyWeightTons > 0) {
      notes.push(
        `Fotnote 7 brukt: ${formatNumber(extraTechnologyWeightTons, 1)} tonn ekstra for ${powertrain === 'alternativeFuel' ? 'alternativt drivstoff' : 'nullutslipp'}.`,
      );
    } else if (powertrain !== 'diesel') {
      notes.push('Ekstra teknologi-vekt for leddbuss kan bare brukes i kolonnen Bk10 / 50.');
    }

    return {
      weight: baseWeight + extraTechnologyWeightTons,
      baseWeight,
      extraTechnologyWeightTons,
      context: 'Leddbuss',
      notes,
    };
  }

  if (resolvedAxleCount === '2') {
    const baseWeight = getWeightByProfile(
      {
        Bk10_50: 19,
        Bk10_42: 19,
        BkT8_50: 16,
        BkT8_40: 16,
        Bk8_32: 16,
        Bk6_28: 12,
      },
      roadProfile,
    );
    const extraTechnologyWeightTons =
      roadProfile === 'Bk10_50' && powertrain === 'zeroEmission'
        ? Math.min(requestedTechnologyExtraTons, 1)
        : 0;

    if (extraTechnologyWeightTons > 0) {
      notes.push(`Fotnote 8 brukt: ${formatNumber(extraTechnologyWeightTons, 1)} tonn ekstra for nullutslippskjÃ¸retÃ¸y.`);
    } else if (powertrain !== 'diesel') {
      notes.push('Ekstra teknologi-vekt for 2-akslet motorvogn gjelder bare nullutslipp i Bk10 / 50.');
    }

    return {
      weight: baseWeight + extraTechnologyWeightTons,
      baseWeight,
      extraTechnologyWeightTons,
      context: 'Motorvogn med 2 aksler unntatt buss',
      notes,
    };
  }

  if (resolvedAxleCount === '3') {
    const baseWeight = getThreeAxleTruckWeight(roadProfile);
    const extraTechnologyWeightTons =
      roadProfile === 'Bk10_50' && powertrain !== 'diesel' && meetsFootnote2
        ? Math.min(requestedTechnologyExtraTons, powertrain === 'alternativeFuel' ? 1 : 2)
        : 0;

    if (roadProfile === 'Bk10_50' && powertrain !== 'diesel') {
      if (meetsFootnote2) {
        notes.push(
          `Fotnote 6 brukt: ${formatNumber(extraTechnologyWeightTons, 1)} tonn ekstra for ${powertrain === 'alternativeFuel' ? 'alternativt drivstoff' : 'nullutslipp'}.`,
        );
      } else {
        notes.push('Fotnote 6 kan ikke brukes fordi kravene i fotnote 2 ikke er oppfylt.');
      }
    }

    return {
      weight: baseWeight + extraTechnologyWeightTons,
      baseWeight,
      extraTechnologyWeightTons,
      context: 'Motorvogn med 3 aksler',
      notes,
    };
  }

  if (!meetsFootnote2 || !hasTwoSteeringAxles) {
    const fallbackWeight = getThreeAxleTruckWeight(roadProfile);

    return {
      weight: fallbackWeight,
      baseWeight: fallbackWeight,
      extraTechnologyWeightTons: 0,
      context: 'Motorvogn med 4 aksler eller flere, fallback til 3-akslet motorvogn',
      notes: [
        'Fotnote 1 brukt: fordi kravene i fotnote 2 og 3 ikke er oppfylt, brukes vekt som for 3-akslet motorvogn.',
      ],
    };
  }

  if (totalAxleDistanceMm < 5400) {
    const weight = getWeightByProfile(
      {
        Bk10_50: 26,
        Bk10_42: 26,
        BkT8_50: 22,
        BkT8_40: 22,
        Bk8_32: 20,
        Bk6_28: 15,
      },
      roadProfile,
    );

    return {
      weight,
      baseWeight: weight,
      extraTechnologyWeightTons: 0,
      context: 'Motorvogn med 4 aksler eller flere, avstand under 5,40 m',
      notes: ['Fotnote 2 og 3 er oppfylt, sÃ¥ 4-akslet rad brukes direkte.'],
    };
  }

  if (totalAxleDistanceMm < 5600) {
    const weight = getWeightByProfile(
      {
        Bk10_50: 30,
        Bk10_42: 30,
        BkT8_50: 26,
        BkT8_40: 26,
        Bk8_32: 22,
        Bk6_28: 16,
      },
      roadProfile,
    );

    return {
      weight,
      baseWeight: weight,
      extraTechnologyWeightTons: 0,
      context: 'Motorvogn med 4 aksler eller flere, avstand 5,40-5,59 m',
      notes: ['Fotnote 2 og 3 er oppfylt, sÃ¥ 4-akslet rad brukes direkte.'],
    };
  }

  if (totalAxleDistanceMm < 5800) {
    const weight = getWeightByProfile(
      {
        Bk10_50: 31,
        Bk10_42: 31,
        BkT8_50: 27,
        BkT8_40: 27,
        Bk8_32: 23,
        Bk6_28: 17,
      },
      roadProfile,
    );

    return {
      weight,
      baseWeight: weight,
      extraTechnologyWeightTons: 0,
      context: 'Motorvogn med 4 aksler eller flere, avstand 5,60-5,79 m',
      notes: ['Fotnote 2 og 3 er oppfylt, sÃ¥ 4-akslet rad brukes direkte.'],
    };
  }

  const weight = getWeightByProfile(
    {
      Bk10_50: 32,
      Bk10_42: 32,
      BkT8_50: 28,
      BkT8_40: 28,
      Bk8_32: 24,
      Bk6_28: 18,
    },
    roadProfile,
  );

  return {
    weight,
    baseWeight: weight,
    extraTechnologyWeightTons: 0,
    context: 'Motorvogn med 4 aksler eller flere, avstand 5,80 m eller st?rre',
    notes: ['Fotnote 2 og 3 er oppfylt, s? 4-akslet rad brukes direkte.'],
  };
}

function getMidpointDistanceMm(groupCount: number, distances: number[]): number | null {
  if (groupCount < 2 || distances.length === 0) {
    return null;
  }

  if (groupCount === 2) {
    if (distances.length === 1) {
      return distances[0];
    }

    if (distances.length === 2) {
      return distances[0] + distances[1] / 2;
    }

    if (distances.length === 3) {
      return distances[0] / 2 + distances[1] + distances[2] / 2;
    }
  }

  if (groupCount === 3 && distances.length === 2) {
    return distances[0] + distances[1] / 2;
  }

  if (groupCount === 4 && distances.length === 3) {
    return distances[0] + distances[1] + distances[2] / 2;
  }

  return null;
}

function normalizeLtpGroups(
  axleCount: number,
  allowedLoads: number[],
  ownWeights: number[],
): { allowedLoads: number[]; ownWeights: number[] } {
  if (allowedLoads.length === ownWeights.length && allowedLoads.length >= 2) {
    return { allowedLoads, ownWeights };
  }

  if (axleCount === 3 && allowedLoads.length === 3 && ownWeights.length === 3) {
    return {
      allowedLoads: [allowedLoads[0], allowedLoads[1] + allowedLoads[2]],
      ownWeights: [ownWeights[0], ownWeights[1] + ownWeights[2]],
    };
  }

  if (axleCount === 4 && allowedLoads.length === 4 && ownWeights.length === 4) {
    return {
      allowedLoads: [allowedLoads[0] + allowedLoads[1], allowedLoads[2] + allowedLoads[3]],
      ownWeights: [ownWeights[0] + ownWeights[1], ownWeights[2] + ownWeights[3]],
    };
  }

  return { allowedLoads, ownWeights };
}

export function buildLtp(
  axleCount: number,
  allowedLoads: number[],
  ownWeights: number[],
  distances: number[],
  grossOwnWeightWithDriver: number,
): LtpResult {
  const normalizedGroups = normalizeLtpGroups(axleCount, allowedLoads, ownWeights);
  const resolvedAllowedLoads = normalizedGroups.allowedLoads;
  const resolvedOwnWeights = normalizedGroups.ownWeights;

  if (resolvedAllowedLoads.length !== resolvedOwnWeights.length) {
    return {
      status: 'invalid',
      ltpCm: null,
      rawLtpCm: null,
      message: 'Tillatt aksellast og egenvekt aksel mÃ¥ ha samme antall verdier.',
      frontPayloadKg: null,
      totalPayloadKg: null,
      midpointDistanceMm: null,
      netLoads: [],
      driverWeightKg: 0,
    };
  }

  if (resolvedAllowedLoads.length < 2) {
    return {
      status: 'missing',
      ltpCm: null,
      rawLtpCm: null,
      message: 'LTP trenger minst to lastgrupper for Ã¥ kunne beregnes.',
      frontPayloadKg: null,
      totalPayloadKg: null,
      midpointDistanceMm: null,
      netLoads: [],
      driverWeightKg: 0,
    };
  }

  if (distances.length === 0) {
    return {
      status: 'missing',
      ltpCm: null,
      rawLtpCm: null,
      message: 'Akselavstander mangler.',
      frontPayloadKg: null,
      totalPayloadKg: null,
      midpointDistanceMm: null,
      netLoads: [],
      driverWeightKg: 0,
    };
  }

  const summedOwnWeight = resolvedOwnWeights.reduce((sum, value) => sum + value, 0);
  const driverWeightKg = grossOwnWeightWithDriver - summedOwnWeight;

  if (driverWeightKg < -25) {
    return {
      status: 'invalid',
      ltpCm: null,
      rawLtpCm: null,
      message:
        'Egenvekt aksel er hÃ¸yere enn egenvekt med fÃ¸rer. Kontroller tallene fra vognkortet.',
      frontPayloadKg: null,
      totalPayloadKg: null,
      midpointDistanceMm: null,
      netLoads: [],
      driverWeightKg,
    };
  }

  const normalizedDriverWeightKg = Math.max(driverWeightKg, 0);
  const adjustedOwnWeights = resolvedOwnWeights.map((value, index) =>
    index === 0 ? value + normalizedDriverWeightKg : value,
  );
  const netLoads = resolvedAllowedLoads.map((load, index) => load - (adjustedOwnWeights[index] ?? 0));
  const frontPayloadKg = netLoads[0];
  const totalPayloadKg = netLoads.reduce((sum, value) => sum + value, 0);
  const midpointDistanceMm = getMidpointDistanceMm(resolvedAllowedLoads.length, distances);

  if (midpointDistanceMm === null) {
    return {
      status: 'invalid',
      ltpCm: null,
      rawLtpCm: null,
      message:
        'Denne kombinasjonen av lastgrupper og akselavstander kan ikke tolkes automatisk ennÃƒÂ¥.',
      frontPayloadKg,
      totalPayloadKg,
      midpointDistanceMm: null,
      netLoads,
      driverWeightKg: normalizedDriverWeightKg,
    };
  }

  if (frontPayloadKg <= 0) {
    return {
      status: 'invalid',
      ltpCm: null,
      rawLtpCm: null,
      message: 'Nyttelast foran mÃ¥ vÃ¦re stÃ¸rre enn 0.',
      frontPayloadKg,
      totalPayloadKg,
      midpointDistanceMm,
      netLoads,
      driverWeightKg: normalizedDriverWeightKg,
    };
  }

  if (totalPayloadKg <= 0) {
    return {
      status: 'invalid',
      ltpCm: null,
      rawLtpCm: null,
      message: 'Samlet nyttelast mÃ¥ vÃ¦re stÃ¸rre enn 0.',
      frontPayloadKg,
      totalPayloadKg,
      midpointDistanceMm,
      netLoads,
      driverWeightKg: normalizedDriverWeightKg,
    };
  }

  const rawLtpCm = (frontPayloadKg * midpointDistanceMm) / totalPayloadKg / 10;
  const ltpCm = Math.ceil(rawLtpCm);

  return {
    status: 'ready',
    ltpCm,
    rawLtpCm,
    message: 'LTP er beregnet automatisk fra vognkortverdiene og rundet opp til nÃ¦rmeste hele cm.',
    frontPayloadKg,
    totalPayloadKg,
    midpointDistanceMm,
    netLoads,
    driverWeightKg: normalizedDriverWeightKg,
  };
}

export function buildSemiTrailerLtp(
  tractorAllowedWeightKg: number | null,
  tractorOwnWeightKg: number | null,
  finalAllowedWeightKg: number,
  combinedOwnWeightKg: number | null,
  kingpinToBogieCenterMm: number | null,
): SemiTrailerLtpResult {
  if (tractorAllowedWeightKg === null || tractorOwnWeightKg === null || combinedOwnWeightKg === null) {
    return {
      status: 'missing',
      ltpCm: null,
      rawLtpCm: null,
      message: 'LTP for semi trailer trenger tillatt vekt og egenvekt for trekkvogn og trailer.',
      frontPayloadKg: null,
      totalPayloadKg: null,
      bogieDistanceMm: kingpinToBogieCenterMm,
    };
  }

  if (kingpinToBogieCenterMm === null) {
    return {
      status: 'missing',
      ltpCm: null,
      rawLtpCm: null,
      message: 'Legg inn avstanden fra kingpin / svingskive til midt pÃ¥ trailerboggien for Ã¥ fÃ¥ LTP.',
      frontPayloadKg: tractorAllowedWeightKg - tractorOwnWeightKg,
      totalPayloadKg: finalAllowedWeightKg - combinedOwnWeightKg,
      bogieDistanceMm: null,
    };
  }

  if (!Number.isFinite(kingpinToBogieCenterMm) || kingpinToBogieCenterMm <= 0) {
    return {
      status: 'invalid',
      ltpCm: null,
      rawLtpCm: null,
      message: 'Avstanden fra kingpin til boggisenter mÃ¥ vÃ¦re stÃ¸rre enn 0 mm.',
      frontPayloadKg: tractorAllowedWeightKg - tractorOwnWeightKg,
      totalPayloadKg: finalAllowedWeightKg - combinedOwnWeightKg,
      bogieDistanceMm: kingpinToBogieCenterMm,
    };
  }

  const frontPayloadKg = tractorAllowedWeightKg - tractorOwnWeightKg;
  const totalPayloadKg = finalAllowedWeightKg - combinedOwnWeightKg;

  if (frontPayloadKg <= 0) {
    return {
      status: 'invalid',
      ltpCm: null,
      rawLtpCm: null,
      message: 'Nyttelast foran pÃ¥ trekkvognen mÃ¥ vÃ¦re stÃ¸rre enn 0.',
      frontPayloadKg,
      totalPayloadKg,
      bogieDistanceMm: kingpinToBogieCenterMm,
    };
  }

  if (totalPayloadKg <= 0) {
    return {
      status: 'invalid',
      ltpCm: null,
      rawLtpCm: null,
      message: 'Samlet nyttelast for vogntoget mÃ¥ vÃ¦re stÃ¸rre enn 0.',
      frontPayloadKg,
      totalPayloadKg,
      bogieDistanceMm: kingpinToBogieCenterMm,
    };
  }

  const rawLtpCm = (frontPayloadKg * kingpinToBogieCenterMm) / totalPayloadKg / 10;
  const ltpCm = Math.ceil(rawLtpCm);

  return {
    status: 'ready',
    ltpCm,
    rawLtpCm,
    message: 'LTP for semi trailer er beregnet og rundet opp til nÃ¦rmeste hele cm.',
    frontPayloadKg,
    totalPayloadKg,
    bogieDistanceMm: kingpinToBogieCenterMm,
  };
}
