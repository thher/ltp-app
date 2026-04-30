// Result and calculation types

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

export type SemiTrailerLtpResult = {
  status: 'ready' | 'missing' | 'invalid';
  ltpCm: number | null;
  rawLtpCm: number | null;
  message: string;
  frontPayloadKg: number | null;
  totalPayloadKg: number | null;
  bogieDistanceMm: number | null;
};
