'use client';

import type { AxleCount, AxleVariantKey, VehicleType } from '../types';
import { tx, type Language } from '../lib/i18n';

type AxleWeightRow = {
  axle: number;
  calculatedAllowedKg: number | null;
  ownKg: number | null;
  availableKg: number | null;
};

function formatNumber(value: number, digits = 2): string {
  return new Intl.NumberFormat('nb-NO', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits === 0 ? 0 : Math.min(digits, 2),
  }).format(value);
}

function isVogntogVehicle(vehicleType: VehicleType) {
  return vehicleType === 'semiTrailer' || vehicleType === 'specialTransport';
}

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
      description: 'Modulvogntog, tÃ¸mmer, dolly/semi og andre spesialrader.',
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

function getDefaultAxleVariant(vehicleType: VehicleType, axleCount: AxleCount): AxleVariantKey {
  if (vehicleType === 'truck') {
    if (axleCount === '2') return 'truck_2_single';
    if (axleCount === '3') return 'truck_3_rear_bogie';
    if (axleCount === '5') return 'truck_5_double_steer_tridem';
    return 'truck_4_rear_tridem';
  }

  if (vehicleType === 'bus') {
    return axleCount === '3' ? 'bus_3_rear_bogie' : 'bus_2_single';
  }

  if (vehicleType === 'articulatedBus') return 'articulated_bus';
  if (vehicleType === 'specialTransport') return 'modular_timber';
  return 'semi_3_plus';
}

const builderPalette = {
  body: '#eaf3f0',
  bodyActive: '#d9f4ea',
  cabin: '#2f7f74',
  trailer: '#f8fbfb',
  bus: '#e6f2ff',
  stroke: '#1f403b',
  muted: '#8aa09b',
  wheel: '#17201f',
  hub: '#ffffff',
  accent: '#16a071',
  road: '#bac9c5',
};

type BuilderPart = 'truck' | 'tractor' | 'semi' | 'drawbar' | 'fullTrailer' | 'dolly' | 'bus' | 'articulatedBus' | 'linkTrailer';

function BuilderUnit({ label, type, active }: { label: string; type: BuilderPart; active: boolean }) {
  const baseStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    gap: 10,
    opacity: active ? 1 : 0.32,
    transform: active ? 'scale(1)' : 'scale(0.98)',
    transition: 'opacity 180ms ease, transform 180ms ease',
  };

  const boxStyle = {
    borderRadius: 22,
    background: active ? '#ffffff' : '#f4f6f6',
    border: `1px solid ${active ? 'rgba(25, 72, 64, 0.12)' : 'rgba(25, 72, 64, 0.08)'}`,
    boxShadow: active ? '0 18px 35px rgba(19, 67, 60, 0.06)' : 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 118,
    minHeight: 64,
    padding: '0.8rem',
  };

  const variantConfig = {
    truck: { width: 96, height: 42, borderRadius: 20, background: active ? builderPalette.bodyActive : '#eef4f6' },
    tractor: { width: 76, height: 40, borderRadius: '24px 14px 14px 24px', background: active ? builderPalette.cabin : '#dfe6e5' },
    semi: { width: 128, height: 42, borderRadius: 22, background: active ? builderPalette.trailer : '#eef4f6' },
    drawbar: { width: 122, height: 40, borderRadius: 20, background: active ? builderPalette.trailer : '#f0f4f3' },
    fullTrailer: { width: 132, height: 42, borderRadius: 24, background: active ? builderPalette.trailer : '#f0f4f3' },
    dolly: { width: 92, height: 40, borderRadius: 20, background: active ? builderPalette.bodyActive : '#eef4f6' },
    linkTrailer: { width: 118, height: 40, borderRadius: 20, background: active ? builderPalette.trailer : '#eef4f6' },
    bus: { width: 172, height: 46, borderRadius: 24, background: active ? builderPalette.bus : '#eef4fb' },
    articulatedBus: { width: 202, height: 46, borderRadius: 24, background: active ? builderPalette.bus : '#eef4fb' },
  }[type] as { width: number; height: number; borderRadius: number | string; background: string };

  const detailStyle = {
    width: typeof variantConfig.width === 'number' ? variantConfig.width * 0.25 : 18,
    height: typeof variantConfig.height === 'number' ? variantConfig.height * 0.35 : 16,
    borderRadius: 999,
    background: type === 'truck' || type === 'tractor' ? builderPalette.cabin : '#ffffff',
    opacity: 0.85,
    marginRight: type === 'truck' || type === 'tractor' ? 10 : 0,
  };

  return (
    <div style={baseStyle}>
      <div style={{ ...boxStyle, width: variantConfig.width, height: variantConfig.height, borderRadius: variantConfig.borderRadius, background: variantConfig.background }}>
        {(type === 'truck' || type === 'tractor') && <div style={detailStyle} />}
        {type === 'articulatedBus' ? (
          <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'space-between' }}>
            <div style={{ width: 74, height: 34, borderRadius: 18, background: '#ffffff' }} />
            <div style={{ width: 74, height: 34, borderRadius: 18, background: '#ffffff' }} />
          </div>
        ) : null}
      </div>
      <span style={{ width: 112, textAlign: 'center', fontSize: 12, fontWeight: 700, color: active ? builderPalette.stroke : builderPalette.muted }}>
        {label}
      </span>
    </div>
  );
}

function BuilderConnector({ type, active }: { type: 'fifthWheel' | 'drawbar' | 'dolly'; active: boolean }) {
  const style = {
    width: type === 'dolly' ? 76 : 88,
    height: 8,
    borderRadius: 999,
    background: active ? builderPalette.accent : '#d8dfdc',
    position: 'relative' as const,
    alignSelf: 'center' as const,
    margin: '0 8px',
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={style}>
        <div
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: '#ffffff',
            border: `2px solid ${builderPalette.stroke}`,
            position: 'absolute' as const,
            left: type === 'drawbar' ? '50%' : 8,
            transform: type === 'drawbar' ? 'translateX(-50%)' : undefined,
          }}
        />
      </div>
    </div>
  );
}

function BuilderShelfItem({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, opacity: active ? 1 : 0.32 }}>
      <div
        style={{
          width: 72,
          height: 52,
          borderRadius: 18,
          background: active ? '#ffffff' : '#f4f6f6',
          border: `1px solid ${active ? 'rgba(25, 72, 64, 0.12)' : 'rgba(25, 72, 64, 0.08)'}`,
          boxShadow: active ? '0 14px 30px rgba(19, 67, 60, 0.05)' : 'none',
        }}
      />
      <span style={{ width: 86, textAlign: 'center', fontSize: 11, fontWeight: 700, color: active ? builderPalette.stroke : builderPalette.muted }}>
        {label}
      </span>
    </div>
  );
}

function BuilderShelf({ activeParts }: { activeParts: BuilderPart[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, minmax(0, 1fr))', gap: 14, paddingTop: 10 }}>
      <BuilderShelfItem label="Lastebil" active={activeParts.includes('truck')} />
      <BuilderShelfItem label="Trekkbil" active={activeParts.includes('tractor')} />
      <BuilderShelfItem label="Semitrailer" active={activeParts.includes('semi')} />
      <BuilderShelfItem label="Påhengsvogn" active={activeParts.includes('drawbar')} />
      <BuilderShelfItem label="Slepvogn" active={activeParts.includes('fullTrailer')} />
      <BuilderShelfItem label="Dolly" active={activeParts.includes('dolly')} />
      <BuilderShelfItem label="Buss" active={activeParts.includes('bus')} />
      <BuilderShelfItem label="Leddbuss" active={activeParts.includes('articulatedBus')} />
    </div>
  );
}

export function AxleWeightTable({
  rows,
  warnings = [],
  language,
  compact = false,
}: {
  rows: AxleWeightRow[];
  warnings?: string[];
  language: Language;
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <>
        {warnings.length > 0 ? (
          <div className="axle-table-warning">
            {warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
        <p className="axle-table-empty">
          {tx(language, 'Ingen akselvekter lagt inn.', 'No axle weights provided.')}
        </p>
      </>
    );
  }

  const missingText = tx(language, 'Ikke lagt inn', 'Not provided');

  return (
    <>
      {warnings.length > 0 ? (
        <div className="axle-table-warning">
          {warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      <div className={compact ? 'axle-card-list axle-card-list--compact' : 'axle-card-list'}>
        {rows.map((row) => (
          <article className="axle-result-card" key={`axle-weight-${row.axle}`}>
            <h4>
              {tx(language, 'Aksel', 'Axle')} {row.axle}
            </h4>
            <div className="axle-result-metrics">
              <div>
                <span>{tx(language, 'Tillatt aksellast', 'Allowed axle load')}</span>
                <strong>{row.calculatedAllowedKg !== null ? `${formatNumber(row.calculatedAllowedKg, 0)} kg` : missingText}</strong>
              </div>
              <div>
                <span>{tx(language, 'Egenvekt', 'Tare weight')}</span>
                <strong>{row.ownKg !== null ? `${formatNumber(row.ownKg, 0)} kg` : missingText}</strong>
              </div>
              <div>
                <span>{tx(language, 'Rest tilgjengelig last', 'Remaining available payload')}</span>
                <strong>{row.availableKg !== null ? `${formatNumber(row.availableKg, 0)} kg` : missingText}</strong>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}


export function VehicleAxleVisual({
  vehicleType,
  language,
  axleCount,
  axleVariant,
  tractorAxles,
  trailerAxles,
  hasTwoSteeringAxles = false,
  compact = false,
}: {
  vehicleType: VehicleType;
  language: Language;
  axleCount?: number | null;
  axleVariant?: AxleVariantKey | null;
  tractorAxles?: number | null;
  trailerAxles?: number | null;
  hasTwoSteeringAxles?: boolean;
  compact?: boolean;
}) {
  const isCombination = isVogntogVehicle(vehicleType);
  const safeAxleCount =
    axleCount && Number.isFinite(axleCount) && axleCount > 0
      ? Math.round(axleCount)
      : vehicleType === 'articulatedBus'
        ? 3
        : vehicleType === 'bus'
          ? 2
          : vehicleType === 'truck'
            ? 4
            : null;
  const safeTractorAxles =
    tractorAxles && Number.isFinite(tractorAxles) && tractorAxles > 0 ? Math.round(tractorAxles) : 2;
  const safeTrailerAxles =
    trailerAxles && Number.isFinite(trailerAxles) && trailerAxles > 0
      ? Math.round(trailerAxles)
      : vehicleType === 'specialTransport'
        ? 4
        : 3;
  const label = getVehicleText(vehicleType, language).label;
  const singleAxles = Math.max(1, safeAxleCount ?? 3);
  const truckDiagramVariant =
    axleVariant === 'truck_2_single' ||
    axleVariant === 'truck_3_rear_bogie' ||
    axleVariant === 'truck_4_rear_tridem' ||
    axleVariant === 'truck_4_double_steer_bogie' ||
    axleVariant === 'truck_5_double_steer_tridem'
      ? axleVariant
      : hasTwoSteeringAxles && singleAxles >= 4
        ? 'truck_4_double_steer_bogie'
        : getDefaultAxleVariant('truck', String(Math.min(Math.max(singleAxles, 2), 5)) as AxleCount);
  const singleWheelPositions = (() => {
    if (vehicleType === 'truck') {
      if (truckDiagramVariant === 'truck_2_single') return [246, 500];
      if (truckDiagramVariant === 'truck_3_rear_bogie') return [236, 474, 526];
      if (truckDiagramVariant === 'truck_4_double_steer_bogie') return [226, 282, 474, 526];
      if (truckDiagramVariant === 'truck_5_double_steer_tridem') return [220, 276, 458, 512, 566];
      return [236, 450, 506, 562].slice(0, singleAxles);
    }

    if (vehicleType === 'articulatedBus') {
      return [226, 380, 548].slice(0, singleAxles);
    }

    if (vehicleType === 'bus') {
      if (singleAxles <= 2) return [250, 512].slice(0, singleAxles);
      return [236, 456, 536].slice(0, singleAxles);
    }

    return [236, 500, 560].slice(0, singleAxles);
  })();
  const displayedSingleAxleCount = vehicleType === 'truck' ? singleWheelPositions.length : safeAxleCount;
  const isDollyCombination =
    vehicleType === 'specialTransport' &&
    (axleVariant === 'dolly_semitrailer_2' ||
      axleVariant === 'dolly_semitrailer_3' ||
      axleVariant === 'dolly_semitrailer_4_plus');
  const isDrawbarCombination = vehicleType === 'specialTransport' && !isDollyCombination && axleVariant === 'modular_timber';
  const isSemiCombination = vehicleType === 'semiTrailer' || (isCombination && !isDollyCombination && !isDrawbarCombination);
  const activeParts: BuilderPart[] = (() => {
    if (vehicleType === 'truck') return ['truck'];
    if (vehicleType === 'bus') return ['bus'];
    if (vehicleType === 'articulatedBus') return ['articulatedBus'];
    if (isDollyCombination) return ['truck', 'dolly', 'semi'];
    if (isDrawbarCombination) return ['truck', 'drawbar'];
    if (isSemiCombination) return ['tractor', 'semi'];
    return ['truck', 'fullTrailer'];
  })();
  const activeTitle = (() => {
    if (vehicleType === 'truck') return 'Lastebil';
    if (vehicleType === 'bus') return 'Buss';
    if (vehicleType === 'articulatedBus') return 'Leddbuss';
    if (isDollyCombination) return 'Lastebil + Dolly + Semitrailer';
    if (isDrawbarCombination) return 'Lastebil + Påhengsvogn';
    if (isSemiCombination) return 'Trekkbil + Semitrailer';
    return 'Lastebil + Slepvogn';
  })();

  return (
    <div
      className={`vehicle-axle-visual vehicle-axle-visual--${vehicleType}${compact ? ' vehicle-axle-visual--compact' : ''}`}
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f7fbfa 100%)',
        border: '1px solid rgba(25, 72, 64, 0.12)',
        boxShadow: '0 14px 34px rgba(17, 44, 39, 0.08)',
        color: builderPalette.stroke,
      }}
    >
      <div className="vehicle-axle-head" style={{ alignItems: 'flex-start', gap: '0.25rem' }}>
        <span style={{ color: builderPalette.muted, fontSize: '0.78rem', letterSpacing: 0, textTransform: 'none' }}>
          {tx(language, 'Valgt kombinasjon', 'Selected combination')}
        </span>
        <strong style={{ color: builderPalette.stroke }}>{activeTitle || label}</strong>
      </div>

      <div className="vehicle-axle-diagram" style={{ background: '#ffffff', border: '1px solid rgba(25, 72, 64, 0.1)', borderRadius: '24px', boxShadow: '0 10px 24px rgba(17, 44, 39, 0.06)', padding: '1.25rem', marginTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', minHeight: '180px', flexWrap: 'wrap' }}>
          {isCombination ? (
            isDollyCombination ? (
              <>
                <BuilderUnit type="truck" label="Lastebil" active />
                <BuilderConnector type="dolly" active />
                <BuilderUnit type="dolly" label="Dolly" active />
                <BuilderConnector type="dolly" active />
                <BuilderUnit type="semi" label="Semitrailer" active />
              </>
            ) : isDrawbarCombination ? (
              <>
                <BuilderUnit type="truck" label="Lastebil" active />
                <BuilderConnector type="drawbar" active />
                <BuilderUnit type="fullTrailer" label="Påhengsvogn" active />
              </>
            ) : isSemiCombination ? (
              <>
                <BuilderUnit type="tractor" label="Trekkbil" active />
                <BuilderConnector type="fifthWheel" active />
                <BuilderUnit type="semi" label="Semitrailer" active />
              </>
            ) : (
              <>
                <BuilderUnit type="truck" label="Lastebil" active />
                <BuilderConnector type="drawbar" active />
                <BuilderUnit type="fullTrailer" label="Slepvogn" active />
              </>
            )
          ) : vehicleType === 'truck' ? (
            <BuilderUnit type="truck" label="Lastebil" active />
          ) : vehicleType === 'bus' ? (
            <BuilderUnit type="bus" label="Buss" active />
          ) : (
            <BuilderUnit type="articulatedBus" label="Leddbuss" active />
          )}
        </div>
        <div style={{ height: '6px', background: builderPalette.road, borderRadius: '999px', marginTop: '1.2rem', width: '100%' }} />
      </div>

      <div className="vehicle-axle-meta" style={{ color: builderPalette.muted, display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
        <span>
          {isCombination
            ? `${safeTractorAxles} + ${safeTrailerAxles}`
            : displayedSingleAxleCount} {tx(language, 'aksler', 'axles')}
        </span>
        <span>{safeAxleCount ? tx(language, 'Valgt oppsett', 'Selected setup') : tx(language, 'Akseloppsett ikke valgt ennå', 'Axle setup not selected yet')}</span>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontWeight: 700, color: builderPalette.stroke, fontSize: '0.95rem' }}>{tx(language, 'Kjøretøydeler', 'Vehicle parts')}</span>
        </div>
        <BuilderShelf activeParts={activeParts} />
      </div>
    </div>
  );
}
