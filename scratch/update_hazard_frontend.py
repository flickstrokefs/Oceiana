import re
from pathlib import Path

REAL_HAZARD_MAP_PATH = Path(r"c:\Saumya_workspace\team ariel\Oceiana\frontend\src\components\Views\RealHazardMap.tsx")
HAZARD_VIEW_PATH = Path(r"c:\Saumya_workspace\team ariel\Oceiana\frontend\src\components\Views\HazardAssessmentView.tsx")

# --- 1. RealHazardMap.tsx ---
real_hazard_map_code = '''import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, RotateCcw, ZoomIn, ZoomOut, Navigation, Wind } from 'lucide-react';

export interface HazardRegionData {
  id: string;
  name: string;
  area: string;
  area_km2: number;
  maxValue: string;
  max_value_raw: number;
  risk_level: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'ADVISORY' | 'NORMAL';
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

interface RealHazardMapProps {
  hazardRegions: HazardRegionData[];
  selectedRegionId: string;
  onSelectRegion: (id: string) => void;
  cycloneTrack?: CycloneTrackPoint[];
  isCycloneMode?: boolean;
  stormName?: string;
  threshold?: string;
}

// Tile Layer configurations for authentic GIS basemaps
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

// Major International Shipping Corridors (SLOCs) across the Indian Ocean
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

export const RealHazardMap: React.FC<RealHazardMapProps> = ({
  hazardRegions,
  selectedRegionId,
  onSelectRegion,
  cycloneTrack = [],
  isCycloneMode = false,
  stormName = 'AMPHAN',
  threshold = '64',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayersRef = useRef<Record<string, L.Polygon>>({});
  const markerLayersRef = useRef<L.Layer[]>([]);
  const cycloneLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeBasemap, setActiveBasemap] = useState<'dark' | 'ocean' | 'satellite'>('dark');
  const [showShippingLanes, setShowShippingLanes] = useState(true);
  const [showCycloneTrack, setShowCycloneTrack] = useState(true);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on Bay of Bengal / Indian Ocean
    const map = L.map(mapContainerRef.current, {
      center: [14.0, 86.0],
      zoom: 5,
      minZoom: 2,
      maxZoom: 11,
      zoomControl: false,
      attributionControl: false,
    });
    mapInstanceRef.current = map;

    // Basemap tile layer
    const cfg = BASEMAP_TILES[activeBasemap];
    const tile = L.tileLayer(cfg.url, {
      subdomains: cfg.subdomains,
      maxZoom: cfg.maxZoom,
    }).addTo(map);
    tileLayerRef.current = tile;

    // Cursor coordinates
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorCoords({
        lat: parseFloat(e.latlng.lat.toFixed(2)),
        lng: parseFloat(e.latlng.lng.toFixed(2)),
      });
    });
    map.on('mouseout', () => setCursorCoords(null));

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Switch Basemaps
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

  // 3. Render Maritime Hazard Zones & Crisp Nautical Polygons
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old polygons
    Object.values(polygonLayersRef.current).forEach((l) => map.removeLayer(l));
    polygonLayersRef.current = {};

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
          weight: isSelected ? 3.5 : 2.0,
          dashArray: isSelected ? undefined : '6, 6',
          fillColor: strokeColor,
          fillOpacity: isSelected ? 0.32 : 0.12,
        }).addTo(map);

        // Crisp Nautical Center Badge
        const centerLat = (r.bounds.south + r.bounds.north) / 2;
        const centerLon = (r.bounds.west + r.bounds.east) / 2;

        const badgeHtml = `
          <div class="nautical-sector-badge ${r.risk_level.toLowerCase()} ${isSelected ? 'badge-selected' : ''}">
            <div class="badge-head">
              <span class="badge-pulse"></span>
              <strong>${r.name}</strong>
            </div>
            <div class="badge-stats">
              <span class="badge-val">${r.maxValue} ${valUnit}</span>
              <span class="badge-risk">${r.risk_level}</span>
            </div>
          </div>
        `;

        const badgeIcon = L.divIcon({
          className: 'nautical-badge-wrapper',
          html: badgeHtml,
          iconSize: [160, 42],
          iconAnchor: [80, 21],
        });

        const badgeMarker = L.marker([centerLat, centerLon], { icon: badgeIcon }).addTo(map);

        badgeMarker.on('click', () => onSelectRegion(r.id));
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
        polygonLayersRef.current[`${r.id}-badge`] = badgeMarker as unknown as L.Polygon;
      } catch (err) {
        console.warn('Error creating polygon for', r.name, err);
      }
    });
  }, [hazardRegions, selectedRegionId, onSelectRegion, isCycloneMode]);

  // 4. Render Authentic Cyclone Track from NOAA IBTrACS
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (cycloneLayerGroupRef.current) {
      map.removeLayer(cycloneLayerGroupRef.current);
      cycloneLayerGroupRef.current = null;
    }

    if (!isCycloneMode || !showCycloneTrack || !cycloneTrack || cycloneTrack.length === 0) return;

    const layerGroup = L.layerGroup().addTo(map);
    cycloneLayerGroupRef.current = layerGroup;

    const latlngs: [number, number][] = cycloneTrack.map((pt) => [pt.lat, pt.lon]);

    // Outer glow / hazard buffer along the cyclone swath
    L.polyline(latlngs, {
      color: '#f43f5e',
      weight: 14,
      opacity: 0.20,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(layerGroup);

    // Main storm track trajectory
    L.polyline(latlngs, {
      color: '#fb7185',
      weight: 3.5,
      opacity: 0.95,
      dashArray: '8, 4',
    }).addTo(layerGroup);

    // Waypoints along track
    cycloneTrack.forEach((pt, idx) => {
      let color = '#06b6d4'; // cyan Depression
      let radius = 5;

      if (pt.wind_kt >= 120) {
        color = '#ec4899'; // magenta SuCS
        radius = 9;
      } else if (pt.wind_kt >= 90) {
        color = '#ef4444'; // red ESCS
        radius = 8;
      } else if (pt.wind_kt >= 64) {
        color = '#f97316'; // orange VSCS
        radius = 7;
      } else if (pt.wind_kt >= 48) {
        color = '#f59e0b'; // amber SCS
        radius = 6;
      } else if (pt.wind_kt >= 34) {
        color = '#38bdf8'; // blue CS
        radius = 5.5;
      }

      const marker = L.circleMarker([pt.lat, pt.lon], {
        radius,
        fillColor: color,
        color: '#ffffff',
        weight: 1.5,
        fillOpacity: 0.95,
      }).addTo(layerGroup);

      const tooltipContent = `
        <div style="font-family: system-ui, sans-serif; font-size: 11px; line-height: 1.4; min-width: 175px;">
          <div style="font-weight: 700; color: ${color}; font-size: 12px; margin-bottom: 3px;">
            🌀 ${stormName} #${idx + 1}
          </div>
          <div><strong>Category:</strong> ${pt.category}</div>
          <div><strong>Sustained Wind:</strong> ${pt.wind_kt} kt (${pt.wind_kmh} km/h)</div>
          <div><strong>Central Pressure:</strong> ${pt.pressure_hpa} hPa</div>
          <div style="color: #94a3b8; font-size: 10px; margin-top: 3px;">${pt.time}</div>
        </div>
      `;

      marker.bindTooltip(tooltipContent, {
        sticky: true,
        className: 'leaflet-hazard-tooltip',
      });
    });

    // Highlight peak intensity point with animated pulse
    const peakPt = [...cycloneTrack].sort((a, b) => b.wind_kt - a.wind_kt)[0];
    if (peakPt) {
      const eyeIcon = L.divIcon({
        className: 'cyclone-eye-icon',
        html: `
          <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(236, 72, 153, 0.45); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; width: 14px; height: 14px; border-radius: 50%; background: #ec4899; border: 2px solid #ffffff; box-shadow: 0 0 12px #ec4899;"></div>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });
      const eyeMarker = L.marker([peakPt.lat, peakPt.lon], { icon: eyeIcon }).addTo(layerGroup);
      eyeMarker.bindTooltip(
        `<div style="font-size: 12px; font-weight: 700; color: #ec4899; font-family: system-ui, sans-serif;">
          🌀 PEAK INTENSITY: Cyclone ${stormName}<br/>
          <span style="font-size: 11px; font-weight: 500; color: #e2e8f0;">
            ${peakPt.wind_kt} kt (${peakPt.wind_kmh} km/h) · ${peakPt.pressure_hpa} hPa
          </span>
        </div>`,
        { sticky: true, className: 'leaflet-hazard-tooltip' }
      );
    }

    // Auto-fit bounds to cyclone track
    if (latlngs.length > 0) {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
    }
  }, [isCycloneMode, showCycloneTrack, cycloneTrack, stormName]);

  // 5. Render Shipping Corridors
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    markerLayersRef.current.forEach((l) => map.removeLayer(l));
    markerLayersRef.current = [];

    if (showShippingLanes) {
      SHIPPING_CORRIDORS.forEach((lane) => {
        const line = L.polyline(lane.path, {
          color: '#38bdf8',
          weight: 2.2,
          dashArray: '8, 8',
          opacity: 0.85,
        }).addTo(map);

        line.bindTooltip(
          `<div style="font-size: 11px; font-weight: 600; color: #38bdf8;">🚢 ${lane.name}</div>`,
          { sticky: true, className: 'leaflet-hazard-tooltip' }
        );

        markerLayersRef.current.push(line);
      });
    }
  }, [showShippingLanes]);

  // 6. Smooth Fly to Selected Region
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

  const handleResetZoom = () => {
    if (mapInstanceRef.current) {
      if (isCycloneMode && cycloneTrack.length > 0) {
        const bounds = L.latLngBounds(cycloneTrack.map((pt) => [pt.lat, pt.lon]));
        mapInstanceRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 6 });
      } else {
        mapInstanceRef.current.flyTo([14.0, 84.0], 5, { duration: 1 });
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

        {/* Real Maritime Layer Toggles */}
        <div className="heatmap-toggle-group">
          {isCycloneMode && (
            <label className="heatmap-checkbox-label">
              <input
                type="checkbox"
                checked={showCycloneTrack}
                onChange={(e) => setShowCycloneTrack(e.target.checked)}
              />
              <Wind size={13} className="text-rose" />
              <span>Cyclone Track ({stormName})</span>
            </label>
          )}

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

      {/* Leaflet DOM Mount */}
      <div className="leaflet-map-mount" ref={mapContainerRef} />

      {/* Floating Map Action Buttons */}
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

      {/* Bottom Floating Bar: Live Coordinates & Attribution */}
      <div className="map-bottom-meta-bar">
        <div className="meta-coords">
          {cursorCoords ? (
            <span>
              {Math.abs(cursorCoords.lat).toFixed(2)}° {cursorCoords.lat >= 0 ? 'N' : 'S'} ·{' '}
              {Math.abs(cursorCoords.lng).toFixed(2)}° {cursorCoords.lng >= 0 ? 'E' : 'W'}
            </span>
          ) : (
            <span>Indian Ocean Basin · WGS84 Georeferenced</span>
          )}
        </div>

        <div className="meta-tilesource">
          <span>
            {isCycloneMode
              ? 'NOAA NCEI IBTrACS v04 (WMO Best Track) · Real Observations'
              : 'Tiles: ' + BASEMAP_TILES[activeBasemap].name + ' · CMEMS GLORYS12'}
          </span>
        </div>
      </div>

      {/* Vertical Scientific Colorbar & Streamline Velocity Legend */}
      <div className="real-map-colorbar">
        <span className="colorbar-title">
          {isCycloneMode ? 'Cyclone Wind Speed' : 'Current Velocity'}
        </span>
        <span className="colorbar-unit">
          {isCycloneMode ? 'Knots (kt)' : 'm/s (Knots)'}
        </span>
        <div className="colorbar-vertical-scale">
          <div className="scale-labels">
            {isCycloneMode ? (
              <>
                <span>≥ 120 kt (SuCS)</span>
                <span>90 kt (ESCS)</span>
                <span>64 kt (VSCS)</span>
                <span>34 kt (Gale)</span>
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
'''

REAL_HAZARD_MAP_PATH.write_text(real_hazard_map_code, encoding="utf-8")
print(f"Updated {REAL_HAZARD_MAP_PATH}")
