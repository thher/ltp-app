"use client";

import { useEffect, useState, useMemo, useRef } from 'react';
import { tx, type Language } from '../lib/i18n';

const DEFAULT_NORWAY_CENTER: [number, number] = [64.0, 11.0];
const ROUTE_LINE_FALLBACK = { color: '#16a071', weight: 5, opacity: 0.85 };
const ROUTE_LINE_REAL = { color: '#0ea5e9', weight: 5, opacity: 0.9 };

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

type LeafletMapInstance = {
  setView: (center: [number, number], zoom: number) => void;
};

type LeafletMarkerInstance = {
  openPopup: () => void;
};

function warningKey(warning: RouteMapWarning) {
  return `${warning.lat}-${warning.lon}-${warning.severity}-${warning.description}`;
}

export default function RouteMap({
  language,
  routeFrom,
  routeTo,
  warnings = [],
  selectedWarning = null,
}: {
  language: Language;
  routeFrom: string;
  routeTo: string;
  warnings?: RouteMapWarning[];
  selectedWarning?: RouteMapWarning | null;
}) {
  const [fromCoord, setFromCoord] = useState<[number, number] | null>(null);
  const [toCoord, setToCoord] = useState<[number, number] | null>(null);
  const [routePath, setRoutePath] = useState<[number, number][] | null>(null);

  const [LeafletComponents, setLeafletComponents] = useState<LeafletComponentsType | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const warningMarkerRefs = useRef<Map<string, LeafletMarkerInstance>>(new Map());

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
    async function geocode(q: string, setter: (c: [number, number] | null) => void) {
      if (!q || !q.trim()) return setter(null);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
          { headers: { 'User-Agent': 'ai-search-app/1.0 (email@example.com)' } },
        );
        const json = (await res.json()) as unknown;
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

    geocode(routeFrom, setFromCoord);
    geocode(routeTo, setToCoord);

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
        return;
      }

      try {
        const [fromLat, fromLon] = fromCoord;
        const [toLat, toLon] = toCoord;
        const res = await fetch(
          `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`,
          { signal: controller.signal },
        );
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

          setRoutePath(path.length > 1 ? path : null);
          return;
        }

        setRoutePath(null);
      } catch {
        if (mounted && !controller.signal.aborted) setRoutePath(null);
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

  return (
    <div className="route-check-map" aria-label={tx(language, 'Kart', 'Map')}>
      {LeafletComponents ? (
        <>
          <LeafletComponents.MapContainer
            ref={mapRef}
            center={mapCenter as unknown}
            zoom={6}
            scrollWheelZoom={false}
            style={{ height: 'min(40vh, 400px)', width: '100%' }}
          >
            <LeafletComponents.TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {fromCoord && toCoord ? (
              <LeafletComponents.Polyline
                positions={routePath ?? [fromCoord, toCoord]}
                pathOptions={routePath ? ROUTE_LINE_REAL : ROUTE_LINE_FALLBACK}
              />
            ) : null}
            {fromCoord && <LeafletComponents.Marker position={fromCoord as [number, number]} />}
            {toCoord && <LeafletComponents.Marker position={toCoord as [number, number]} />}
            {warnings.map((warning, index) => (
              <LeafletComponents.Marker
                key={`height-warning-${warning.lat}-${warning.lon}-${index}`}
                position={[warning.lat, warning.lon] as [number, number]}
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
          </LeafletComponents.MapContainer>
          <div className="route-check-map-caption">
            <strong>{tx(language, 'Kart (enkel forhåndsvisning)', 'Map (simple preview)')}</strong>
            <span>{tx(language, 'Plasser og anbefalinger vises når rutedata er koblet til.', 'Places and recommendations appear when route data is connected.')}</span>
          </div>
        </>
      ) : (
        <div className="route-map-placeholder">
          <div className="route-map-line route-map-line--primary" />
          <div className="route-map-line route-map-line--secondary" />
          <div className="route-map-node route-map-node--from" />
          <div className="route-map-node route-map-node--to" />
          <strong>{tx(language, 'Kart kommer senere', 'Map coming later')}</strong>
          <span>{tx(language, 'Ingen eksterne kart- eller rutedata er koblet til ennå.', 'No external map or route data is connected yet.')}</span>
        </div>
      )}
    </div>
  );
}
