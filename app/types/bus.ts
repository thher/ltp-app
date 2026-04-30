// Bus-specific types

import type { RoadProfile, Powertrain, VehicleType } from './common';
import type { LtpResult, BusPassengerLoadResult } from './results';

export type BusResult = {
  vehicleType: VehicleType;
  axleCount: number;
  roadProfile: RoadProfile;
  powertrain: Powertrain;
  totalAxleDistanceMm: number;
  totalAxleDistanceMeters: number;
  tableWeightTons: number;
  extraTechnologyWeightTons: number;
  totalWeightWithTechnologyTons: number;
  tableContext: string;
  weightRuleNotes: string[];
  allowedLoads: number[];
  ownWeights: number[];
  distances: number[];
  grossOwnWeightWithDriver: number;
  ltp: LtpResult;
  busPassengerLoad: BusPassengerLoadResult | null;
  steps: string[];
};

export type ArticulatedBusResult = BusResult;
