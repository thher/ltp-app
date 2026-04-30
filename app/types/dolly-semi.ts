// Dolly-Semitrailer special transport types
// Covers: dolly_semitrailer_2, dolly_semitrailer_3, dolly_semitrailer_4_plus

import type { RoadProfile } from './common';
import type { SemiTrailerLtpResult } from './results';

export type DollySemiAxleConfiguration = '2' | '3' | '4+';

export type DollySemiResult = {
  axleConfiguration: DollySemiAxleConfiguration;
  tractorAxles: number;
  dollyAxles: number;
  trailerAxles: number;
  minimumDistanceMeters: number;
  distanceBand: string;
  roadProfile: RoadProfile;
  tableWeightKg: number;
  finalAllowedWeightKg: number;
  tableContext: string;
  limitationReason: string;
  tractorAllowedWeightKg: number | null;
  tractorOwnWeightKg: number | null;
  dollyAllowedWeightKg: number | null;
  dollyOwnWeightKg: number | null;
  trailerAllowedWeightKg: number | null;
  trailerOwnWeightKg: number | null;
  totalCombinedCardWeightKg: number | null;
  totalCombinedOwnWeightKg: number | null;
  availablePayloadKg: number | null;
  kingpinToBogieCenterMm: number | null;
  ltp: SemiTrailerLtpResult;
  steps: string[];
};

export type DollySemiBand = {
  minDistance: number;
  maxDistance: number;
  bandLabel: string;
  minWeightKg: number;
  maxWeightKg: number;
};

export type DollySemiRow = {
  distance: number;
  allowedWeightKg: number;
  bandLabel: string;
};
