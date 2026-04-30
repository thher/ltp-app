// Vehicle-specific types

import type { Powertrain, WheelSetup } from './common';

export type TruckLayout = 'standard' | 'doubleSteerRearBogie';

export type AxleVariantKey =
  | 'truck_2_single'
  | 'truck_3_rear_bogie'
  | 'truck_4_rear_tridem'
  | 'truck_4_double_steer_bogie'
  | 'truck_5_double_steer_tridem'
  | 'bus_2_single'
  | 'bus_3_rear_bogie'
  | 'articulated_bus'
  | 'semi_1_axle'
  | 'semi_2_axle'
  | 'semi_2_axle_forced_steer'
  | 'semi_3_plus'
  | 'semi_bogie_forced_steer'
  | 'dolly_semitrailer_2'
  | 'dolly_semitrailer_3'
  | 'dolly_semitrailer_4_plus'
  | 'modular_timber';

export type TrailerFamily = 'semitrailer' | 'drawbar' | 'dollySemi' | 'moduleTimber';

export type VehicleLookupResponse = {
  registration: string;
  vehicleCategory: string | null;
  vehicleLabel: string | null;
  axleCount: number | null;
  driveAxleCount: number | null;
  seatCount: number | null;
  standingCount: number | null;
  hasAirSuspension: boolean | null;
  frontWheelSetup: WheelSetup | null;
  rearWheelSetup: WheelSetup | null;
  hasTwoSteeringAxles: boolean | null;
  allDriveAxlesAtOrUnderNinePointFiveTons: boolean | null;
  allowedAxleLoads: string | null;
  axleOwnWeights: string | null;
  axleDistances: string | null;
  grossOwnWeightWithDriver: number | null;
  vehicleHeightMm: number | null;
  vehicleLengthMm: number | null;
  vehicleWidthMm: number | null;
  powertrainHint: Powertrain | null;
  technologyWeightKg: number | null;
  notes: string[];
  rawFound: boolean;
};
