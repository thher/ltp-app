// Core union types
export type VehicleType = 'truck' | 'semiTrailer' | 'specialTransport' | 'bus' | 'articulatedBus';

export type AxleCount = '2' | '3' | '4' | '5';

export type RoadProfile = 'Bk10_50' | 'Bk10_42' | 'BkT8_50' | 'BkT8_40' | 'Bk8_32' | 'Bk6_28';

export type Powertrain = 'diesel' | 'alternativeFuel' | 'zeroEmission';

export type WheelSetup = 'single' | 'double' | 'multiple';

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

export type FormField =
  | 'allowedAxleLoads'
  | 'axleOwnWeights'
  | 'axleDistances'
  | 'grossOwnWeightWithDriver';

// Form state
export type FormState = {
  allowedAxleLoads: string;
  axleOwnWeights: string;
  axleDistances: string;
  grossOwnWeightWithDriver: string;
};

// Vehicle lookup response from API
export type VehicleLookupResponse = {
  registration: string;
  vehicleCategory: string | null;
  vehicleLabel: string | null;
  axleCount: number | null;
  driveAxleCount: number | null;
  powertrainHint: Powertrain | null;
  technologyWeightKg: number | null;
  hasAirSuspension: boolean | null;
  frontWheelSetup: WheelSetup | null;
  rearWheelSetup: WheelSetup | null;
  hasTwoSteeringAxles: boolean | null;
  allDriveAxlesAtOrUnderNinePointFiveTons: boolean | null;
  seatCount: number | null;
  standingCount: number | null;
  allowedAxleLoads: string | null;
  axleOwnWeights: string | null;
  axleDistances: string | null;
  grossOwnWeightWithDriver: number | null;
  vehicleHeightMm: number | null;
  vehicleLengthMm: number | null;
  vehicleWidthMm: number | null;
  notes: string[];
};

// LTP result for standard truck/bus
export type LtpResult = {
  status: 'ready' | 'missing' | 'invalid';
  ltpCm: number | null;
  rawLtpCm: number | null;
  message: string;
  frontPayloadKg: number | null;
  totalPayloadKg: number | null;
  midpointDistanceMm: number | null;
  netLoads: number[];
  driverWeightKg: number;
};

// LTP result for semi trailer
export type SemiTrailerLtpResult = {
  status: 'ready' | 'missing' | 'invalid';
  ltpCm: number | null;
  rawLtpCm: number | null;
  message: string;
  frontPayloadKg: number | null;
  totalPayloadKg: number | null;
  bogieDistanceMm: number | null;
};

// Bus passenger load result
export type BusPassengerLoadResult = {
  status: 'ready' | 'missing' | 'invalid';
  seatedPassengerCount: number | null;
  standingPassengerCount: number | null;
  passengerCount: number | null;
  passengerWeightKg: number | null;
  availablePayloadKg: number | null;
  remainingLoadKg: number | null;
  perPersonLoadKg: number | null;
  message: string;
};

// Main result for truck/bus calculation
export type Result = {
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

// Result for semi trailer combination
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
