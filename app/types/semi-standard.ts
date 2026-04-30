// Standard Semi-trailer types (non-special)

import type { RoadProfile } from './common';
import type { SemiTrailerLtpResult } from './results';

export type SemiTrailerResult = {
  tractorAxles: number;
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
  trailerAllowedWeightKg: number | null;
  trailerOwnWeightKg: number | null;
  combinationCardWeightKg: number | null;
  combinedCardWeightKg: number | null;
  combinedOwnWeightKg: number | null;
  availablePayloadKg: number | null;
  kingpinToBogieCenterMm: number | null;
  ltp: SemiTrailerLtpResult;
  steps: string[];
};

export type SemiStandardResult = SemiTrailerResult;

export type SemiTrailerBand = {
  minDistance: number;
  maxDistance: number;
  bandLabel: string;
  minWeightKg: number;
  maxWeightKg: number;
};

export type SemiStandardBand = SemiTrailerBand;

export type SemiTrailerRow = {
  distance: number;
  allowedWeightKg: number;
  bandLabel: string;
};

export type SemiStandardRow = SemiTrailerRow;
