import type {
  AxleVariantKey,
  FormField,
  FormState,
  Powertrain,
  RoadProfile,
  TrailerFamily,
  TruckLayout,
  VehicleType,
  WheelSetup,
} from './types';
export const INITIAL_FORM: FormState = {
  allowedAxleLoads: '',
  axleOwnWeights: '',
  axleDistances: '',
  grossOwnWeightWithDriver: '',
};

export const ROAD_PROFILES: { value: RoadProfile; label: string; labelEn?: string; description: string; descriptionEn?: string }[] = [
  { value: 'Bk10_50', label: 'Bk10 / 50', labelEn: 'Bk10 / 50', description: 'Velg denne dersom veglisten viser Bk10/50.', descriptionEn: 'Choose this if the road list shows Bk10/50.' },
  { value: 'Bk10_42', label: 'Bk10 / 42', labelEn: 'Bk10 / 42', description: 'Velg denne dersom veglisten viser Bk10/42.', descriptionEn: 'Choose this if the road list shows Bk10/42.' },
  { value: 'BkT8_50', label: 'BkT8 / 50', labelEn: 'BkT8 / 50', description: 'Velg denne dersom veglisten viser BkT8/50.', descriptionEn: 'Choose this if the road list shows BkT8/50.' },
  { value: 'BkT8_40', label: 'BkT8 / 40', labelEn: 'BkT8 / 40', description: 'Velg denne dersom veglisten viser BkT8/40.', descriptionEn: 'Choose this if the road list shows BkT8/40.' },
  { value: 'Bk8_32', label: 'Bk8 / 32', labelEn: 'Bk8 / 32', description: 'Velg denne dersom veglisten viser Bk8/32.', descriptionEn: 'Choose this if the road list shows Bk8/32.' },
  { value: 'Bk6_28', label: 'Bk6 / 28', labelEn: 'Bk6 / 28', description: 'Velg denne dersom veglisten viser Bk6/28.', descriptionEn: 'Choose this if the road list shows Bk6/28.' },
];

export const POWERTRAIN_OPTIONS: { value: Powertrain; label: string; labelEn?: string; description: string; descriptionEn?: string }[] = [
  { value: 'diesel', label: 'Diesel / vanlig', labelEn: 'Diesel / regular', description: 'Ingen ekstra tilleggsvekt.', descriptionEn: 'No added weight.' },
  { value: 'alternativeFuel', label: 'Alternativt drivstoff', labelEn: 'Alternative fuel', description: 'Kan gi inntil 1 tonn ekstra der regelen gjelder.', descriptionEn: 'May give up to 1 ton extra where the rule applies.' },
  { value: 'zeroEmission', label: 'El / nullutslipp', labelEn: 'Electric / zero emission', description: 'Kan gi inntil 2 tonn ekstra der regelen gjelder.', descriptionEn: 'May give up to 2 tons extra where the rule applies.' },
];

export const VEHICLE_OPTIONS: { value: VehicleType; label: string; labelEn?: string; description: string; descriptionEn?: string }[] = [
  { value: 'truck', label: 'Lastebil', labelEn: 'Truck', description: 'Bruk for motorvogn / lastebil.', descriptionEn: 'Use for rigid trucks / motor vehicles.' },
  { value: 'semiTrailer', label: 'Semi trailer', labelEn: 'Semi trailer', description: 'Bruk for trekkvogn med semitrailer / vogntog.', descriptionEn: 'Use for tractor unit with semitrailer / vehicle combination.' },
  { value: 'specialTransport', label: 'Spesialtyper', labelEn: 'Special types', description: 'Modulvogntog, tømmer, dolly/semi og andre spesialrader.', descriptionEn: 'Modular combinations, timber, dolly/semi and other special rows.' },
  { value: 'bus', label: 'Buss', labelEn: 'Bus', description: 'Bruk for buss med 2 eller 3 aksler.', descriptionEn: 'Use for buses with 2 or 3 axles.' },
  { value: 'articulatedBus', label: 'Leddbuss', labelEn: 'Articulated bus', description: 'Bruk for leddbuss.', descriptionEn: 'Use for articulated buses.' },
];

export const WHEEL_SETUP_OPTIONS: { value: WheelSetup; label: string; labelEn?: string; description: string; descriptionEn?: string }[] = [
  { value: 'single', label: 'Enkle hjul', labelEn: 'Single wheels', description: 'Vanlig enkel hjulmontering.', descriptionEn: 'Standard single wheel mounting.' },
  { value: 'double', label: 'Doble hjul', labelEn: 'Dual wheels', description: 'Tvillinghjul / doble hjul.', descriptionEn: 'Twin/dual wheels.' },
  { value: 'multiple', label: 'Flere hjul', labelEn: 'Multiple wheels', description: 'Bruk denne hvis oppsettet er mer enn vanlig tvilling.', descriptionEn: 'Use this when the setup has more than common twin wheels.' },
];


export const TRUCK_LAYOUT_OPTIONS: { value: TruckLayout; label: string; labelEn?: string; description: string; descriptionEn?: string }[] = [
  { value: 'standard', label: 'Standard oppsett', labelEn: 'Standard layout', description: 'Vanlig lastebiloppsett.', descriptionEn: 'Typical truck layout.' },
  { value: 'doubleSteerRearBogie', label: '2 styrende + boggi', labelEn: '2 steering + bogie', description: 'Bruk denne når bilen har to styrende aksler foran og bakre boggi.', descriptionEn: 'Use this when the vehicle has two steering axles at the front and a rear bogie.' },
];

export const AXLE_VARIANT_OPTIONS: {
  value: AxleVariantKey;
  vehicleTypes: VehicleType[];
  label: string;
  labelEn?: string;
  description: string;
  descriptionEn?: string;
}[] = [
  { value: 'truck_2_single', vehicleTypes: ['truck'], label: '2 aksler', labelEn: '2 axles', description: 'En foraksel og en bakaksel. Velg oppsettet slik det står i vognkortet eller oppgaven.', descriptionEn: 'One front axle and one rear axle. Select the setup shown on the vehicle card or task.' },
  { value: 'truck_3_rear_bogie', vehicleTypes: ['truck'], label: '3 aksler', labelEn: '3 axles', description: 'En foraksel og boggi (to aksler) bak. Boggi = to aksler i gruppe.', descriptionEn: 'One front axle and bogie (two axles) at rear. Bogie = two axles in a group.' },
  { value: 'truck_4_rear_tridem', vehicleTypes: ['truck'], label: '4 aksler', labelEn: '4 axles', description: 'En foraksel og tridem (tre aksler) bak. Tridem = tre aksler i gruppe.', descriptionEn: 'One front axle and tridem (three axles) at rear. Tridem = three axles in a group.' },
  { value: 'truck_4_double_steer_bogie', vehicleTypes: ['truck'], label: '2 styrende + boggi', labelEn: '2 steering + bogie', description: 'To styrende foraksler og boggi (to aksler) bak. Spesialkonfigurasjon.', descriptionEn: 'Two steering front axles and bogie (two axles) at rear. Special configuration.' },
  { value: 'truck_5_double_steer_tridem', vehicleTypes: ['truck'], label: '2 styrende + tridem', labelEn: '2 steering + tridem', description: 'To styrende foraksler og tridem (tre aksler) bak. Spesialkonfigurasjon.', descriptionEn: 'Two steering front axles and tridem (three axles) at rear. Special configuration.' },
  { value: 'bus_2_single', vehicleTypes: ['bus'], label: '2 aksler', labelEn: '2 axles', description: 'En foraksel og en bakaksel. Velg oppsettet slik det står i vognkortet eller oppgaven.', descriptionEn: 'One front axle and one rear axle. Select the setup shown on the vehicle card or task.' },
  { value: 'bus_3_rear_bogie', vehicleTypes: ['bus'], label: '3 aksler', labelEn: '3 axles', description: 'En foraksel og boggi (to aksler) bak. Boggi = to aksler i gruppe.', descriptionEn: 'One front axle and bogie (two axles) at rear. Bogie = two axles in a group.' },
  { value: 'articulated_bus', vehicleTypes: ['articulatedBus'], label: 'Leddbuss', labelEn: 'Articulated bus', description: 'Leddbuss med aksler fordelt over to ledd. Velg oppsettet slik det står i vognkortet eller oppgaven.', descriptionEn: 'Articulated bus with axles distributed over two segments. Select the setup shown on the vehicle card or task.' },
  { value: 'semi_1_axle', vehicleTypes: ['semiTrailer'], label: '1 aksel', labelEn: '1 axle', description: 'Enkelt traileraksel. Brukes i vogntogtabellen når tilhengeren har en aksel.', descriptionEn: 'Single trailer axle. Used in the combination table when the trailer has one axle.' },
  { value: 'semi_2_axle', vehicleTypes: ['semiTrailer'], label: '2 aksler', labelEn: '2 axles', description: 'Vanlig 2-akslet trailer med boggi. Mest brukt.', descriptionEn: 'Standard 2-axle trailer with bogie. Most common.' },
  { value: 'semi_2_axle_forced_steer', vehicleTypes: ['semiTrailer', 'specialTransport'], label: '2 aksler + tvangsstyrt', labelEn: '2 axles + forced-steer', description: 'To aksler med tvangsstyring på siste aksel. Egen rad i kjøretøyvekttabellen når vilkårene er oppfylt.', descriptionEn: 'Two axles with forced steering on the last axle. Separate row in vehicle weight table when conditions are met.' },
  { value: 'semi_3_plus', vehicleTypes: ['semiTrailer', 'specialTransport'], label: '3 aksler eller mer', labelEn: '3 axles or more', description: 'Trippelboggi eller flere aksler på tilhengeren.', descriptionEn: 'Triple bogie or more axles on the trailer.' },
  { value: 'semi_bogie_forced_steer', vehicleTypes: ['semiTrailer', 'specialTransport'], label: 'Boggi + tvangsstyrt', labelEn: 'Bogie + forced-steer', description: 'Boggi (to aksler) med etterfølgende tvangsstyrt aksel. Spesialrad i kjøretøyvekttabellen.', descriptionEn: 'Bogie (two axles) with subsequent forced-steer axle. Special row in vehicle weight table.' },
  { value: 'dolly_semitrailer_2', vehicleTypes: ['specialTransport'], label: '2 + 2 aksler', labelEn: '2 + 2 axles', description: 'Dolly (2 aksler) + semitrailer (2 aksler). Spesialrader i kjøretøyvekttabellen.', descriptionEn: 'Dolly (2 axles) + semi-trailer (2 axles). Special rows in vehicle weight table.' },
  { value: 'dolly_semitrailer_3', vehicleTypes: ['specialTransport'], label: '2 + 3 aksler', labelEn: '2 + 3 axles', description: 'Dolly (2 aksler) + semitrailer (3 aksler). Spesialrader i kjøretøyvekttabellen.', descriptionEn: 'Dolly (2 axles) + semi-trailer (3 axles). Special rows in vehicle weight table.' },
  { value: 'dolly_semitrailer_4_plus', vehicleTypes: ['specialTransport'], label: '2 + 4 aksler', labelEn: '2 + 4 axles', description: 'Dolly (2 aksler) + semitrailer (4+ aksler). Spesialrader i kjøretøyvekttabellen.', descriptionEn: 'Dolly (2 axles) + semi-trailer (4+ axles). Special rows in vehicle weight table.' },
  { value: 'modular_timber', vehicleTypes: ['specialTransport'], label: 'Modul / tømmer', labelEn: 'Modular / timber', description: 'Egne veglister, tabeller og særregler for modul- og tommervogntog. Krever manuell kontroll.', descriptionEn: 'Dedicated road lists, tables and special rules for modular and timber combinations. Requires manual verification.' },
];

export const TRAILER_FAMILY_OPTIONS: { value: TrailerFamily; label: string; labelEn?: string; description: string; descriptionEn?: string }[] = [
  { value: 'semitrailer', label: 'Semitrailer', labelEn: 'Semi-trailer', description: 'Trekkvogn med semitrailer. Bruk tabell 3b i kjøretøyvekttabellen.', descriptionEn: 'Tractor unit with semi-trailer. Use table 3b in the vehicle weight table.' },
  { value: 'drawbar', label: 'Påhengsvogn', labelEn: 'Drawbar trailer', description: 'Motorvogn med påhengsvogn. Bruk tabell 3a i kjøretøyvekttabellen.', descriptionEn: 'Motor vehicle with drawbar trailer. Use table 3a in the vehicle weight table.' },
  { value: 'dollySemi', label: 'Dolly + semitrailer', labelEn: 'Dolly + semi-trailer', description: 'Slepvogn/dolly med semitrailer. Har egne rader i kjøretøyvekttabellen (spesialrader).', descriptionEn: 'Drawbar/dolly with semi-trailer. Has dedicated rows in the vehicle weight table (special rows).' },
  { value: 'moduleTimber', label: 'Modul / tømmer', labelEn: 'Modular / timber', description: 'Modulvogntog eller tømmervogntog med egne veglister, tabeller og særregler. Krever manuell kontroll.', descriptionEn: 'Modular or timber combination with dedicated road lists, tables and special rules. Requires manual verification.' },
];

export const FIELD_LABELS: Record<FormField, string> = {
  allowedAxleLoads: 'Tillatt aksellast',
  axleOwnWeights: 'Egenvekt aksel',
  axleDistances: 'Akselavstander',
  grossOwnWeightWithDriver: 'Egenvekt med fører',
};

export const FIELD_LABELS_EN: Record<FormField, string> = {
  allowedAxleLoads: 'Allowed axle load',
  axleOwnWeights: 'Axle own weight',
  axleDistances: 'Axle distances',
  grossOwnWeightWithDriver: 'Gross own weight with driver',
};

export const FIELD_UNITS: Record<FormField, string> = {
  allowedAxleLoads: 'kg',
  axleOwnWeights: 'kg',
  axleDistances: 'mm',
  grossOwnWeightWithDriver: 'kg',
};

export const FIELD_EXAMPLES: Record<FormField, string> = {
  allowedAxleLoads: 'Eksempel: 18000/26000',
  axleOwnWeights: 'Eksempel: 9000/7100',
  axleDistances: 'Eksempel: 1500/3500/1390',
  grossOwnWeightWithDriver: 'Eksempel: 16175',
};

export const FIELD_EXAMPLES_EN: Record<FormField, string> = {
  allowedAxleLoads: 'Example: 18000/26000',
  axleOwnWeights: 'Example: 9000/7100',
  axleDistances: 'Example: 1500/3500/1390',
  grossOwnWeightWithDriver: 'Example: 16175',
};

export const FIELD_HELP: Record<FormField, string> = {
  allowedAxleLoads: 'Fra vognkort punkt 8: skriv verdiene akkurat slik de står, skilt med /.',
  axleOwnWeights: 'Fra vognkort punkt 8: bruk verdien under "Egenvekt aksel".',
  axleDistances: 'Fra vognkort punkt 9 (M): bruk akselavstandene i samme rekkefølge.',
  grossOwnWeightWithDriver: 'Fra vognkort punkt 8: bruk verdien under "Egenvekt med fører".',
};

export const FIELD_HELP_EN: Record<FormField, string> = {
  allowedAxleLoads: 'From the vehicle card point 8: enter the values exactly as shown, separated by /.',
  axleOwnWeights: 'From vehicle card point 8: use the value under "Axle own weight".',
  axleDistances: 'From vehicle card point 9 (M): use the axle distances in the same order.',
  grossOwnWeightWithDriver: 'From vehicle card point 8: use the value under "Gross own weight with driver".',
};


export type SemiTrailerBand = {
  min?: number;
  max?: number;
  label: string;
  weights: Record<RoadProfile, number>;
};

export type SemiTrailerRow = {
  tractorAxles: number;
  trailerAxles: number;
  label: string;
  bands: SemiTrailerBand[];
};

export const SEMI_TRAILER_TABLE_3B: SemiTrailerRow[] = [
  {
    tractorAxles: 2,
    trailerAxles: 1,
    label: 'Motorvogn med 2 aksler + semitrailer med 1 aksel',
    bands: [
      { max: 3, label: 'Mindre enn 3,00 m', weights: { Bk10_50: 19, Bk10_42: 19, BkT8_50: 16, BkT8_40: 16, Bk8_32: 16, Bk6_28: 12 } },
      { min: 3, label: '3,00 m og større', weights: { Bk10_50: 29, Bk10_42: 29, BkT8_50: 24, BkT8_40: 24, Bk8_32: 24, Bk6_28: 18 } },
    ],
  },
  {
    tractorAxles: 2,
    trailerAxles: 2,
    label: 'Motorvogn med 2 aksler + semitrailer med 2 aksler',
    bands: [
      { max: 3, label: 'Mindre enn 3,00 m', weights: { Bk10_50: 19, Bk10_42: 19, BkT8_50: 16, BkT8_40: 16, Bk8_32: 16, Bk6_28: 12 } },
      { min: 3, max: 3.2, label: '3,00 til og med 3,19 m', weights: { Bk10_50: 34, Bk10_42: 34, BkT8_50: 30, BkT8_40: 30, Bk8_32: 26, Bk6_28: 21 } },
      { min: 3.2, max: 3.4, label: '3,20 til og med 3,39 m', weights: { Bk10_50: 35, Bk10_42: 35, BkT8_50: 30, BkT8_40: 30, Bk8_32: 27.1, Bk6_28: 21 } },
      { min: 3.4, max: 3.7, label: '3,40 til og med 3,69 m', weights: { Bk10_50: 36, Bk10_42: 36, BkT8_50: 30, BkT8_40: 30, Bk8_32: 28, Bk6_28: 21 } },
      { min: 3.7, label: '3,70 m og større', weights: { Bk10_50: 37, Bk10_42: 37, BkT8_50: 30, BkT8_40: 30, Bk8_32: 28, Bk6_28: 21 } },
    ],
  },
  {
    tractorAxles: 2,
    trailerAxles: 3,
    label: 'Motorvogn med 2 aksler + semitrailer med 3 aksler eller flere',
    bands: [
      { max: 3, label: 'Mindre enn 3,00 m', weights: { Bk10_50: 19, Bk10_42: 19, BkT8_50: 16, BkT8_40: 16, Bk8_32: 16, Bk6_28: 12 } },
      { min: 3, max: 3.4, label: '3,00 til og med 3,39 m', weights: { Bk10_50: 37, Bk10_42: 37, BkT8_50: 32, BkT8_40: 32, Bk8_32: 28, Bk6_28: 23 } },
      { min: 3.4, max: 3.7, label: '3,40 til og med 3,69 m', weights: { Bk10_50: 38, Bk10_42: 36.8, BkT8_50: 32, BkT8_40: 32, Bk8_32: 28.6, Bk6_28: 23.5 } },
      { min: 3.7, label: '3,70 m og større', weights: { Bk10_50: 39, Bk10_42: 37.4, BkT8_50: 32, BkT8_40: 32, Bk8_32: 29, Bk6_28: 24 } },
    ],
  },
  {
    tractorAxles: 3,
    trailerAxles: 1,
    label: 'Motorvogn med 3 aksler + semitrailer med 1 aksel',
    bands: [
      { max: 3, label: 'Mindre enn 3,00 m', weights: { Bk10_50: 26, Bk10_42: 26, BkT8_50: 22, BkT8_40: 22, Bk8_32: 20, Bk6_28: 15 } },
      { min: 3, max: 3.2, label: '3,00 til og med 3,19 m', weights: { Bk10_50: 33, Bk10_42: 33, BkT8_50: 30, BkT8_40: 30, Bk8_32: 26, Bk6_28: 21 } },
      { min: 3.2, max: 3.6, label: '3,20 til og med 3,59 m', weights: { Bk10_50: 34, Bk10_42: 34, BkT8_50: 30, BkT8_40: 30, Bk8_32: 26.7, Bk6_28: 21 } },
      { min: 3.6, max: 4, label: '3,60 til og med 3,99 m', weights: { Bk10_50: 35, Bk10_42: 35, BkT8_50: 30, BkT8_40: 30, Bk8_32: 27.4, Bk6_28: 21 } },
      { min: 4, label: '4,00 m og større', weights: { Bk10_50: 36, Bk10_42: 36, BkT8_50: 30, BkT8_40: 30, Bk8_32: 28, Bk6_28: 21 } },
    ],
  },
  {
    tractorAxles: 3,
    trailerAxles: 2,
    label: 'Motorvogn med 3 aksler + semitrailer med 2 aksler',
    bands: [
      { max: 3, label: 'Mindre enn 3,00 m', weights: { Bk10_50: 26, Bk10_42: 26, BkT8_50: 22, BkT8_40: 22, Bk8_32: 20, Bk6_28: 15 } },
      { min: 3, max: 3.3, label: '3,00 til og med 3,29 m', weights: { Bk10_50: 37, Bk10_42: 37, BkT8_50: 36, BkT8_40: 36, Bk8_32: 28, Bk6_28: 24 } },
      { min: 3.3, max: 3.6, label: '3,30 til og med 3,59 m', weights: { Bk10_50: 38, Bk10_42: 36.6, BkT8_50: 36, BkT8_40: 36, Bk8_32: 28.4, Bk6_28: 24 } },
      { min: 3.6, max: 3.9, label: '3,60 til og med 3,89 m', weights: { Bk10_50: 39, Bk10_42: 37.1, BkT8_50: 36, BkT8_40: 36, Bk8_32: 28.9, Bk6_28: 24 } },
      { min: 3.9, max: 4.1, label: '3,90 til og med 4,09 m', weights: { Bk10_50: 40, Bk10_42: 37.7, BkT8_50: 36, BkT8_40: 36, Bk8_32: 29.3, Bk6_28: 24 } },
      { min: 4.1, max: 4.3, label: '4,10 til og med 4,29 m', weights: { Bk10_50: 41, Bk10_42: 38.1, BkT8_50: 36, BkT8_40: 36, Bk8_32: 29.6, Bk6_28: 24 } },
      { min: 4.3, max: 4.5, label: '4,30 til og med 4,49 m', weights: { Bk10_50: 42, Bk10_42: 38.4, BkT8_50: 36, BkT8_40: 36, Bk8_32: 29.9, Bk6_28: 24 } },
      { min: 4.5, max: 4.7, label: '4,50 til og med 4,69 m', weights: { Bk10_50: 43, Bk10_42: 38.8, BkT8_50: 36, BkT8_40: 36, Bk8_32: 30.2, Bk6_28: 24 } },
      { min: 4.7, max: 5.2, label: '4,70 til og med 5,19 m', weights: { Bk10_50: 44, Bk10_42: 39.2, BkT8_50: 36, BkT8_40: 36, Bk8_32: 30.5, Bk6_28: 24 } },
      { min: 5.2, max: 5.7, label: '5,20 til og med 5,69 m', weights: { Bk10_50: 44, Bk10_42: 40, BkT8_50: 36, BkT8_40: 36, Bk8_32: 31.3, Bk6_28: 24 } },
      { min: 5.7, max: 6.2, label: '5,70 til og med 6,19 m', weights: { Bk10_50: 44, Bk10_42: 41, BkT8_50: 36, BkT8_40: 36, Bk8_32: 32, Bk6_28: 24 } },
      { min: 6.2, label: '6,20 m og større', weights: { Bk10_50: 44, Bk10_42: 42, BkT8_50: 36, BkT8_40: 36, Bk8_32: 32, Bk6_28: 24 } },
    ],
  },
  {
    tractorAxles: 3,
    trailerAxles: 3,
    label: 'Motorvogn med 3 aksler + semitrailer med 3 aksler eller flere',
    bands: [
      { max: 3, label: 'Mindre enn 3,00 m', weights: { Bk10_50: 26, Bk10_42: 26, BkT8_50: 22, BkT8_40: 22, Bk8_32: 20, Bk6_28: 15 } },
      { min: 3, max: 3.3, label: '3,00 til og med 3,29 m', weights: { Bk10_50: 41, Bk10_42: 39, BkT8_50: 38, BkT8_40: 38, Bk8_32: 30, Bk6_28: 25 } },
      { min: 3.3, max: 3.6, label: '3,30 til og med 3,59 m', weights: { Bk10_50: 42, Bk10_42: 39.5, BkT8_50: 38, BkT8_40: 38, Bk8_32: 30.4, Bk6_28: 25.5 } },
      { min: 3.6, max: 3.9, label: '3,60 til og med 3,89 m', weights: { Bk10_50: 43, Bk10_42: 40, BkT8_50: 38, BkT8_40: 38, Bk8_32: 30.8, Bk6_28: 26 } },
      { min: 3.9, max: 4.2, label: '3,90 til og med 4,19 m', weights: { Bk10_50: 44, Bk10_42: 40.5, BkT8_50: 38, BkT8_40: 38, Bk8_32: 31.2, Bk6_28: 26.5 } },
      { min: 4.2, max: 4.5, label: '4,20 til og med 4,49 m', weights: { Bk10_50: 45, Bk10_42: 41, BkT8_50: 38, BkT8_40: 38, Bk8_32: 31.6, Bk6_28: 27 } },
      { min: 4.5, label: '4,50 m og større', weights: { Bk10_50: 46, Bk10_42: 41.5, BkT8_50: 38, BkT8_40: 38, Bk8_32: 32, Bk6_28: 27 } },
    ],
  },
  {
    tractorAxles: 4,
    trailerAxles: 1,
    label: 'Motorvogn med 4 aksler eller flere + semitrailer med 1 aksel',
    bands: [
      { max: 3, label: 'Mindre enn 3,00 m', weights: { Bk10_50: 32, Bk10_42: 32, BkT8_50: 28, BkT8_40: 28, Bk8_32: 24, Bk6_28: 18 } },
      { min: 3, max: 3.3, label: '3,00 til og med 3,29 m', weights: { Bk10_50: 38, Bk10_42: 36, BkT8_50: 36, BkT8_40: 36, Bk8_32: 28, Bk6_28: 23 } },
      { min: 3.3, max: 3.6, label: '3,30 til og med 3,59 m', weights: { Bk10_50: 39, Bk10_42: 36.5, BkT8_50: 36, BkT8_40: 36, Bk8_32: 28.4, Bk6_28: 23.5 } },
      { min: 3.6, max: 3.9, label: '3,60 til og med 3,89 m', weights: { Bk10_50: 40, Bk10_42: 37, BkT8_50: 36, BkT8_40: 36, Bk8_32: 28.9, Bk6_28: 24 } },
      { min: 3.9, max: 4.2, label: '3,90 til og med 4,19 m', weights: { Bk10_50: 41, Bk10_42: 37.5, BkT8_50: 36, BkT8_40: 36, Bk8_32: 29.3, Bk6_28: 24 } },
      { min: 4.2, max: 4.7, label: '4,20 til og med 4,69 m', weights: { Bk10_50: 42, Bk10_42: 38, BkT8_50: 36, BkT8_40: 36, Bk8_32: 29.8, Bk6_28: 24 } },
      { min: 4.7, max: 5.2, label: '4,70 til og med 5,19 m', weights: { Bk10_50: 42, Bk10_42: 39, BkT8_50: 36, BkT8_40: 36, Bk8_32: 30.5, Bk6_28: 24 } },
      { min: 5.2, max: 5.7, label: '5,20 til og med 5,69 m', weights: { Bk10_50: 42, Bk10_42: 40, BkT8_50: 36, BkT8_40: 36, Bk8_32: 31.3, Bk6_28: 24 } },
      { min: 5.7, max: 6.4, label: '5,70 til og med 6,39 m', weights: { Bk10_50: 42, Bk10_42: 41, BkT8_50: 36, BkT8_40: 36, Bk8_32: 32, Bk6_28: 24 } },
      { min: 6.4, label: '6,40 m og større', weights: { Bk10_50: 42, Bk10_42: 42, BkT8_50: 36, BkT8_40: 36, Bk8_32: 32, Bk6_28: 24 } },
    ],
  },
  {
    tractorAxles: 4,
    trailerAxles: 2,
    label: 'Motorvogn med 4 aksler eller flere + semitrailer med 2 aksler',
    bands: [
      { max: 3, label: 'Mindre enn 3,00 m', weights: { Bk10_50: 32, Bk10_42: 32, BkT8_50: 28, BkT8_40: 28, Bk8_32: 24, Bk6_28: 18 } },
      { min: 3, max: 3.4, label: '3,00 til og med 3,39 m', weights: { Bk10_50: 42, Bk10_42: 38, BkT8_50: 42, BkT8_40: 38, Bk8_32: 29, Bk6_28: 25 } },
      { min: 3.4, max: 3.8, label: '3,40 til og med 3,79 m', weights: { Bk10_50: 43, Bk10_42: 38.8, BkT8_50: 42, BkT8_40: 38.7, Bk8_32: 29.7, Bk6_28: 25.6 } },
      { min: 3.8, max: 4.1, label: '3,80 til og med 4,09 m', weights: { Bk10_50: 44, Bk10_42: 39.6, BkT8_50: 42, BkT8_40: 39.4, Bk8_32: 30.4, Bk6_28: 26.1 } },
      { min: 4.1, max: 4.4, label: '4,10 til og med 4,39 m', weights: { Bk10_50: 45, Bk10_42: 40.2, BkT8_50: 42, BkT8_40: 40, Bk8_32: 30.9, Bk6_28: 26.6 } },
      { min: 4.4, max: 4.7, label: '4,40 til og med 4,69 m', weights: { Bk10_50: 46, Bk10_42: 40.8, BkT8_50: 42, BkT8_40: 40, Bk8_32: 31.5, Bk6_28: 27 } },
      { min: 4.7, max: 5, label: '4,70 til og med 4,99 m', weights: { Bk10_50: 47, Bk10_42: 41.4, BkT8_50: 42, BkT8_40: 40, Bk8_32: 32, Bk6_28: 27 } },
      { min: 5, max: 5.3, label: '5,00 til og med 5,29 m', weights: { Bk10_50: 48, Bk10_42: 42, BkT8_50: 42, BkT8_40: 40, Bk8_32: 32, Bk6_28: 27 } },
      { min: 5.3, max: 5.6, label: '5,30 til og med 5,59 m', weights: { Bk10_50: 49, Bk10_42: 42, BkT8_50: 42, BkT8_40: 40, Bk8_32: 32, Bk6_28: 27 } },
      { min: 5.6, label: '5,60 m og større', weights: { Bk10_50: 50, Bk10_42: 42, BkT8_50: 42, BkT8_40: 40, Bk8_32: 32, Bk6_28: 27 } },
    ],
  },
  {
    tractorAxles: 4,
    trailerAxles: 3,
    label: 'Motorvogn med 4 aksler eller flere + semitrailer med 3 aksler eller flere',
    bands: [
      { max: 3, label: 'Mindre enn 3,00 m', weights: { Bk10_50: 32, Bk10_42: 32, BkT8_50: 28, BkT8_40: 28, Bk8_32: 24, Bk6_28: 18 } },
      { min: 3, max: 3.4, label: '3,00 til og med 3,39 m', weights: { Bk10_50: 46, Bk10_42: 40, BkT8_50: 46, BkT8_40: 40, Bk8_32: 31, Bk6_28: 27 } },
      { min: 3.4, max: 3.8, label: '3,40 til og med 3,79 m', weights: { Bk10_50: 48, Bk10_42: 41.5, BkT8_50: 47, BkT8_40: 40, Bk8_32: 32, Bk6_28: 27.5 } },
      { min: 3.8, max: 4.2, label: '3,80 til og med 4,19 m', weights: { Bk10_50: 49, Bk10_42: 42, BkT8_50: 47, BkT8_40: 40, Bk8_32: 32, Bk6_28: 28 } },
      { min: 4.2, label: '4,20 m og større', weights: { Bk10_50: 50, Bk10_42: 42, BkT8_50: 47, BkT8_40: 40, Bk8_32: 32, Bk6_28: 28 } },
    ],
  },
];

