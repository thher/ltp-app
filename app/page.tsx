'use client';

import { ChangeEvent, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import type {
  VehicleType,
  AxleCount,
  RoadProfile,
  Powertrain,
  WheelSetup,
  TruckLayout,
  AxleVariantKey,
  TrailerFamily,
  VehicleLookupResponse,
  FormField,
  FormState,
  Result,
  SemiTrailerResult,
} from './types';
import {
  AXLE_VARIANT_OPTIONS,
  FIELD_EXAMPLES,
  FIELD_EXAMPLES_EN,
  FIELD_HELP,
  FIELD_HELP_EN,
  FIELD_LABELS,
  FIELD_LABELS_EN,
  FIELD_UNITS,
  INITIAL_FORM,
  POWERTRAIN_OPTIONS,
  ROAD_PROFILES,
  TRAILER_FAMILY_OPTIONS,
  VEHICLE_OPTIONS,
  WHEEL_SETUP_OPTIONS,
} from './constants';
import { GlobalTopControls } from './components/controls';
import { DrivingRestSection, RouteCheckFutureSection } from './components/route-check';
import { AxleWeightTable, VehicleAxleVisual } from './components/vehicle-display';
import {
  buildAxleWeightRows,
  buildBusPassengerLoad,
  buildLtp,
  buildSemiTrailerLtp,
  deriveCalculatedAxleRows,
  getCalculationAxleCount,
  getRoadProfileLabel,
  getSemiTrailerTableWeight,
  getUnsupportedCalculationMessage,
  getVehicleTableWeight,
  parseDisplayWeights,
  parseSlashSeparated,
} from './lib/calculations';
import { tx, translateRuntimeText, type Language } from './lib/i18n';

function getVehicleText(vehicleType: VehicleType, language: Language) {
  const text: Record<VehicleType, { label: string; description: string; labelEn: string; descriptionEn: string }> = {
    truck: {
      label: 'Lastebil',
      description: 'Bruk for motorvogn / lastebil.',
      labelEn: 'Truck',
      descriptionEn: 'Use for rigid trucks / motor vehicles.',
    },
    semiTrailer: {
      label: 'Semi trailer',
      description: 'Bruk for trekkvogn med semitrailer / vogntog.',
      labelEn: 'Semi trailer',
      descriptionEn: 'Use for tractor unit with semitrailer / vehicle combination.',
    },
    specialTransport: {
      label: 'Spesialtyper',
      description: 'Modulvogntog, tømmer, dolly/semi og andre spesialrader.',
      labelEn: 'Special types',
      descriptionEn: 'Modular combinations, timber, dolly/semi and other special rows.',
    },
    bus: {
      label: 'Buss',
      description: 'Bruk for buss med 2 eller 3 aksler.',
      labelEn: 'Bus',
      descriptionEn: 'Use for buses with 2 or 3 axles.',
    },
    articulatedBus: {
      label: 'Leddbuss',
      description: 'Bruk for leddbuss.',
      labelEn: 'Articulated bus',
      descriptionEn: 'Use for articulated buses.',
    },
  };

  const value = text[vehicleType];

  return {
    label: tx(language, value.label, value.labelEn),
    description: tx(language, value.description, value.descriptionEn),
  };
}

function getVehiclePhotoPath(vehicleType: VehicleType) {
  const paths: Record<VehicleType, string> = {
    truck: '/images/truck-photo-v1.png',
    semiTrailer: '/images/semi-trailer-photo-v1.png',
    bus: '/images/bus-photo-v1.png',
    articulatedBus: '/images/articulated-bus-photo-v1.png',
    specialTransport: '/images/special-transport-photo-v1.png',
  };

  return paths[vehicleType];
}

function getVehiclePhotoAlt(vehicleType: VehicleType, language: Language) {
  const label = getVehicleText(vehicleType, language).label;
  return tx(language, `Fotoillustrasjon av ${label}`, `Photo illustration of ${label}`);
}

function isVogntogVehicle(vehicleType: VehicleType) {
  return vehicleType === 'semiTrailer' || vehicleType === 'specialTransport';
}

function getTrailerVariantOptions(trailerFamily: TrailerFamily) {
  if (trailerFamily === 'dollySemi') {
    return AXLE_VARIANT_OPTIONS.filter((option) =>
      ['dolly_semitrailer_2', 'dolly_semitrailer_3', 'dolly_semitrailer_4_plus'].includes(option.value),
    );
  }

  if (trailerFamily === 'moduleTimber') {
    return AXLE_VARIANT_OPTIONS.filter((option) => option.value === 'modular_timber');
  }

  return AXLE_VARIANT_OPTIONS.filter((option) =>
    ['semi_1_axle', 'semi_2_axle', 'semi_2_axle_forced_steer', 'semi_3_plus', 'semi_bogie_forced_steer'].includes(
      option.value,
    ),
  );
}

function getTrailerAxlesFromVariant(variant: AxleVariantKey) {
  if (variant === 'semi_1_axle') {
    return '1';
  }

  if (variant === 'semi_2_axle' || variant === 'semi_2_axle_forced_steer' || variant === 'dolly_semitrailer_2') {
    return '2';
  }

  if (variant === 'dolly_semitrailer_4_plus') {
    return '4';
  }

  return '3';
}


/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
function getVognkortChecklist(vehicleType: VehicleType, language: Language): string[] {
  if (isVogntogVehicle(vehicleType)) {
    return [
      tx(language, 'Trekkvogn punkt 8: Tillatt totalvekt og aksellast', 'Tractor point 8: Allowed total weight and axle loads'),
      tx(language, 'Trekkvogn punkt 9: Akselavstander i mm', 'Tractor point 9: Axle distances in mm'),
      tx(language, 'Trekkvogn punkt 12: Antall aksler', 'Tractor point 12: Number of axles'),
      tx(language, 'Semitrailer vognkort: Tillatt totalvekt', 'Semitrailer card: Allowed total weight'),
      tx(language, 'Semitrailer vognkort: Antall aksler', 'Semitrailer card: Number of axles'),
      tx(language, 'Vegliste: Minsteavstand og bruksklasse', 'Road list: Minimum distance and road class'),
    ];
  }

  const common = [
    tx(language, 'Punkt 8: Tillatt aksellast', 'Point 8: Allowed axle load'),
    tx(language, 'Punkt 8: Egenvekt aksel', 'Point 8: Axle own weight'),
    tx(language, 'Punkt 8: Egenvekt med forer', 'Point 8: Gross own weight with driver'),
    tx(language, 'Punkt 9: Akselavstander i mm', 'Point 9: Axle distances in mm'),
    tx(language, 'Punkt 12: Antall aksler', 'Point 12: Number of axles'),
  ];

  if (vehicleType === 'truck') {
    return [
      ...common,
      tx(language, 'Punkt 12: Antall aksler med drift', 'Point 12: Number of driven axles'),
      tx(language, 'Punkt 15: Merknader om styrende eller friksjonsstyrt aksel', 'Point 15: Notes about steering or friction-steered axle'),
    ];
  }

  if (vehicleType === 'articulatedBus') {
    return [
      ...common,
      tx(language, 'Punkt 11: Sitteplasser og ståplasser', 'Point 11: Seating and standing places'),
      tx(language, 'Punkt 15: Merknader hvis aksler eller plassering er spesielle', 'Point 15: Notes if axles or placement are special'),
    ];
  }

  if (vehicleType === 'bus') {
    return [
      ...common,
      tx(language, 'Punkt 11: Sitteplasser og ståplasser', 'Point 11: Seating and standing places'),
      tx(language, 'Punkt 15 bare hvis det star noe ekstra om aksler eller spesielle merknader', 'Point 15 only if there is something extra about axles or special notes'),
    ];
  }

  return [...common, tx(language, 'Punkt 15 bare hvis det star noe ekstra om aksler eller spesielle merknader', 'Point 15 only if there is something extra about axles or special notes')];
}

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('nb-NO', {
    maximumFractionDigits: digits,
  }).format(value);
}

function getDefaultAxleVariant(vehicleType: VehicleType, axleCount: AxleCount): AxleVariantKey {
  if (vehicleType === 'truck') {
    if (axleCount === '2') {
      return 'truck_2_single';
    }

    if (axleCount === '3') {
      return 'truck_3_rear_bogie';
    }

    if (axleCount === '5') {
      return 'truck_5_double_steer_tridem';
    }

    return 'truck_4_rear_tridem';
  }

  if (vehicleType === 'bus') {
    return axleCount === '3' ? 'bus_3_rear_bogie' : 'bus_2_single';
  }

  if (vehicleType === 'articulatedBus') {
    return 'articulated_bus';
  }

  if (vehicleType === 'specialTransport') {
    return 'modular_timber';
  }

  return 'semi_3_plus';
}

function getAxleVariantOptions(vehicleType: VehicleType) {
  return AXLE_VARIANT_OPTIONS.filter((option) => option.vehicleTypes.includes(vehicleType));
}

function getAxleVariant(value: AxleVariantKey) {
  return AXLE_VARIANT_OPTIONS.find((option) => option.value === value) ?? AXLE_VARIANT_OPTIONS[0];
}

function applyAxleVariant(
  nextVariant: AxleVariantKey,
  setAxleVariant: (value: AxleVariantKey) => void,
  setAxleCount: (value: AxleCount) => void,
  setTruckLayout: (value: TruckLayout) => void,
  setHasTwoSteeringAxles: (value: boolean) => void,
) {
  setAxleVariant(nextVariant);

  if (nextVariant === 'truck_4_double_steer_bogie') {
    setAxleCount('4');
    setTruckLayout('doubleSteerRearBogie');
    setHasTwoSteeringAxles(true);
  } else if (nextVariant === 'truck_5_double_steer_tridem') {
    setAxleCount('5');
    setTruckLayout('doubleSteerRearBogie');
    setHasTwoSteeringAxles(true);
  } else if (nextVariant === 'truck_4_rear_tridem') {
    setAxleCount('4');
    setTruckLayout('standard');
    setHasTwoSteeringAxles(false);
  } else if (nextVariant === 'truck_3_rear_bogie' || nextVariant === 'bus_3_rear_bogie') {
    setAxleCount('3');
    setTruckLayout('standard');
    setHasTwoSteeringAxles(false);
  } else if (nextVariant === 'truck_2_single' || nextVariant === 'bus_2_single') {
    setAxleCount('2');
    setTruckLayout('standard');
    setHasTwoSteeringAxles(false);
  }
}

function mapVehicleTypeFromLookup(category: string | null, label: string | null): VehicleType | null {
  const combined = `${category ?? ''} ${label ?? ''}`.toLowerCase();

  if (combined.includes('leddbuss')) {
    return 'articulatedBus';
  }

  if (combined.includes('buss')) {
    return 'bus';
  }

  if (
    combined.includes('lastebil') ||
    combined.includes('motorvogn') ||
    combined.includes('n2') ||
    combined.includes('n3')
  ) {
    return 'truck';
  }

  return null;
}

function InputField({
  name,
  value,
  onChange,
  language,
}: {
  name: FormField;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  language: Language;
}) {
  return (
    <label className="field-card">
      <span className="field-header">
        <span>{tx(language, FIELD_LABELS[name], FIELD_LABELS_EN[name])}</span>
        <span className="field-unit">{FIELD_UNITS[name]}</span>
      </span>
      <input
        name={name}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={tx(language, FIELD_EXAMPLES[name], FIELD_EXAMPLES_EN[name])}
        className="field-input"
      />
      <span className="field-source">{tx(language, FIELD_HELP[name], FIELD_HELP_EN[name])}</span>
    </label>
  );
}

export default function Home() {
  const [screen, setScreen] = useState<'plate' | 'choose' | 'calculator'>('plate');
  const [language, setLanguage] = useState<Language>('no');
  const [vehicleType, setVehicleType] = useState<VehicleType>('truck');
  const [axleCount, setAxleCount] = useState<AxleCount>('4');
  const [roadProfile, setRoadProfile] = useState<RoadProfile>('Bk10_50');
  const [powertrain, setPowertrain] = useState<Powertrain>('diesel');
  const [, setTruckLayout] = useState<TruckLayout>('standard');
  const [axleVariant, setAxleVariant] = useState<AxleVariantKey>('truck_4_rear_tridem');
  const [trailerFamily, setTrailerFamily] = useState<TrailerFamily>('semitrailer');
  const [technologyWeight, setTechnologyWeight] = useState('');
  const [busSeatCount, setBusSeatCount] = useState('');
  const [busStandingCount, setBusStandingCount] = useState('');
  const [busPassengerWeightKg, setBusPassengerWeightKg] = useState('75');
  const [hasAirSuspension, setHasAirSuspension] = useState(true);
  const [driveAxleCount, setDriveAxleCount] = useState('1');
  const [frontWheelSetup, setFrontWheelSetup] = useState<WheelSetup>('single');
  const [rearWheelSetup, setRearWheelSetup] = useState<WheelSetup>('double');
  const [allDriveAxlesAtOrUnderNinePointFiveTons, setAllDriveAxlesAtOrUnderNinePointFiveTons] = useState(false);
  const [hasTwoSteeringAxles, setHasTwoSteeringAxles] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState<Result | null>(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [routeFrom, setRouteFrom] = useState('');
  const [routeTo, setRouteTo] = useState('');
  const [plannedDeparture, setPlannedDeparture] = useState('');
  const [drivingUsedTodayHours, setDrivingUsedTodayHours] = useState('0');
  const [pendingTripCalculation, setPendingTripCalculation] = useState(false);
  const [tripCalculationKey, setTripCalculationKey] = useState(0);
  const handleCalculateRef = useRef<() => void>(() => undefined);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState('');
  const [lookupNotes, setLookupNotes] = useState<string[]>([]);
  const [routeVehicleLookup, setRouteVehicleLookup] = useState<VehicleLookupResponse | null>(null);
  const [semiTrailerForm, setSemiTrailerForm] = useState({
    tractorAxles: '2',
    trailerAxles: '3',
    minimumDistanceMeters: '',
    kingpinToBogieCenterMm: '',
    tractorAllowedWeightKg: '',
    tractorOwnWeightKg: '',
    trailerAllowedWeightKg: '',
    trailerOwnWeightKg: '',
    combinationCardWeightKg: '',
    trailerAllowedAxleLoads: '',
    trailerAxleOwnWeights: '',
  });
  const [trailerRegistrationNumber, setTrailerRegistrationNumber] = useState('');
  const [trailerLookupLoading, setTrailerLookupLoading] = useState(false);
  const [trailerLookupMessage, setTrailerLookupMessage] = useState('');
  const [trailerLookupNotes, setTrailerLookupNotes] = useState<string[]>([]);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [semiTrailerResult, setSemiTrailerResult] = useState<SemiTrailerResult | null>(null);
  const [error, setError] = useState('');

  const resolvedAxleCount = getCalculationAxleCount(vehicleType, axleVariant, axleCount);
  const hasTwinWheelsOnDriveAxles = rearWheelSetup !== 'single';
  const routeCheckTotalWeight =
    routeVehicleLookup?.allowedAxleLoads
      ?.split('/')
      .map((value) => Number(value.replace(',', '.')))
      .filter((value) => Number.isFinite(value) && value > 0)
      .reduce((sum, value) => sum + value, 0) ?? null;
  const formatRouteDimension = (valueMm: number | null | undefined) =>
    valueMm !== null && valueMm !== undefined ? `${formatNumber(valueMm / 1000, 2)} m` : '';
  const routeCheckPrefill = {
    vehicleHeight: formatRouteDimension(routeVehicleLookup?.vehicleHeightMm),
    vehicleLength: formatRouteDimension(routeVehicleLookup?.vehicleLengthMm),
    vehicleWidth: formatRouteDimension(routeVehicleLookup?.vehicleWidthMm),
    totalWeight: routeCheckTotalWeight ? `${formatNumber(routeCheckTotalWeight, 0)} kg` : '',
    roadClass: roadProfile,
  };
  const showTechnologyWeightInput = powertrain !== 'diesel';
  const isTruck = vehicleType === 'truck';
  const isBusVehicle = vehicleType === 'bus' || vehicleType === 'articulatedBus';
  const isSpecialTransport = vehicleType === 'specialTransport';
  const showAdvancedOptions = isTruck || showTechnologyWeightInput;
  const selectedVehicle = VEHICLE_OPTIONS.find((option) => option.value === vehicleType);
  const selectedVehicleText = selectedVehicle ? getVehicleText(selectedVehicle.value, language) : null;
  const trailerAllowedDisplayWeights = parseDisplayWeights(semiTrailerForm.trailerAllowedAxleLoads);
  const trailerOwnDisplayWeights = parseDisplayWeights(semiTrailerForm.trailerAxleOwnWeights);
  const trailerAxleWeightRows = buildAxleWeightRows(trailerAllowedDisplayWeights, trailerOwnDisplayWeights);
  const vehicleAxleDerivation = result
    ? deriveCalculatedAxleRows({
        baseAllowedLoads: result.allowedLoads,
        ownWeights: result.ownWeights,
        targetAllowedTotalKg: result.totalWeightWithTechnologyTons * 1000,
        language,
        missingRuleMessage: tx(
          language,
          'Mangler beregnet totalvekt fra valgt kjøretøytype, akseloppsett og bruksklasse.',
          'Missing calculated total weight from the selected vehicle type, axle setup and road class.',
        ),
      })
    : { rows: [], warnings: [] };
  const trailerTargetAllowedTotalKg =
    semiTrailerResult && semiTrailerResult.tractorAllowedWeightKg !== null
      ? Math.max(semiTrailerResult.finalAllowedWeightKg - semiTrailerResult.tractorAllowedWeightKg, 0)
      : null;
  const trailerAxleDerivation = deriveCalculatedAxleRows({
    baseAllowedLoads: trailerAllowedDisplayWeights,
    ownWeights: trailerOwnDisplayWeights,
    targetAllowedTotalKg: trailerTargetAllowedTotalKg,
    language,
    missingRuleMessage: semiTrailerResult
      ? tx(
          language,
          'Mangler tillatt totalvekt for trekkvogn. Da kan ikke beregnet vogntogvekt fordeles til traileraksler.',
          'Missing allowed total weight for the tractor. The calculated combination weight cannot be distributed to trailer axles.',
        )
      : tx(
          language,
          'Ingen trailerregel er beregnet i denne flyten. Bruk semi-trailer-flyten for beregnet traileraksellast.',
          'No trailer rule is calculated in this flow. Use the semi-trailer flow for calculated trailer axle load.',
        ),
  });

  const handleVehicleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const nextType = event.target.value as VehicleType;
    setVehicleType(nextType);
    setResult(null);
    setSemiTrailerResult(null);
    setTripCalculationKey(0);
    setError('');
    setTruckLayout('standard');
    setHasTwoSteeringAxles(false);

    if (nextType === 'bus') {
      setAxleCount('2');
      setAxleVariant('bus_2_single');
    } else if (nextType === 'articulatedBus') {
      setAxleCount('3');
      setAxleVariant('articulated_bus');
    } else if (nextType === 'semiTrailer') {
      setAxleVariant('semi_3_plus');
      setTrailerFamily('semitrailer');
    } else if (nextType === 'specialTransport') {
      setAxleVariant('modular_timber');
      setTrailerFamily('moduleTimber');
      setSemiTrailerForm((current) => ({ ...current, trailerAxles: '4' }));
    } else {
      setAxleVariant(getDefaultAxleVariant(nextType, axleCount));
    }

  };

  const handleVehicleCardSelect = (nextType: VehicleType) => {
    setVehicleType(nextType);
    setResult(null);
    setSemiTrailerResult(null);
    setTripCalculationKey(0);
    setError('');

    if (nextType === 'bus') {
      setAxleCount('2');
      setAxleVariant('bus_2_single');
    } else if (nextType === 'articulatedBus') {
      setAxleCount('3');
      setAxleVariant('articulated_bus');
    } else if (nextType === 'semiTrailer') {
      setAxleVariant('semi_3_plus');
      setTrailerFamily('semitrailer');
    } else if (nextType === 'specialTransport') {
      setAxleVariant('modular_timber');
      setTrailerFamily('moduleTimber');
      setSemiTrailerForm((current) => ({ ...current, trailerAxles: '4' }));
    } else {
      setAxleVariant(getDefaultAxleVariant(nextType, axleCount));
    }

    setTruckLayout('standard');
    setHasTwoSteeringAxles(false);

    setScreen('calculator');
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSemiTrailerInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setSemiTrailerForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleRegistrationLookup = async () => {
    const normalizedRegistration = registrationNumber.trim().toUpperCase().replace(/\s+/g, '');

    if (!normalizedRegistration) {
      setLookupMessage(tx(language, 'Skriv inn registreringsnummer først.', 'Enter registration number first.'));
      setLookupNotes([]);
      return false;
    }

    setLookupLoading(true);
    setLookupMessage('');
    setLookupNotes([]);

    try {
      const response = await fetch(`/api/vehicle?registration=${encodeURIComponent(normalizedRegistration)}`);
      const payload = (await response.json()) as
        | { vehicle?: VehicleLookupResponse; message?: string; notes?: string[] }
        | { message?: string; notes?: string[] };

      if (!response.ok || !('vehicle' in payload) || !payload.vehicle) {
        setLookupMessage(translateRuntimeText(payload.message ?? tx(language, 'Fant ikke kjøretøydata for dette registreringsnummeret.', 'No vehicle data found for this registration number.'), language));
        setLookupNotes(payload.notes ?? []);
        return false;
      }

      const vehicle = payload.vehicle;
      setRouteVehicleLookup(vehicle);
      const nextVehicleType = mapVehicleTypeFromLookup(vehicle.vehicleCategory, vehicle.vehicleLabel);

      if (nextVehicleType && nextVehicleType !== 'semiTrailer') {
        setVehicleType(nextVehicleType);

        if (nextVehicleType === 'bus') {
          setAxleCount('2');
        } else if (nextVehicleType === 'articulatedBus') {
          setAxleCount('3');
        } else if (vehicle.axleCount && vehicle.axleCount >= 2 && vehicle.axleCount <= 5) {
          setAxleCount(String(vehicle.axleCount) as AxleCount);
        }
      } else if (vehicle.axleCount && vehicle.axleCount >= 2 && vehicle.axleCount <= 5) {
        setAxleCount(String(vehicle.axleCount) as AxleCount);
      }

      if (vehicle.driveAxleCount && vehicle.driveAxleCount > 0) {
        setDriveAxleCount(String(Math.min(vehicle.driveAxleCount, 3)));
      }

      if (vehicle.powertrainHint) {
        setPowertrain(vehicle.powertrainHint);
      }

      if (vehicle.technologyWeightKg !== null) {
        setTechnologyWeight(String(vehicle.technologyWeightKg));
      }

      if (vehicle.hasAirSuspension !== null) {
        setHasAirSuspension(vehicle.hasAirSuspension);
      }

      if (vehicle.frontWheelSetup) {
        setFrontWheelSetup(vehicle.frontWheelSetup);
      }

      if (vehicle.rearWheelSetup) {
        setRearWheelSetup(vehicle.rearWheelSetup);
      }

      if (vehicle.hasTwoSteeringAxles !== null) {
        setHasTwoSteeringAxles(vehicle.hasTwoSteeringAxles);
      }

      if (
        (nextVehicleType === 'truck' || (!nextVehicleType && vehicleType === 'truck')) &&
        vehicle.axleCount &&
        vehicle.axleCount >= 2 &&
        vehicle.axleCount <= 5
      ) {
        const lookupAxleCount = String(vehicle.axleCount) as AxleCount;
        if (lookupAxleCount === '4' && vehicle.hasTwoSteeringAxles) {
          setAxleVariant('truck_4_double_steer_bogie');
        } else if (lookupAxleCount === '5') {
          setAxleVariant('truck_5_double_steer_tridem');
        } else {
          setAxleVariant(getDefaultAxleVariant('truck', lookupAxleCount));
        }
      }

      if (vehicle.allDriveAxlesAtOrUnderNinePointFiveTons !== null) {
        setAllDriveAxlesAtOrUnderNinePointFiveTons(vehicle.allDriveAxlesAtOrUnderNinePointFiveTons);
      }

      if (nextVehicleType === 'bus' || nextVehicleType === 'articulatedBus') {
        if (vehicle.seatCount !== null) {
          setBusSeatCount(String(Math.max(vehicle.seatCount - 1, 0)));
        }

        if (vehicle.standingCount !== null) {
          setBusStandingCount(String(vehicle.standingCount));
        }
      }

      setForm((current) => ({
        ...current,
        allowedAxleLoads: vehicle.allowedAxleLoads ?? current.allowedAxleLoads,
        axleOwnWeights: vehicle.axleOwnWeights ?? current.axleOwnWeights,
        axleDistances: vehicle.axleDistances ?? current.axleDistances,
        grossOwnWeightWithDriver:
          vehicle.grossOwnWeightWithDriver !== null
            ? String(vehicle.grossOwnWeightWithDriver)
            : current.grossOwnWeightWithDriver,
      }));

      setResult(null);
      setSemiTrailerResult(null);
      setError('');
      setScreen('calculator');
      setLookupMessage(tx(language, `Data hentet for ${vehicle.registration}. Feltene er fylt inn så langt API-et ga treff.`, `Data fetched for ${vehicle.registration}. Fields were filled as far as the API provided matches.`));
      setLookupNotes(vehicle.notes);
      return true;
    } catch {
      setLookupMessage(tx(language, 'Kunne ikke hente kjøretøydata akkurat nå.', 'Could not fetch vehicle data right now.'));
      setLookupNotes([]);
      return false;
    } finally {
      setLookupLoading(false);
    }
  };

  const handleTrailerLookup = async () => {
    const normalizedRegistration = trailerRegistrationNumber.trim().toUpperCase().replace(/\s+/g, '');

    if (!normalizedRegistration) {
      setTrailerLookupMessage(tx(language, 'Skriv inn registreringsnummer for tilhenger først.', 'Enter trailer registration first.'));
      setTrailerLookupNotes([]);
      return;
    }

    setTrailerLookupLoading(true);
    setTrailerLookupMessage('');
    setTrailerLookupNotes([]);

    try {
      const response = await fetch(`/api/vehicle?registration=${encodeURIComponent(normalizedRegistration)}`);
      const payload = (await response.json()) as
        | { vehicle?: VehicleLookupResponse; message?: string; notes?: string[] }
        | { message?: string; notes?: string[] };

      if (!response.ok || !('vehicle' in payload) || !payload.vehicle) {
        setTrailerLookupMessage(translateRuntimeText(payload.message ?? tx(language, 'Fant ikke data for tilhengeren.', 'No trailer data found.'), language));
        setTrailerLookupNotes(payload.notes ?? []);
        return;
      }

      const vehicle = payload.vehicle;

      // Populate trailer-related fields when we have a trailer lookup
      setSemiTrailerForm((current) => {
        // Try to derive trailer total allowed weight by summing allowed axle loads when present
        let derivedTrailerAllowedKg = current.trailerAllowedWeightKg;
        let derivedTrailerOwnKg =
          vehicle.grossOwnWeightWithDriver !== null ? String(vehicle.grossOwnWeightWithDriver) : current.trailerOwnWeightKg;

        if (vehicle.allowedAxleLoads) {
          try {
            const parts = vehicle.allowedAxleLoads.split('/').map((p) => Number(p.replace(',', '.'))).filter(Boolean);
            if (parts.length > 0) {
              const sum = parts.reduce((s, v) => s + v, 0);
              derivedTrailerAllowedKg = String(Math.round(sum));
            }
          } catch {
            // ignore
          }
        }

        if (vehicle.grossOwnWeightWithDriver === null && vehicle.axleOwnWeights) {
          try {
            const parts = vehicle.axleOwnWeights.split('/').map((p) => Number(p.replace(',', '.'))).filter(Boolean);
            if (parts.length > 0) {
              const sum = parts.reduce((s, v) => s + v, 0);
              derivedTrailerOwnKg = String(Math.round(sum));
            }
          } catch {
            // ignore
          }
        }

        return {
          ...current,
          trailerAllowedWeightKg: derivedTrailerAllowedKg,
          trailerOwnWeightKg: derivedTrailerOwnKg,
          trailerAllowedAxleLoads: vehicle.allowedAxleLoads ?? current.trailerAllowedAxleLoads,
          trailerAxleOwnWeights: vehicle.axleOwnWeights ?? current.trailerAxleOwnWeights,
          trailerAxles: vehicle.axleCount ? String(vehicle.axleCount) : current.trailerAxles,
        };
      });

      setTrailerLookupMessage(`${tx(language, 'Tilhengerdata hentet for', 'Trailer data fetched for')} ${vehicle.registration}`);
      setTrailerLookupNotes(vehicle.notes ?? []);
    } catch {
      setTrailerLookupMessage(tx(language, 'Kunne ikke hente tilhengerdata akkurat nå.', 'Could not fetch trailer data right now.'));
      setTrailerLookupNotes([]);
    } finally {
      setTrailerLookupLoading(false);
    }
  };

  const handlePlateEntrySubmit = async () => {
    if (trailerRegistrationNumber.trim()) {
      await handleTrailerLookup();
    }

    const lookupSucceeded = await handleRegistrationLookup();
    if (lookupSucceeded) {
      setPendingTripCalculation(true);
    }
  };

  function translateErrorMessage(message: string, lang: Language) {
    if (!message) return message;
    // Simple pattern translations for common thrown messages
    if (message.startsWith('Feltet')) {
      // Examples: Feltet {label} må fylles ut.
      const fillMatch = message.match(/^Feltet (.+) må fylles ut\./);
      if (fillMatch) {
        return lang === 'en' ? `Field ${fillMatch[1]} must be filled out.` : message;
      }
      const minMatch = message.match(/^Feltet (.+) må inneholde minst én verdi\./);
      if (minMatch) {
        return lang === 'en' ? `Field ${minMatch[1]} must contain at least one value.` : message;
      }
      const invalidMatch = message.match(/^Feltet (.+) inneholder en ugyldig verdi: (.+)$/);
      if (invalidMatch) {
        return lang === 'en' ? `Field ${invalidMatch[1]} contains an invalid value: ${invalidMatch[2]}` : message;
      }
    }

    const map: Record<string, string> = {
      'Denne kombinasjonen av trekkvogn og semitrailer er ikke lagt inn ennå.':
        'This combination of tractor and semitrailer is not configured yet.',
      'Fant ikke riktig avstandsbånd for denne minsteavstanden.': 'Could not find matching distance band for this minimum distance.',
      'Minsteavstand må være et gyldig tall i meter.': 'Minimum distance must be a valid number in meters.',
      'Avstand fra kingpin til boggisenter må være et gyldig tall i mm.': 'Kingpin to bogie center distance must be a valid number in mm.',
      'Tillatt totalvekt for trekkvogn må være et gyldig tall i kg.': 'Allowed total weight for tractor must be a valid number in kg.',
      'Egenvekt for trekkvogn må være et gyldig tall i kg.': 'Own weight for tractor must be a valid number in kg.',
      'Tillatt totalvekt for semitrailer må være et gyldig tall i kg.': 'Allowed total weight for semitrailer must be a valid number in kg.',
      'Egenvekt for semitrailer må være et gyldig tall i kg.': 'Own weight for semitrailer must be a valid number in kg.',
      'Tillatt vogntogvekt må være et gyldig tall i kg.': 'Allowed combination weight must be a valid number in kg.',
      'Egenvekt med fører må være et gyldig tall i kg.': 'Gross own weight with driver must be a valid number in kg.',
      'Batteri-/teknologivekt må være et gyldig tall i kg.': 'Battery/technology weight must be a valid number in kg.',
    };

    return lang === 'en' && map[message] ? map[message] : message;
  }

  const handlePrint = () => {
    const summary = document.querySelector('.printable-summary');
    let printRoot: HTMLDivElement | null = null;

    try {
      if (summary) {
        printRoot = document.createElement('div');
        printRoot.className = 'print-export-root';
        printRoot.appendChild(summary.cloneNode(true));
        document.body.appendChild(printRoot);
        document.body.classList.add('is-printing-summary');
      }

      window.print();
    } catch {
      // ignore in non-browser environments
    } finally {
      document.body.classList.remove('is-printing-summary');
      printRoot?.remove();
    }
  };

  const handleResetSearch = () => {
    setRegistrationNumber('');
    setRouteFrom('');
    setRouteTo('');
    setTrailerRegistrationNumber('');
    setLookupMessage('');
    setLookupNotes([]);
    setRouteVehicleLookup(null);
    setTrailerLookupMessage('');
    setTrailerLookupNotes([]);
    setLookupLoading(false);
    setTrailerLookupLoading(false);
    setResult(null);
    setSemiTrailerResult(null);
    setForm(INITIAL_FORM);
    setSemiTrailerForm({
      tractorAxles: '2',
      trailerAxles: '3',
      minimumDistanceMeters: '',
      kingpinToBogieCenterMm: '',
      tractorAllowedWeightKg: '',
      tractorOwnWeightKg: '',
      trailerAllowedWeightKg: '',
      trailerOwnWeightKg: '',
      combinationCardWeightKg: '',
      trailerAllowedAxleLoads: '',
      trailerAxleOwnWeights: '',
    });
    setError('');
  };

  useEffect(() => {
    // Initialize theme from localStorage
    try {
      const stored = localStorage.getItem('ltp-theme');
      const next = stored === 'light' ? 'light' : 'dark';
      setTheme(next);
      document.documentElement.setAttribute('data-theme', next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('ltp-theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const handleCalculate = () => {
    try {
      if (isVogntogVehicle(vehicleType)) {
        const tractorAxles = Number(semiTrailerForm.tractorAxles);
        const trailerAxles = Number(semiTrailerForm.trailerAxles);
        const minimumDistanceMeters = Number(semiTrailerForm.minimumDistanceMeters.replace(',', '.'));
        const kingpinToBogieCenterMm =
          semiTrailerForm.kingpinToBogieCenterMm.trim() === ''
            ? null
            : Number(semiTrailerForm.kingpinToBogieCenterMm.replace(',', '.'));
        const tractorAllowedWeightKg =
          semiTrailerForm.tractorAllowedWeightKg.trim() === ''
            ? null
            : Number(semiTrailerForm.tractorAllowedWeightKg.replace(',', '.'));
        const tractorOwnWeightKg =
          semiTrailerForm.tractorOwnWeightKg.trim() === ''
            ? null
            : Number(semiTrailerForm.tractorOwnWeightKg.replace(',', '.'));
        const trailerAllowedWeightKg =
          semiTrailerForm.trailerAllowedWeightKg.trim() === ''
            ? null
            : Number(semiTrailerForm.trailerAllowedWeightKg.replace(',', '.'));
        const trailerOwnWeightKg =
          semiTrailerForm.trailerOwnWeightKg.trim() === ''
            ? null
            : Number(semiTrailerForm.trailerOwnWeightKg.replace(',', '.'));
        const combinationCardWeightKg =
          semiTrailerForm.combinationCardWeightKg.trim() === ''
            ? null
            : Number(semiTrailerForm.combinationCardWeightKg.replace(',', '.'));

        if (!Number.isFinite(minimumDistanceMeters) || minimumDistanceMeters <= 0) {
          throw new Error('Minsteavstand må være et gyldig tall i meter.');
        }

        if (
          kingpinToBogieCenterMm !== null &&
          (!Number.isFinite(kingpinToBogieCenterMm) || kingpinToBogieCenterMm <= 0)
        ) {
          throw new Error('Avstand fra kingpin til boggisenter må være et gyldig tall i mm.');
        }

        if (tractorAllowedWeightKg !== null && (!Number.isFinite(tractorAllowedWeightKg) || tractorAllowedWeightKg < 0)) {
          throw new Error('Tillatt totalvekt for trekkvogn må være et gyldig tall i kg.');
        }

        if (tractorOwnWeightKg !== null && (!Number.isFinite(tractorOwnWeightKg) || tractorOwnWeightKg < 0)) {
          throw new Error('Egenvekt for trekkvogn må være et gyldig tall i kg.');
        }

        if (trailerAllowedWeightKg !== null && (!Number.isFinite(trailerAllowedWeightKg) || trailerAllowedWeightKg < 0)) {
          throw new Error('Tillatt totalvekt for semitrailer må være et gyldig tall i kg.');
        }

        if (trailerOwnWeightKg !== null && (!Number.isFinite(trailerOwnWeightKg) || trailerOwnWeightKg < 0)) {
          throw new Error('Egenvekt for semitrailer må være et gyldig tall i kg.');
        }

        if (combinationCardWeightKg !== null && (!Number.isFinite(combinationCardWeightKg) || combinationCardWeightKg < 0)) {
          throw new Error('Tillatt vogntogvekt må være et gyldig tall i kg.');
        }

        const tableLookup = getSemiTrailerTableWeight(tractorAxles, trailerAxles, minimumDistanceMeters, roadProfile);
        const combinedCardWeightKg =
          tractorAllowedWeightKg !== null && trailerAllowedWeightKg !== null
            ? tractorAllowedWeightKg + trailerAllowedWeightKg
            : null;
        const combinedOwnWeightKg =
          tractorOwnWeightKg !== null && trailerOwnWeightKg !== null ? tractorOwnWeightKg + trailerOwnWeightKg : null;
        const candidates = [
          { label: 'Tabell 3b', value: tableLookup.tableWeightKg },
          ...(combinedCardWeightKg !== null ? [{ label: 'sum av vognkortvekter', value: combinedCardWeightKg }] : []),
          ...(combinationCardWeightKg !== null ? [{ label: 'oppgitt vogntogvekt', value: combinationCardWeightKg }] : []),
        ];
        const finalLimit = candidates.reduce((lowest, current) => (current.value < lowest.value ? current : lowest));
        const availablePayloadKg = combinedOwnWeightKg !== null ? finalLimit.value - combinedOwnWeightKg : null;
        const ltp = buildSemiTrailerLtp(
          tractorAllowedWeightKg,
          tractorOwnWeightKg,
          finalLimit.value,
          combinedOwnWeightKg,
          kingpinToBogieCenterMm,
        );

        setSemiTrailerResult({
          tractorAxles,
          trailerAxles,
          minimumDistanceMeters,
          distanceBand: tableLookup.distanceBand,
          roadProfile,
          tableWeightKg: tableLookup.tableWeightKg,
          finalAllowedWeightKg: finalLimit.value,
          tableContext: tableLookup.tableContext,
          limitationReason: finalLimit.label,
          tractorAllowedWeightKg,
          tractorOwnWeightKg,
          trailerAllowedWeightKg,
          trailerOwnWeightKg,
          combinationCardWeightKg,
          combinedCardWeightKg,
          combinedOwnWeightKg,
          availablePayloadKg,
          kingpinToBogieCenterMm,
          ltp,
          steps: [
            tx(language, `1. Trekkvogn aksler = ${formatNumber(tractorAxles, 0)} stk`, `1. Tractor axles = ${formatNumber(tractorAxles, 0)} pcs`),
            tx(language, `2. Semitrailer aksler = ${formatNumber(trailerAxles, 0)} stk`, `2. Semitrailer axles = ${formatNumber(trailerAxles, 0)} pcs`),
            tx(language, `3. Minsteavstand = ${formatNumber(minimumDistanceMeters, 2)} m (${tableLookup.distanceBand})`, `3. Minimum distance = ${formatNumber(minimumDistanceMeters, 2)} m (${tableLookup.distanceBand})`),
            tx(language, `4. Tabell 3b (${getRoadProfileLabel(roadProfile)}) = ${formatNumber(tableLookup.tableWeightKg, 0)} kg for ${tableLookup.tableContext}`, `4. Table 3b (${getRoadProfileLabel(roadProfile)}) = ${formatNumber(tableLookup.tableWeightKg, 0)} kg for ${translateRuntimeText(tableLookup.tableContext, language)}`),
            tractorAllowedWeightKg !== null
              ? tx(language, `5. Tillatt totalvekt trekkvogn fra vognkort = ${formatNumber(tractorAllowedWeightKg, 0)} kg`, `5. Allowed tractor total weight from card = ${formatNumber(tractorAllowedWeightKg, 0)} kg`)
              : tx(language, '5. Tillatt totalvekt trekkvogn er ikke lagt inn ennå', '5. Allowed tractor total weight not provided yet'),
            tractorOwnWeightKg !== null
              ? tx(language, `6. Egenvekt trekkvogn = ${formatNumber(tractorOwnWeightKg, 0)} kg`, `6. Tractor own weight = ${formatNumber(tractorOwnWeightKg, 0)} kg`)
              : tx(language, '6. Egenvekt trekkvogn er ikke lagt inn ennå', '6. Tractor own weight not provided yet'),
            trailerAllowedWeightKg !== null
              ? tx(language, `7. Tillatt totalvekt semitrailer fra vognkort = ${formatNumber(trailerAllowedWeightKg, 0)} kg`, `7. Allowed semitrailer total weight from card = ${formatNumber(trailerAllowedWeightKg, 0)} kg`)
              : tx(language, '7. Tillatt totalvekt semitrailer er ikke lagt inn ennå', '7. Allowed semitrailer total weight not provided yet'),
            trailerOwnWeightKg !== null
              ? tx(language, `8. Egenvekt semitrailer = ${formatNumber(trailerOwnWeightKg, 0)} kg`, `8. Semitrailer own weight = ${formatNumber(trailerOwnWeightKg, 0)} kg`)
              : tx(language, '8. Egenvekt semitrailer er ikke lagt inn ennå', '8. Semitrailer own weight not provided yet'),
            combinationCardWeightKg !== null
              ? tx(language, `9. Tillatt vogntogvekt fra kort/oppgave = ${formatNumber(combinationCardWeightKg, 0)} kg`, `9. Allowed combination weight from card = ${formatNumber(combinationCardWeightKg, 0)} kg`)
              : tx(language, '9. Tillatt vogntogvekt er ikke lagt inn ennå', '9. Allowed combination weight not provided yet'),
            availablePayloadKg !== null
              ? tx(language, `10. Tilgjengelig nyttelast = ${formatNumber(availablePayloadKg, 0)} kg`, `10. Available payload = ${formatNumber(availablePayloadKg, 0)} kg`)
              : tx(language, '10. Tilgjengelig nyttelast krever at begge egenvekter er lagt inn.', '10. Available payload requires both own weights to be provided.'),
            ltp.status === 'ready'
              ? tx(language, `11. LTP = (${formatNumber(ltp.frontPayloadKg ?? 0, 0)} × ${formatNumber(ltp.bogieDistanceMm ?? 0, 0)}) / ${formatNumber(ltp.totalPayloadKg ?? 0, 0)} = ${formatNumber(ltp.rawLtpCm ?? 0)} cm, rundet opp til ${formatNumber(ltp.ltpCm ?? 0, 0)} cm`, `11. LTP = (${formatNumber(ltp.frontPayloadKg ?? 0, 0)} × ${formatNumber(ltp.bogieDistanceMm ?? 0, 0)}) / ${formatNumber(ltp.totalPayloadKg ?? 0, 0)} = ${formatNumber(ltp.rawLtpCm ?? 0)} cm, rounded up to ${formatNumber(ltp.ltpCm ?? 0, 0)} cm`)
              : tx(language, `11. LTP ikke klar: ${ltp.message}`, `11. LTP not ready: ${translateRuntimeText(ltp.message, language)}`),
            tx(language, `12. Sluttvekt = ${formatNumber(finalLimit.value, 0)} kg, begrenset av ${finalLimit.label}.`, `12. Final weight = ${formatNumber(finalLimit.value, 0)} kg, limited by ${translateRuntimeText(finalLimit.label, language)}.`),
          ],
        });
        setResult(null);
        setError('');
        setTripCalculationKey((current) => current + 1);
        return;
      }

      const unsupportedCalculationMessage = getUnsupportedCalculationMessage(vehicleType, axleVariant, language);
      if (unsupportedCalculationMessage) {
        throw new Error(unsupportedCalculationMessage);
      }

      const allowedLoads = parseSlashSeparated(form.allowedAxleLoads, FIELD_LABELS.allowedAxleLoads);
      const ownWeights = parseSlashSeparated(form.axleOwnWeights, FIELD_LABELS.axleOwnWeights);
      const distances = parseSlashSeparated(form.axleDistances, FIELD_LABELS.axleDistances);
      const grossOwnWeightWithDriver = Number(form.grossOwnWeightWithDriver.replace(',', '.'));
      const totalAxleDistanceMm = distances.reduce((sum, value) => sum + value, 0);
      const technologyWeightKg = technologyWeight.trim() === '' ? 0 : Number(technologyWeight.replace(',', '.'));
      const busSeatCountValue = busSeatCount.trim() === '' ? 0 : Number(busSeatCount.replace(',', '.'));
      const busStandingCountValue = busStandingCount.trim() === '' ? 0 : Number(busStandingCount.replace(',', '.'));
      const passengerWeightValue = busPassengerWeightKg.trim() === '' ? NaN : Number(busPassengerWeightKg.replace(',', '.'));

      if (!Number.isFinite(grossOwnWeightWithDriver) || grossOwnWeightWithDriver < 0) {
        throw new Error('Egenvekt med fører må være et gyldig tall i kg.');
      }

      const ltp = buildLtp(Number(resolvedAxleCount), allowedLoads, ownWeights, distances, grossOwnWeightWithDriver);

      if (!Number.isFinite(technologyWeightKg) || technologyWeightKg < 0) {
        throw new Error('Batteri-/teknologivekt må være et gyldig tall i kg.');
      }

      const totalWeight = getVehicleTableWeight(
        vehicleType,
        resolvedAxleCount,
        roadProfile,
        totalAxleDistanceMm,
        powertrain,
        technologyWeightKg,
        hasAirSuspension,
        Number(driveAxleCount),
        hasTwinWheelsOnDriveAxles,
        allDriveAxlesAtOrUnderNinePointFiveTons,
        hasTwoSteeringAxles,
      );
      const totalWeightWithTechnologyTons = totalWeight.weight;
      const busPassengerLoad =
        vehicleType === 'bus' || vehicleType === 'articulatedBus'
          ? buildBusPassengerLoad(
              totalWeightWithTechnologyTons,
              grossOwnWeightWithDriver,
              busSeatCountValue,
              busStandingCountValue,
              passengerWeightValue,
              language,
            )
          : null;

      setResult({
        vehicleType,
        axleCount: Number(resolvedAxleCount),
        roadProfile,
        powertrain,
        totalAxleDistanceMm,
        totalAxleDistanceMeters: totalAxleDistanceMm / 1000,
        tableWeightTons: totalWeight.baseWeight,
        extraTechnologyWeightTons: totalWeight.extraTechnologyWeightTons,
        totalWeightWithTechnologyTons,
        tableContext: totalWeight.context,
        weightRuleNotes: totalWeight.notes,
        allowedLoads,
        ownWeights,
        distances,
        grossOwnWeightWithDriver,
        ltp,
        busPassengerLoad,
        steps: [
          `1. Tillatt aksellast lest fra vognkort = ${allowedLoads.map((value) => formatNumber(value, 0)).join(' / ')} kg`,
          `2. Egenvekt aksel lest fra vognkort = ${ownWeights.map((value) => formatNumber(value, 0)).join(' / ')} kg`,
          `3. Egenvekt med fører = ${formatNumber(grossOwnWeightWithDriver, 0)} kg`,
          `4. Akselavstander lest fra vognkort = ${distances.map((value) => formatNumber(value, 0)).join(' / ')} mm`,
          `5. Kjøretøyvekttabell (${getRoadProfileLabel(roadProfile)}) = ${formatNumber(totalWeight.baseWeight, 1)} tonn for ${totalWeight.context}`,
          totalWeight.extraTechnologyWeightTons > 0
            ? `6. Tillatt totalvekt = ${formatNumber(totalWeight.baseWeight, 1)} + ${formatNumber(totalWeight.extraTechnologyWeightTons, 1)} = ${formatNumber(totalWeightWithTechnologyTons, 1)} tonn`
            : `6. Tillatt totalvekt = ${formatNumber(totalWeightWithTechnologyTons, 1)} tonn uten fotnotetillegg`,
          ltp.status === 'ready'
            ? tx(language, `7. LTP = (${formatNumber(ltp.frontPayloadKg ?? 0, 0)} × ${formatNumber(ltp.midpointDistanceMm ?? 0, 0)}) / ${formatNumber(ltp.totalPayloadKg ?? 0, 0)} = ${formatNumber(ltp.rawLtpCm ?? 0)} cm, rundet opp til ${formatNumber(ltp.ltpCm ?? 0, 0)} cm`, `7. LTP = (${formatNumber(ltp.frontPayloadKg ?? 0, 0)} × ${formatNumber(ltp.midpointDistanceMm ?? 0, 0)}) / ${formatNumber(ltp.totalPayloadKg ?? 0, 0)} = ${formatNumber(ltp.rawLtpCm ?? 0)} cm, rounded up to ${formatNumber(ltp.ltpCm ?? 0, 0)} cm`)
            : tx(language, `7. ${ltp.message}`, `7. ${translateRuntimeText(ltp.message, language)}`),
          busPassengerLoad
            ? busPassengerLoad.status === 'ready'
              ? tx(language, `8. Last per passasjer = (${formatNumber(busPassengerLoad.availablePayloadKg ?? 0, 0)} - ${formatNumber((busPassengerLoad.passengerCount ?? 0) * (busPassengerLoad.passengerWeightKg ?? 0), 0)}) / ${formatNumber(busPassengerLoad.passengerCount ?? 0, 0)} = ${formatNumber(busPassengerLoad.perPersonLoadKg ?? 0, 0)} kg`, `8. Load per passenger = (${formatNumber(busPassengerLoad.availablePayloadKg ?? 0, 0)} - ${formatNumber((busPassengerLoad.passengerCount ?? 0) * (busPassengerLoad.passengerWeightKg ?? 0), 0)}) / ${formatNumber(busPassengerLoad.passengerCount ?? 0, 0)} = ${formatNumber(busPassengerLoad.perPersonLoadKg ?? 0, 0)} kg`)
              : tx(language, `8. ${busPassengerLoad.message}`, `8. ${translateRuntimeText(busPassengerLoad.message, language)}`)
            : tx(language, '8. Ikke brukt for lastebil', '8. Not used for truck'),
        ],
      });
      setSemiTrailerResult(null);
      setError('');
      setTripCalculationKey((current) => current + 1);
    } catch (buildError) {
      setResult(null);
      setSemiTrailerResult(null);
      setError(translateErrorMessage((buildError as Error).message, language));
    }
  };

  handleCalculateRef.current = handleCalculate;

  useEffect(() => {
    if (!pendingTripCalculation || screen !== 'calculator') return;
    setPendingTripCalculation(false);
    handleCalculateRef.current();
  }, [pendingTripCalculation, screen]);

  useEffect(() => {
    if (tripCalculationKey <= 0) return;
    window.requestAnimationFrame(() => {
      document.getElementById('trip-main-view')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [tripCalculationKey]);

  const handleReset = () => {
    setForm(INITIAL_FORM);
    setSemiTrailerForm({
      tractorAxles: '2',
      trailerAxles: '3',
      minimumDistanceMeters: '',
      kingpinToBogieCenterMm: '',
      tractorAllowedWeightKg: '',
      tractorOwnWeightKg: '',
      trailerAllowedWeightKg: '',
      trailerOwnWeightKg: '',
      combinationCardWeightKg: '',
      trailerAllowedAxleLoads: '',
      trailerAxleOwnWeights: '',
    });
    setTruckLayout('standard');
    setAxleVariant('truck_4_rear_tridem');
    setTrailerFamily('semitrailer');
    setTechnologyWeight('');
    setBusSeatCount('');
    setBusStandingCount('');
    setBusPassengerWeightKg('75');
    setHasAirSuspension(true);
    setDriveAxleCount('1');
    setFrontWheelSetup('single');
    setRearWheelSetup('double');
    setAllDriveAxlesAtOrUnderNinePointFiveTons(false);
    setHasTwoSteeringAxles(false);
    setResult(null);
    setSemiTrailerResult(null);
    setTripCalculationKey(0);
    setError('');
  };

  const getTripLtpSummary = () => {
    const ltp = result?.ltp ?? semiTrailerResult?.ltp ?? null;
    if (!ltp) return tx(language, 'Sjekk detaljer', 'Check details');
    if (ltp.status !== 'ready') return tx(language, 'Sjekk detaljer', 'Check details');
    return tx(language, `OK - ${formatNumber(ltp.ltpCm ?? 0, 0)} cm`, `OK - ${formatNumber(ltp.ltpCm ?? 0, 0)} cm`);
  };

  const getNextBreakSummary = () => {
    if (!plannedDeparture) return tx(language, 'Avgang ikke satt', 'Departure not set');
    const departure = new Date(plannedDeparture);
    const usedHours = Number(drivingUsedTodayHours.replace(',', '.'));
    if (!Number.isFinite(departure.getTime()) || !Number.isFinite(usedHours)) {
      return tx(language, 'Sjekk detaljer', 'Check details');
    }
    const remainingHours = Math.max(4.5 - usedHours, 0);
    const nextBreak = new Date(departure.getTime() + Math.round(remainingHours * 60 * 60 * 1000));
    return new Intl.DateTimeFormat(language === 'no' ? 'nb-NO' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(nextBreak);
  };

  const renderTripMainView = () => (
    <section id="trip-main-view" className="driver-results-flow driver-results-flow--map-first" aria-label={tx(language, 'Steg 2: Hovedvisning for turen', 'Step 2: Main trip view')}>
      <div className="workflow-section-heading">
        <h2>{tx(language, 'Hovedvisning for turen', 'Main trip view')}</h2>
      </div>

      <RouteCheckFutureSection
        language={language}
        routeFrom={routeFrom}
        routeTo={routeTo}
        prefill={routeCheckPrefill}
        autoCheckKey={tripCalculationKey}
        ltpSummary={getTripLtpSummary()}
        nextBreakSummary={getNextBreakSummary()}
        detailsContent={(restStops) => (
          <details className="trip-detail-card">
            <summary>{tx(language, 'Kjøre- og hviletid', 'Driving and rest time')}</summary>
            <DrivingRestSection
              language={language}
              plannedDeparture={plannedDeparture}
              drivingUsedTodayHours={drivingUsedTodayHours}
              restStops={restStops}
            />
          </details>
        )}
        afterVehicleDetailsContent={
          <details className="trip-detail-card">
            <summary>{tx(language, 'LTP-sammendrag', 'LTP summary')}</summary>
            <div>
              {result ? (
                <>
                  <strong>{result.ltp.status === 'ready' ? `${formatNumber(result.ltp.ltpCm ?? 0, 0)} cm` : tx(language, 'Ikke klar', 'Not ready')}</strong>
                  <p>{translateRuntimeText(result.ltp.message, language)}</p>
                </>
              ) : semiTrailerResult ? (
                <>
                  <strong>{semiTrailerResult.ltp.status === 'ready' ? `${formatNumber(semiTrailerResult.ltp.ltpCm ?? 0, 0)} cm` : tx(language, 'Ikke klar', 'Not ready')}</strong>
                  <p>{translateRuntimeText(semiTrailerResult.ltp.message, language)}</p>
                </>
              ) : (
                <p>{tx(language, 'Beregningen vises her når grunnlaget er klart.', 'The calculation appears here when the basis is ready.')}</p>
              )}
            </div>
          </details>
        }
      />
    </section>
  );

  if (screen === 'plate') {
    return (
      <main className="ltp-shell ltp-shell--plate">
        <GlobalTopControls language={language} onLanguageChange={setLanguage} theme={theme} onThemeChange={setTheme} />
        <section className="plate-entry">
          <div className="plate-entry-copy">
            <div className="registration-lookup registration-lookup--standalone">
              <h2>{tx(language, 'Tur og kjøretøy', 'Trip and vehicle')}</h2>
              <form
                className="registration-lookup-form registration-lookup-form--stacked"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handlePlateEntrySubmit();
                }}
              >
                <div className="plate-input-grid">
                  <label className="registration-field">
                    <span>{tx(language, 'Skiltnummer', 'Registration number')}</span>
                    <input
                      className="registration-input"
                      value={registrationNumber}
                      onChange={(event) => setRegistrationNumber(event.target.value)}
                      placeholder={tx(language, 'F.eks. AB12345', 'E.g. AB12345')}
                      aria-label={tx(language, 'Skiltnummer', 'Registration number')}
                      autoCapitalize="characters"
                      autoComplete="off"
                      autoFocus
                      required
                    />
                  </label>
                  <label className="registration-field">
                    <span>{tx(language, 'Fra', 'From')}</span>
                    <input
                      className="registration-input"
                      value={routeFrom}
                      onChange={(event) => setRouteFrom(event.target.value)}
                      placeholder={tx(language, 'Startsted', 'Start location')}
                      aria-label={tx(language, 'Fra', 'From')}
                      autoComplete="off"
                    />
                  </label>
                  <label className="registration-field">
                    <span>{tx(language, 'Til', 'To')}</span>
                    <input
                      className="registration-input"
                      value={routeTo}
                      onChange={(event) => setRouteTo(event.target.value)}
                      placeholder={tx(language, 'Destinasjon', 'Destination')}
                      aria-label={tx(language, 'Til', 'To')}
                      autoComplete="off"
                    />
                  </label>
                  <label className="registration-field">
                    <span>{tx(language, 'Planlagt avgang', 'Planned departure')}</span>
                    <input
                      className="registration-input"
                      type="datetime-local"
                      value={plannedDeparture}
                      onChange={(event) => setPlannedDeparture(event.target.value)}
                      aria-label={tx(language, 'Planlagt avgang', 'Planned departure')}
                    />
                  </label>
                  <label className="registration-field">
                    <span>{tx(language, 'Tid kjørt allerede i dag', 'Driving time already today')}</span>
                    <input
                      className="registration-input"
                      type="number"
                      min="0"
                      step="0.25"
                      value={drivingUsedTodayHours}
                      onChange={(event) => setDrivingUsedTodayHours(event.target.value)}
                      placeholder="0"
                      aria-label={tx(language, 'Tid kjørt allerede i dag', 'Driving time already today')}
                    />
                  </label>
                </div>
                <button type="submit" className="registration-button registration-button--wide" disabled={lookupLoading || trailerLookupLoading}>
                  {lookupLoading || trailerLookupLoading ? tx(language, 'Henter...', 'Fetching...') : tx(language, 'Start turberegning', 'Start trip calculation')}
                </button>
              </form>
              <details className="manual-values-panel">
                <summary>{tx(language, 'Vis manuelle kjøretøyverdier', 'Show manual vehicle values')}</summary>
                <div className="manual-values-grid">
                  <label className="registration-field">
                    <span>{tx(language, 'Tilhenger (valgfri)', 'Trailer (optional)')}</span>
                    <input
                      className="registration-input"
                      value={trailerRegistrationNumber}
                      onChange={(event) => setTrailerRegistrationNumber(event.target.value)}
                      placeholder={tx(language, 'F.eks. AB12345', 'E.g. AB12345')}
                      aria-label={tx(language, 'Tilhenger (valgfri)', 'Trailer (optional)')}
                      autoCapitalize="characters"
                      autoComplete="off"
                    />
                  </label>
                  <label className="select-block plate-road-profile">
                    <span className="select-label">{tx(language, 'Vegliste / bruksklasse', 'Road list / road class')}</span>
                    <select
                      value={roadProfile}
                      onChange={(event) => setRoadProfile(event.target.value as RoadProfile)}
                      className="select-input"
                    >
                      {ROAD_PROFILES.map((option) => (
                        <option key={option.value} value={option.value}>
                          {tx(language, option.label, option.labelEn ?? option.label)}
                        </option>
                      ))}
                    </select>
                    <small className="select-note">
                      {(() => {
                        const option = ROAD_PROFILES.find((item) => item.value === roadProfile);
                        return option ? tx(language, option.description, option.descriptionEn ?? option.description) : '';
                      })()}
                    </small>
                  </label>
                </div>
              </details>
              {lookupMessage ? <p className="registration-message">{lookupMessage}</p> : null}
              {trailerLookupMessage ? <p className="registration-message">{trailerLookupMessage}</p> : null}
              {lookupNotes.length > 0 ? (
                <div className="registration-notes">
                  {lookupNotes.slice(0, 3).map((note) => (
                    <span key={note}>{translateRuntimeText(note, language)}</span>
                  ))}
                </div>
              ) : null}
              {trailerLookupNotes.length > 0 ? (
                <div className="registration-notes">
                  {trailerLookupNotes.slice(0, 3).map((note) => (
                    <span key={note}>{translateRuntimeText(note, language)}</span>
                  ))}
                </div>
              ) : null}
            </div>

          </div>
        </section>
      </main>
    );
  }

  if (screen === 'choose') {
    return (
      <main className="ltp-shell ltp-shell--landing">
        <GlobalTopControls language={language} onLanguageChange={setLanguage} theme={theme} onThemeChange={setTheme} />
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="eyebrow">{tx(language, 'LTP Beregner', 'LTP Calculator')}</p>
            <h1>{tx(language, 'Velg kjøretøy og gå videre til riktig kalkulator.', 'Choose vehicle type and continue to the right calculator.')}</h1>
            <p className="hero-text">
              {tx(
                language,
                'Start med kjøretøytypen du faktisk jobber med. Da får du en ryddigere kalkulator som passer bedre til vognkortet, akslene og reglene du bruker.',
                'Start with the vehicle type you are actually working with. That gives you a cleaner calculator that matches the vehicle card, axles and rules.',
              )}
            </p>
            <div className="registration-lookup">
              <h2>{tx(language, 'Tur og kjøretøy', 'Trip and vehicle')}</h2>
              <p>
                {tx(
                  language,
                  'Vi prøver å hente vognkortdata automatisk. Får vi treff, fylles aksler, aksellast, egenvekt og akselavstander inn så langt Vegvesen-dataene gir oss.',
                  'We try to fetch the vehicle-card data automatically. If we get a match, the key values are filled in where available.',
                )}
              </p>
              <form
                className="registration-lookup-form registration-lookup-form--stacked"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handlePlateEntrySubmit();
                }}
              >
                <div className="plate-input-grid">
                  <label className="registration-field">
                    <span>{tx(language, 'Registreringsnummer', 'Registration number')}</span>
                    <input
                      className="registration-input"
                      value={registrationNumber}
                      onChange={(event) => setRegistrationNumber(event.target.value)}
                      placeholder={tx(language, 'F.eks. AB12345', 'E.g. AB12345')}
                      aria-label={tx(language, 'Registreringsnummer', 'Registration number')}
                      autoCapitalize="characters"
                      autoComplete="off"
                    />
                  </label>
                  <label className="registration-field">
                    <span>{tx(language, 'Fra', 'From')}</span>
                    <input
                      className="registration-input"
                      value={routeFrom}
                      onChange={(event) => setRouteFrom(event.target.value)}
                      placeholder={tx(language, 'Startsted', 'Start location')}
                      aria-label={tx(language, 'Fra', 'From')}
                      autoComplete="off"
                    />
                  </label>
                  <label className="registration-field">
                    <span>{tx(language, 'Til', 'To')}</span>
                    <input
                      className="registration-input"
                      value={routeTo}
                      onChange={(event) => setRouteTo(event.target.value)}
                      placeholder={tx(language, 'Destinasjon', 'Destination')}
                      aria-label={tx(language, 'Til', 'To')}
                      autoComplete="off"
                    />
                  </label>
                  <label className="registration-field">
                    <span>{tx(language, 'Planlagt avgang', 'Planned departure')}</span>
                    <input
                      className="registration-input"
                      type="datetime-local"
                      value={plannedDeparture}
                      onChange={(event) => setPlannedDeparture(event.target.value)}
                      aria-label={tx(language, 'Planlagt avgang', 'Planned departure')}
                    />
                  </label>
                  <label className="registration-field">
                    <span>{tx(language, 'Tid kjørt allerede i dag', 'Driving time already today')}</span>
                    <input
                      className="registration-input"
                      type="number"
                      min="0"
                      step="0.25"
                      value={drivingUsedTodayHours}
                      onChange={(event) => setDrivingUsedTodayHours(event.target.value)}
                      placeholder="0"
                      aria-label={tx(language, 'Tid kjørt allerede i dag', 'Driving time already today')}
                    />
                  </label>
                </div>
                <button type="submit" className="registration-button" disabled={lookupLoading}>
                  {lookupLoading ? tx(language, 'Henter...', 'Fetching...') : tx(language, 'Start turberegning', 'Start trip calculation')}
                </button>
              </form>
              {lookupMessage ? <p className="registration-message">{lookupMessage}</p> : null}
              {lookupNotes.length > 0 ? (
                <div className="registration-notes">
                  {lookupNotes.slice(0, 3).map((note) => (
                    <span key={note}>{translateRuntimeText(note, language)}</span>
                  ))}
                </div>
              ) : null}
              {routeCheckPrefill.vehicleHeight || routeCheckPrefill.vehicleLength || routeCheckPrefill.vehicleWidth || routeCheckPrefill.totalWeight ? (
                <div className="driver-vehicle-prefill" aria-label={tx(language, 'Kjøretøydata fra vognkort', 'Vehicle data from vehicle card')}>
                  <span>{tx(language, 'Kjøretøydata fra vognkort', 'Vehicle data from vehicle card')}</span>
                  <div>
                    <strong>{tx(language, 'Høyde', 'Height')}: {routeCheckPrefill.vehicleHeight || tx(language, 'Mangler', 'Missing')}</strong>
                    <strong>{tx(language, 'Lengde', 'Length')}: {routeCheckPrefill.vehicleLength || tx(language, 'Mangler', 'Missing')}</strong>
                    <strong>{tx(language, 'Bredde', 'Width')}: {routeCheckPrefill.vehicleWidth || tx(language, 'Mangler', 'Missing')}</strong>
                    <strong>{tx(language, 'Totalvekt', 'Total weight')}: {routeCheckPrefill.totalWeight || tx(language, 'Mangler', 'Missing')}</strong>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="hero-points">
              <span>{tx(language, 'Lastebil', 'Truck')}</span>
              <span>{tx(language, 'Semi trailer', 'Semi trailer')}</span>
              <span>{tx(language, 'Buss', 'Bus')}</span>
              <span>{tx(language, 'Leddbuss', 'Articulated bus')}</span>
              <span>{tx(language, 'LTP og totalvekt', 'LTP and total weight')}</span>
            </div>
          </div>
          <div className="landing-visual">
            <div className="landing-visual-stage">
              <Image
                src="/images/hero-vehicles-bg-v1.png"
                alt="Fotorealistisk bakgrunn med lastebil og buss"
                className="landing-hero-photo landing-hero-photo--premium"
                fill
                priority
                sizes="(max-width: 939px) 100vw, 40vw"
              />
            </div>
            <p className="visual-caption">
              {tx(
                language,
                'Velg kjøretøy først, så bygger vi resten av skjemaet rundt den typen du har valgt.',
                'Choose the vehicle first, then the form is built around that vehicle type.',
              )}
            </p>
          </div>
        </section>

        <section className="vehicle-choice-grid">
          {VEHICLE_OPTIONS.map((option) => {
            const optionText = getVehicleText(option.value, language);

            return (
            <button
              key={option.value}
              type="button"
              className={`vehicle-choice-card vehicle-choice-card--${option.value}`}
              onClick={() => handleVehicleCardSelect(option.value)}
            >
              <div className="vehicle-choice-top">
                <span className="vehicle-choice-kicker">{tx(language, 'Kjøretøytype', 'Vehicle type')}</span>
                <strong>{optionText.label}</strong>
                <p>{optionText.description}</p>
              </div>

              <div className="vehicle-choice-art">
                <Image
                  src={getVehiclePhotoPath(option.value)}
                  alt={getVehiclePhotoAlt(option.value, language)}
                  className={`vehicle-choice-photo vehicle-choice-photo--${option.value}`}
                  fill
                  sizes="(max-width: 939px) 100vw, 50vw"
                />
              </div>

              <span className="vehicle-choice-action">{tx(language, 'Velg', 'Choose')}</span>
            </button>
            );
          })}
        </section>

        {/* Route check preview now appears after calculation results */}
      </main>
    );
  }

  if (isVogntogVehicle(vehicleType)) {
    return (
      <main className="ltp-shell">
        <GlobalTopControls language={language} onLanguageChange={setLanguage} theme={theme} onThemeChange={setTheme} />
        <div className="topbar-card">
          <div>
            <p className="eyebrow">{tx(language, 'Valgt kjøretøy', 'Selected vehicle')}</p>
            <h2>{selectedVehicleText?.label}</h2>
            <p className="topbar-text">{selectedVehicleText?.description}</p>
          </div>
          <div className="topbar-actions">
            <button type="button" className="secondary-button no-print" onClick={() => void handlePrint()}>
              {tx(language, 'Skriv ut / eksporter sammendrag', 'Print / export summary')}
            </button>
            <button type="button" className="secondary-button no-print" onClick={() => void handleResetSearch()}>
              {tx(language, 'Nullstill søk', 'Reset search')}
            </button>
            <button type="button" className="secondary-button" onClick={() => setScreen('choose')}>
              {tx(language, 'Bytt kjøretøy', 'Change vehicle')}
            </button>
          </div>
        </div>

        {tripCalculationKey > 0 ? renderTripMainView() : null}

        <details className="advanced-calculation-shell">
          <summary>{tx(language, 'Avansert beregning', 'Advanced calculation')}</summary>
        <section className="hero-card professional-hero">
          <div className="hero-copy">
            <p className="eyebrow">{isSpecialTransport ? tx(language, 'Spesialtype inn', 'Special type in') : tx(language, 'Vogntog inn', 'Combination in')}</p>
            <h1>
              {isSpecialTransport
                ? tx(language, 'Bygg opp spesialtransport med riktig vegliste.', 'Build special transport with the right road list.')
                : tx(language, 'Bygg opp semi trailer fra riktige vogntogverdier.', 'Build the semi trailer setup from the right combination values.')}
            </h1>
            <p className="hero-text">
              {isSpecialTransport
                ? tx(language, 'Spesialtypene ligger for seg: modulvogntog, tømmervogntog, dolly med semitrailer og tvangsstyrte varianter.', 'Special types are separated: modular combinations, timber combinations, dolly with semitrailer and forced-steering variants.')
                : tx(language, 'Semi trailer skal ikke presses inn i vanlig lastebil-flyt. Her samler vi trekkvogn, semitrailer, minsteavstand og vegliste som eget oppsett.', 'Semi trailers should not be squeezed into the rigid-truck flow. Here tractor, trailer, minimum distance and road list are handled together.')}
            </p>
            <div className="registration-lookup">
              <span className="registration-label">{tx(language, 'Første steg', 'First step')}</span>
              <h2>{tx(language, 'Skriv inn skilt nr', 'Enter plate number')}</h2>
              <p>
                {tx(language, 'Vi prøver å hente vognkortdata automatisk. Får vi treff, fylles aksler, aksellast, egenvekt og akselavstander inn så langt Vegvesen-dataene gir oss.', 'We try to fetch the vehicle-card data automatically. If we get a match, axles, axle loads, own weight and axle distances are filled where the API provides them.')}
              </p>
              <form
                className="registration-lookup-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleRegistrationLookup();
                }}
              >
                <input
                  className="registration-input"
                  value={registrationNumber}
                  onChange={(event) => setRegistrationNumber(event.target.value)}
                  placeholder={tx(language, 'F.eks. AB12345', 'E.g. AB12345')}
                  aria-label={tx(language, 'Registreringsnummer', 'Registration number')}
                  autoCapitalize="characters"
                  autoComplete="off"
                />
                <button type="submit" className="registration-button" disabled={lookupLoading}>
                  {lookupLoading ? tx(language, 'Henter...', 'Fetching...') : tx(language, 'Hent vognkort', 'Fetch vehicle data')}
                </button>
              </form>
              <div style={{ marginTop: 12 }}>
                <label className="registration-lookup-form" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10 }}>
                  <input
                    className="registration-input"
                    value={trailerRegistrationNumber}
                    onChange={(event) => setTrailerRegistrationNumber(event.target.value)}
                    placeholder={tx(language, 'Tilhenger - f.eks. AB12345', 'Trailer - e.g. AB12345')}
                    aria-label={tx(language, 'Tilhenger registreringsnummer', 'Trailer registration number')}
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="registration-button"
                    disabled={trailerLookupLoading}
                    onClick={() => void handleTrailerLookup()}
                  >
                    {trailerLookupLoading ? tx(language, 'Henter...', 'Fetching...') : tx(language, 'Hent tilhenger', 'Fetch trailer')}
                  </button>
                </label>
                {trailerLookupMessage ? <p className="registration-message">{trailerLookupMessage}</p> : null}
                {trailerLookupNotes.length > 0 ? (
                  <div className="registration-notes">
                    {trailerLookupNotes.slice(0, 3).map((note) => (
                      <span key={note}>{translateRuntimeText(note, language)}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              {lookupMessage ? <p className="registration-message">{lookupMessage}</p> : null}
              {lookupNotes.length > 0 ? (
                <div className="registration-notes">
                  {lookupNotes.slice(0, 3).map((note) => (
                    <span key={note}>{translateRuntimeText(note, language)}</span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-visual-media hero-visual-media--clean">
              <VehicleAxleVisual
                vehicleType={vehicleType}
                language={language}
                axleVariant={axleVariant}
                tractorAxles={Number(semiTrailerForm.tractorAxles)}
                trailerAxles={Number(semiTrailerForm.trailerAxles)}
              />
            </div>
            <div className="visual-caption">
              {isSpecialTransport
                ? tx(language, 'Egen flyt for de tyngre spesialoppsettene, slik at de ikke roter til vanlig lastebil, buss eller semi.', 'A separate flow for heavier special setups, so they do not clutter truck, bus or semi calculations.')
                : tx(language, 'Egen flyt for trekkvogn og semitrailer, slik at vogntogfelt ikke blandes inn i vanlig lastebilberegning.', 'A separate flow for tractor and semitrailer, so combination fields are not mixed into rigid-truck calculations.')}
            </div>
          </div>
        </section>

        <section className="workspace-grid">
          <article className="panel-card">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">{tx(language, 'Fra vognkort og vegliste', 'From vehicle card and road list')}</p>
                <h2>{isSpecialTransport ? tx(language, 'Spesialtype og vegliste', 'Special type and road list') : tx(language, 'Første versjon for semi trailer', 'First semi trailer setup')}</h2>
              </div>
            </div>

            <div className="status-strip">
              <div className="status-chip">
                <span>{tx(language, 'Kjøretøy', 'Vehicle')}</span>
                <strong>{selectedVehicleText?.label}</strong>
              </div>
              <div className="status-chip">
                <span>{tx(language, 'Bruksklasse', 'Road class')}</span>
                <strong>{getRoadProfileLabel(roadProfile)}</strong>
              </div>
            </div>

            <section className="step-card step-card--accent">
              <div className="step-head">
                <div>
                  <h3>{tx(language, 'Steg 1 – Oppsett', 'Step 1 – Setup')}</h3>
                  <p>{tx(language, 'Velg akseloppsettet som står i vognkortet.', 'Select the axle configuration from the vehicle card.')}</p>
                  <small className="step-helper">{tx(language, 'Basert på punkt 8, 9 og 12 i vognkortet.', 'Based on sections 8, 9 and 12 of the vehicle card.')}</small>
                </div>
              </div>

              <div className="selector-grid compact-grid">
                <label className="select-block">
                  <span className="select-label">{tx(language, 'Aksler på trekkvogn', 'Axles on tractor')}</span>
                  <select
                    value={semiTrailerForm.tractorAxles}
                    onChange={(event) =>
                      setSemiTrailerForm((current) => ({
                        ...current,
                        tractorAxles: event.target.value,
                      }))
                    }
                    className="select-input"
                  >
                    <option value="2">{tx(language, '2 aksler', '2 axles')}</option>
                    <option value="3">{tx(language, '3 aksler', '3 axles')}</option>
                    <option value="4">{tx(language, '4 aksler', '4 axles')}</option>
                  </select>
                </label>

                <label className="select-block">
                  <span className="select-label">{tx(language, 'Tilhenger / trailer', 'Trailer')}</span>
                  <select
                    value={trailerFamily}
                    onChange={(event) => {
                      const nextFamily = event.target.value as TrailerFamily;
                      const firstVariant = getTrailerVariantOptions(nextFamily)[0]?.value ?? 'semi_3_plus';

                      setTrailerFamily(nextFamily);
                      setAxleVariant(firstVariant);
                      setSemiTrailerForm((current) => ({
                        ...current,
                        trailerAxles: getTrailerAxlesFromVariant(firstVariant),
                      }));
                    }}
                    className="select-input"
                  >
                    {TRAILER_FAMILY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {tx(language, option.label, option.labelEn ?? option.label)}
                      </option>
                    ))}
                  </select>
                  <small className="select-note">
                    {(() => {
                      const option = TRAILER_FAMILY_OPTIONS.find((item) => item.value === trailerFamily);
                      return option ? tx(language, option.description, option.descriptionEn ?? option.description) : '';
                    })()}
                  </small>
                  <small className="select-note">
                    {tx(language, 'Valgt oppsett brukes i beregningen.', 'Selected setup is used in the calculation.')}
                  </small>
                  {(() => {
                    const option = TRAILER_FAMILY_OPTIONS.find((item) => item.value === trailerFamily);
                    if (!option) return null;
                    const specialFamilies = ['dollySemi', 'moduleTimber'];
                    if (specialFamilies.includes(option.value)) {
                      return (
                        <small className="select-note">
                          {tx(language, 'Bruker aktuell rad i kjøretøyvekttabellen.', 'Uses the relevant row in the vehicle weight table.')}
                        </small>
                      );
                    }
                    return null;
                  })()}
                </label>

                <label className="select-block">
                  <span className="select-label">{tx(language, 'Akseloppsett på tilhenger', 'Trailer axle setup')}</span>
                  <select
                    value={axleVariant}
                    onChange={(event) => {
                      const nextVariant = event.target.value as AxleVariantKey;

                      setAxleVariant(nextVariant);
                      setSemiTrailerForm((current) => ({
                        ...current,
                        trailerAxles: getTrailerAxlesFromVariant(nextVariant),
                      }));
                    }}
                    className="select-input"
                  >
                    {getTrailerVariantOptions(trailerFamily).map((option) => (
                      <option key={option.value} value={option.value}>
                        {tx(language, option.label, option.labelEn ?? option.label)}
                      </option>
                    ))}
                  </select>
                  <small className="select-note">
                    {tx(language, getAxleVariant(axleVariant).description, getAxleVariant(axleVariant).descriptionEn ?? getAxleVariant(axleVariant).description)}
                  </small>
                </label>

                <label className="select-block">
                  <span className="select-label">{tx(language, 'Bruksklasse / tabell', 'Road class / table')}</span>
                  <select
                    value={roadProfile}
                    onChange={(event) => setRoadProfile(event.target.value as RoadProfile)}
                    className="select-input"
                  >
                    {ROAD_PROFILES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {tx(language, option.label, option.labelEn ?? option.label)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="step-card">
              <div className="step-head">
                <span className="step-badge">{tx(language, 'Steg 2', 'Step 2')}</span>
                <div>
                  <h3>{tx(language, 'Kortverdier for trekkvogn og trailer', 'Card values for tractor and trailer')}</h3>
                  <p>{tx(language, 'Fyll inn kortverdiene hver for seg. Da blir det enklere å se hva som begrenser vogntoget.', 'Fill in the card values separately. This makes it easier to see what limits the combination.')}</p>
                </div>
              </div>

              <div className="field-list field-list--two">
                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Minsteavstand', 'Minimum distance')}</span>
                    <span className="field-unit">m</span>
                  </span>
                  <input
                    name="minimumDistanceMeters"
                    type="text"
                    value={semiTrailerForm.minimumDistanceMeters}
                    onChange={handleSemiTrailerInputChange}
                    placeholder={tx(language, 'Eksempel: 3,70', 'Example: 3.70')}
                    className="field-input"
                  />
                  <span className="field-source">{tx(language, 'Avstand fra bakerste aksel på motorvogn til første aksel på semitrailer.', 'Distance from the rear axle on the motor vehicle to the first axle on the semitrailer.')}</span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Kingpin til boggisenter', 'Kingpin to bogie center')}</span>
                    <span className="field-unit">mm</span>
                  </span>
                  <input
                    name="kingpinToBogieCenterMm"
                    type="text"
                    value={semiTrailerForm.kingpinToBogieCenterMm}
                    onChange={handleSemiTrailerInputChange}
                    placeholder={tx(language, 'Eksempel: 5285', 'Example: 5285')}
                    className="field-input"
                  />
                  <span className="field-source">{tx(language, 'Bruk avstanden fra kingpin / svingskive til midt på trailerboggien for LTP.', 'Use the distance from kingpin / fifth wheel to the center of the trailer bogie for LTP.')}</span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Tillatt totalvekt trekkvogn', 'Allowed total weight tractor')}</span>
                    <span className="field-unit">kg</span>
                  </span>
                  <input
                    name="tractorAllowedWeightKg"
                    type="text"
                    value={semiTrailerForm.tractorAllowedWeightKg}
                    onChange={handleSemiTrailerInputChange}
                    placeholder={tx(language, 'Eksempel: 26000', 'Example: 26000')}
                    className="field-input"
                  />
                  <span className="field-source">{tx(language, 'Fra vognkortet til trekkvognen.', 'From the tractor vehicle card.')}</span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Egenvekt trekkvogn', 'Tractor own weight')}</span>
                    <span className="field-unit">kg</span>
                  </span>
                  <input
                    name="tractorOwnWeightKg"
                    type="text"
                    value={semiTrailerForm.tractorOwnWeightKg}
                    onChange={handleSemiTrailerInputChange}
                    placeholder={tx(language, 'Eksempel: 8200', 'Example: 8200')}
                    className="field-input"
                  />
                  <span className="field-source">{tx(language, 'Fra trekkvognkortet hvis du vil få nyttelast utregnet.', 'From the tractor card if you want payload calculated.')}</span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Tillatt totalvekt semitrailer', 'Allowed total weight semitrailer')}</span>
                    <span className="field-unit">kg</span>
                  </span>
                  <input
                    name="trailerAllowedWeightKg"
                    type="text"
                    value={semiTrailerForm.trailerAllowedWeightKg}
                    onChange={handleSemiTrailerInputChange}
                    placeholder={tx(language, 'Eksempel: 39000', 'Example: 39000')}
                    className="field-input"
                  />
                  <span className="field-source">{tx(language, 'Fra vognkortet til semitraileren.', 'From the semitrailer vehicle card.')}</span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Tillatt aksellast per tilhengeraksel', 'Allowed axle load per trailer axle')}</span>
                    <span className="field-unit">kg</span>
                  </span>
                  <input
                    name="trailerAllowedAxleLoads"
                    type="text"
                    value={semiTrailerForm.trailerAllowedAxleLoads}
                    onChange={handleSemiTrailerInputChange}
                    placeholder="9000/9000/9000"
                    className="field-input"
                  />
                  <span className="field-source">
                    {tx(language, 'Fra semitrailerkort/vognkort punkt 8: tillatt aksellast per aksel.', 'From semitrailer vehicle card point 8: allowed axle load per axle.')}
                  </span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Egenvekt semitrailer', 'Semitrailer own weight')}</span>
                    <span className="field-unit">kg</span>
                  </span>
                  <input
                    name="trailerOwnWeightKg"
                    type="text"
                    value={semiTrailerForm.trailerOwnWeightKg}
                    onChange={handleSemiTrailerInputChange}
                    placeholder={tx(language, 'Eksempel: 7200', 'Example: 7200')}
                    className="field-input"
                  />
                  <span className="field-source">{tx(language, 'Fra trailerkortet hvis du vil få nyttelast utregnet.', 'From the trailer card if you want payload calculated.')}</span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Egenvekt per tilhengeraksel', 'Own weight per trailer axle')}</span>
                    <span className="field-unit">kg</span>
                  </span>
                  <input
                    name="trailerAxleOwnWeights"
                    type="text"
                    value={semiTrailerForm.trailerAxleOwnWeights}
                    onChange={handleSemiTrailerInputChange}
                    placeholder={tx(language, FIELD_EXAMPLES.axleOwnWeights, FIELD_EXAMPLES_EN.axleOwnWeights)}
                    className="field-input"
                  />
                  <span className="field-source">
                    {tx(language, 'Fra trailerkort punkt 8: bruk verdien under "Egenvekt aksel".', 'From trailer card point 8: use the value under "Axle own weight".')}
                  </span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Tillatt vogntogvekt', 'Allowed combination weight')}</span>
                    <span className="field-unit">kg</span>
                  </span>
                  <input
                    name="combinationCardWeightKg"
                    type="text"
                    value={semiTrailerForm.combinationCardWeightKg}
                    onChange={handleSemiTrailerInputChange}
                    placeholder={tx(language, 'Eksempel: 50000', 'Example: 50000')}
                    className="field-input"
                  />
                  <span className="field-source">{tx(language, 'Legg inn hvis oppgaven eller veglista allerede oppgir vogntogvekt.', 'Enter this if the task or road list already provides combination weight.')}</span>
                </label>
              </div>
            </section>

            {error ? <p className="error-banner">{error}</p> : null}

            <div className="button-row">
              <button type="button" className="primary-button" onClick={handleCalculate}>
                {isSpecialTransport
                  ? tx(language, 'Klargjør spesialoppsett', 'Prepare special setup')
                  : tx(language, 'Klargjør semi trailer-oppsett', 'Prepare semi trailer setup')}
              </button>
              <button type="button" className="secondary-button" onClick={handleReset}>
                {tx(language, 'Nullstill', 'Reset')}
              </button>
            </div>
          </article>

          <article className="result-panel">
            <div className="panel-header">
              <div>
                <p className="panel-kicker">{tx(language, 'Resultat', 'Result')}</p>
                <h2>{tx(language, 'Resultat', 'Result')}</h2>
              </div>
            </div>

            {semiTrailerResult ? (
              <>
                <div className="result-hero-card">
                  <div className="result-hero-copy">
                    <p className="result-label">{tx(language, 'Aktivt oppsett', 'Active setup')}</p>
                    <strong>
                      {formatNumber(semiTrailerResult.tractorAxles, 0)} +{' '}
                      {formatNumber(semiTrailerResult.trailerAxles, 0)} {tx(language, 'aksler', 'axles')}
                    </strong>
                    <p>
                      {tx(language, 'Trekkvogn med', 'Tractor with')} {formatNumber(semiTrailerResult.tractorAxles, 0)} {tx(language, 'aksler og semitrailer med', 'axles and semitrailer with')}{' '}
                      {formatNumber(semiTrailerResult.trailerAxles, 0)} {tx(language, 'aksler.', 'axles.')}
                    </p>
                  </div>

                  <div className="result-hero-visual">
                    <VehicleAxleVisual
                      vehicleType={vehicleType}
                      language={language}
                      axleVariant={axleVariant}
                      tractorAxles={semiTrailerResult.tractorAxles}
                      trailerAxles={semiTrailerResult.trailerAxles}
                    />
                  </div>
                </div>

                <div className="support-card">
                  <h3>{tx(language, 'Tillatt aksellast per aksel', 'Allowed axle load per axle')}</h3>
                  <AxleWeightTable rows={trailerAxleDerivation.rows} warnings={trailerAxleDerivation.warnings} language={language} />
                  <div className="support-grid axle-list-fallback">
                    {trailerAxleWeightRows.length > 0 ? (
                      trailerAxleWeightRows.map((row) => (
                        <div className="support-row" key={`trail-axle-${row.axle}`}>
                          <span>{tx(language, 'Aksel', 'Axle')} {row.axle}</span>
                          <strong>
                            {tx(language, 'Tillatt', 'Allowed')}: {row.allowedKg !== null ? `${formatNumber(row.allowedKg, 0)} kg` : tx(language, 'mangler', 'missing')}
                            {' · '}
                            {tx(language, 'Egenvekt/tara', 'Own/tare')}: {row.ownKg !== null ? `${formatNumber(row.ownKg, 0)} kg` : tx(language, 'mangler', 'missing')}
                            {row.payloadKg !== null ? ` · ${tx(language, 'Rest', 'Remaining')}: ${formatNumber(row.payloadKg, 0)} kg` : ''}
                          </strong>
                        </div>
                      ))
                    ) : (
                      <div className="support-row">
                        <span>{tx(language, 'Ingen tilhengeraksler', 'No trailer axle data')}</span>
                        <strong>{tx(language, 'Legg inn eller hent tillatt aksellast og egenvekt aksel', 'Enter or fetch allowed axle load and axle own weight')}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <div className="dual-highlight">
                  <div className="result-highlight ltp-highlight">
                    <p className="result-label">{tx(language, 'Lastepunkt', 'Loading point')}</p>
                    {semiTrailerResult.ltp.status === 'ready' ? (
                      <>
                        <strong>{formatNumber(semiTrailerResult.ltp.ltpCm ?? 0)} cm</strong>
                        <p>{translateRuntimeText(semiTrailerResult.ltp.message, language)}</p>
                      </>
                    ) : (
                      <>
                        <strong>{tx(language, 'Ikke klar', 'Not ready')}</strong>
                        <p>{translateRuntimeText(semiTrailerResult.ltp.message, language)}</p>
                      </>
                    )}
                  </div>

                  <div className="result-highlight weight-highlight">
                    <p className="result-label">{tx(language, 'Sluttvekt brukt', 'Final weight used')}</p>
                    <strong>{formatNumber(semiTrailerResult.finalAllowedWeightKg, 0)} kg</strong>
                    <p>
                      {tx(language, 'Appen begrenser vogntoget etter', 'The app limits the combination by')} <strong>{translateRuntimeText(semiTrailerResult.limitationReason, language)}</strong>.
                    </p>
                  </div>
                </div>

                <div className="support-card">
                  <h3>{tx(language, 'Oppsett klart', 'Setup ready')}</h3>
                  <div className="support-grid">
                    <div className="support-row">
                      <span>{tx(language, 'Trekkvogn', 'Tractor')}</span>
                      <strong>{formatNumber(semiTrailerResult.tractorAxles, 0)} {tx(language, 'aksler', 'axles')}</strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Semitrailer', 'Semitrailer')}</span>
                      <strong>{formatNumber(semiTrailerResult.trailerAxles, 0)} {tx(language, 'aksler', 'axles')}</strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Minsteavstand', 'Minimum distance')}</span>
                      <strong>{formatNumber(semiTrailerResult.minimumDistanceMeters, 2)} m</strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Kingpin til boggisenter', 'Kingpin to bogie center')}</span>
                      <strong>
                        {semiTrailerResult.kingpinToBogieCenterMm !== null
                          ? `${formatNumber(semiTrailerResult.kingpinToBogieCenterMm, 0)} mm`
                          : tx(language, 'Ikke lagt inn', 'Not provided')}
                      </strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Avstandsbånd', 'Distance band')}</span>
                      <strong>{translateRuntimeText(semiTrailerResult.distanceBand, language)}</strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Bruksklasse', 'Road class')}</span>
                      <strong>{getRoadProfileLabel(semiTrailerResult.roadProfile)}</strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Tabellrad', 'Table row')}</span>
                      <strong>{translateRuntimeText(semiTrailerResult.tableContext, language)}</strong>
                    </div>
                  </div>
                </div>

                <div className="support-card">
                  <h3>{tx(language, 'Vogntogvekt fra tabell', 'Combination weight from table')}</h3>
                  <div className="support-grid">
                    <div className="support-row">
                      <span>{tx(language, 'Tabell 3b', 'Table 3b')}</span>
                      <strong>{formatNumber(semiTrailerResult.tableWeightKg, 0)} kg</strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Sluttvekt brukt', 'Final weight used')}</span>
                      <strong>{formatNumber(semiTrailerResult.finalAllowedWeightKg, 0)} kg</strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Begrenset av', 'Limited by')}</span>
                      <strong>{translateRuntimeText(semiTrailerResult.limitationReason, language)}</strong>
                    </div>
                  </div>
                </div>

                <div className="support-card">
                  <h3>{tx(language, 'Vekter fra kort / oppgave', 'Weights from card / record')}</h3>
                  <div className="support-grid">
                    <div className="support-row">
                      <span>{tx(language, 'Trekkvogn', 'Tractor')}</span>
                      <strong>
                        {semiTrailerResult.tractorAllowedWeightKg !== null
                          ? `${formatNumber(semiTrailerResult.tractorAllowedWeightKg, 0)} kg`
                          : tx(language, 'Ikke lagt inn', 'Not provided')}
                      </strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Egenvekt trekkvogn', 'Tractor own weight')}</span>
                      <strong>
                        {semiTrailerResult.tractorOwnWeightKg !== null
                          ? `${formatNumber(semiTrailerResult.tractorOwnWeightKg, 0)} kg`
                          : tx(language, 'Ikke lagt inn', 'Not provided')}
                      </strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Semitrailer', 'Semitrailer')}</span>
                      <strong>
                        {semiTrailerResult.trailerAllowedWeightKg !== null
                          ? `${formatNumber(semiTrailerResult.trailerAllowedWeightKg, 0)} kg`
                          : tx(language, 'Ikke lagt inn', 'Not provided')}
                      </strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Egenvekt semitrailer', 'Semitrailer own weight')}</span>
                      <strong>
                        {semiTrailerResult.trailerOwnWeightKg !== null
                          ? `${formatNumber(semiTrailerResult.trailerOwnWeightKg, 0)} kg`
                          : tx(language, 'Ikke lagt inn', 'Not provided')}
                      </strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Sum kjøretøyvekter', 'Sum vehicle weights')}</span>
                      <strong>
                        {semiTrailerResult.combinedCardWeightKg !== null
                          ? `${formatNumber(semiTrailerResult.combinedCardWeightKg, 0)} kg`
                          : tx(language, 'Mangler en av vektene', 'Missing one of the weights')}
                      </strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Sum egenvekter', 'Sum own weights')}</span>
                      <strong>
                        {semiTrailerResult.combinedOwnWeightKg !== null
                          ? `${formatNumber(semiTrailerResult.combinedOwnWeightKg, 0)} kg`
                          : tx(language, 'Mangler en av egenvektene', 'Missing one of the own weights')}
                      </strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Vogntogvekt', 'Combination weight')}</span>
                      <strong>
                        {semiTrailerResult.combinationCardWeightKg !== null
                          ? `${formatNumber(semiTrailerResult.combinationCardWeightKg, 0)} kg`
                          : tx(language, 'Ikke lagt inn', 'Not provided')}
                      </strong>
                    </div>
                    <div className="support-row">
                      <span>{tx(language, 'Tilgjengelig nyttelast', 'Available payload')}</span>
                      <strong>
                        {semiTrailerResult.availablePayloadKg !== null
                          ? `${formatNumber(semiTrailerResult.availablePayloadKg, 0)} kg`
                          : tx(language, 'Krever begge egenvekter', 'Requires both own weights')}
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="steps-card">
                  <h3>{tx(language, 'Steg for steg', 'Step by step')}</h3>
                  <ol>
                    {semiTrailerResult.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
                <div className="printable-summary" aria-hidden>
                  <h2>{tx(language, 'Sammendrag', 'Summary')}</h2>
                  <div>
                    <div><strong>{tx(language, 'Trekkvogn', 'Tractor')}</strong>: {formatNumber(semiTrailerResult.tractorAxles, 0)} {tx(language, 'aksler', 'axles')}</div>
                    <div><strong>{tx(language, 'Semitrailer', 'Semitrailer')}</strong>: {formatNumber(semiTrailerResult.trailerAxles, 0)} {tx(language, 'aksler', 'axles')}</div>
                    <div><strong>{tx(language, 'Minsteavstand', 'Minimum distance')}</strong>: {formatNumber(semiTrailerResult.minimumDistanceMeters, 2)} m</div>
                    <div><strong>{tx(language, 'Sluttvekt brukt', 'Final weight used')}</strong>: {formatNumber(semiTrailerResult.finalAllowedWeightKg, 0)} kg</div>
                  </div>
                  <h3>{tx(language, 'Tillatt aksellast per aksel', 'Allowed axle load per axle')}</h3>
                  <AxleWeightTable rows={trailerAxleDerivation.rows} warnings={trailerAxleDerivation.warnings} language={language} compact />
                </div>
              </>
            ) : (
              <div className="empty-state">
                      <p>
                        {isSpecialTransport
                          ? tx(language, 'Ingen spesialberegning ennå.', 'No special calculation yet.')
                          : tx(language, 'Ingen semi trailer-beregning ennå.', 'No semi trailer calculation yet.')}
                      </p>
                <span>{tx(language, 'Legg inn vogntogverdiene og trykk knappen for å bygge opp riktig grunnlag.', 'Enter the combination values and press the button to build the correct basis.')}</span>
              </div>
            )}
          </article>
        </section>
        </details>
      </main>
    );
  }

  return (
    <main className="ltp-shell">
      <GlobalTopControls language={language} onLanguageChange={setLanguage} theme={theme} onThemeChange={setTheme} />
      <div className="topbar-card">
        <div>
          <p className="eyebrow">{tx(language, 'Valgt kjøretøy', 'Selected vehicle')}</p>
          <h2>{selectedVehicleText?.label}</h2>
          <p className="topbar-text">{selectedVehicleText?.description}</p>
        </div>
        <div className="topbar-actions">
          <button type="button" className="secondary-button no-print" onClick={() => void handlePrint()}>
            {tx(language, 'Skriv ut / eksporter sammendrag', 'Print / export summary')}
          </button>
          <button type="button" className="secondary-button no-print" onClick={() => void handleResetSearch()}>
            {tx(language, 'Nullstill søk', 'Reset search')}
          </button>
          <button type="button" className="secondary-button" onClick={() => setScreen('choose')}>
            {tx(language, 'Bytt kjøretøy', 'Change vehicle')}
          </button>
        </div>
      </div>

      {tripCalculationKey > 0 ? renderTripMainView() : null}

      <details className="advanced-calculation-shell">
        <summary>{tx(language, 'Avansert beregning', 'Advanced calculation')}</summary>
      <section className="hero-card professional-hero">
        <div className="hero-copy">
          <p className="eyebrow">{tx(language, 'Vognkort inn → svar ut', 'Vehicle data in → answer out')}</p>
          <h1>{tx(language, 'Fyll inn akkurat det som står i vognkortet.', 'Enter exactly what is shown on the vehicle card.')}</h1>
          <p className="hero-text">
            {tx(
              language,
              'Du skal ikke skrive inn ekstra regnefelt. Velg kjøretøytype og tabell, og før deretter inn `Tillatt aksellast`, `Egenvekt aksel` og `Akselavstander` slik de står i vognkortet.',
              'You should not enter extra calculation fields. Choose vehicle type and table, then enter axle loads, axle own weights and axle distances as shown on the vehicle card.',
            )}
          </p>
        </div>

        <div className="hero-visual">
          <div className="hero-visual-media hero-visual-media--clean">
            <VehicleAxleVisual
              vehicleType={vehicleType}
              language={language}
              axleCount={Number(resolvedAxleCount)}
              axleVariant={axleVariant}
              hasTwoSteeringAxles={hasTwoSteeringAxles}
            />
          </div>
          <div className="visual-caption">
            {tx(
              language,
              'Bildet følger kjøretøytypen du har valgt, og feltene under er bygget rundt hvordan verdiene står i vognkortet.',
              'The image follows the selected vehicle type, and the fields below match how the values are shown on the vehicle card.',
            )}
          </div>
        </div>
      </section>

      <section className="workspace-grid">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">{tx(language, 'Fra vognkort', 'From vehicle card')}</p>
              <h2>{tx(language, 'Rolig flyt fra kjøretøyvalg til svar', 'Clean flow from vehicle choice to answer')}</h2>
            </div>
          </div>

          <div className="status-strip">
            <div className="status-chip">
              <span>{tx(language, 'Kjøretøy', 'Vehicle')}</span>
              <strong>{selectedVehicleText?.label}</strong>
            </div>
            <div className="status-chip">
              <span>{tx(language, 'Aksler', 'Axles')}</span>
              <strong>{resolvedAxleCount}</strong>
            </div>
            <div className="status-chip">
              <span>{tx(language, 'Vegliste', 'Road list')}</span>
              <strong>{getRoadProfileLabel(roadProfile)}</strong>
            </div>
            <div className="status-chip">
              <span>{tx(language, 'Drivlinje', 'Powertrain')}</span>
              <strong>
                {(() => {
                  const option = POWERTRAIN_OPTIONS.find((item) => item.value === powertrain);
                  return option ? tx(language, option.label, option.labelEn ?? option.label) : '';
                })()}
              </strong>
            </div>
          </div>

          <section className="step-card">
            <div className="step-head">
              <div>
                <h3>{tx(language, 'Steg 1 – Oppsett', 'Step 1 – Setup')}</h3>
                <p>{tx(language, 'Velg akseloppsettet som står i vognkortet.', 'Select the axle configuration from the vehicle card.')}</p>
                <small className="step-helper">{tx(language, 'Basert på punkt 8, 9 og 12 i vognkortet.', 'Based on sections 8, 9 and 12 of the vehicle card.')}</small>
              </div>
            </div>

            <div className="selector-grid compact-grid">
              <label className="select-block">
                <span className="select-label">{tx(language, 'Kjøretøytype', 'Vehicle type')}</span>
                <select value={vehicleType} onChange={handleVehicleChange} className="select-input">
                  {VEHICLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {getVehicleText(option.value, language).label}
                    </option>
                  ))}
                </select>
                <small className="select-note">
                  {selectedVehicleText?.description}
                </small>
              </label>

              <label className="select-block">
                <span className="select-label">{tx(language, 'Akseloppsett', 'Axle setup')}</span>
                <select
                  value={axleVariant}
                  onChange={(event) => {
                    applyAxleVariant(
                      event.target.value as AxleVariantKey,
                      setAxleVariant,
                      setAxleCount,
                      setTruckLayout,
                      setHasTwoSteeringAxles,
                    );
                  }}
                  className="select-input"
                >
                  {getAxleVariantOptions(vehicleType).map((option) => (
                    <option key={option.value} value={option.value}>
                      {tx(language, option.label, option.labelEn ?? option.label)}
                    </option>
                  ))}
                </select>
                  <small className="select-note">
                    {tx(language, getAxleVariant(axleVariant).description, getAxleVariant(axleVariant).descriptionEn ?? getAxleVariant(axleVariant).description)}
                  </small>
                  <small className="select-note">
                    {tx(language, 'Valgt oppsett brukes i beregningen.', 'Selected setup is used in the calculation.')}
                  </small>
              </label>

              <label className="select-block">
                <span className="select-label">{tx(language, 'Bruksklasse / tabell', 'Road class / table')}</span>
                <select
                  value={roadProfile}
                  onChange={(event) => setRoadProfile(event.target.value as RoadProfile)}
                  className="select-input"
                >
                  {ROAD_PROFILES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {tx(language, option.label, option.labelEn ?? option.label)}
                    </option>
                  ))}
                </select>
                <small className="select-note">
                    {(() => {
                      const option = ROAD_PROFILES.find((item) => item.value === roadProfile);
                      return option ? tx(language, option.description, option.descriptionEn ?? option.description) : '';
                    })()}
                </small>
              </label>

              <label className="select-block">
                <span className="select-label">{tx(language, 'Drivlinje', 'Powertrain')}</span>
                <select
                  value={powertrain}
                  onChange={(event) => setPowertrain(event.target.value as Powertrain)}
                  className="select-input"
                >
                  {POWERTRAIN_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {tx(language, option.label, option.labelEn ?? option.label)}
                    </option>
                  ))}
                </select>
                <small className="select-note">
                    {(() => {
                      const option = POWERTRAIN_OPTIONS.find((item) => item.value === powertrain);
                      return option ? tx(language, option.description, option.descriptionEn ?? option.description) : '';
                    })()}
                </small>
              </label>
            </div>
          </section>

          <section className="step-card step-card--accent">
            <div className="step-head">
                <span className="step-badge">{tx(language, 'Steg 2', 'Step 2')}</span>
              <div>
                <h3>{tx(language, 'Vognkortverdier', 'Vehicle card values')}</h3>
                <p>{tx(language, 'Skriv inn linjene akkurat slik de står i vognkortet, med skråstrek mellom verdiene.', 'Enter the lines exactly as shown on the vehicle card, with slashes between the values.')}</p>
              </div>
            </div>

            <div className="field-list field-list--two">
              <InputField name="allowedAxleLoads" value={form.allowedAxleLoads} onChange={handleInputChange} language={language} />
              <InputField name="axleOwnWeights" value={form.axleOwnWeights} onChange={handleInputChange} language={language} />
              <InputField name="grossOwnWeightWithDriver" value={form.grossOwnWeightWithDriver} onChange={handleInputChange} language={language} />
              <InputField name="axleDistances" value={form.axleDistances} onChange={handleInputChange} language={language} />
            </div>

            <div className="step-card" style={{ marginTop: 10 }}>
              <div className="step-head">
                <span className="step-badge">{tx(language, 'Valgfritt', 'Optional')}</span>
                <div>
                  <h3>{tx(language, 'Tilhenger (valgfritt)', 'Trailer (optional)')}</h3>
                  <p className="hero-text">{tx(language, 'Hvis du vil hente eller legge inn tilhengerdata, bruk feltet under.', 'If you want to fetch or enter trailer data, use the fields below.')}</p>
                </div>
              </div>

              <div className="field-list field-list--two">
                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Tilhengerskilt', 'Trailer plate')}</span>
                    <span className="field-unit" />
                  </span>
                  <div className="trailer-lookup-card">
                    <input
                      type="text"
                      value={trailerRegistrationNumber}
                      onChange={(e) => setTrailerRegistrationNumber(e.target.value)}
                      placeholder={tx(language, 'Eksempel: AB12345', 'Example: AB12345')}
                      className="field-input"
                    />
                    <button type="button" className="registration-button trailer-lookup-button" onClick={() => void handleTrailerLookup()} disabled={trailerLookupLoading}>
                      {trailerLookupLoading ? tx(language, 'Henter...', 'Fetching...') : tx(language, 'Hent tilhenger', 'Fetch trailer')}
                    </button>
                  </div>
                  <span className="field-source">{tx(language, 'Valgfritt: henter vognkort for tilhenger hvis tilgjengelig.', 'Optional: fetch trailer vehicle card if available.')}</span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Tilhenger - tillatt aksellast', 'Trailer - allowed axle loads')}</span>
                    <span className="field-unit">kg</span>
                  </span>
                  <input
                    name="trailerAllowedAxleLoads"
                    type="text"
                    value={semiTrailerForm.trailerAllowedAxleLoads}
                    onChange={(e) => setSemiTrailerForm((c) => ({ ...c, trailerAllowedAxleLoads: e.target.value }))}
                    placeholder={tx(language, FIELD_EXAMPLES.allowedAxleLoads, FIELD_EXAMPLES_EN.allowedAxleLoads)}
                    className="field-input"
                  />
                  <span className="field-source">{tx(language, 'Fra trailerkort punkt 8, f.eks. 12000/12000', 'From trailer card point 8, e.g. 12000/12000')}</span>
                </label>
              </div>
            </div>

            {isBusVehicle ? (
              <div className="field-list field-list--two">
                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Sitteplasser', 'Seating capacity')}</span>
                    <span className="field-unit">{tx(language, 'stk', 'pcs')}</span>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={busSeatCount}
                    onChange={(event) => setBusSeatCount(event.target.value)}
                    placeholder={tx(language, 'Eksempel: 49', 'Example: 49')}
                    className="field-input"
                  />
                  <span className="field-source">
                    {tx(language, 'Fra vognkort punkt 11: antall sitteplasser i alt minus bussjåføren.', 'From vehicle card point 11: total seating capacity minus the bus driver.')}
                  </span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Ståplasser', 'Standing places')}</span>
                    <span className="field-unit">{tx(language, 'stk', 'pcs')}</span>
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    step="1"
                    value={busStandingCount}
                    onChange={(event) => setBusStandingCount(event.target.value)}
                    placeholder={tx(language, 'Eksempel: 24', 'Example: 24')}
                    className="field-input"
                  />
                  <span className="field-source">{tx(language, 'Fra vognkort punkt 11: antall ståplasser hvis det står oppført.', 'From vehicle card point 11: standing places if listed.')}</span>
                </label>

                <label className="field-card">
                  <span className="field-header">
                    <span>{tx(language, 'Standardvekt per passasjer', 'Standard weight per passenger')}</span>
                    <span className="field-unit">kg</span>
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="1"
                    step="any"
                    value={busPassengerWeightKg}
                    onChange={(event) => setBusPassengerWeightKg(event.target.value)}
                    placeholder={tx(language, 'Eksempel: 75', 'Example: 75')}
                    className="field-input"
                  />
                  <span className="field-source">{tx(language, 'Endre denne hvis dere bruker en annen standardvekt per person.', 'Change this if you use another standard weight per person.')}</span>
                </label>
              </div>
            ) : null}
          </section>

          {showAdvancedOptions ? (
            <details className="advanced-card">
            <summary className="advanced-summary">
              <span>{tx(language, 'Vis flere regler og hjuloppsett', 'Show more rules and wheel setup')}</span>
              <span className="advanced-summary-note">{tx(language, 'Fotnoter, luftfjæring, hjul og teknologi', 'Footnotes, air suspension, wheels and technology')}</span>
            </summary>

            <div className="advanced-content">
              {isTruck ? (
              <div className="selector-grid compact-grid">
                <label className="select-block">
                  <span className="select-label">{tx(language, 'Luftfjæring', 'Air suspension')}</span>
                  <select
                    value={hasAirSuspension ? 'yes' : 'no'}
                    onChange={(event) => setHasAirSuspension(event.target.value === 'yes')}
                    className="select-input"
                  >
                    <option value="yes">{tx(language, 'Ja', 'Yes')}</option>
                    <option value="no">{tx(language, 'Nei', 'No')}</option>
                  </select>
                  <small className="select-note">{tx(language, 'Bruk dette når fotnote 2 krever luftfjæring.', 'Use this when footnote 2 requires air suspension.')}</small>
                </label>

                <label className="select-block">
                  <span className="select-label">{tx(language, 'Drivaksler', 'Drive axles')}</span>
                  <select
                    value={driveAxleCount}
                    onChange={(event) => setDriveAxleCount(event.target.value)}
                    className="select-input"
                  >
                    <option value="1">{tx(language, '1 drivaksel', '1 drive axle')}</option>
                    <option value="2">{tx(language, '2 drivaksler', '2 drive axles')}</option>
                  </select>
                  <small className="select-note">{tx(language, 'Bruk antall aksler med drift fra vognkort punkt 12.', 'Use the number of driven axles from vehicle card point 12.')}</small>
                </label>

                <label className="select-block">
                  <span className="select-label">{tx(language, 'Hjul foran', 'Front wheel setup')}</span>
                  <select
                    value={frontWheelSetup}
                    onChange={(event) => setFrontWheelSetup(event.target.value as WheelSetup)}
                    className="select-input"
                  >
                    {WHEEL_SETUP_OPTIONS.map((option) => (
                      <option key={`front-${option.value}`} value={option.value}>
                        {tx(language, option.label, option.labelEn ?? option.label)}
                      </option>
                    ))}
                  </select>
                  <small className="select-note">
                    {(() => {
                      const option = WHEEL_SETUP_OPTIONS.find((item) => item.value === frontWheelSetup);
                      return option ? tx(language, option.description, option.descriptionEn ?? option.description) : '';
                    })()}
                  </small>
                </label>

                <label className="select-block">
                  <span className="select-label">{tx(language, 'Hjul bak / drivaksel', 'Rear wheel / drive axle')}</span>
                  <select
                    value={rearWheelSetup}
                    onChange={(event) => setRearWheelSetup(event.target.value as WheelSetup)}
                    className="select-input"
                  >
                    {WHEEL_SETUP_OPTIONS.map((option) => (
                      <option key={`rear-${option.value}`} value={option.value}>
                        {tx(language, option.label, option.labelEn ?? option.label)}
                      </option>
                    ))}
                  </select>
                  <small className="select-note">
                    {rearWheelSetup === 'single'
                      ? tx(language, 'Regnes ikke som tvillinghjul i fotnote 2.', 'Does not count as dual wheels in footnote 2.')
                      : tx(language, 'Brukes som tvillinghjul / flere hjul i fotnote 2.', 'Used as dual wheels / multiple wheels in footnote 2.')}
                  </small>
                </label>

                <label className="select-block">
                  <span className="select-label">{tx(language, 'Begge drivaksler ≤ 9,5 t', 'Both drive axles ≤ 9.5 t')}</span>
                  <select
                    value={allDriveAxlesAtOrUnderNinePointFiveTons ? 'yes' : 'no'}
                    onChange={(event) => setAllDriveAxlesAtOrUnderNinePointFiveTons(event.target.value === 'yes')}
                    className="select-input"
                    disabled={vehicleType !== 'truck' || driveAxleCount !== '2'}
                  >
                    <option value="no">{tx(language, 'Nei / vet ikke', 'No / unknown')}</option>
                    <option value="yes">{tx(language, 'Ja', 'Yes')}</option>
                  </select>
                  <small className="select-note">{tx(language, 'Trengs bare når du har to drivaksler.', 'Only needed when you have two drive axles.')}</small>
                </label>

                <label className="select-block">
                  <span className="select-label">{tx(language, 'To styrende aksler', 'Two steering axles')}</span>
                  <select
                    value={hasTwoSteeringAxles ? 'yes' : 'no'}
                    onChange={(event) => {
                      const nextHasTwoSteeringAxles = event.target.value === 'yes';
                      setHasTwoSteeringAxles(nextHasTwoSteeringAxles);
                      if (vehicleType === 'truck' && resolvedAxleCount === '4') {
                        setAxleVariant(nextHasTwoSteeringAxles ? 'truck_4_double_steer_bogie' : 'truck_4_rear_tridem');
                      }
                    }}
                    className="select-input"
                    disabled={vehicleType !== 'truck' || resolvedAxleCount !== '4'}
                  >
                    <option value="no">{tx(language, 'Nei', 'No')}</option>
                    <option value="yes">{tx(language, 'Ja', 'Yes')}</option>
                  </select>
                  <small className="select-note">{tx(language, 'Bruk ja hvis punkt 15 sier to styrende aksler / friksjonsstyrt.', 'Use yes if point 15 says two steering axles / friction steering.')}</small>
                </label>
              </div>
              ) : null}

              {showTechnologyWeightInput ? (
                <div className="selector-grid compact-grid">
                  <label className="select-block">
                    <span className="select-label">{tx(language, 'Batteri-/teknologivekt', 'Battery / technology weight')}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={technologyWeight}
                      onChange={(event) => setTechnologyWeight(event.target.value)}
                      placeholder={tx(language, 'Eksempel: 2000', 'Example: 2000')}
                      className="field-input"
                    />
                    <small className="select-note">
                      {tx(language, 'Vekten av batteri / alternativ drivstoffteknologi i kg. Gjelder bare fotnotetillegg i Bk10 / 50.', 'Weight of battery / alternative fuel technology in kg. Applies only to footnote additions in Bk10 / 50.')}
                    </small>
                  </label>
                </div>
              ) : null}
            </div>
            </details>
          ) : null}

          <section className="step-card">
            <div className="step-head">
                <span className="step-badge">{tx(language, 'Steg 3', 'Step 3')}</span>
              <div>
                <h3>{tx(language, 'Beregn resultatet', 'Calculate the result')}</h3>
                <p>{tx(language, 'Når du har fylt inn alle feltene, kan du beregne LTP og totalvekt.', 'When all fields are filled in, you can calculate LTP and total weight.')}</p>
              </div>
            </div>

            <div className="button-group">
              <button type="button" className="primary-button" onClick={handleCalculate}>
                {tx(language, 'Beregn LTP og totalvekt', 'Calculate LTP and total weight')}
              </button>
              <button type="button" className="secondary-button" onClick={handleReset}>
                {tx(language, 'Nullstill', 'Reset')}
              </button>
            </div>

            {error ? <div className="error-message">{error}</div> : null}
          </section>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <p className="panel-kicker">{tx(language, 'Resultat', 'Result')}</p>
            <h2>{tx(language, 'Resultat', 'Result')}</h2>
          </div>

          {result ? (
            <>
              <VehicleAxleVisual
                vehicleType={vehicleType}
                language={language}
                axleCount={result.axleCount}
                axleVariant={axleVariant}
                hasTwoSteeringAxles={hasTwoSteeringAxles}
              />

              <div className="dual-highlight">
                <div className="result-highlight ltp-highlight">
                  <p className="result-label">{tx(language, 'Lastepunkt', 'Loading point')}</p>
                  {result.ltp.status === 'ready' ? (
                    <>
                      <strong>{formatNumber(result.ltp.ltpCm ?? 0)} cm</strong>
                      <p>{translateRuntimeText(result.ltp.message, language)}</p>
                    </>
                  ) : (
                    <>
                      <strong>{tx(language, 'Ikke klar', 'Not ready')}</strong>
                      <p>{translateRuntimeText(result.ltp.message, language)}</p>
                    </>
                  )}
                </div>

                <div className="result-highlight weight-highlight">
                  <p className="result-label">{tx(language, 'Sluttvekt', 'Final weight')}</p>
                  <strong>{formatNumber(result.totalWeightWithTechnologyTons, 1)} {tx(language, 'tonn', 'tons')}</strong>
                  <p>{translateRuntimeText(result.tableContext, language)}</p>
                </div>

                {result.busPassengerLoad ? (
                  <div className="result-highlight passenger-highlight">
                    <p className="result-label">{tx(language, 'Last per passasjer', 'Load per passenger')}</p>
                    {result.busPassengerLoad.status === 'ready' ? (
                      <>
                        <strong>{formatNumber(result.busPassengerLoad.perPersonLoadKg ?? 0, 0)} kg</strong>
                        <p>{translateRuntimeText(result.busPassengerLoad.message, language)}</p>
                      </>
                    ) : (
                      <>
                        <strong>{tx(language, 'Ikke klar', 'Not ready')}</strong>
                        <p>{translateRuntimeText(result.busPassengerLoad.message, language)}</p>
                      </>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="support-card">
                <h3>{tx(language, 'Tillatt aksellast per aksel', 'Allowed axle load per axle')}</h3>
                <AxleWeightTable rows={vehicleAxleDerivation.rows} warnings={vehicleAxleDerivation.warnings} language={language} />
                <div className="support-grid axle-list-fallback">
                  {buildAxleWeightRows(result.allowedLoads, result.ownWeights).map((row) => (
                    <div className="support-row" key={`result-axle-${row.axle}`}>
                      <span>{tx(language, 'Aksel', 'Axle')} {row.axle}</span>
                      <strong>
                        {tx(language, 'Tillatt', 'Allowed')}: {row.allowedKg !== null ? `${formatNumber(row.allowedKg, 0)} kg` : tx(language, 'mangler', 'missing')}
                        {' · '}
                        {tx(language, 'Egenvekt/tara', 'Own/tare')}: {row.ownKg !== null ? `${formatNumber(row.ownKg, 0)} kg` : tx(language, 'mangler', 'missing')}
                        {row.payloadKg !== null ? ` · ${tx(language, 'Rest', 'Remaining')}: ${formatNumber(row.payloadKg, 0)} kg` : ''}
                      </strong>
                    </div>
                  ))}
                  {result.ltp.driverWeightKg > 0 ? (
                    <div className="support-row">
                      <span>{tx(language, 'Fører lagt på foraksel', 'Driver added to front axle')}</span>
                      <strong>{formatNumber(result.ltp.driverWeightKg, 0)} kg</strong>
                    </div>
                  ) : null}
                </div>
              </div>

              {trailerAllowedDisplayWeights.length > 0 || trailerOwnDisplayWeights.length > 0 ? (
                <div className="support-card">
                  <h3>{tx(language, 'Tilhenger: tillatt aksellast per aksel', 'Trailer: allowed axle load per axle')}</h3>
                  <AxleWeightTable rows={trailerAxleDerivation.rows} warnings={trailerAxleDerivation.warnings} language={language} />
                </div>
              ) : null}

              <div className="support-card">
                <h3>{tx(language, 'Oppsett brukt', 'Setup used')}</h3>
                <div className="support-grid">
                  <div className="support-row">
                    <span>{tx(language, 'Kjøretøy', 'Vehicle')}</span>
                    <strong>{selectedVehicleText?.label}</strong>
                  </div>
                  <div className="support-row">
                    <span>{tx(language, 'Aksler', 'Axles')}</span>
                    <strong>{result.axleCount}</strong>
                  </div>
                  <div className="support-row">
                    <span>{tx(language, 'Akselavstander', 'Axle distances')}</span>
                    <strong>{formatNumber(result.totalAxleDistanceMeters, 2)} m</strong>
                  </div>
                  <div className="support-row">
                    <span>{tx(language, 'Bruksklasse', 'Road class')}</span>
                    <strong>{getRoadProfileLabel(result.roadProfile)}</strong>
                  </div>
                  <div className="support-row">
                    <span>{tx(language, 'Drivlinje', 'Powertrain')}</span>
                      <strong>
                        {(() => {
                          const option = POWERTRAIN_OPTIONS.find((o) => o.value === result.powertrain);
                          return option ? tx(language, option.label, option.labelEn ?? option.label) : '';
                        })()}
                      </strong>
                  </div>
                  {result.totalWeightWithTechnologyTons > result.tableWeightTons ? (
                    <div className="support-row">
                      <span>{tx(language, 'Fotnotetillegg', 'Footnote addition')}</span>
                      <strong>{formatNumber(result.extraTechnologyWeightTons, 1)} {tx(language, 'tonn', 'tons')}</strong>
                    </div>
                  ) : null}
                </div>
              </div>

              {result.weightRuleNotes.length > 0 ? (
                <div className="support-card">
                  <h3>{tx(language, 'Regler brukt', 'Rules used')}</h3>
                  <ul className="notes-list">
                    {result.weightRuleNotes.map((note) => (
                      <li key={note}>{translateRuntimeText(note, language)}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="support-card">
                <h3>{tx(language, 'Steg for steg', 'Step by step')}</h3>
                <ol>
                  {result.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
              <div className="printable-summary" aria-hidden>
                <h2>{tx(language, 'Sammendrag', 'Summary')}</h2>
                <div>
                  <div><strong>{tx(language, 'Registreringsnummer', 'Registration')}</strong>: {registrationNumber || tx(language, 'Ikke lagt inn', 'Not provided')}</div>
                  <div><strong>{tx(language, 'Kjøretøy', 'Vehicle')}</strong>: {selectedVehicleText?.label}</div>
                  <div><strong>{tx(language, 'Lastepunkt', 'Loading point')}</strong>: {result.ltp.status === 'ready' ? `${formatNumber(result.ltp.ltpCm ?? 0)} cm` : tx(language, 'Ikke klar', 'Not ready')}</div>
                  <div><strong>{tx(language, 'Sluttvekt', 'Final weight')}</strong>: {formatNumber(result.totalWeightWithTechnologyTons, 1)} {tx(language, 'tonn', 'tons')}</div>
                </div>
                <h3>{tx(language, 'Tillatt aksellast per aksel', 'Allowed axle load per axle')}</h3>
                <AxleWeightTable rows={vehicleAxleDerivation.rows} warnings={vehicleAxleDerivation.warnings} language={language} compact />
                {trailerAllowedDisplayWeights.length > 0 || trailerOwnDisplayWeights.length > 0 ? (
                  <>
                    <h3>{tx(language, 'Tilhenger: tillatt aksellast per aksel', 'Trailer: allowed axle load per axle')}</h3>
                    <AxleWeightTable rows={trailerAxleDerivation.rows} warnings={trailerAxleDerivation.warnings} language={language} compact />
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>
                {tx(language, 'Ingen beregning ennå.', 'No calculation yet.')}
              </p>
              <span>{tx(language, 'Legg inn vognkortverdiene og trykk knappen for å beregne LTP og totalvekt.', 'Enter the vehicle-card values and press the button to calculate LTP and total weight.')}</span>
            </div>
          )}
        </article>
      </section>
      </details>
    </main>
    );
  }
