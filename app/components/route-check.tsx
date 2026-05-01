"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ROAD_PROFILES } from '../constants';
import type { RoadProfile } from '../types';
import { tx, type Language } from '../lib/i18n';
import RouteMap from './route-map';

// Private helpers for the driving/rest planner (UI-only)
function parseNumberOrDefault(value: string, def: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : def;
}

function computeNextBreakBy(departureIso: string, drivingUsedHours: number, maxBeforeBreakHours: number) {
  if (!departureIso) return null;
  const dep = new Date(departureIso);
  const remaining = Math.max(maxBeforeBreakHours - drivingUsedHours, 0);
  const ms = Math.round(remaining * 60 * 60 * 1000);
  return new Date(dep.getTime() + ms);
}

function computeDailyRestBy(departureIso: string, drivingUsedHours: number, dailyLimitHours: number, extendedDay: boolean) {
  if (!departureIso) return null;
  const dep = new Date(departureIso);
  const limit = extendedDay ? Math.max(dailyLimitHours, 10) : dailyLimitHours;
  const remaining = Math.max(limit - drivingUsedHours, 0);
  const ms = Math.round(remaining * 60 * 60 * 1000);
  return new Date(dep.getTime() + ms);
}

function formatDateShort(date: Date | null) {
  if (!date) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}


type RouteCheckPrefill = {
  vehicleHeight?: string;
  vehicleLength?: string;
  vehicleWidth?: string;
  totalWeight?: string;
  roadClass?: RoadProfile;
};

type RouteWarning = {
  type: 'height';
  value: number;
  description: string;
  lat: number;
  lon: number;
  severity: 'critical' | 'caution';
  distanceKm?: number;
};

type RoadworkWarning = {
  type: 'roadwork';
  description: string;
  lat: number;
  lon: number;
  distanceKm?: number;
};

type RestStop = {
  type: 'rest-stop';
  name: string;
  lat: number;
  lon: number;
  distanceKm?: number;
};

type RouteWarningResponse = {
  warnings: RouteWarning[];
  roadwork: RoadworkWarning[];
  restStops: RestStop[];
  source: string;
  message: string;
  debug?: {
    nvdbFetchedCount: number;
    nvdbMatchedRouteCount: number;
    nvdbHeightFilteredCount: number;
    datexFetchedCount: number;
    datexMatchedRouteCount: number;
    restStopCount: number;
    usedRouteFilter: boolean;
  };
};

function parseVehicleMeasure(value: string, unit: 'mm' | 'kg') {
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(parsed)) return null;
  if (unit === 'mm' && /m/i.test(value) && !/mm/i.test(value)) return Math.round(parsed * 1000);
  return Math.round(parsed);
}

function formatHeightMeters(valueMeters: number, language: Language) {
  return valueMeters.toLocaleString(language === 'no' ? 'nb-NO' : 'en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

const AVERAGE_TRUCK_SPEED_KMH = 70;

function parseRemainingDrivingHours(value?: string) {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(',', '.');
  const hourMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:h|t|time|timer|hour|hours)/);
  const minuteMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minutt|minutter|minute|minutes)/);
  const hours = hourMatch ? Number(hourMatch[1]) : 0;
  const minutes = minuteMatch ? Number(minuteMatch[1]) : 0;
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || (hours === 0 && minutes === 0)) return null;
  return hours + minutes / 60;
}

export function RouteCheckFutureSection({
  language,
  routeFrom,
  routeTo,
  prefill,
  autoCheckKey = 0,
  ltpSummary,
  nextBreakSummary,
  detailsContent,
  afterVehicleDetailsContent,
}: {
  language: Language;
  routeFrom: string;
  routeTo: string;
  prefill?: RouteCheckPrefill;
  autoCheckKey?: number;
  ltpSummary?: string;
  nextBreakSummary?: string;
  detailsContent?: ReactNode;
  afterVehicleDetailsContent?: ReactNode;
}) {
  const sourceHelper = tx(language, 'Hentes fra vognkort når tilgjengelig', 'Fetched from vehicle card when available');
  const emptyRouteText = tx(language, 'Ikke lagt inn ennå', 'Not entered yet');
  const heightRef = useRef<HTMLInputElement>(null);
  const lengthRef = useRef<HTMLInputElement>(null);
  const widthRef = useRef<HTMLInputElement>(null);
  const totalWeightRef = useRef<HTMLInputElement>(null);
  const [routeWarningResult, setRouteWarningResult] = useState<RouteWarningResponse | null>(null);
  const [routeWarningLoading, setRouteWarningLoading] = useState(false);
  const [routeWarningError, setRouteWarningError] = useState('');
  const [selectedWarning, setSelectedWarning] = useState<RouteWarning | null>(null);
  const [checkedVehicleHeightMm, setCheckedVehicleHeightMm] = useState<number | null>(null);
  const sortedHeightWarnings = useMemo(
    () =>
      [...(routeWarningResult?.warnings ?? [])].sort((a, b) => {
        const distanceDelta = (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity);
        if (distanceDelta !== 0) return distanceDelta;
        if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
        return a.value - b.value;
      }),
    [routeWarningResult],
  );
  const criticalWarningCount = (routeWarningResult?.warnings ?? []).filter((warning) => warning.severity === 'critical').length;
  const cautionWarningCount = (routeWarningResult?.warnings ?? []).filter((warning) => warning.severity === 'caution').length;
  const realRoadwork = useMemo(() => routeWarningResult?.roadwork ?? [], [routeWarningResult]);
  const restStops = useMemo(() => routeWarningResult?.restStops ?? [], [routeWarningResult]);
  const roadworkCount = realRoadwork.length;
  const estimatedStopDistanceKm = useMemo(() => {
    const remainingHours = parseRemainingDrivingHours(nextBreakSummary);
    return remainingHours !== null ? remainingHours * AVERAGE_TRUCK_SPEED_KMH : null;
  }, [nextBreakSummary]);
  const recommendedRestStop = useMemo(() => {
    if (estimatedStopDistanceKm === null || restStops.length === 0) return null;
    return restStops
      .map((stop) => ({
        ...stop,
        diff: Math.abs((stop.distanceKm ?? Infinity) - estimatedStopDistanceKm),
      }))
      .sort((a, b) => a.diff - b.diff)[0] ?? null;
  }, [estimatedStopDistanceKm, restStops]);
  const estimatedTimeToStop = useMemo(() => {
    if (!recommendedRestStop?.distanceKm) return null;
    return recommendedRestStop.distanceKm / AVERAGE_TRUCK_SPEED_KMH;
  }, [recommendedRestStop]);
  const isRecommendedStopTooFar =
    recommendedRestStop &&
    estimatedStopDistanceKm !== null &&
    typeof recommendedRestStop.distanceKm === 'number' &&
    recommendedRestStop.distanceKm > estimatedStopDistanceKm + 50;
  const nextCriticalWarning = useMemo(
    () =>
      [...(routeWarningResult?.warnings ?? [])]
        .filter((warning) => warning.severity === 'critical')
        .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))[0] ?? null,
    [routeWarningResult],
  );
  const liveStatusMessages = useMemo(() => {
    const messages: Array<{ tone: 'critical' | 'warning' | 'info'; text: string }> = [];

    if (nextCriticalWarning) {
      const restrictionHeightMm = Math.round(nextCriticalWarning.value * 1000);
      const diffMm =
        checkedVehicleHeightMm !== null ? checkedVehicleHeightMm - restrictionHeightMm : null;
      const diffCm = diffMm !== null ? Math.max(Math.round(diffMm / 10), 0) : null;
      const distanceText =
        typeof nextCriticalWarning.distanceKm === 'number'
          ? ` - ${nextCriticalWarning.distanceKm.toLocaleString(language === 'no' ? 'nb-NO' : 'en-US', {
              maximumFractionDigits: 1,
            })} ${tx(language, 'km frem', 'km ahead')}`
          : '';
      messages.push({
        tone: 'critical',
        text:
          diffCm !== null
            ? `${tx(language, 'FOR HØY', 'TOO HIGH')} +${diffCm} cm${distanceText}`
            : `${tx(language, 'FOR HØY', 'TOO HIGH')}${distanceText}`,
      });
    }

    if (estimatedTimeToStop !== null && estimatedTimeToStop < 0.25) {
      messages.push({
        tone: 'critical',
        text: tx(language, 'STOPP snart - hviletid nærmer seg', 'STOP soon - rest time is approaching'),
      });
    } else if (estimatedTimeToStop !== null && estimatedTimeToStop < 0.5) {
      messages.push({
        tone: 'warning',
        text: tx(language, 'Pause snart nødvendig', 'Break needed soon'),
      });
    }

    if (realRoadwork.some((incident) => typeof incident.distanceKm === 'number' && incident.distanceKm <= 50)) {
      messages.push({
        tone: 'info',
        text: tx(language, 'Veiarbeid nærmer seg', 'Roadwork ahead'),
      });
    }

    return messages.slice(0, 3);
  }, [checkedVehicleHeightMm, estimatedTimeToStop, language, nextCriticalWarning, realRoadwork]);

  const checkRouteWarnings = useCallback(async () => {
    setRouteWarningLoading(true);
    setRouteWarningError('');

    try {
      const vehicleHeightMm = parseVehicleMeasure(heightRef.current?.value ?? '', 'mm');
      const requestBody = {
        from: routeFrom,
        to: routeTo,
        vehicleHeightMm,
        vehicleWidthMm: parseVehicleMeasure(widthRef.current?.value ?? '', 'mm'),
        vehicleLengthMm: parseVehicleMeasure(lengthRef.current?.value ?? '', 'mm'),
        totalWeightKg: parseVehicleMeasure(totalWeightRef.current?.value ?? '', 'kg'),
      };
      console.log('Calling /api/route-warnings');
      console.log('Route warnings request body:', requestBody);

      const response = await fetch('/api/route-warnings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      console.log('Route warnings response status:', response.status);

      if (!response.ok) throw new Error('Route warning request failed');
      const json = (await response.json()) as RouteWarningResponse;
      setRouteWarningResult(json);
      setSelectedWarning(null);
      setCheckedVehicleHeightMm(vehicleHeightMm);
    } catch {
      setRouteWarningError(
        tx(language, 'Kunne ikke gjennomføre foreløpig rutesjekk.', 'Could not run the preliminary route check.'),
      );
    } finally {
      setRouteWarningLoading(false);
    }
  }, [language, routeFrom, routeTo]);

  useEffect(() => {
    if (!autoCheckKey || !routeFrom.trim() || !routeTo.trim()) return;
    void checkRouteWarnings();
  }, [autoCheckKey, checkRouteWarnings, routeFrom, routeTo]);

  return (
    <section className="route-check-section route-check-section--main-trip" aria-labelledby="route-check-title">
      <div className="route-check-copy">
        <p className="eyebrow">{tx(language, 'Rutekart', 'Route map')}</p>
        <h2 id="route-check-title">{tx(language, 'Hovedvisning for turen', 'Main trip view')}</h2>
      </div>

      <div className="route-check-layout">
        <div className="route-check-route-preview">
          <div>
            <span>{tx(language, 'Fra', 'From')}</span>
            <strong>{routeFrom.trim() || emptyRouteText}</strong>
          </div>
          <div>
            <span>{tx(language, 'Til', 'To')}</span>
            <strong>{routeTo.trim() || emptyRouteText}</strong>
          </div>
        </div>

        <div className="route-check-map-panel">
          <RouteMap
            language={language}
            routeFrom={routeFrom}
            routeTo={routeTo}
            warnings={routeWarningResult?.warnings ?? []}
            roadwork={realRoadwork}
            restStops={restStops}
            selectedWarning={selectedWarning}
          />
          <p className="helper">
            Rute, tunnel, høyde og trafikkdata er veiledende. Sjekk alltid skilting, vegliste og
            offisielle kilder før kjøring. Ikke bruk som eneste grunnlag for transport.
          </p>
          {liveStatusMessages.length > 0 ? (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              <strong>{tx(language, 'Status nå', 'Status now')}</strong>
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {liveStatusMessages.map((message, index) => (
                  <div
                    key={`live-status-${message.tone}-${index}`}
                    style={{
                      border:
                        message.tone === 'critical'
                          ? '1px solid rgba(220, 38, 38, 0.45)'
                          : message.tone === 'warning'
                            ? '1px solid rgba(245, 158, 11, 0.5)'
                            : '1px solid rgba(148, 163, 184, 0.35)',
                      background:
                        message.tone === 'critical'
                          ? 'rgba(220, 38, 38, 0.1)'
                          : message.tone === 'warning'
                            ? 'rgba(245, 158, 11, 0.12)'
                            : 'rgba(148, 163, 184, 0.1)',
                      borderRadius: '12px',
                      padding: '0.65rem 0.8rem',
                    }}
                  >
                    <span>{message.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div className="trip-status-grid">
            <div className="trip-status-card">
              <span>LTP</span>
              <strong>{ltpSummary ?? tx(language, 'Sjekk detaljer', 'Check details')}</strong>
            </div>
            <div className="trip-status-card">
              <span>{tx(language, 'Tunnel/høyde', 'Tunnel/height')}</span>
              <strong>
                {routeWarningLoading
                  ? tx(language, 'Sjekker...', 'Checking...')
                  : `${criticalWarningCount} ${tx(language, 'kritisk', 'critical')}, ${cautionWarningCount} ${tx(language, 'nær grense', 'caution')}`}
              </strong>
            </div>
            <div className="trip-status-card">
              <span>{tx(language, 'Veiarbeid', 'Roadwork')}</span>
              <strong>
                {routeWarningLoading ? tx(language, 'Sjekker...', 'Checking...') : `${roadworkCount} ${tx(language, 'hendelser', 'incidents')}`}
              </strong>
            </div>
            <div className="trip-status-card">
              <span>{tx(language, 'Neste pause', 'Next break')}</span>
              <strong>{nextBreakSummary ?? tx(language, 'Avgang ikke satt', 'Departure not set')}</strong>
            </div>
          </div>
          {routeWarningLoading ? (
            <p className="route-check-loading">{tx(language, 'Sjekker høydevarsler og trafikk langs ruten...', 'Checking height warnings and traffic along the route...')}</p>
          ) : null}
          {routeWarningError ? <p className="helper">{routeWarningError}</p> : null}
        </div>

        <details className="trip-details-master">
          <summary>{tx(language, 'Vis detaljer', 'Show details')}</summary>
          <div className="trip-details-stack">
            <details className="trip-detail-card">
              <summary>{tx(language, 'Varsler', 'Warnings')}</summary>
              <button type="button" className="secondary-button secondary-button--compact" onClick={checkRouteWarnings} disabled={routeWarningLoading}>
                {routeWarningLoading
                  ? tx(language, 'Oppdaterer...', 'Updating...')
                  : tx(language, 'Oppdater varsler', 'Refresh warnings')}
              </button>
              {routeWarningResult ? (
                <>
                  <h3>{tx(language, 'Tunnel og høyde', 'Tunnel and height')}</h3>
                  {sortedHeightWarnings.length === 0 ? (
                    <p>{tx(language, 'Ingen høydebegrensninger funnet langs ruten for valgt kjøretøyhøyde.', 'No height restrictions found along the route for the selected vehicle height.')}</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {sortedHeightWarnings.map((warning, index) => {
                        const isCritical = warning.severity === 'critical';
                        const restrictionHeightMm = Math.round(warning.value * 1000);
                        const diffMm =
                          checkedVehicleHeightMm !== null ? checkedVehicleHeightMm - restrictionHeightMm : null;
                        const diffCm = diffMm !== null ? Math.round(Math.abs(diffMm) / 10) : null;
                        const statusText = isCritical
                          ? diffCm !== null
                            ? tx(language, `FOR HØY +${diffCm} cm`, `TOO HIGH +${diffCm} cm`)
                            : tx(language, 'FOR HØY', 'TOO HIGH')
                          : diffCm !== null
                            ? tx(language, `LAV KLARING ${diffCm} cm`, `LOW CLEARANCE ${diffCm} cm`)
                            : tx(language, 'LAV KLARING', 'LOW CLEARANCE');
                        return (
                          <button
                            type="button"
                            key={`height-warning-list-${warning.lat}-${warning.lon}-${index}`}
                            onClick={() => setSelectedWarning(warning)}
                            style={{
                              border: `1px solid ${isCritical ? 'rgba(220, 38, 38, 0.45)' : 'rgba(245, 158, 11, 0.5)'}`,
                              background: isCritical ? 'rgba(220, 38, 38, 0.1)' : 'rgba(245, 158, 11, 0.12)',
                              borderRadius: '14px',
                              padding: '0.85rem 1rem',
                              display: 'grid',
                              gap: '0.35rem',
                              color: 'inherit',
                              cursor: 'pointer',
                              font: 'inherit',
                              textAlign: 'left',
                              width: '100%',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                              <strong>{statusText}</strong>
                            </div>
                            <div className={isCritical ? 'height-warning-detail height-warning-detail--critical' : 'height-warning-detail height-warning-detail--caution'}>
                              {tx(language, 'Skilt', 'Sign')}: {formatHeightMeters(warning.value, language)} m
                            </div>
                            {typeof warning.distanceKm === 'number' ? (
                              <div className="helper" style={{ margin: 0 }}>
                                {warning.distanceKm.toLocaleString(language === 'no' ? 'nb-NO' : 'en-US', {
                                  maximumFractionDigits: 1,
                                })}{' '}
                                {tx(language, 'km frem', 'km ahead')}
                              </div>
                            ) : null}
                            {isCritical ? (
                              <strong className="height-warning-stop">
                                {tx(language, 'STOPP - ruten må endres', 'STOP - route must be changed')}
                              </strong>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <h3>{tx(language, 'Veiarbeid og trafikk', 'Roadwork and traffic')}</h3>
                  {realRoadwork.length === 0 ? (
                    <p>{tx(language, 'Ingen registrerte veiarbeid eller trafikkmeldinger langs ruten akkurat nå.', 'No registered roadwork or traffic incidents along the route right now.')}</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {realRoadwork.map((incident, index) => (
                        <div
                          key={`roadwork-${incident.lat}-${incident.lon}-${index}`}
                          style={{
                            border: '1px solid rgba(14, 165, 233, 0.35)',
                            background: 'rgba(14, 165, 233, 0.1)',
                            borderRadius: '14px',
                            padding: '0.85rem 1rem',
                            display: 'grid',
                            gap: '0.35rem',
                          }}
                        >
                          <strong>{tx(language, 'Veiarbeid / trafikk', 'Roadwork / traffic')}</strong>
                          <span>{incident.description}</span>
                          {typeof incident.distanceKm === 'number' ? (
                            <div className="helper" style={{ margin: 0 }}>
                              {incident.distanceKm.toLocaleString(language === 'no' ? 'nb-NO' : 'en-US', {
                                maximumFractionDigits: 1,
                              })}{' '}
                              {tx(language, 'km frem', 'km ahead')}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                  <h3>{tx(language, 'Hvileplasser', 'Rest stops')}</h3>
                  {restStops.length === 0 ? (
                    <p className="helper">
                      {tx(language, 'Hvileplasser kobles til neste steg.', 'Rest stops will be connected in the next step.')}
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      <div
                        style={{
                          border: '1px solid rgba(34, 197, 94, 0.45)',
                          background: 'rgba(34, 197, 94, 0.14)',
                          borderRadius: '14px',
                          padding: '0.85rem 1rem',
                          display: 'grid',
                          gap: '0.35rem',
                        }}
                      >
                        <strong>{tx(language, 'Anbefalt stopp', 'Recommended stop')}</strong>
                        {recommendedRestStop ? (
                          <>
                            <span>{recommendedRestStop.name}</span>
                            {typeof recommendedRestStop.distanceKm === 'number' ? (
                              <span className="helper" style={{ margin: 0 }}>
                                {recommendedRestStop.distanceKm.toLocaleString(language === 'no' ? 'nb-NO' : 'en-US', {
                                  maximumFractionDigits: 1,
                                })}{' '}
                                {tx(language, 'km frem', 'km ahead')}
                              </span>
                            ) : null}
                            {estimatedTimeToStop ? (
                              <span className="helper" style={{ margin: 0 }}>
                                {Math.round(estimatedTimeToStop * 60)} min
                              </span>
                            ) : null}
                          {isRecommendedStopTooFar ? (
                            <span>{tx(language, 'Ingen ideell hvileplass - vurder tidligere stopp', 'No ideal rest stop - consider an earlier stop')}</span>
                          ) : (
                            <span className="helper" style={{ margin: 0 }}>
                              {tx(language, 'Basert på kjøre-/hviletid', 'Based on driving/rest time')}
                            </span>
                          )}
                        </>
                        ) : (
                          <span>{tx(language, 'Ingen optimal hvileplass funnet - vurder tidligere stopp', 'No optimal rest stop found - consider an earlier stop')}</span>
                        )}
                      </div>
                      {restStops.map((stop, index) => (
                        <div
                          key={`rest-stop-${stop.lat}-${stop.lon}-${index}`}
                          style={{
                            border: '1px solid rgba(34, 197, 94, 0.35)',
                            background: 'rgba(34, 197, 94, 0.1)',
                            borderRadius: '14px',
                            padding: '0.85rem 1rem',
                            display: 'grid',
                            gap: '0.35rem',
                          }}
                        >
                          <strong>{stop.name}</strong>
                          {typeof stop.distanceKm === 'number' ? (
                            <div className="helper" style={{ margin: 0 }}>
                              {stop.distanceKm.toLocaleString(language === 'no' ? 'nb-NO' : 'en-US', {
                                maximumFractionDigits: 1,
                              })}{' '}
                              {tx(language, 'km frem', 'km ahead')}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p>{tx(language, 'Varsler sjekkes automatisk når ruten er klar.', 'Warnings are checked automatically when the route is ready.')}</p>
              )}
            </details>

            {detailsContent}

            <details className="trip-detail-card">
              <summary>{tx(language, 'Kjøretøydata', 'Vehicle data')}</summary>
              <div className="route-check-form-fields">
                <label>
                  <span>{tx(language, 'Kjøretøyhøyde', 'Vehicle height')}</span>
                  <input ref={heightRef} type="text" defaultValue={prefill?.vehicleHeight ?? ''} placeholder="4,20 m" />
                  <small>{sourceHelper}</small>
                </label>
                <label>
                  <span>{tx(language, 'Kjøretøylengde', 'Vehicle length')}</span>
                  <input ref={lengthRef} type="text" defaultValue={prefill?.vehicleLength ?? ''} placeholder="19,50 m" />
                  <small>{sourceHelper}</small>
                </label>
                <label>
                  <span>{tx(language, 'Kjøretøybredde', 'Vehicle width')}</span>
                  <input ref={widthRef} type="text" defaultValue={prefill?.vehicleWidth ?? ''} placeholder="2,55 m" />
                  <small>{sourceHelper}</small>
                </label>
                <label>
                  <span>{tx(language, 'Totalvekt', 'Total weight')}</span>
                  <input ref={totalWeightRef} type="text" defaultValue={prefill?.totalWeight ?? ''} placeholder="50 000 kg" />
                  <small>{sourceHelper}</small>
                </label>
                <label>
                  <span>{tx(language, 'Bruksklasse', 'Road class')}</span>
                  <select defaultValue={prefill?.roadClass ?? 'Bk10_50'}>
                    {ROAD_PROFILES.map((option) => (
                      <option key={`route-${option.value}`} value={option.value}>
                        {tx(language, option.label, option.labelEn ?? option.label)}
                      </option>
                    ))}
                  </select>
                  <small>{sourceHelper}</small>
                </label>
              </div>
            </details>

            {afterVehicleDetailsContent}
          </div>
        </details>
      </div>
    </section>
  );
}

export function DrivingRestSection({
  language,
  plannedDeparture = '',
  drivingUsedTodayHours = '0',
  restStops = [],
}: {
  language: Language;
  plannedDeparture?: string;
  drivingUsedTodayHours?: string;
  restStops?: RestStop[];
}) {
  const [departure, setDeparture] = useState<string>(plannedDeparture);
  const [drivingUsedHours, setDrivingUsedHours] = useState<string>(drivingUsedTodayHours || '0');
  const [maxDrivingBeforeBreakHours, setMaxDrivingBeforeBreakHours] = useState<string>('4.5');
  const [dailyLimitHours, setDailyLimitHours] = useState<string>('9');
  const [extendedDay, setExtendedDay] = useState<boolean>(false);

  const parsedDrivingUsed = parseNumberOrDefault(drivingUsedHours, 0);
  const parsedMaxDrivingBeforeBreak = parseNumberOrDefault(maxDrivingBeforeBreakHours, 4.5);
  const parsedDailyLimit = parseNumberOrDefault(dailyLimitHours, 9);

  const nextBreakBy = useMemo(
    () => computeNextBreakBy(departure, parsedDrivingUsed, parsedMaxDrivingBeforeBreak),
    [departure, parsedDrivingUsed, parsedMaxDrivingBeforeBreak],
  );

  const dailyRestBy = useMemo(
    () => computeDailyRestBy(departure, parsedDrivingUsed, parsedDailyLimit, extendedDay),
    [departure, parsedDrivingUsed, parsedDailyLimit, extendedDay],
  );

  useEffect(() => {
    setDeparture(plannedDeparture);
  }, [plannedDeparture]);

  useEffect(() => {
    setDrivingUsedHours(drivingUsedTodayHours || '0');
  }, [drivingUsedTodayHours]);

  return (
    <section className="route-check-section" aria-labelledby="driving-rest-title">
      <div className="route-check-copy">
        <p className="eyebrow">{tx(language, 'Planlegging', 'Planning')}</p>
        <h2 id="driving-rest-title">{tx(language, 'Kjøre- og hviletid', 'Driving and rest time')}</h2>
        <p>
          {tx(
            language,
            'En enkel forhåndsvisning for pause og døgnhvile. Rute- og stoppdata kobles til senere.',
            'A simple preview for breaks and daily rest. Route and stop data will be connected later.',
          )}
        </p>
      </div>

      <div className="route-check-rest" aria-label={tx(language, 'Kjøre-/hvileplan', 'Driving/rest planner')}>
        <p className="helper">{tx(language, 'Regel: Etter maks 4,5 timer kjøring kreves normalt 45 minutter pause. Daglig kjøretid er normalt 9 timer.', 'Rule: After max 4.5 hours driving a 45-minute break is normally required. Daily driving time is normally 9 hours.')}</p>

        <label>
          <span>{tx(language, 'Planlagt avgang', 'Planned departure time')}</span>
          <input
            type="datetime-local"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
          />
        </label>

        <label>
          <span>{tx(language, 'Tid kjørt allerede i dag (timer)', 'Driving time already used today (hours)')}</span>
          <input
            type="number"
            step="0.25"
            min="0"
            value={drivingUsedHours}
            onChange={(e) => setDrivingUsedHours(e.target.value)}
          />
        </label>

        <label>
          <span>{tx(language, 'Maks kjøretid før pause (timer)', 'Max driving period before break (hours)')}</span>
          <input
            type="number"
            step="0.25"
            min="0"
            value={maxDrivingBeforeBreakHours}
            onChange={(e) => setMaxDrivingBeforeBreakHours(e.target.value)}
          />
        </label>

        <label>
          <span>{tx(language, 'Døgnkjøring (timer)', 'Daily driving limit (hours)')}</span>
          <input
            type="number"
            step="0.25"
            min="0"
            value={dailyLimitHours}
            onChange={(e) => setDailyLimitHours(e.target.value)}
          />
        </label>

        <label className="checkbox-label">
          <input type="checkbox" checked={extendedDay} onChange={(e) => setExtendedDay(e.target.checked)} />
          <span>{tx(language, 'Tillat utvidet 10-timers dag', 'Allow extended 10-hour day')}</span>
        </label>

        <div className="route-check-rest-result">
          <h4>{tx(language, 'Forhåndsvisning', 'Preview')}</h4>
          <div>
            <strong>{tx(language, 'Neste pause senest', 'Next break by')}</strong>
            <div>{nextBreakBy ? formatDateShort(nextBreakBy) : tx(language, 'Avgangstid ikke satt', 'Departure time not set')}</div>
          </div>
          <div>
            <strong>{tx(language, 'Døgnhvile senest', 'Daily rest by')}</strong>
            <div>{dailyRestBy ? formatDateShort(dailyRestBy) : tx(language, 'Avgangstid ikke satt', 'Departure time not set')}</div>
          </div>
          <div>
            <strong>{tx(language, 'Anbefalte stoppesteder', 'Recommended stops')}</strong>
            {restStops.length > 0 ? (
              <div style={{ display: 'grid', gap: '0.35rem' }}>
                {restStops.slice(0, 3).map((stop, index) => (
                  <div key={`driving-rest-stop-${stop.lat}-${stop.lon}-${index}`}>
                    <span>{stop.name}</span>
                    {typeof stop.distanceKm === 'number' ? (
                      <div className="helper" style={{ margin: 0 }}>
                        ≈{' '}
                        {stop.distanceKm.toLocaleString(language === 'no' ? 'nb-NO' : 'en-US', {
                          maximumFractionDigits: 0,
                        })}{' '}
                        {tx(language, 'km frem', 'km ahead')}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div>{tx(language, 'Ingen hvileplasser funnet langs ruten', 'No rest stops found along the route')}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
