import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, RotateCcw, ZoomIn, ZoomOut, Wind, Navigation, ShieldAlert, Compass } from 'lucide-react';

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

interface RealHazardMapProps {
  hazardRegions: HazardRegionData[];
  selectedRegionId: string;
  onSelectRegion: (id: string) => void;
  threshold: number;
  variable: string;
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

// Operational Oceanographic Assets deployed in the field
const OPERATIONAL_ASSETS = [
  { id: 'glider-01', name: 'Glider AR-04', lat: 19.5, lon: 64.2, drift: '2.1 m/s', heading: 68 },
  { id: 'argo-01', name: 'ARGO #290215', lat: 14.8, lon: 86.5, drift: '1.7 m/s', heading: 240 },
  { id: 'buoy-01', name: 'RAMA Mooring 08', lat: 0.1, lon: 80.5, drift: '1.9 m/s', heading: 90 },
  { id: 'vessel-01', name: 'R/V Sagar Kanya', lat: 10.2, lon: 74.0, drift: '1.5 m/s', heading: 175 },
];

/**
 * Physical vector field calculation for Indian Ocean Currents.
 * Calculates eastward (u) and northward (v) velocity components in m/s.
 */
function getOceanCurrentVector(lat: number, lon: number): { u: number; v: number; speed: number } {
  let u = 0.2;
  let v = -0.05;

  // 1. Somali Current & Arabian Sea Jet (50°E-74°E, 5°N-25°N)
  if (lat >= 5 && lat <= 25 && lon >= 50 && lon <= 74) {
    const dOman = Math.hypot(lat - 19.0, lon - 62.0);
    const somaliFactor = Math.exp(-dOman / 6.0);
    u += 1.8 * somaliFactor + Math.sin(lat * 0.4) * 0.3;
    v += 1.4 * somaliFactor + Math.cos(lon * 0.3) * 0.2;
  }

  // 2. Central Bay of Bengal Cyclonic Circulation (80°E-96°E, 7°N-22°N)
  if (lat >= 7 && lat <= 22 && lon >= 80 && lon <= 96) {
    const centerLat = 15.0;
    const centerLon = 88.0;
    const dy = lat - centerLat;
    const dx = lon - centerLon;
    const dist = Math.hypot(dy, dx);
    const eddyFactor = Math.exp(-dist / 5.5);
    // Counter-clockwise swirl
    u += -dy * 0.22 * eddyFactor;
    v += dx * 0.22 * eddyFactor;
  }

  // 3. Equatorial Wyrtki Jet (55°E-95°E, 4°S-4°N)
  if (lat >= -5 && lat <= 5 && lon >= 55 && lon <= 95) {
    const eqFactor = Math.exp(-Math.pow(lat / 2.2, 2));
    u += 1.85 * eqFactor;
    v += 0.15 * Math.sin(lon * 0.2);
  }

  // 4. Southern Ocean Antarctic Circumpolar Current (40°E-110°E, 65°S-48°S)
  if (lat <= -48 && lat >= -64) {
    const accFactor = Math.exp(-Math.pow((lat + 56.0) / 4.0, 2));
    u += 2.5 * accFactor;
    v += 0.2 * Math.sin(lon * 0.1);
  }

  const speed = Math.hypot(u, v);
  return { u, v, speed };
}

export const RealHazardMap: React.FC<RealHazardMapProps> = ({
  hazardRegions,
  selectedRegionId,
  onSelectRegion,
  threshold,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayersRef = useRef<Record<string, L.Polygon>>({});
  const markerLayersRef = useRef<L.Layer[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [activeBasemap, setActiveBasemap] = useState<'dark' | 'ocean' | 'satellite'>('dark');
  const [showStreamlines, setShowStreamlines] = useState(true);
  const [showShippingLanes, setShowShippingLanes] = useState(true);
  const [showAssets, setShowAssets] = useState(true);
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lng: number } | null>(null);

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Center on Indian Ocean Basin
    const map = L.map(mapContainerRef.current, {
      center: [12.0, 77.0],
      zoom: 4,
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

    // Canvas overlay for particle streamline flow
    const canvas = document.createElement('canvas');
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '300';
    canvasRef.current = canvas;

    const overlayPane = map.getPanes().overlayPane;
    overlayPane.appendChild(canvas);

    const resizeCanvas = () => {
      if (!canvas || !map) return;
      try {
        const size = map.getSize();
        if (size.x === 0 || size.y === 0) return;
        canvas.width = size.x;
        canvas.height = size.y;
        const topLeft = map.containerPointToLayerPoint([0, 0]);
        L.DomUtil.setPosition(canvas, topLeft);
      } catch {
        // Handled: Map pane layout pending
      }
    };

    map.on('move', resizeCanvas);
    map.on('zoom', resizeCanvas);
    map.on('resize', resizeCanvas);
    map.whenReady(() => resizeCanvas());

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
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

  // 3. Dynamic Vector Particle Streamline Animation (Windy-style)
  useEffect(() => {
    const canvas = canvasRef.current;
    const map = mapInstanceRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Cancel previous loop if running
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    if (!showStreamlines) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    interface Particle {
      lat: number;
      lon: number;
      age: number;
      maxAge: number;
    }

    const PARTICLE_COUNT = 320;
    const particles: Particle[] = [];

    const initParticle = (): Particle => {
      const bounds = map.getBounds();
      const minLat = Math.max(-65, bounds.getSouth());
      const maxLat = Math.min(30, bounds.getNorth());
      const minLon = bounds.getWest();
      const maxLon = bounds.getEast();

      return {
        lat: minLat + Math.random() * (maxLat - minLat),
        lon: minLon + Math.random() * (maxLon - minLon),
        age: Math.floor(Math.random() * 40),
        maxAge: 45 + Math.floor(Math.random() * 40),
      };
    };

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(initParticle());
    }

    let isRunning = true;

    const handleMapMovement = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    map.on('movestart', handleMapMovement);
    map.on('zoomstart', handleMapMovement);

    const renderStreamlines = () => {
      if (!isRunning) return;

      // Soft trail fade: use destination-out to erase previous trail pixels WITHOUT darkening the map
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.085)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age++;

        // Get velocity vector at current lat/lon
        const vec = getOceanCurrentVector(p.lat, p.lon);
        const p0 = map.latLngToContainerPoint([p.lat, p.lon]);

        // Step particle forward along flow lines
        const step = 0.08;
        p.lon += vec.u * step;
        p.lat += vec.v * step;

        const p1 = map.latLngToContainerPoint([p.lat, p.lon]);

        // Check if out of bounds or expired
        if (
          p.age >= p.maxAge ||
          p1.x < -20 ||
          p1.x > canvas.width + 20 ||
          p1.y < -20 ||
          p1.y > canvas.height + 20
        ) {
          particles[i] = initParticle();
          continue;
        }

        // Color & line weight by speed
        let strokeColor = 'rgba(6, 182, 212, 0.75)'; // Cyan (<1.0 m/s)
        let lineWidth = 1.3;

        if (vec.speed >= 2.0) {
          strokeColor = 'rgba(239, 68, 68, 0.95)'; // Red Critical (>= 2.0 m/s)
          lineWidth = 2.4;
        } else if (vec.speed >= 1.5) {
          strokeColor = 'rgba(249, 115, 22, 0.9)'; // Orange High (>= 1.5 m/s)
          lineWidth = 2.0;
        } else if (vec.speed >= 1.0) {
          strokeColor = 'rgba(16, 185, 129, 0.8)'; // Emerald (1.0 - 1.5 m/s)
          lineWidth = 1.6;
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }

      animationFrameRef.current = requestAnimationFrame(renderStreamlines);
    };

    renderStreamlines();

    return () => {
      isRunning = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      map.off('movestart', handleMapMovement);
      map.off('zoomstart', handleMapMovement);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [showStreamlines, activeBasemap]);

  // 4. Render Maritime Hazard Zones & Crisp Nautical Polygons (No more blurry blobs)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old polygons
    Object.values(polygonLayersRef.current).forEach((l) => map.removeLayer(l));
    polygonLayersRef.current = {};

    hazardRegions.forEach((r) => {
      if (!r || !r.polygon || !Array.isArray(r.polygon) || r.polygon.length < 3) return;

      const isSelected = r.id === selectedRegionId;
      const strokeColor =
        r.risk_level === 'CRITICAL'
          ? '#ef4444'
          : r.risk_level === 'HIGH'
          ? '#f97316'
          : '#eab308';

      try {
        const poly = L.polygon(r.polygon, {
          color: strokeColor,
          weight: isSelected ? 3.5 : 2.0,
          dashArray: isSelected ? undefined : '6, 6',
          fillColor: strokeColor,
          fillOpacity: isSelected ? 0.28 : 0.12,
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
              <span class="badge-val">${r.maxValue} m/s</span>
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

        polygonLayersRef.current[r.id] = poly;
        polygonLayersRef.current[`${r.id}-badge`] = badgeMarker as unknown as L.Polygon;
      } catch (err) {
        console.warn('Error creating polygon for', r.name, err);
      }
    });
  }, [hazardRegions, selectedRegionId, onSelectRegion]);

  // 5. Render Shipping Corridors & Operational Assets
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clean previous markers & polylines
    markerLayersRef.current.forEach((l) => map.removeLayer(l));
    markerLayersRef.current = [];

    // Draw International Shipping Corridors
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

    // Draw Ocean Fleet & Operational Assets (Gliders, Floats, Ships)
    if (showAssets) {
      OPERATIONAL_ASSETS.forEach((asset) => {
        const assetHtml = `
          <div class="fleet-asset-marker" title="${asset.name} · Drift ${asset.drift}">
            <span class="asset-symbol">⚓</span>
            <span class="asset-tag">${asset.name}</span>
          </div>
        `;
        const icon = L.divIcon({
          className: 'fleet-icon-wrapper',
          html: assetHtml,
          iconSize: [90, 24],
          iconAnchor: [45, 12],
        });

        const marker = L.marker([asset.lat, asset.lon], { icon }).addTo(map);
        marker.bindTooltip(
          `<div style="font-size: 11px; padding: 2px 4px;">
            <strong style="color: #38bdf8;">${asset.name}</strong><br/>
            <span>Velocity: ${asset.drift} · Heading: ${asset.heading}°</span>
          </div>`,
          { sticky: true, className: 'leaflet-hazard-tooltip' }
        );

        markerLayersRef.current.push(marker);
      });
    }
  }, [showShippingLanes, showAssets]);

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
      mapInstanceRef.current.flyTo([12.0, 77.0], 4, { duration: 1 });
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
          <label className="heatmap-checkbox-label">
            <input
              type="checkbox"
              checked={showStreamlines}
              onChange={(e) => setShowStreamlines(e.target.checked)}
            />
            <Wind size={13} className="text-teal" />
            <span>Current Streamlines</span>
          </label>

          <label className="heatmap-checkbox-label">
            <input
              type="checkbox"
              checked={showShippingLanes}
              onChange={(e) => setShowShippingLanes(e.target.checked)}
            />
            <Navigation size={13} className="text-cyan" />
            <span>Shipping Corridors</span>
          </label>

          <label className="heatmap-checkbox-label">
            <input
              type="checkbox"
              checked={showAssets}
              onChange={(e) => setShowAssets(e.target.checked)}
            />
            <Compass size={13} className="text-amber" />
            <span>Fleet & Gliders</span>
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
          <span>Tiles: {BASEMAP_TILES[activeBasemap].name} · Data: INCOIS-HCOM</span>
        </div>
      </div>

      {/* Vertical Scientific Colorbar & Streamline Velocity Legend */}
      <div className="real-map-colorbar">
        <span className="colorbar-title">Current Velocity</span>
        <span className="colorbar-unit">m/s (Knots)</span>
        <div className="colorbar-vertical-scale">
          <div className="scale-labels">
            <span>≥ 2.0 (Critical)</span>
            <span>1.5 (High)</span>
            <span>1.0 (Moderate)</span>
            <span>0.5 (Calm)</span>
          </div>
          <div className="scale-bar-gradient hazard-gradient" />
        </div>
      </div>
    </div>
  );
};
