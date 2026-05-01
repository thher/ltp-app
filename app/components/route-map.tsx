"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { tx, type Language } from '../lib/i18n';

const DEFAULT_NORWAY_CENTER: [number, number] = [64.0, 11.0];
const ROUTE_LINE_REAL = { color: '#3b82f6', weight: 4 };

/* eslint-disable @typescript-eslint/no-explicit-any */
type LeafletComponentsType = {
  MapContainer: any;
  TileLayer: any;
  Marker: any;
  Popup: any;
  Polyline: any;
  L: any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

type RouteMapWarning = {
  type: 'height';
  value: number;
  description: string;
  lat: number;
  lon: number;
  severity: 'critical' | 'caution';
};

type RouteMapRoadwork = {
  type: 'roadwork';
  description: string;
  lat: number;
  lon: number;
  distanceKm?: number;
};

type LeafletMapInstance = {
  setView: (center: [number, number], zoom: number) => void;
  fitBounds: (bounds: [number, number][], options?: { padding?: [number, number] }) => void;
};

type LeafletMarkerInstance = {
  openPopup: () => void;
};

function warningKey(warning: RouteMapWarning) {
  return `${warning.lat}-${warning.lon}-${warning.severity}-${warning.description}`;
}

function simplifyRoute(points: [number, number][], step = 10) {
  return points.filter((_, i) => i % step === 0);
}

function nearestRoutePoint(point: [number, number], route: [number, number][]) {
  if (route.length === 0) return point;

  let nearest = point;
  let nearestDistance = Infinity;
  for (const routePoint of route) {
    const latDelta = routePoint[0] - point[0];
    const lonDelta = routePoint[1] - point[1];
    const distance = latDelta * latDelta + lonDelta * lonDelta;
    if (distance < nearestDistance) {
      nearest = routePoint;
      nearestDistance = distance;
    }
  }
  return nearest;
}

export default function RouteMap({
  language,
  routeFrom,
  routeTo,
  warnings = [],
  roadwork = [],
  selectedWarning = null,
}: {
  language: Language;
  routeFrom: string;
  routeTo: string;
  warnings?: RouteMapWarning[];
  roadwork?: RouteMapRoadwork[];
  selectedWarning?: RouteMapWarning | null;
}) {
  const [fromCoord, setFromCoord] = useState<[number, number] | null>(null);
  const [toCoord, setToCoord] = useState<[number, number] | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][] | null>(null);
  const [routeStatus, setRouteStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  const [LeafletComponents, setLeafletComponents] = useState<LeafletComponentsType | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const warningMarkerRefs = useRef<Map<string, LeafletMarkerInstance>>(new Map());
  const hasRouteInput = Boolean(routeFrom.trim() && routeTo.trim());
  const simplifiedRoute = useMemo(() => {
    if (!routePath || routePath.length === 0) return [];
    const simplified = simplifyRoute(routePath, routePath.length > 10000 ? 15 : 5);
    return simplified.length > 1 ? simplified : routePath;
  }, [routePath]);
  const snappedHeightWarnings = useMemo(
    () =>
      warnings.map((warning) => ({
        ...warning,
        mapPosition: nearestRoutePoint([warning.lat, warning.lon], simplifiedRoute),
      })),
    [simplifiedRoute, warnings],
  );
  const snappedRoadwork = useMemo(
    () =>
      roadwork.map((incident) => ({
        ...incident,
        mapPosition: nearestRoutePoint([incident.lat, incident.lon], simplifiedRoute),
      })),
    [roadwork, simplifiedRoute],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [{ MapContainer, TileLayer, Marker, Popup, Polyline }, L] = await Promise.all([
          import('react-leaflet'),
          import('leaflet'),
        ]);
        // @ts-expect-error: import of CSS file for Leaflet
        await import('leaflet/dist/leaflet.css');

        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });

        if (mounted) setLeafletComponents({ MapContainer, TileLayer, Marker, Popup, Polyline, L });
      } catch {
        if (mounted) setLeafletComponents(null);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    async function geocode(label: 'From' | 'To', q: string, setter: (c: [number, number] | null) => void) {
      if (!q || !q.trim()) return setter(null);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
          { headers: { 'User-Agent': 'ai-search-app/1.0 (email@example.com)' } },
        );
        const json = (await res.json()) as unknown;
        console.log(`RouteMap geocoded ${label} result:`, json);
        if (!mounted) return;
        if (Array.isArray(json) && json.length > 0) {
          const first = json[0] as Record<string, unknown> | undefined;
          if (first) {
            const latRaw = first.lat;
            const lonRaw = first.lon;
            const lat = typeof latRaw === 'string' ? Number(latRaw) : typeof latRaw === 'number' ? latRaw : NaN;
            const lon = typeof lonRaw === 'string' ? Number(lonRaw) : typeof lonRaw === 'number' ? lonRaw : NaN;
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
              setter([lat, lon]);
              return;
            }
          }
        }

        setter(null);
      } catch {
        if (mounted) setter(null);
      }
    }

    geocode('From', routeFrom, setFromCoord);
    geocode('To', routeTo, setToCoord);

    return () => {
      mounted = false;
    };
  }, [routeFrom, routeTo]);

  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    async function fetchRoute() {
      if (!fromCoord || !toCoord) {
        setRoutePath(null);
        setRouteStatus('idle');
        return;
      }

      try {
        setRouteStatus('loading');
        const [fromLat, fromLon] = fromCoord;
        const [toLat, toLon] = toCoord;
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
        console.log('RouteMap OSRM request URL:', osrmUrl);
        const res = await fetch(osrmUrl, { signal: controller.signal });
        console.log('RouteMap OSRM response status:', res.status);
        if (!res.ok) throw new Error('OSRM route request failed');

        const json = (await res.json()) as unknown;
        if (!mounted) return;

        const routes =
          typeof json === 'object' && json !== null && 'routes' in json
            ? (json as { routes?: unknown }).routes
            : null;
        const firstRoute = Array.isArray(routes) ? routes[0] : null;
        const geometry =
          typeof firstRoute === 'object' && firstRoute !== null && 'geometry' in firstRoute
            ? (firstRoute as { geometry?: unknown }).geometry
            : null;
        const coordinates =
          typeof geometry === 'object' && geometry !== null && 'coordinates' in geometry
            ? (geometry as { coordinates?: unknown }).coordinates
            : null;

        if (Array.isArray(coordinates)) {
          const path = coordinates
            .map((coord): [number, number] | null => {
              if (!Array.isArray(coord) || coord.length < 2) return null;
              const lon = typeof coord[0] === 'number' ? coord[0] : NaN;
              const lat = typeof coord[1] === 'number' ? coord[1] : NaN;
              return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
            })
            .filter((coord): coord is [number, number] => coord !== null);

          console.log('RouteMap OSRM geometry point count:', path.length);
          setRoutePath(path.length > 1 ? path : null);
          setRouteStatus(path.length > 1 ? 'ready' : 'failed');
          return;
        }

        setRoutePath(null);
        setRouteStatus('failed');
        console.log('RouteMap OSRM geometry point count:', 0);
      } catch {
        if (mounted && !controller.signal.aborted) {
          setRoutePath(null);
          setRouteStatus('failed');
          console.log('RouteMap OSRM geometry point count:', 0);
        }
      }
    }

    fetchRoute();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [fromCoord, toCoord]);

  const mapCenter: [number, number] = useMemo(() => {
    if (fromCoord && toCoord) {
      return [(fromCoord[0] + toCoord[0]) / 2, (fromCoord[1] + toCoord[1]) / 2];
    }
    if (fromCoord) return fromCoord;
    if (toCoord) return toCoord;
    return DEFAULT_NORWAY_CENTER;
  }, [fromCoord, toCoord]);

  useEffect(() => {
    if (!selectedWarning || !Number.isFinite(selectedWarning.lat) || !Number.isFinite(selectedWarning.lon)) return;

    const center: [number, number] = [selectedWarning.lat, selectedWarning.lon];
    mapRef.current?.setView(center, 15);
    warningMarkerRefs.current.get(warningKey(selectedWarning))?.openPopup();
  }, [selectedWarning]);

  useEffect(() => {
    if (simplifiedRoute.length > 1) {
      mapRef.current?.fitBounds(simplifiedRoute, { padding: [32, 32] });
      return;
    }

    if (fromCoord && toCoord) {
      mapRef.current?.fitBounds([fromCoord, toCoord], { padding: [32, 32] });
    }
  }, [fromCoord, simplifiedRoute, toCoord]);

  const routeCaption = (() => {
    if (hasRouteInput && routeStatus === 'loading') {
      return tx(language, 'Henter rute og kartdata…', 'Fetching route and map data…');
    }
    if (fromCoord && toCoord && routeStatus === 'failed') {
      return tx(
        language,
        'Kunne ikke hente rute. Sjekk fra/til eller prøv igjen.',
        'Could not fetch the route. Check from/to or try again.',
      );
    }
    if (routeStatus === 'ready') {
      return tx(language, 'Ruten er tegnet med veilinje.', 'The route is drawn with road geometry.');
    }
    return tx(language, 'Henter rute og kartdata…', 'Fetching route and map data…');
  })();

  return (
    <div className="route-check-map" aria-label={tx(language, 'Kart', 'Map')}>
      {LeafletComponents ? (
        <>
          <LeafletComponents.MapContainer
            ref={mapRef}
            center={mapCenter as unknown}
            zoom={6}
            scrollWheelZoom={false}
            style={{ height: 'min(58vh, 560px)', width: '100%' }}
          >
            <LeafletComponents.TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {fromCoord && toCoord && simplifiedRoute.length > 1 ? (
              <LeafletComponents.Polyline
                positions={simplifiedRoute}
                pathOptions={ROUTE_LINE_REAL}
              />
            ) : null}
            {fromCoord && <LeafletComponents.Marker position={fromCoord as [number, number]} />}
            {toCoord && <LeafletComponents.Marker position={toCoord as [number, number]} />}
            {snappedHeightWarnings.map((warning, index) => (
              <LeafletComponents.Marker
                key={`height-warning-${warning.lat}-${warning.lon}-${index}`}
                position={warning.mapPosition}
                ref={(marker: LeafletMarkerInstance | null) => {
                  const key = warningKey(warning);
                  if (marker) {
                    warningMarkerRefs.current.set(key, marker);
                  } else {
                    warningMarkerRefs.current.delete(key);
                  }
                }}
                icon={LeafletComponents.L.divIcon({
                  className: '',
                  html: `<span style="display:block;width:18px;height:18px;border-radius:999px;background:${warning.severity === 'critical' ? '#dc2626' : '#f59e0b'};border:3px solid #fff;box-shadow:0 8px 18px rgba(0,0,0,.28);"></span>`,
                  iconSize: [18, 18],
                  iconAnchor: [9, 9],
                })}
              >
                <LeafletComponents.Popup>
                  <strong>{warning.description}</strong>
                  <br />
                  <span>
                    {tx(language, 'Alvorlighetsgrad', 'Severity')}: {warning.severity}
                  </span>
                </LeafletComponents.Popup>
              </LeafletComponents.Marker>
            ))}
            {snappedRoadwork.map((incident, index) => (
              <LeafletComponents.Marker
                key={`roadwork-${incident.lat}-${incident.lon}-${index}`}
                position={incident.mapPosition}
                icon={LeafletComponents.L.divIcon({
                  className: '',
                  html: '<span style="display:block;width:20px;height:20px;border-radius:6px;background:#0ea5e9;border:3px solid #fef08a;box-shadow:0 8px 18px rgba(0,0,0,.28);"></span>',
                  iconSize: [20, 20],
                  iconAnchor: [10, 10],
                })}
              >
                <LeafletComponents.Popup>
                  <strong>{incident.description}</strong>
                  {typeof incident.distanceKm === 'number' ? (
                    <>
                      <br />
                      <span>
                        {incident.distanceKm.toLocaleString(language === 'no' ? 'nb-NO' : 'en-US', {
                          maximumFractionDigits: 1,
                        })}{' '}
                        {tx(language, 'km frem', 'km ahead')}
                      </span>
                    </>
                  ) : null}
                </LeafletComponents.Popup>
              </LeafletComponents.Marker>
            ))}
          </LeafletComponents.MapContainer>
          <div className="route-check-map-caption">
            <strong>{tx(language, 'Rutekart', 'Route map')}</strong>
            <span>{routeCaption}</span>
            <div className="route-map-debug">
              <span>{tx(language, 'From coordinate found', 'From coordinate found')}: {fromCoord ? 'yes' : 'no'}</span>
              <span>{tx(language, 'To coordinate found', 'To coordinate found')}: {toCoord ? 'yes' : 'no'}</span>
              <span>{tx(language, 'OSRM route fetched', 'OSRM route fetched')}: {routeStatus === 'ready' ? 'yes' : 'no'}</span>
              <span>{tx(language, 'Route point count', 'Route point count')}: {routePath?.length ?? 0}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="route-map-placeholder">
          <div className="route-map-line route-map-line--primary" />
          <div className="route-map-line route-map-line--secondary" />
          <div className="route-map-node route-map-node--from" />
          <div className="route-map-node route-map-node--to" />
          <strong>{hasRouteInput ? tx(language, 'Henter rute og kartdata…', 'Fetching route and map data…') : tx(language, 'Kart', 'Map')}</strong>
          <span>{hasRouteInput ? tx(language, 'Kartet lastes inn.', 'The map is loading.') : tx(language, 'Legg inn fra og til for å vise rute.', 'Enter from and to locations to show a route.')}</span>
        </div>
      )}
    </div>
  );
}
