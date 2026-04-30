// Modular Timber transport types
// Specialized for timber/modular wagon combinations

import type { RoadProfile } from './common';
import type { SemiTrailerLtpResult } from './results';

export type ModularTimberResult = {
  moduleCount: number;
  totalModuleAxles: number;
  tractorAxles: number;
  minimumDistanceMeters: number;
  distanceBand: string;
  roadProfile: RoadProfile;
  tableWeightKg: number;
  finalAllowedWeightKg: number;
  tableContext: string;
  limitationReason: string;
  tractorAllowedWeightKg: number | null;
  tractorOwnWeightKg: number | null;
  moduleAllowedWeightKg: number | null;
  moduleOwnWeightKg: number | null;
  totalCombinedCardWeightKg: number | null;
  totalCombinedOwnWeightKg: number | null;
  availablePayloadKg: number | null;
  kingpinToBogieCenterMm: number | null;
  ltp: SemiTrailerLtpResult;
  steps: string[];
};

export type ModularTimberBand = {
  minDistance: number;
  maxDistance: number;
  bandLabel: string;
  minWeightKg: number;
  maxWeightKg: number;
};

export type ModularTimberRow = {
  distance: number;
  allowedWeightKg: number;
  bandLabel: string;
};

export type ModuleSpecification = {
  moduleNumber: number;
  axleCount: number;
  wheelSetup: 'single' | 'double';
  allowedWeightKg: number;
  ownWeightKg: number;
};
