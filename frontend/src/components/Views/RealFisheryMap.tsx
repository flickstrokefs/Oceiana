import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Layers,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Anchor,
  ShieldAlert,
  Waves,
  Sliders,
  Globe2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';

export interface FisheryZoneData {
  id: string;
  name: string;
  region: string;
  rating: 'FAVOURABLE' | 'GOOD' | 'MODERATE';
  status: string;
  chlorophyll_mean: number; // mg/m³
  sst_mean: number; // °C
  salinity_mean: number; // PSU
  primary_species: string[];
  depth_strata: {
    min_depth: number;
    max_depth: number;
    optimal_catch_depth: number;
    stratum_name: string;
  };
  gear_recommendations: string[];
  bounds: { west: number; east: number; south: number; north: number };
  polygon: [number, number][]; // [lat, lon]
  center: [number, number];
  scientific_rationale: string;
}

export interface DepthStratumPreset {
  id: string;
  depth: number;
  label: string;
  stratum_name: string;
  depth_range: string;
  target_species: string[];
  temp_c: number;
  salinity_psu: number;
  dissolved_o2_ml_l: number;
  light_level: 'Euphotic (100% PAR)' | 'Disphotic Twilight (<1% PAR)' | 'Aphotic (Total Darkness)';
  recommended_gear: string;
  biological_role: string;
  acoustic_dsl: boolean; // Deep Scattering Layer reflection
}

interface RealFisheryMapProps {
  fisheryZones: FisheryZoneData[];
  selectedZoneId: string;
  onSelectZone: (id: string) => void;
  variable?: string;
  activeRegion?: string;
  initialDepth?: number;
}

// 1. Authentic Tile Layer Configurations for Oceanographic Basemaps
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
    attribution: '&copy; Esri, GEBCO, NOAA Bathymetric Grid',
    subdomains: [],
    maxZoom: 13,
  },
  satellite: {
    name: 'Esri World Satellite',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Maxar Earth Observation',
    subdomains: [],
    maxZoom: 18,
  },
};

// 2. 3D Depth Strata Presets Specially Designed for Marine Fisheries
export const DEPTH_STRATA_PRESETS: DepthStratumPreset[] = [
  {
    id: 'stratum-epipelagic',
    depth: 30,
    label: 'Surface (30m)',
    stratum_name: 'Epipelagic / Mixed Layer (MLD)',
    depth_range: '0 – 50 m',
    target_species: ['Indian Oil Sardine', 'Indian Mackerel', 'Anchovy', 'Ribbonfish'],
    temp_c: 28.4,
    salinity_psu: 33.2,
    dissolved_o2_ml_l: 4.8,
    light_level: 'Euphotic (100% PAR)',
    recommended_gear: 'Surface Ring Seines & Drift Gillnets (0–35m)',
    biological_role: 'Phytoplankton bloom euphotic zone; primary herbivorous fish feeding habitat.',
    acoustic_dsl: false,
  },
  {
    id: 'stratum-thermocline',
    depth: 95,
    label: 'Thermocline (95m)',
    stratum_name: 'Thermocline Core / Oxycline Aggregation Band',
    depth_range: '50 – 150 m',
    target_species: ['Yellowfin Tuna', 'Skipjack Tuna', 'Swordfish', 'Sailfish', 'Wahoo'],
    temp_c: 22.8,
    salinity_psu: 34.6,
    dissolved_o2_ml_l: 2.1,
    light_level: 'Euphotic (100% PAR)',
    recommended_gear: 'Pelagic Longlines (hook depths set between 75m and 125m)',
    biological_role: 'Sharp density gradient traps detritus; top oceanic predators concentrate on oxycline ceiling.',
    acoustic_dsl: false,
  },
  {
    id: 'stratum-shelfbreak',
    depth: 200,
    label: 'Shelf Break (200m)',
    stratum_name: '200m Continental Shelf Edge & Upwelling Margin',
    depth_range: '150 – 250 m',
    target_species: ['White Pomfret', 'Indian Salmon (Rawas)', 'King Mackerel', 'Reef Snapper'],
    temp_c: 16.2,
    salinity_psu: 34.9,
    dissolved_o2_ml_l: 1.1,
    light_level: 'Disphotic Twilight (<1% PAR)',
    recommended_gear: 'High-opening bottom trawls & Shelf drop lines',
    biological_role: 'Bathymetric slope breaks internal waves, driving nutrient pumping to upper strata.',
    acoustic_dsl: false,
  },
  {
    id: 'stratum-mesopelagic',
    depth: 320,
    label: 'Twilight DSL (320m)',
    stratum_name: 'Mesopelagic / Deep Scattering Layer (DSL)',
    depth_range: '250 – 450 m',
    target_species: ['Oceanic Purpleback Squid', 'Lanternfish (Myctophids)', 'Hairtail'],
    temp_c: 12.5,
    salinity_psu: 35.1,
    dissolved_o2_ml_l: 0.4,
    light_level: 'Disphotic Twilight (<1% PAR)',
    recommended_gear: 'Nighttime Squid Jigging with underwater LED luminaires & Midwater Trawls',
    biological_role: 'Diel Vertical Migration (DVM) layer; acoustic backscatter biomass rises at dusk.',
    acoustic_dsl: true,
  },
  {
    id: 'stratum-demersal',
    depth: 600,
    label: 'Bathyal (600m)',
    stratum_name: 'Deep Demersal Slope & Submarine Bank Benthos',
    depth_range: '450 – 1000+ m',
    target_species: ['Deep-Sea Scarlet Prawn', 'Arabian Sea Red Shrimp', 'Grouper', 'Indian Halibut'],
    temp_c: 8.4,
    salinity_psu: 35.0,
    dissolved_o2_ml_l: 0.9,
    light_level: 'Aphotic (Total Darkness)',
    recommended_gear: 'Deep-sea crustacean traps & Specialized benthic bottom longlines',
    biological_role: 'Cold deep continental margins; benthic invertebrate scavengers and demersal finfish.',
    acoustic_dsl: false,
  },
];

// 3. Georeferenced Bathymetric Isobaths (Depth Contours in Bay of Bengal & Arabian Sea)
const BATHYMETRIC_ISOBATHS: { depth: number; label: string; color: string; coords: [number, number][] }[] = [
  {
    depth: 50,
    label: '50m Coastal Shelf Isobath',
    color: '#38bdf8',
    coords: [
      [21.6, 88.5],
      [20.5, 87.2],
      [19.2, 85.8],
      [17.8, 83.8],
      [15.8, 81.2],
      [13.5, 80.5],
      [10.5, 80.1],
      [8.5, 78.4],
      [7.2, 77.5],
    ],
  },
  {
    depth: 100,
    label: '100m Mid-Shelf Contour',
    color: '#06b6d4',
    coords: [
      [21.2, 89.2],
      [20.1, 87.8],
      [18.8, 86.2],
      [17.4, 84.1],
      [15.2, 81.5],
      [12.8, 80.8],
      [9.8, 80.4],
      [8.0, 78.6],
    ],
  },
  {
    depth: 200,
    label: '200m Continental Shelf Break (Primary Fishery Boundary)',
    color: '#fbbf24', // Golden contour line for shelf break
    coords: [
      [20.8, 89.8],
      [19.6, 88.3],
      [18.2, 86.6],
      [16.8, 84.5],
      [14.5, 81.9],
      [12.0, 81.1],
      [9.2, 80.7],
      [7.6, 78.8],
      [6.8, 77.8],
    ],
  },
  {
    depth: 500,
    label: '500m Upper Bathyal Slope',
    color: '#818cf8',
    coords: [
      [20.2, 90.5],
      [19.0, 89.0],
      [17.5, 87.2],
      [16.0, 85.2],
      [13.8, 82.5],
      [11.2, 81.8],
      [8.5, 81.2],
      [6.5, 79.2],
    ],
  },
  {
    depth: 1000,
    label: '1,000m Deep Oceanic Basin',
    color: '#6366f1',
    coords: [
      [19.5, 91.2],
      [18.2, 89.8],
      [16.6, 88.0],
      [15.0, 86.0],
      [13.0, 83.2],
      [10.5, 82.5],
      [7.8, 81.8],
      [5.5, 80.2],
    ],
  },
];

// 4. Major Commercial Fishing Harbors & Landing Centers
const FISHING_HARBORS = [
  { id: 'port-paradip', name: 'Paradip Fishery Harbor', lat: 20.26, lon: 86.67, state: 'Odisha', boats: '1,200+ Trawlers', status: 'Active' },
  { id: 'port-vizag', name: 'Visakhapatnam Fishing Port', lat: 17.69, lon: 83.29, state: 'Andhra Pradesh', boats: 'Tuna Longliner Base', status: 'Active' },
  { id: 'port-kasimedu', name: 'Chennai Harbor (Kasimedu)', lat: 13.12, lon: 80.30, state: 'Tamil Nadu', boats: 'Multi-day Fleet Hub', status: 'Active' },
  { id: 'port-tuticorin', name: 'Tuticorin Fishery Port', lat: 8.75, lon: 78.16, state: 'Tamil Nadu', boats: 'Gulf of Mannar Fleet', status: 'Active' },
  { id: 'port-kochi', name: 'Kochi Port (Thoppumpady)', lat: 9.93, lon: 76.26, state: 'Kerala', boats: 'Deep-sea Prawn Hub', status: 'Active' },
  { id: 'port-mangalore', name: 'Mangalore Old Port', lat: 12.86, lon: 74.83, state: 'Karnataka', boats: 'Purse Seine Base', status: 'Active' },
  { id: 'port-veraval', name: 'Veraval Fishery Port', lat: 20.90, lon: 70.37, state: 'Gujarat', boats: 'Largest Landings Hub', status: 'Active' },
];

// 5. Marine Protected / Seasonal Conservation Zones
const CONSERVATION_ZONES = [
  {
    id: 'res-gahirmatha',
    name: 'Gahirmatha Olive Ridley Turtle Sanctuary',
    center: [20.72, 87.05] as [number, number],
    radius_km: 38,
    restriction: 'Seasonal mechanized trawling strictly banned (1 Nov – 31 May) under OMFRA.',
  },
  {
    id: 'res-mannar',
    name: 'Gulf of Mannar Marine Biosphere Reserve',
    center: [9.15, 79.18] as [number, number],
    radius_km: 26,
    restriction: 'Coral reef protection zone; commercial deep trawling restricted.',
  },
  {
    id: 'res-sundarbans',
    name: 'Sundarbans Marine Biosphere Buffer',
    center: [21.65, 88.85] as [number, number],
    radius_km: 32,
    restriction: 'Estuarine tiger reserve aquatic buffer; small artisanal craft only.',
  },
];

// 6. Thermal / Chlorophyll Frontal Convergence Lines (Cayula-Cornillon Gradient)
const PRODUCTIVITY_FRONTS = [
  {
    name: 'North Bay of Bengal Riverine Front',
    path: [
      [21.2, 87.8],
      [20.5, 88.8],
      [19.8, 89.6],
    ] as [number, number][],
    gradient: '0.45 °C/km',
  },
  {
    name: 'Odisha Shelf-Slope Thermal Boundary',
    path: [
      [19.5, 85.5],
      [18.6, 86.2],
      [17.8, 85.8],
    ] as [number, number][],
    gradient: '0.52 °C/km',
  },
  {
    name: 'Andhra Cyclonic Eddy Convergence Front',
    path: [
      [16.8, 83.2],
      [15.5, 83.9],
      [14.2, 82.8],
    ] as [number, number][],
    gradient: '0.38 °C/km',
  },
  {
    name: 'Wadge Bank Thermal Upwelling Convergence',
    path: [
      [7.8, 76.8],
      [7.2, 77.6],
      [7.4, 78.4],
    ] as [number, number][],
    gradient: '0.61 °C/km',
  },
];

export const RealFisheryMap: React.FC<RealFisheryMapProps> = ({
  fisheryZones,
  selectedZoneId,
  onSelectZone,
  variable = 'Chlorophyll (mg/m³)',
  activeRegion = 'Indian Ocean',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const polygonLayersRef = useRef<Record<string, L.Polygon>>({});
  const vectorGroupRef = useRef<L.LayerGroup | null>(null);
  const depthIsobathGroupRef = useRef<L.LayerGroup | null>(null);

  // Basemap & Layer Toggles
  const [activeBasemap, setActiveBasemap] = useState<'dark' | 'ocean' | 'satellite'>('ocean');
  const [showDepthLayer, setShowDepthLayer] = useState<boolean>(true);
  const [selectedDepth, setSelectedDepth] = useState<number>(95); // Default to Thermocline (95m)
  const [showFronts, setShowFronts] = useState<boolean>(true);
  const [showHarbors, setShowHarbors] = useState<boolean>(true);
  const [showConservationZones, setShowConservationZones] = useState<boolean>(true);
  const [cursorMeta, setCursorMeta] = useState<{ lat: number; lng: number; depthEstimate: string } | null>(null);
  const [prismMinimized, setPrismMinimized] = useState<boolean>(false);

  // Active Depth Stratum derived from slider
  const activeStratum = useMemo(() => {
    return (
      DEPTH_STRATA_PRESETS.reduce((prev, curr) => {
        return Math.abs(curr.depth - selectedDepth) < Math.abs(prev.depth - selectedDepth) ? curr : prev;
      }, DEPTH_STRATA_PRESETS[0]) || DEPTH_STRATA_PRESETS[1]
    );
  }, [selectedDepth]);

  // Selected Zone Object
  const selectedZone = useMemo(() => {
    return fisheryZones.find((z) => z.id === selectedZoneId) || fisheryZones[0];
  }, [fisheryZones, selectedZoneId]);

  // Synchronize depth when selectedZoneId changes from table/parent
  useEffect(() => {
    const selected = fisheryZones.find((z) => z.id === selectedZoneId);
    if (selected && selected.depth_strata?.optimal_catch_depth) {
      setSelectedDepth(selected.depth_strata.optimal_catch_depth);
    }
  }, [selectedZoneId, fisheryZones]);

  const handleSelectDepthPreset = (preset: DepthStratumPreset) => {
    setSelectedDepth(preset.depth);
    const matched = fisheryZones.find(
      (z) => preset.depth >= z.depth_strata.min_depth && preset.depth <= z.depth_strata.max_depth
    );
    if (matched) {
      onSelectZone(matched.id);
    }
  };

  const handleSliderChange = (newDepth: number) => {
    setSelectedDepth(newDepth);
    const matched = fisheryZones.find(
      (z) => newDepth >= z.depth_strata.min_depth && newDepth <= z.depth_strata.max_depth
    );
    if (matched && matched.id !== selectedZoneId) {
      onSelectZone(matched.id);
    }
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Centered on Bay of Bengal / North Indian Ocean
    const map = L.map(mapContainerRef.current, {
      center: [14.5, 85.5],
      zoom: 5,
      minZoom: 3,
      maxZoom: 12,
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

    // Cursor coordinates + Realistic Bathymetric Depth Estimation on mousemove
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      const lat = parseFloat(e.latlng.lat.toFixed(2));
      const lng = parseFloat(e.latlng.lng.toFixed(2));

      // Realistic bathymetric depth estimation based on distance from coast in BoB
      let estDepth = 'Deep Oceanic (> 2,500m)';
      if (lat > 20.5 && lng > 87.0 && lng < 91.0) {
        estDepth = 'Delta Shelf (25–60m)';
      } else if (lng < 82.5 && lat > 12.0 && lat < 18.0) {
        estDepth = 'Coromandel Coastal (40–120m)';
      } else if (lng >= 83.0 && lng <= 86.0 && lat >= 14.0 && lat <= 19.0) {
        estDepth = 'Shelf Break Slope (180–800m)';
      } else if (lat < 8.5 && lng > 76.5 && lng < 78.5) {
        estDepth = 'Wadge Bank Shelf (45–110m)';
      }

      setCursorMeta({ lat, lng, depthEstimate: estDepth });
    });
    map.on('mouseout', () => setCursorMeta(null));

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

  // 3. Render Potential Fishing Zones (PFZ) & Nautical Badges
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Remove old polygons
    Object.values(polygonLayersRef.current).forEach((l) => map.removeLayer(l));
    polygonLayersRef.current = {};

    fisheryZones.forEach((z) => {
      if (!z.polygon || z.polygon.length < 3) return;

      const isSelected = z.id === selectedZoneId;
      // Highlighting zones whose depth range matches active 3D depth stratum
      const matchesActiveDepth =
        showDepthLayer &&
        selectedDepth >= z.depth_strata.min_depth &&
        selectedDepth <= z.depth_strata.max_depth;

      const strokeColor =
        z.rating === 'FAVOURABLE'
          ? '#10b981' // emerald
          : z.rating === 'GOOD'
          ? '#06b6d4' // cyan
          : '#f59e0b'; // amber

      try {
        const poly = L.polygon(z.polygon, {
          color: matchesActiveDepth ? '#38bdf8' : strokeColor,
          weight: isSelected ? 3.5 : matchesActiveDepth ? 2.8 : 2.0,
          dashArray: isSelected ? undefined : matchesActiveDepth ? '4, 4' : '6, 6',
          fillColor: matchesActiveDepth ? '#0284c7' : strokeColor,
          fillOpacity: isSelected ? 0.38 : matchesActiveDepth ? 0.28 : 0.14,
        }).addTo(map);

        // Sleek Nautical Center Badge: compact pill by default to avoid overlap; expands on hover / selection / depth match
        const [centerLat, centerLon] = z.center;
        const isExpanded = isSelected || matchesActiveDepth;
        const badgeHtml = `
          <div class="pfz-nautical-badge ${z.rating.toLowerCase()} ${isSelected ? 'badge-selected' : ''} ${
          matchesActiveDepth ? 'depth-stratum-match' : ''
        } ${isExpanded ? 'badge-expanded' : 'badge-compact'}">
            <div class="badge-head">
              <span class="badge-fish-icon">🐟</span>
              <strong class="badge-title">${z.name}</strong>
              <span class="badge-depth-tag">${z.depth_strata.optimal_catch_depth}m</span>
            </div>
            ${
              isExpanded
                ? `<div class="badge-stats">
                    <span class="badge-species">${z.primary_species[0]}</span>
                    <span class="badge-chl">${z.chlorophyll_mean} mg/m³</span>
                  </div>`
                : ''
            }
          </div>
        `;

        const badgeIcon = L.divIcon({
          className: 'pfz-badge-wrapper',
          html: badgeHtml,
          iconSize: isExpanded ? [165, 40] : [135, 24],
          iconAnchor: isExpanded ? [82, 20] : [67, 12],
        });

        const badgeMarker = L.marker([centerLat, centerLon], { icon: badgeIcon }).addTo(map);

        badgeMarker.on('click', () => onSelectZone(z.id));
        poly.on('click', () => onSelectZone(z.id));

        poly.bindTooltip(
          `<div style="font-size: 11px; padding: 4px 6px; font-family: system-ui, sans-serif;">
            <strong style="color: #38bdf8; font-size: 12px;">🐟 ${z.name}</strong><br/>
            <span>Status: <strong style="color: #34d399;">${z.rating} PFZ</strong> · SST: <strong>${z.sst_mean} °C</strong></span><br/>
            <span>Optimal Catch Depth: <strong style="color: #fbbf24;">${z.depth_strata.optimal_catch_depth}m (${z.depth_strata.stratum_name})</strong></span><br/>
            <span style="color: #94a3b8; font-size: 10px;">Target: ${z.primary_species.slice(0, 3).join(', ')}</span>
          </div>`,
          { sticky: true, className: 'leaflet-hazard-tooltip' }
        );

        polygonLayersRef.current[z.id] = poly;
        polygonLayersRef.current[`${z.id}-badge`] = badgeMarker as unknown as L.Polygon;
      } catch (err) {
        console.warn('Error rendering PFZ polygon', z.name, err);
      }
    });
  }, [fisheryZones, selectedZoneId, onSelectZone, showDepthLayer, selectedDepth]);

  // 4. Render 3D Bathymetric Isobaths & Depth Contour Lines
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (depthIsobathGroupRef.current) {
      map.removeLayer(depthIsobathGroupRef.current);
      depthIsobathGroupRef.current = null;
    }

    if (!showDepthLayer) return;

    const layerGroup = L.layerGroup().addTo(map);
    depthIsobathGroupRef.current = layerGroup;

    BATHYMETRIC_ISOBATHS.forEach((iso) => {
      // Highlight contour if closest to selectedDepth
      const isHighlighted = Math.abs(iso.depth - selectedDepth) <= 60;

      const polyline = L.polyline(iso.coords, {
        color: isHighlighted ? '#f59e0b' : iso.color,
        weight: isHighlighted ? 3.2 : iso.depth === 200 ? 2.5 : 1.8,
        dashArray: iso.depth === 200 ? '8, 4' : '4, 4',
        opacity: isHighlighted ? 0.95 : 0.75,
      }).addTo(layerGroup);

      polyline.bindTooltip(
        `<div style="font-size: 11px; font-weight: 700; color: ${iso.color};">
          ⚓ ${iso.label} (${iso.depth}m)
          ${iso.depth === 200 ? '<br/><span style="color:#fbbf24; font-size:10px;">★ Primary Pelagic Shelf Break</span>' : ''}
        </div>`,
        { sticky: true, className: 'leaflet-hazard-tooltip' }
      );
    });
  }, [showDepthLayer, selectedDepth]);

  // 5. Render Fronts, Fishing Ports, and Conservation Areas
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (vectorGroupRef.current) {
      map.removeLayer(vectorGroupRef.current);
      vectorGroupRef.current = null;
    }

    const group = L.layerGroup().addTo(map);
    vectorGroupRef.current = group;

    // Thermal & Chlorophyll Fronts
    if (showFronts) {
      PRODUCTIVITY_FRONTS.forEach((front) => {
        const line = L.polyline(front.path, {
          color: '#10b981',
          weight: 2.5,
          dashArray: '5, 5',
          opacity: 0.88,
        }).addTo(group);

        line.bindTooltip(
          `<div style="font-size: 11px; font-weight: 600; color: #34d399;">
            🌿 ${front.name}<br/>
            <span style="font-size: 10px; color: #cbd5e1;">Cayula-Cornillon Gradient: ${front.gradient}</span>
          </div>`,
          { sticky: true, className: 'leaflet-hazard-tooltip' }
        );
      });
    }

    // Fishing Harbors
    if (showHarbors) {
      FISHING_HARBORS.forEach((port) => {
        const portIcon = L.divIcon({
          className: 'fishing-port-marker-wrap',
          html: `
            <div class="fishing-port-pin" title="${port.name}">
              <span class="port-anchor">⚓</span>
              <span class="port-mini-label">${port.name.replace(' Fishery Harbor', '').replace(' Fishing Port', '').replace(' Harbor', '')}</span>
            </div>
          `,
          iconSize: [85, 20],
          iconAnchor: [42, 10],
        });

        const m = L.marker([port.lat, port.lon], { icon: portIcon }).addTo(group);
        m.bindTooltip(
          `<div style="font-size: 11px; padding: 2px;">
            <strong style="color: #38bdf8;">⚓ ${port.name}</strong> (${port.state})<br/>
            <span style="color: #94a3b8;">Fleet: ${port.boats}</span>
          </div>`,
          { sticky: true, className: 'leaflet-hazard-tooltip' }
        );
      });
    }

    // Marine Conservation & Trawling Restricted Zones
    if (showConservationZones) {
      CONSERVATION_ZONES.forEach((res) => {
        const circle = L.circle(res.center, {
          radius: res.radius_km * 1000,
          color: '#ef4444',
          weight: 1.5,
          dashArray: '6, 6',
          fillColor: '#ef4444',
          fillOpacity: 0.12,
        }).addTo(group);

        circle.bindTooltip(
          `<div style="font-size: 11px; padding: 3px; max-width: 220px;">
            <strong style="color: #ef4444;">🛡️ ${res.name}</strong><br/>
            <span style="color: #fca5a5; font-size: 10px;">${res.restriction}</span>
          </div>`,
          { sticky: true, className: 'leaflet-hazard-tooltip' }
        );
      });
    }
  }, [showFronts, showHarbors, showConservationZones]);

  // 6. Smooth Fly to Selected Zone
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const selected = fisheryZones.find((z) => z.id === selectedZoneId);
    if (selected && selected.polygon && selected.polygon.length >= 3) {
      try {
        const bounds = L.latLngBounds(selected.polygon);
        map.flyToBounds(bounds, { padding: [45, 45], maxZoom: 7, duration: 1.2 });
      } catch {
        // Fallback gracefully
      }
    }
  }, [selectedZoneId, fisheryZones]);

  const handleResetZoom = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([14.5, 85.5], 5, { duration: 1.0 });
    }
  };

  const handleZoomIn = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
  };

  // Fly Cesium 3D Globe camera to active fishery sector in Underwater mode
  const handleFlyToUnderwater3D = () => {
    const state = OceanState.getInstance();
    state.setActivePage('3d-ocean');
    state.setMode('underwater');
    state.setUnderwaterRegion('bay-of-bengal');
    state.setDepth(selectedDepth);
    const center = selectedZone?.center || [14.0, 86.0];
    state.requestFlyToLocation(center[0], center[1], 1500000, 0, -65, 1.5);
  };

  return (
    <div className="real-fishery-map-wrapper">
      {/* Top Map Control Bar */}
      <div className="real-map-topbar">
        {/* Basemap Switcher Pill */}
        <div className="basemap-selector-pill">
          <Layers size={13} className="text-cyan" />
          <button
            type="button"
            className={`map-tab-btn ${activeBasemap === 'ocean' ? 'active' : ''}`}
            onClick={() => setActiveBasemap('ocean')}
            title="Esri Ocean Bathymetry & Seafloor Terrain"
          >
            Bathymetry
          </button>
          <button
            type="button"
            className={`map-tab-btn ${activeBasemap === 'dark' ? 'active' : ''}`}
            onClick={() => setActiveBasemap('dark')}
            title="High-Contrast Dark Maritime Basemap"
          >
            Dark Maritime
          </button>
          <button
            type="button"
            className={`map-tab-btn ${activeBasemap === 'satellite' ? 'active' : ''}`}
            onClick={() => setActiveBasemap('satellite')}
            title="Esri World Satellite Imagery"
          >
            Satellite
          </button>
        </div>

        {/* Fishery Feature & 3D Depth Layer Toggles */}
        <div className="heatmap-toggle-group">
          {/* 3D Depth Layer Toggle with Glow Pill */}
          <button
            type="button"
            className={`depth-layer-toggle-btn ${showDepthLayer ? 'active' : ''}`}
            onClick={() => setShowDepthLayer(!showDepthLayer)}
            title="Toggle 3D Water Column Depth Layer & Bathymetric Fishing Strata"
          >
            <Waves size={13} className="text-teal animate-pulse" />
            <span>3D Depth Layer</span>
            <span className="depth-indicator-pill">{selectedDepth}m</span>
          </button>

          <label className="heatmap-checkbox-label">
            <input
              type="checkbox"
              checked={showFronts}
              onChange={(e) => setShowFronts(e.target.checked)}
            />
            <span className="text-green font-bold">🌿 Fronts</span>
          </label>

          <label className="heatmap-checkbox-label">
            <input
              type="checkbox"
              checked={showHarbors}
              onChange={(e) => setShowHarbors(e.target.checked)}
            />
            <Anchor size={12} className="text-cyan" />
            <span>Harbors</span>
          </label>

          <label className="heatmap-checkbox-label">
            <input
              type="checkbox"
              checked={showConservationZones}
              onChange={(e) => setShowConservationZones(e.target.checked)}
            />
            <ShieldAlert size={12} className="text-rose" />
            <span>No-Trawl Zones</span>
          </label>
        </div>
      </div>

      {/* Leaflet DOM Mount */}
      <div className="leaflet-map-mount" ref={mapContainerRef} />

      {/* Floating Map Zoom & Extent Buttons */}
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
          title="Reset Extent to Bay of Bengal & Indian Ocean"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* 3D Depth Layer Water Column Controller & Isometric Prism */}
      {showDepthLayer && (
        <div className={`depth-strata-overlay-container ${prismMinimized ? 'minimized' : ''}`}>
          <div className="depth-overlay-header">
            <div className="d-hdr-left">
              <Sliders size={13} className="text-cyan" />
              <span className="d-hdr-title">3D Depth Layer: Water Column & Fishing Strata</span>
              <span className="d-depth-badge">{selectedDepth} m</span>
            </div>
            <div className="d-hdr-actions">
              <button
                type="button"
                className="depth-dive-globe-btn"
                onClick={handleFlyToUnderwater3D}
                title="Dive into Cesium 3D Volumetric Digital Ocean"
              >
                <Globe2 size={12} /> 3D Ocean Volume
              </button>
              <button
                type="button"
                className="depth-min-btn"
                onClick={() => setPrismMinimized(!prismMinimized)}
                title={prismMinimized ? 'Expand 3D Depth Layer' : 'Collapse HUD'}
              >
                {prismMinimized ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </div>
          </div>

          {!prismMinimized && (
            <div className="depth-overlay-body">
              {/* Depth Quick-Preset Buttons */}
              <div className="depth-preset-pills">
                {DEPTH_STRATA_PRESETS.map((p) => {
                  const isActive = p.id === activeStratum.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={`preset-pill-btn ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectDepthPreset(p)}
                    >
                      <span>{p.label}</span>
                      <small className="preset-tiny-species">{p.target_species[0]}</small>
                    </button>
                  );
                })}
              </div>

              {/* Slider & Hydrographic Readout Grid */}
              <div className="depth-slider-row">
                <span className="slider-label">0m (Surface)</span>
                <input
                  type="range"
                  min="0"
                  max="1000"
                  step="5"
                  value={selectedDepth}
                  onChange={(e) => handleSliderChange(parseInt(e.target.value, 10))}
                  className="depth-range-slider"
                  title="Drag depth to slice the 3D ocean water column"
                />
                <span className="slider-label">1000m (Bathyal)</span>
              </div>

              {/* Split Details: 3D Isometric Water Column Prism (Left) + Ecological Data (Right) */}
              <div className="depth-interactive-split">
                {/* 3D Isometric Water Column Prism Visualization */}
                <div className="depth-3d-prism-canvas">
                  <svg viewBox="0 0 260 145" className="water-prism-svg">
                    <defs>
                      <linearGradient id="oceanColumnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#0284c7" stopOpacity="0.85" />
                        <stop offset="20%" stopColor="#0369a1" stopOpacity="0.9" />
                        <stop offset="45%" stopColor="#075985" stopOpacity="0.92" />
                        <stop offset="70%" stopColor="#0f172a" stopOpacity="0.95" />
                        <stop offset="100%" stopColor="#020617" stopOpacity="0.98" />
                      </linearGradient>
                      <linearGradient id="activeDepthSliceGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                        <stop offset="50%" stopColor="#34d399" stopOpacity="0.9" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>

                    {/* 3D Isometric Column Faces */}
                    {/* Top Surface (0m) */}
                    <polygon points="130,12 215,35 130,55 45,35" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" opacity="0.65" />
                    <text x="130" y="32" fill="#e0f2fe" fontSize="8" textAnchor="middle" fontWeight="bold">SURFACE 0m</text>

                    {/* Left Front Face */}
                    <polygon points="45,35 130,55 130,135 45,115" fill="url(#oceanColumnGrad)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />

                    {/* Right Front Face */}
                    <polygon points="130,55 215,35 215,115 130,135" fill="url(#oceanColumnGrad)" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />

                    {/* Stratification Horizon Lines in 3D */}
                    {/* MLD Horizon (40m) */}
                    <line x1="45" y1="51" x2="130" y2="71" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6" />
                    <line x1="130" y1="71" x2="215" y2="51" stroke="#38bdf8" strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6" />
                    <text x="218" y="53" fill="#94a3b8" fontSize="7">MLD 40m</text>

                    {/* Thermocline Horizon (100m) */}
                    <line x1="45" y1="67" x2="130" y2="87" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3,3" opacity="0.75" />
                    <line x1="130" y1="87" x2="215" y2="67" stroke="#fbbf24" strokeWidth="1" strokeDasharray="3,3" opacity="0.75" />
                    <text x="218" y="69" fill="#fbbf24" fontSize="7" fontWeight="bold">Thermo 100m</text>

                    {/* 200m Shelf Break Horizon */}
                    <line x1="45" y1="83" x2="130" y2="103" stroke="#f97316" strokeWidth="1" strokeDasharray="4,2" opacity="0.85" />
                    <line x1="130" y1="103" x2="215" y2="83" stroke="#f97316" strokeWidth="1" strokeDasharray="4,2" opacity="0.85" />
                    <text x="218" y="85" fill="#f97316" fontSize="7" fontWeight="bold">Shelf 200m</text>

                    {/* Active Depth Slice Plane in 3D! Moves dynamically with selectedDepth (scaled 0-1000m to y: 35-115) */}
                    {(() => {
                      const sliceY = 35 + (selectedDepth / 1000) * 80;
                      return (
                        <g className="active-depth-plane-group">
                          <polygon
                            points={`130,${sliceY + 20} 215,${sliceY} 130,${sliceY - 20} 45,${sliceY}`}
                            fill="url(#activeDepthSliceGrad)"
                            stroke="#34d399"
                            strokeWidth="1.5"
                            opacity="0.85"
                          />
                          <circle cx="130" cy={sliceY + 20} r="3" fill="#34d399" />
                          <text x="38" y={sliceY + 4} fill="#34d399" fontSize="8" fontWeight="bold" textAnchor="end">
                            {selectedDepth}m
                          </text>
                        </g>
                      );
                    })()}

                    {/* Biological fish aggregation dots at respective depths */}
                    <circle cx="85" cy="50" r="2" fill="#facc15" />
                    <circle cx="95" cy="54" r="2" fill="#facc15" />
                    <circle cx="105" cy="52" r="2" fill="#facc15" />
                    <circle cx="150" cy="74" r="2.8" fill="#38bdf8" />
                    <circle cx="165" cy="72" r="2.8" fill="#38bdf8" />
                    <circle cx="140" cy="100" r="2.2" fill="#ec4899" />
                  </svg>
                  <span className="prism-subcaption">3D Water-Column Bio-Stratum · INCOIS/TEOS-10</span>
                </div>

                {/* Right: Hydrographic & Fishery Metrics at Active Depth */}
                <div className="depth-stratum-details">
                  <div className="stratum-headline">
                    <span className="stratum-title-text">{activeStratum.stratum_name}</span>
                    <span className="stratum-range-tag">{activeStratum.depth_range}</span>
                  </div>

                  <p className="stratum-role-desc">{activeStratum.biological_role}</p>

                  <div className="stratum-metrics-grid">
                    <div className="s-metric-box">
                      <span className="s-met-lbl">WATER TEMP</span>
                      <strong className="s-met-val text-cyan">{activeStratum.temp_c} °C</strong>
                    </div>
                    <div className="s-metric-box">
                      <span className="s-met-lbl">DISSOLVED O₂</span>
                      <strong className="s-met-val text-emerald">{activeStratum.dissolved_o2_ml_l} ml/L</strong>
                    </div>
                    <div className="s-metric-box">
                      <span className="s-met-lbl">SALINITY</span>
                      <strong className="s-met-val text-amber">{activeStratum.salinity_psu} PSU</strong>
                    </div>
                    <div className="s-metric-box">
                      <span className="s-met-lbl">LIGHT PENETRATION</span>
                      <strong className="s-met-val text-slate">{activeStratum.light_level}</strong>
                    </div>
                  </div>

                  <div className="stratum-target-row">
                    <span className="target-lbl">TARGET CATCH:</span>
                    <div className="target-tags-wrap">
                      {activeStratum.target_species.map((sp) => (
                        <span key={sp} className="species-pill">
                          🐟 {sp}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="stratum-gear-row">
                    <span className="gear-lbl">RECOMMENDED GEAR:</span>
                    <span className="gear-val text-amber">{activeStratum.recommended_gear}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bottom Floating Meta Bar: Live Coordinates & Bathymetry */}
      <div className="map-bottom-meta-bar">
        <div className="meta-coords">
          {cursorMeta ? (
            <span>
              {Math.abs(cursorMeta.lat).toFixed(2)}° {cursorMeta.lat >= 0 ? 'N' : 'S'} ·{' '}
              {Math.abs(cursorMeta.lng).toFixed(2)}° {cursorMeta.lng >= 0 ? 'E' : 'W'} ·{' '}
              <strong className="text-teal">{cursorMeta.depthEstimate}</strong>
            </span>
          ) : (
            <span>{activeRegion} · Bay of Bengal & Indian Ocean · Bathymetric Fishing Grounds</span>
          )}
        </div>

        <div className="meta-tilesource">
          <span>
            {showDepthLayer
              ? `GEBCO Bathymetry · Active 3D Depth: ${selectedDepth}m (${activeStratum.stratum_name})`
              : 'Basemap: ' + BASEMAP_TILES[activeBasemap].name + ' · MODIS/Sentinel-3 PFZ Fronts'}
          </span>
        </div>
      </div>

      {/* Vertical Scientific Colorbar on Right (Chlorophyll or SST or Depth) */}
      <div className="real-map-colorbar">
        <span className="colorbar-title">
          {showDepthLayer ? 'Water Depth (m)' : variable.includes('Chlorophyll') ? 'Chlorophyll-a' : 'Sea Surface Temp'}
        </span>
        <span className="colorbar-unit">
          {showDepthLayer ? 'Depth Stratum' : variable.includes('Chlorophyll') ? 'mg/m³ (Log Scale)' : '°C'}
        </span>
        <div className="colorbar-vertical-scale">
          <div className="scale-labels">
            {showDepthLayer ? (
              <>
                <span>0m Surface</span>
                <span>50m MLD</span>
                <span>100m Thermo</span>
                <span>200m Shelf</span>
                <span>1000m+</span>
              </>
            ) : variable.includes('Chlorophyll') ? (
              <>
                <span>≥ 5.0 (High)</span>
                <span>2.0 (Front)</span>
                <span>0.5 (Bloom)</span>
                <span>0.1 (Oligotrophic)</span>
              </>
            ) : (
              <>
                <span>30.0 °C</span>
                <span>28.0 °C</span>
                <span>26.0 °C</span>
                <span>24.0 °C</span>
              </>
            )}
          </div>
          <div
            className={`scale-bar-gradient ${
              showDepthLayer ? 'depth-strata-gradient' : variable.includes('Chlorophyll') ? 'chl-gradient' : 'sst-gradient'
            }`}
          />
        </div>
      </div>
    </div>
  );
};
