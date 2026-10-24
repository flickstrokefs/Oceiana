import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, RotateCcw, ZoomIn, ZoomOut, Navigation, Disc3, Radar } from 'lucide-react';

export interface HazardRegionData {
  id: string;
  name: string;
  area: string;
  area_km2: number;
  maxValue: string;
  max_value_raw: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'ADVISORY' | 'NORMAL' | 'LOW' | 'NOT_EXPOSED';
  impactSummary: string;
  recommendedAction: string;
  bounds: { west: number; east: number; south: number; north: number };
  polygon: [number, number][]; // [lat, lon]
}

export interface CycloneTrackPoint {
  time: string;
  lat: number;
  lon: number;
  wind_kt: number;
  wind_kmh: number;
  pressure_hpa: number;
  category: string;
}

export interface RegionalCyclone {
  name: string;
  season: number;
  category: string;
  basin: string;
  peak_wind_kt: number;
  peak_wind_kmh: number;
  min_pressure_hpa: number;
  dates: string;
  center: { lat: number; lon: number };
  track: CycloneTrackPoint[];
  wind_radii_nm?: {
    r64: number;
    r50: number;
    r34: number;
  };
}

interface RealHazardMapProps {
  hazardRegions: HazardRegionData[];
  selectedRegionId: string;
  onSelectRegion: (id: string) => void;
  cycloneTrack?: CycloneTrackPoint[];
  regionalCyclones?: RegionalCyclone[];
  isCycloneMode?: boolean;
  stormName?: string;
  onSelectStorm?: (storm: string) => void;
  threshold?: string;
}

// Basemaps for authentic GIS cartography
const BASEMAP_TILES = {
  dark: {
    name: 'CartoDB Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 18,
  },
  ocean: {
    name: 'Esri Ocean Bathymetry',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, GEBCO, NOAA',
    subdomains: [],
    maxZoom: 13,
  },
  satellite: {
    name: 'Esri World Satellite',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar',
    subdomains: [],
    maxZoom: 18,
  },
};

// Major International Shipping Corridors (SLOCs)
const SHIPPING_CORRIDORS: { id: string; name: string; path: [number, number][] }[] = [
  {
    id: 'sloc-tanker',
    name: 'Hormuz Tanker Route -> Malacca Strait',
    path: [
      [26.2, 56.4],
      [24.5, 59.0],
      [20.5, 63.5],
      [14.2, 69.5],
      [8.0, 76.5],
      [5.8, 80.5],
      [5.4, 94.5],
      [4.2, 98.8],
    ],
  },
  {
    id: 'sloc-suez',
    name: 'Red Sea / Gulf of Aden -> Colombo Hub',
    path: [
      [12.6, 44.5],
      [12.2, 51.5],
      [10.5, 59.5],
      [7.8, 72.0],
      [6.9, 79.8],
    ],
  },
  {
    id: 'sloc-cape',
    name: 'Cape of Good Hope -> Bay of Bengal Corridor',
    path: [
      [-34.0, 25.0],
      [-28.0, 45.0],
      [-15.0, 68.0],
      [-2.0, 82.0],
      [12.0, 85.0],
      [17.5, 87.5],
    ],
  },
];

// Fallback regional benchmarks if backend is offline
const DEFAULT_REGIONAL_CYCLONES: RegionalCyclone[] = [
  {
    name: 'AMPHAN',
    season: 2020,
    category: 'Super Cyclonic Storm (SuCS)',
    basin: 'Bay of Bengal',
    peak_wind_kt: 130,
    peak_wind_kmh: 240.8,
    min_pressure_hpa: 920,
    dates: '16–21 May 2020',
    center: { lat: 18.2, lon: 86.8 },
    track: [],
    wind_radii_nm: { r64: 55, r50: 95, r34: 175 },
  },
  {
    name: 'BIPARJOY',
    season: 2023,
    category: 'Extremely Severe Cyclonic Storm (ESCS)',
    basin: 'Arabian Sea',
    peak_wind_kt: 90,
    peak_wind_kmh: 166.7,
    min_pressure_hpa: 958,
    dates: '6–19 Jun 2023',
    center: { lat: 21.0, lon: 66.5 },
    track: [],
    wind_radii_nm: { r64: 40, r50: 75, r34: 145 },
  },
  {
    name: 'MOCHA',
    season: 2023,
    category: 'Extremely Severe Cyclonic Storm (ESCS)',
    basin: 'Bay of Bengal',
    peak_wind_kt: 115,
    peak_wind_kmh: 213.0,
    min_pressure_hpa: 938,
    dates: '9–15 May 2023',
    center: { lat: 15.5, lon: 90.2 },
    track: [],
    wind_radii_nm: { r64: 50, r50: 85, r34: 160 },
  },
  {
    name: 'TAUKTAE',
    season: 2021,
    category: 'Extremely Severe Cyclonic Storm (ESCS)',
    basin: 'Arabian Sea',
    peak_wind_kt: 100,
    peak_wind_kmh: 185.2,
    min_pressure_hpa: 950,
    dates: '14–19 May 2021',
    center: { lat: 17.5, lon: 71.8 },
    track: [],
    wind_radii_nm: { r64: 45, r50: 80, r34: 150 },
  },
];

// Physical Wind Field vector function combining cyclonic vortices with ambient monsoonal trade winds
function computeWindVector(
  lat: number,
  lon: number,
  vortices: { lat: number; lon: number; maxWind: number }[]
): { u: number; v: number; speed: number; direction: number } {
  // Ambient trade wind / summer SW monsoon base field (knots)
  let u_amb = 12.0;
  let v_amb = 6.0;

  if (lat < 5) {
    u_amb = 5.0;
    v_amb = 2.0;
  } else if (lon < 75) {
    u_amb = 15.0;
    v_amb = 9.0;
  }

  let u_cyc_total = 0;
  let v_cyc_total = 0;
  let minDistanceToCyclone = 999;

  for (const c of vortices) {
    const dLat = lat - c.lat;
    const dLon = (lon - c.lon) * Math.cos((c.lat * Math.PI) / 180);
    const r = Math.sqrt(dLat * dLat + dLon * dLon);
    if (r < minDistanceToCyclone) minDistanceToCyclone = r;

    // Influence extends up to ~9 degrees (~1,000 km)
    if (r > 0.05 && r < 9.5) {
      const theta = Math.atan2(dLat, dLon);
      const R_max = 0.42; // Radius of max winds in degrees (~46 km)
      let Vt: number;
      if (r <= R_max) {
        Vt = c.maxWind * (r / R_max);
      } else {
        Vt = c.maxWind * Math.pow(R_max / r, 0.65) * Math.exp(-0.16 * (r - R_max));
      }

      // Counter-clockwise cyclonic rotation (Northern Hemisphere) + ~20° inward radial spiral
      const psi = theta + Math.PI / 2 + 0.36;
      u_cyc_total += Vt * Math.cos(psi);
      v_cyc_total += Vt * Math.sin(psi);
    }
  }

  const blend = Math.min(1, minDistanceToCyclone / 4.0);
  const u = u_cyc_total + u_amb * blend;
  const v = v_cyc_total + v_amb * blend;
  const speed = Math.sqrt(u * u + v * v);
  const rad = Math.atan2(-u, -v);
  let direction = (rad * 180) / Math.PI;
  if (direction < 0) direction += 360;

  return { u, v, speed, direction };
}

// Legacy internal type retained while the now-unmounted flow renderer is removed in a follow-up cleanup.
interface WindParticle {
  x: number;
  y: number;
  age: number;
  maxLife: number;
}

export const RealHazardMap: React.FC<RealHazardMapProps> = ({
  hazardRegions,
  selectedRegionId,
  onSelectRegion,
  cycloneTrack = [],
  regionalCyclones = [],
  isCycloneMode = false,
  stormName = 'AMPHAN',
  onSelectStorm,
  threshold = '64',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayersRef = useRef<Record<string, L.Layer>>({});
  const cycloneLayersRef = useRef<L.LayerGroup | null>(null);
  const windRadiiLayersRef = useRef<L.LayerGroup | null>(null);
  const shippingLayersRef = useRef<L.LayerGroup | null>(null);
  const hazardRasterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const windRasterLayerRef = useRef<L.ImageOverlay | null>(null);

  // Retained internally while the legacy simulation code is phased out; no canvas is mounted.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [activeBasemap, setActiveBasemap] = useState<'dark' | 'ocean' | 'satellite'>('dark');
  const [showWindFlows] = useState<boolean>(false);
  const [flowSpeedMode] = useState<'normal' | 'fast'>('normal');
  const [showWindRadii, setShowWindRadii] = useState<boolean>(false);
  const [showShippingLanes, setShowShippingLanes] = useState<boolean>(false);
  const [showCycloneTrack, setShowCycloneTrack] = useState<boolean>(true);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [cursorWind, setCursorWind] = useState<{ speed: number; dir: number } | null>(null);

  // Active cyclones list for vortex calculations
  const activeCyclonesList = useMemo(() => {
    const list = regionalCyclones.length > 0 ? regionalCyclones : DEFAULT_REGIONAL_CYCLONES;
    return list;
  }, [regionalCyclones]);

  // Primary active storm meta
  const currentActiveStorm = useMemo(() => {
    return (
      activeCyclonesList.find((c) => c.name.toUpperCase() === stormName.toUpperCase()) ||
      activeCyclonesList[0]
    );
  }, [activeCyclonesList, stormName]);

  // Active vortices for wind field: focused storm or all regional storms
  const activeVortices = useMemo(() => {
    if (stormName === 'ALL' || stormName.includes('ALL')) {
      return activeCyclonesList.map((c) => ({
        lat: c.center.lat,
        lon: c.center.lon,
        maxWind: c.peak_wind_kt,
      }));
    }
    // Focused storm: prioritize current storm center or peak point
    if (cycloneTrack.length > 0) {
      const peakPt = [...cycloneTrack].sort((a, b) => b.wind_kt - a.wind_kt)[0];
      return [
        {
          lat: peakPt ? peakPt.lat : currentActiveStorm.center.lat,
          lon: peakPt ? peakPt.lon : currentActiveStorm.center.lon,
          maxWind: peakPt ? peakPt.wind_kt : currentActiveStorm.peak_wind_kt,
        },
        // Also keep other regional storms as secondary vortices
        ...activeCyclonesList
          .filter((c) => c.name.toUpperCase() !== stormName.toUpperCase())
          .map((c) => ({
            lat: c.center.lat,
            lon: c.center.lon,
            maxWind: c.peak_wind_kt * 0.75,
          })),
      ];
    }
    return activeCyclonesList.map((c) => ({
      lat: c.center.lat,
      lon: c.center.lon,
      maxWind: c.name.toUpperCase() === stormName.toUpperCase() ? c.peak_wind_kt : c.peak_wind_kt * 0.7,
    }));
  }, [activeCyclonesList, stormName, cycloneTrack, currentActiveStorm]);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on Indian Ocean Basin (covering Bay of Bengal & Arabian Sea)
    const map = L.map(mapContainerRef.current, {
      center: [15.0, 78.0],
      zoom: 5,
      minZoom: 2,
      maxZoom: 12,
      zoomControl: false,
      attributionControl: false,
      renderer: L.canvas({ padding: 0.3 }),
    });
    mapInstanceRef.current = map;

    // Basemap tile layer
    const cfg = BASEMAP_TILES[activeBasemap];
    const tile = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains,
      maxZoom: cfg.maxZoom,
    }).addTo(map);
    tileLayerRef.current = tile;

    // Layer groups
    cycloneLayersRef.current = L.layerGroup().addTo(map);
    windRadiiLayersRef.current = L.layerGroup().addTo(map);
    shippingLayersRef.current = L.layerGroup().addTo(map);

    // Cursor coordinates and dynamic wind speed readout
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const lat = parseFloat(e.latlng.lat.toFixed(2));
      const lng = parseFloat(e.latlng.lng.toFixed(2));
      setCursorCoords({ lat, lng });

      const w = computeWindVector(lat, lng, activeVortices);
      setCursorWind({ speed: Math.round(w.speed), dir: Math.round(w.direction) });
    });

    map.on('mouseout', () => {
      setCursorCoords(null);
      setCursorWind(null);
    });

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Basemap Switcher
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const cfg = BASEMAP_TILES[activeBasemap];
    const newTile = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains,
      maxZoom: cfg.maxZoom,
    }).addTo(map);
    tileLayerRef.current = newTile;
  }, [activeBasemap]);

  // 3. Render Maritime Sectors & Hazard Polygons
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old polygons
    Object.values(polygonLayersRef.current).forEach((l) => map.removeLayer(l));
    polygonLayersRef.current = {};

    // Cyclone mode uses the continuous wind-intensity field below; sector boxes would obscure it.
    if (isCycloneMode) return;

    const valUnit = isCycloneMode ? 'kt' : 'm/s';

    hazardRegions.forEach((r) => {
      if (!r || !r.polygon || !Array.isArray(r.polygon) || r.polygon.length < 3) return;

      const isSelected = r.id === selectedRegionId;
      const strokeColor =
        r.risk_level === 'CRITICAL'
          ? '#ef4444'
          : r.risk_level === 'HIGH'
          ? '#f97316'
          : r.risk_level === 'MODERATE'
          ? '#eab308'
          : '#10b981';

      try {
        const poly = L.polygon(r.polygon, {
          color: strokeColor,
          weight: isSelected ? 2.5 : 1.25,
          dashArray: isSelected ? undefined : '5, 7',
          fillColor: strokeColor,
          fillOpacity: isSelected ? 0.16 : 0.05,
        }).addTo(map);

        poly.on('click', () => onSelectRegion(r.id));

        poly.bindTooltip(
          `<div style="font-size: 11px; padding: 2px 4px; font-family: system-ui, sans-serif;">
            <strong style="color: #38bdf8;">${r.name}</strong><br/>
            <span>Peak: <strong>${r.maxValue} ${valUnit}</strong> · Risk: <strong>${r.risk_level}</strong></span><br/>
            <span style="color: #94a3b8; font-size: 10px;">Area: ${r.area} km²</span>
          </div>`,
          { sticky: true, className: 'leaflet-hazard-tooltip' }
        );

        polygonLayersRef.current[r.id] = poly;
      } catch (err) {
        console.warn('Error creating polygon for', r.name, err);
      }
    });
  }, [hazardRegions, selectedRegionId, onSelectRegion, isCycloneMode]);

  // 4. Render Regional Cyclones, Active Track, and Eye Badges
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !cycloneLayersRef.current) return;

    cycloneLayersRef.current.clearLayers();

    if (!isCycloneMode || !showCycloneTrack) return;

    // 4A. Render all regional cyclones' eye markers & baseline tracks
    activeCyclonesList.forEach((cyc) => {
      const isCurrentSelected = cyc.name.toUpperCase() === stormName.toUpperCase();
      // Keep the map geographic: show a single focused storm symbol, not a label card for every cyclone.
      if (!isCurrentSelected) return;
      const basinColor = cyc.basin === 'Arabian Sea' ? '#06b6d4' : '#ec4899';

      // Regional Cyclone Eye Marker
      const eyeIcon = L.divIcon({
        className: 'cyclone-eye-icon',
        html: `
          <div class="cyclone-regional-badge ${isCurrentSelected ? 'badge-focused' : ''}">
            <div class="eye-radar-pulse" style="border-color: ${basinColor};"></div>
            <div class="eye-core-dot" style="background: ${basinColor};">🌀</div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [18, 18],
      });

      const eyeMarker = L.marker([cyc.center.lat, cyc.center.lon], { icon: eyeIcon }).addTo(
        cycloneLayersRef.current!
      );

      eyeMarker.on('click', () => {
        if (onSelectStorm) {
          onSelectStorm(cyc.name);
        }
        map.flyTo([cyc.center.lat, cyc.center.lon], 6, { duration: 1.2 });
      });

      eyeMarker.bindTooltip(
        `<div style="font-family: system-ui, sans-serif; font-size: 11px; line-height: 1.4;">
          <strong style="color: ${basinColor}; font-size: 12px;">Cyclone ${cyc.name} (${cyc.season})</strong><br/>
          <span>${cyc.category} · <strong>${cyc.basin}</strong></span><br/>
          <span>Peak Sustained Wind: <strong>${cyc.peak_wind_kt} kt (${cyc.peak_wind_kmh} km/h)</strong></span><br/>
          <span>Min Barometric Pressure: <strong>${cyc.min_pressure_hpa} hPa</strong></span><br/>
          <span style="color: #94a3b8; font-size: 10px;">Dates: ${cyc.dates}</span>
        </div>`,
        { sticky: true, className: 'leaflet-hazard-tooltip' }
      );

      // Render secondary storm track if available
      if (cyc.track && cyc.track.length > 0 && !isCurrentSelected) {
        const secondaryPts: [number, number][] = cyc.track.map((p) => [p.lat, p.lon]);
        L.polyline(secondaryPts, {
          color: basinColor,
          weight: 2.0,
          opacity: 0.5,
          dashArray: '4, 6',
        }).addTo(cycloneLayersRef.current!);
      }
    });

    // 4B. Render the primary selected storm's detailed track
    if (cycloneTrack && cycloneTrack.length > 0) {
      const latlngs: [number, number][] = cycloneTrack.map((pt) => [pt.lat, pt.lon]);

      // Outer glow buffer
      L.polyline(latlngs, {
        color: '#f43f5e',
        weight: 6,
        opacity: 0.08,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(cycloneLayersRef.current!);

      // Main track line
      L.polyline(latlngs, {
        color: '#fb7185',
        weight: 2.4,
        opacity: 0.82,
        dashArray: '7, 7',
      }).addTo(cycloneLayersRef.current!);

      // Waypoints along track
      cycloneTrack.slice(0, 0).forEach((pt, idx) => {
        let color = '#06b6d4';
        let radius = 5;
        if (pt.wind_kt >= 120) {
          color = '#ec4899';
          radius = 9;
        } else if (pt.wind_kt >= 90) {
          color = '#ef4444';
          radius = 8;
        } else if (pt.wind_kt >= 64) {
          color = '#f97316';
          radius = 7;
        } else if (pt.wind_kt >= 48) {
          color = '#f59e0b';
          radius = 6;
        } else if (pt.wind_kt >= 34) {
          color = '#38bdf8';
          radius = 5.5;
        }

        const marker = L.circleMarker([pt.lat, pt.lon], {
          radius,
          fillColor: color,
          color: '#ffffff',
          weight: 1.5,
          fillOpacity: 0.95,
        }).addTo(cycloneLayersRef.current!);

        marker.bindTooltip(
          `<div style="font-family: system-ui, sans-serif; font-size: 11px; line-height: 1.4; min-width: 175px;">
            <div style="font-weight: 700; color: ${color}; font-size: 12px; margin-bottom: 3px;">
              🌀 ${stormName} #${idx + 1}
            </div>
            <div><strong>Category:</strong> ${pt.category}</div>
            <div><strong>Sustained Wind:</strong> ${pt.wind_kt} kt (${pt.wind_kmh} km/h)</div>
            <div><strong>Central Pressure:</strong> ${pt.pressure_hpa} hPa</div>
            <div style="color: #94a3b8; font-size: 10px; margin-top: 3px;">${pt.time}</div>
          </div>`,
          { sticky: true, className: 'leaflet-hazard-tooltip' }
        );
      });
    }
  }, [isCycloneMode, showCycloneTrack, activeCyclonesList, cycloneTrack, stormName, onSelectStorm]);

  // 5. Render Wind Radii (R34, R50, R64 Isotachs)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !windRadiiLayersRef.current) return;

    windRadiiLayersRef.current.clearLayers();

    if (!isCycloneMode || !showWindRadii) return;

    // Plot danger wind radii for active cyclone centers
    const targetCyclones =
      stormName === 'ALL' || stormName.includes('ALL')
        ? activeCyclonesList
        : [currentActiveStorm];

    targetCyclones.forEach((cyc) => {
      const r_nm = cyc.wind_radii_nm || { r64: 45, r50: 80, r34: 150 };
      const center: [number, number] = [cyc.center.lat, cyc.center.lon];

      // Conversion: 1 Nautical Mile = 1852 meters
      // R34: Gale Force (34 kt)
      const c34 = L.circle(center, {
        radius: r_nm.r34 * 1852,
        color: '#06b6d4',
        weight: 1.2,
        dashArray: '6, 6',
        fillColor: '#06b6d4',
        fillOpacity: 0.07,
      }).addTo(windRadiiLayersRef.current!);

      c34.bindTooltip(
        `<div style="font-size: 11px;">
          <strong style="color: #06b6d4;">R34 Gale-Force Radius: ${r_nm.r34} nm</strong><br/>
          <span>Cyclone ${cyc.name} · Winds ≥ 34 kt (63 km/h)</span><br/>
          <span style="color: #cbd5e1; font-size: 10px;">Dangerous swells and navigational warnings.</span>
        </div>`,
        { sticky: true, className: 'leaflet-hazard-tooltip' }
      );

      // R50: Storm Force (50 kt)
      const c50 = L.circle(center, {
        radius: r_nm.r50 * 1852,
        color: '#f59e0b',
        weight: 1.4,
        dashArray: '4, 4',
        fillColor: '#f59e0b',
        fillOpacity: 0.12,
      }).addTo(windRadiiLayersRef.current!);

      c50.bindTooltip(
        `<div style="font-size: 11px;">
          <strong style="color: #f59e0b;">R50 Storm-Force Radius: ${r_nm.r50} nm</strong><br/>
          <span>Cyclone ${cyc.name} · Winds ≥ 50 kt (93 km/h)</span><br/>
          <span style="color: #cbd5e1; font-size: 10px;">Severe sea chop, heavy damage to light vessels.</span>
        </div>`,
        { sticky: true, className: 'leaflet-hazard-tooltip' }
      );

      // R64: Hurricane / Core Force (64 kt)
      const c64 = L.circle(center, {
        radius: r_nm.r64 * 1852,
        color: '#f43f5e',
        weight: 1.8,
        fillColor: '#f43f5e',
        fillOpacity: 0.18,
      }).addTo(windRadiiLayersRef.current!);

      c64.bindTooltip(
        `<div style="font-size: 11px;">
          <strong style="color: #f43f5e;">R64 Hurricane-Force Radius: ${r_nm.r64} nm</strong><br/>
          <span>Cyclone ${cyc.name} · Winds ≥ 64 kt (119 km/h)</span><br/>
          <span style="color: #fca5a5; font-size: 10px; font-weight: 600;">IMD Great Danger zone · Catastrophic sea surge.</span>
        </div>`,
        { sticky: true, className: 'leaflet-hazard-tooltip' }
      );
    });
  }, [isCycloneMode, showWindRadii, activeCyclonesList, currentActiveStorm, stormName]);

  // 6. Render Shipping Corridors
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !shippingLayersRef.current) return;

    shippingLayersRef.current.clearLayers();

    if (showShippingLanes) {
      SHIPPING_CORRIDORS.forEach((lane) => {
        const line = L.polyline(lane.path, {
          color: '#38bdf8',
          weight: 2.2,
          dashArray: '8, 8',
          opacity: 0.85,
        }).addTo(shippingLayersRef.current!);

        line.bindTooltip(
          `<div style="font-size: 11px; font-weight: 600; color: #38bdf8;">🚢 ${lane.name}</div>`,
          { sticky: true, className: 'leaflet-hazard-tooltip' }
        );
      });
    }
  }, [showShippingLanes]);

  // Render the observed wind hazard as a geographic raster field, not a stack of SVG markers.
  // Each best-track fix contributes a soft, scaled wind footprint; the result reads as a continuous swath.
  useEffect(() => {
    const map = mapInstanceRef.current;
    const canvas = hazardRasterCanvasRef.current;
    if (!map || !canvas || !isCycloneMode) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const resizeAndDraw = () => {
      const size = map.getSize();
      const scale = window.devicePixelRatio || 1;
      canvas.width = size.x * scale;
      canvas.height = size.y * scale;
      canvas.style.width = `${size.x}px`;
      canvas.style.height = `${size.y}px`;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, size.x, size.y);

      const samples = cycloneTrack.length ? cycloneTrack : currentActiveStorm ? [{
        lat: currentActiveStorm.center.lat,
        lon: currentActiveStorm.center.lon,
        wind_kt: currentActiveStorm.peak_wind_kt,
      }] : [];
      const radii = currentActiveStorm?.wind_radii_nm || { r64: 45, r50: 80, r34: 150 };

      samples.forEach((sample) => {
        const center = map.latLngToContainerPoint([sample.lat, sample.lon]);
        const edge = map.latLngToContainerPoint([sample.lat, sample.lon + (radii.r34 * 1.852) / 111]);
        const radius = Math.max(52, Math.abs(edge.x - center.x) * 1.8);
        const intensity = Math.max(0.32, Math.min(1, sample.wind_kt / 115));
        const gradient = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
        gradient.addColorStop(0, `rgba(225, 29, 72, ${0.62 * intensity})`);
        gradient.addColorStop(0.22, `rgba(244, 63, 94, ${0.46 * intensity})`);
        gradient.addColorStop(0.5, `rgba(245, 158, 11, ${0.29 * intensity})`);
        gradient.addColorStop(0.76, `rgba(34, 211, 238, ${0.16 * intensity})`);
        gradient.addColorStop(1, 'rgba(34, 211, 238, 0)');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(center.x, center.y, radius, 0, Math.PI * 2);
        context.fill();
      });
    };

    resizeAndDraw();
    map.on('move zoom resize', resizeAndDraw);
    return () => {
      map.off('move zoom resize', resizeAndDraw);
    };
  }, [isCycloneMode, cycloneTrack, currentActiveStorm]);

  // Georeferenced gridded analysis: unlike a screen overlay, this image has real lat/lon bounds
  // and Leaflet reprojects it with the map on every zoom and pan.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (windRasterLayerRef.current) {
      map.removeLayer(windRasterLayerRef.current);
      windRasterLayerRef.current = null;
    }
    if (!isCycloneMode || !currentActiveStorm) return;

    const samples = cycloneTrack.length
      ? cycloneTrack
      : [{ lat: currentActiveStorm.center.lat, lon: currentActiveStorm.center.lon, wind_kt: currentActiveStorm.peak_wind_kt }];
    const r34Km = (currentActiveStorm.wind_radii_nm?.r34 || 150) * 1.852;
    const padDegrees = Math.max(3, r34Km / 70);
    const latMin = Math.min(...samples.map((p) => p.lat)) - padDegrees;
    const latMax = Math.max(...samples.map((p) => p.lat)) + padDegrees;
    const lonMin = Math.min(...samples.map((p) => p.lon)) - padDegrees;
    const lonMax = Math.max(...samples.map((p) => p.lon)) + padDegrees;
    const width = 720;
    const height = Math.max(320, Math.round(width * (latMax - latMin) / (lonMax - lonMin)));
    const raster = document.createElement('canvas');
    raster.width = width;
    raster.height = height;
    const ctx = raster.getContext('2d');
    if (!ctx) return;
    const image = ctx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
      const lat = latMax - (y / (height - 1)) * (latMax - latMin);
      for (let x = 0; x < width; x++) {
        const lon = lonMin + (x / (width - 1)) * (lonMax - lonMin);
        let wind = 0;
        for (const sample of samples) {
          const dx = (lon - sample.lon) * 111 * Math.cos((lat * Math.PI) / 180);
          const dy = (lat - sample.lat) * 111;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const localWind = sample.wind_kt * Math.exp(-Math.pow(distance / r34Km, 1.7));
          wind = Math.max(wind, localWind);
        }
        if (wind < 18) continue;
        const t = Math.min(1, (wind - 18) / 105);
        const i = (y * width + x) * 4;
        // Oceanographic intensity palette: cyan (watch) → amber (gale) → red (severe core).
        const red = t < 0.45 ? Math.round(20 + 525 * t) : Math.round(255 - 90 * (t - 0.45));
        const green = t < 0.45 ? Math.round(170 + 120 * t) : Math.round(225 - 190 * (t - 0.45));
        const blue = t < 0.45 ? Math.round(235 - 330 * t) : Math.round(75 - 45 * (t - 0.45));
        image.data[i] = red;
        image.data[i + 1] = Math.max(0, green);
        image.data[i + 2] = Math.max(0, blue);
        image.data[i + 3] = Math.round(35 + 150 * t);
      }
    }
    ctx.putImageData(image, 0, 0);
    windRasterLayerRef.current = L.imageOverlay(
      raster.toDataURL('image/png'),
      [[latMin, lonMin], [latMax, lonMax]],
      { opacity: 0.78, interactive: false, className: 'cyclone-wind-raster' }
    ).addTo(map);
    return () => {
      if (windRasterLayerRef.current) {
        map.removeLayer(windRasterLayerRef.current);
        windRasterLayerRef.current = null;
      }
    };
  }, [isCycloneMode, cycloneTrack, currentActiveStorm]);

  // 7. Smooth Fly to Selected Region
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const selected = hazardRegions.find((r) => r.id === selectedRegionId);
    if (selected && selected.polygon && Array.isArray(selected.polygon) && selected.polygon.length >= 3) {
      try {
        const bounds = L.latLngBounds(selected.polygon);
        map.flyToBounds(bounds, { padding: [40, 40], maxZoom: 6, duration: 1.2 });
      } catch {
        // Fall back gracefully
      }
    }
  }, [selectedRegionId, hazardRegions]);

  // 8. High-Performance Animated Wind Flows Canvas Simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    const map = mapInstanceRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = map.getSize().x);
    let height = (canvas.height = map.getSize().y);

    const handleResize = () => {
      if (!map) return;
      width = canvas.width = map.getSize().x;
      height = canvas.height = map.getSize().y;
    };

    map.on('resize', handleResize);
    map.on('move', () => {
      // Clear canvas on fast pan to prevent smeared trails
      ctx.clearRect(0, 0, width, height);
    });

    if (!showWindFlows) {
      ctx.clearRect(0, 0, width, height);
      return () => {
        map.off('resize', handleResize);
      };
    }

    // Particle Swarm initialization
    const PARTICLE_COUNT = 700;
    const particles: WindParticle[] = [];

    const seedParticle = (p?: WindParticle): WindParticle => {
      const part = p || { x: 0, y: 0, age: 0, maxLife: 0 };
      // 50% spawned around active cyclone eyes for dense spiral visualization
      if (Math.random() < 0.55 && activeVortices.length > 0) {
        const vortex = activeVortices[Math.floor(Math.random() * activeVortices.length)];
        const pt = map.latLngToContainerPoint([vortex.lat, vortex.lon]);
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 220 + 20; // 20px to 240px radius from eye
        part.x = pt.x + Math.cos(angle) * dist;
        part.y = pt.y + Math.sin(angle) * dist;
      } else {
        // Spawn randomly across visible screen
        part.x = Math.random() * width;
        part.y = Math.random() * height;
      }
      part.age = 0;
      part.maxLife = Math.floor(Math.random() * 60 + 40);
      return part;
    };

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = seedParticle();
      p.age = Math.floor(Math.random() * p.maxLife); // stagger ages
      particles.push(p);
    }

    const speedScale = flowSpeedMode === 'fast' ? 0.075 : 0.045;

    let running = true;
    const render = () => {
      if (!running) return;

      // Silky smooth destination-out fade so underlying map tiles stay clear
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.085)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Bounds and life check
        if (p.x < 0 || p.x > width || p.y < 0 || p.y > height || p.age >= p.maxLife) {
          seedParticle(p);
          continue;
        }

        // Convert screen pixel to LatLng
        const latlng = map.containerPointToLatLng(L.point(p.x, p.y));

        // Compute local wind field
        const w = computeWindVector(latlng.lat, latlng.lng, activeVortices);

        // Advance particle along vector field:
        // East (u) moves x right (+), North (v) moves y up (-)
        const dx = w.u * speedScale * 14;
        const dy = -w.v * speedScale * 14;

        const nextX = p.x + dx;
        const nextY = p.y + dy;

        // Dynamic streamline color based on wind speed (knots)
        let strokeColor = '#38bdf8'; // <34 kt cyan
        let lineWidth = 1.2;

        if (w.speed >= 100) {
          strokeColor = '#e879f9'; // SuCS neon magenta
          lineWidth = 2.4;
        } else if (w.speed >= 64) {
          strokeColor = '#f43f5e'; // Hurricane / VSCS rose
          lineWidth = 2.1;
        } else if (w.speed >= 48) {
          strokeColor = '#fb923c'; // Severe storm orange
          lineWidth = 1.8;
        } else if (w.speed >= 34) {
          strokeColor = '#facc15'; // Gale force amber
          lineWidth = 1.5;
        } else if (w.speed >= 22) {
          strokeColor = '#2dd4bf'; // Fresh breeze teal
          lineWidth = 1.3;
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';

        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(nextX, nextY);
        ctx.stroke();

        p.x = nextX;
        p.y = nextY;
        p.age++;
      }

      animFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      running = false;
      map.off('resize', handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [showWindFlows, flowSpeedMode, activeVortices]);

  const handleResetZoom = () => {
    if (mapInstanceRef.current) {
      if (isCycloneMode && cycloneTrack.length > 0) {
        const bounds = L.latLngBounds(cycloneTrack.map((pt) => [pt.lat, pt.lon]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
      } else {
        mapInstanceRef.current.flyTo([15.0, 78.0], 5, { duration: 1 });
      }
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut();
    }
  };

  return (
    <div className="real-hazard-map-wrapper">
      {/* Top Map Control Bar */}
      <div className="real-map-topbar">
        {/* Basemap Switcher */}
        <div className="basemap-selector-pill">
          <Layers size={13} className="text-cyan" />
          <button
            type="button"
            className={`map-tab-btn ${activeBasemap === 'dark' ? 'active' : ''}`}
            onClick={() => setActiveBasemap('dark')}
          >
            Dark Maritime
          </button>
          <button
            type="button"
            className={`map-tab-btn ${activeBasemap === 'ocean' ? 'active' : ''}`}
            onClick={() => setActiveBasemap('ocean')}
          >
            Bathymetry
          </button>
          <button
            type="button"
            className={`map-tab-btn ${activeBasemap === 'satellite' ? 'active' : ''}`}
            onClick={() => setActiveBasemap('satellite')}
          >
            Satellite
          </button>
        </div>

        {/* Hazard interpretation and operational layers */}
        <div className="heatmap-toggle-group">
          <span className="map-data-label"><Radar size={13} /> Cyclone hazard layers</span>

          {/* 2. Wind Radii (R34, R50, R64 Isotachs) */}
          {isCycloneMode && (
            <button
              type="button"
              className={`map-feature-pill-btn ${showWindRadii ? 'active-amber' : ''}`}
              onClick={() => setShowWindRadii(!showWindRadii)}
              title="Toggle R34 (gale), R50 (storm), and R64 (hurricane) danger wind radii"
            >
              <Disc3 size={13} className={showWindRadii ? 'text-amber-400' : 'text-slate-400'} />
              <span>Wind Radii</span>
            </button>
          )}

          {/* 3. Cyclone Track Toggle */}
          {isCycloneMode && (
            <label className="heatmap-checkbox-label">
              <input
                type="checkbox"
                checked={showCycloneTrack}
                onChange={(e) => setShowCycloneTrack(e.target.checked)}
              />
              <span className="text-rose">🌀</span>
              <span>Regional Tracks</span>
            </label>
          )}

          {/* 4. Shipping Corridors Toggle */}
          <label className="heatmap-checkbox-label">
            <input
              type="checkbox"
              checked={showShippingLanes}
              onChange={(e) => setShowShippingLanes(e.target.checked)}
            />
            <Navigation size={13} className="text-cyan" />
            <span>Shipping Corridors</span>
          </label>
        </div>
      </div>

      {/* Leaflet Map DOM Mount */}
      <div className="leaflet-map-mount" ref={mapContainerRef} />

      {/* Floating Map Zoom Controls */}
      <div className="map-floating-controls">
        <button
          type="button"
          className="map-float-btn"
          onClick={handleZoomIn}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>
        <button
          type="button"
          className="map-float-btn"
          onClick={handleZoomOut}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>
        <button
          type="button"
          className="map-float-btn"
          onClick={handleResetZoom}
          title="Reset Extent to Indian Ocean Basin"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* Bottom Floating Bar: Live Coordinates, Live Wind Readout & Tile Attribution */}
      <div className="map-bottom-meta-bar">
        <div className="meta-coords">
          {cursorCoords ? (
            <span className="flex items-center gap-2">
              <span>
                {Math.abs(cursorCoords.lat).toFixed(2)}° {cursorCoords.lat >= 0 ? 'N' : 'S'} ·{' '}
                {Math.abs(cursorCoords.lng).toFixed(2)}° {cursorCoords.lng >= 0 ? 'E' : 'W'}
              </span>
              {cursorWind && (
                <span className="text-teal-400 font-semibold border-l border-slate-700 pl-2">
                  💨 Wind: {cursorWind.speed} kt ({cursorWind.dir}°)
                </span>
              )}
            </span>
          ) : (
            <span>Indian Ocean Basin · Bay of Bengal & Arabian Sea</span>
          )}
        </div>

        <div className="meta-tilesource">
          <span>
            {isCycloneMode
              ? `NOAA IBTrACS v04 · IMD Marine Advisories · Threshold > ${threshold} kt`
              : 'Tiles: ' + BASEMAP_TILES[activeBasemap].name + ' · CMEMS GLORYS12'}
          </span>
        </div>
      </div>

      {/* Vertical Scientific Colorbar & Wind Velocity Scale */}
      <div className="real-map-colorbar">
        <span className="colorbar-title">
          {isCycloneMode ? 'Wind Speed (kt)' : 'Current Velocity'}
        </span>
        <span className="colorbar-unit">
          {isCycloneMode ? 'Knots / Saffir-Simpson' : 'm/s (Knots)'}
        </span>
        <div className="colorbar-vertical-scale">
          <div className="scale-labels">
            {isCycloneMode ? (
              <>
                <span className="text-pink-400">≥ 100 kt (SuCS)</span>
                <span className="text-rose-400">64 kt (Hurricane)</span>
                <span className="text-amber-400">48 kt (Storm)</span>
                <span className="text-yellow-300">34 kt (Gale)</span>
                <span className="text-cyan-400">&lt; 25 kt (Trade)</span>
              </>
            ) : (
              <>
                <span>≥ 2.0 (Critical)</span>
                <span>1.5 (High)</span>
                <span>1.0 (Moderate)</span>
                <span>0.5 (Calm)</span>
              </>
            )}
          </div>
          <div
            className={`scale-bar-gradient ${
              isCycloneMode ? 'cyclone-gradient' : 'hazard-gradient'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
