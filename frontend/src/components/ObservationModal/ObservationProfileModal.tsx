import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Globe2,
  RefreshCw,
  Layers,
  MapPin,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  BarChart2,
} from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import { fetchObservationProfile } from '../../services/observationService';
import {
  OCEAN_REGIONS,
  getOceanRegionConfig,
} from '../../ocean/data/oceanRegions';
import type {
  ObservationProfilePayload,
  ProfileVariable,
  SelectedObservation,
  UnderwaterRegionId,
  ProfileDepthSample,
} from '../../types/ocean';
import { RegionalDepthVisualizer } from './RegionalDepthVisualizer';

interface ObservationProfileModalProps {
  observation?: SelectedObservation | null;
  isOpen?: boolean;
  onClose?: () => void;
}

const VARIABLE_OPTIONS: { id: ProfileVariable; label: string; unit: string; min: number; max: number }[] = [
  { id: 'temperature', label: 'Temperature (°C)', unit: '°C', min: 2, max: 32 },
  { id: 'salinity', label: 'Salinity (PSU)', unit: 'PSU', min: 32, max: 37 },
  { id: 'currentSpeed', label: 'Current Speed (m/s)', unit: 'm/s', min: 0, max: 2.5 },
  { id: 'chlorophyll', label: 'Chlorophyll (mg/m³)', unit: 'mg/m³', min: 0.05, max: 4.0 },
  { id: 'oxygen', label: 'Dissolved Oxygen (ml/L)', unit: 'ml/L', min: 0.5, max: 6.5 },
];

const DEPTH_TICKS = [0, 50, 100, 200, 500, 750, 1000, 1500, 2000, 3000, 4000];

// SVG illustration of Autonomous Underwater Glider
const GliderIllustration: React.FC = () => (
  <svg
    viewBox="0 0 160 80"
    className="instrument-svg glider-svg"
    aria-label="Glider illustration"
  >
    <defs>
      <linearGradient id="gliderBody" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="50%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#ca8a04" />
      </linearGradient>
      <linearGradient id="gliderWing" x1="0%" y1="0%" x2="100%" y2="50%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>
    <path
      d="M 65 38 L 105 12 L 115 15 L 80 40 Z"
      fill="url(#gliderWing)"
      stroke="#78350f"
      strokeWidth="1"
    />
    <path
      d="M 55 42 L 85 68 L 95 65 L 70 44 Z"
      fill="url(#gliderWing)"
      stroke="#78350f"
      strokeWidth="1"
    />
    <path
      d="M 125 36 L 145 22 L 148 24 L 135 41 Z"
      fill="#ca8a04"
      stroke="#78350f"
      strokeWidth="1"
    />
    <path
      d="M 128 41 L 144 48 L 140 50 L 126 43 Z"
      fill="#b45309"
      stroke="#78350f"
      strokeWidth="1"
    />
    <path
      d="M 24 43 Q 18 42 14 41 Q 12 40 14 39 Q 20 37 32 36 L 118 36 Q 132 38 136 41 Q 132 44 118 45 L 32 45 Z"
      fill="url(#gliderBody)"
      stroke="#78350f"
      strokeWidth="1.2"
    />
    <line x1="14" y1="40" x2="4" y2="40" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
    <circle cx="4" cy="40" r="1.5" fill="#38bdf8" />
    <rect x="42" y="37" width="12" height="7" rx="1" fill="#0f172a" />
    <circle cx="48" cy="40.5" r="2" fill="#22c55e" />
    <rect x="74" y="37" width="3" height="7" fill="#1e293b" />
    <rect x="94" y="37" width="3" height="7" fill="#1e293b" />
    <line x1="135" y1="41" x2="152" y2="35" stroke="#64748b" strokeWidth="1.2" />
    <circle cx="152" cy="35" r="1" fill="#ef4444" />
  </svg>
);

// SVG illustration of Argo Profiling Float
const ArgoIllustration: React.FC = () => (
  <svg
    viewBox="0 0 80 110"
    className="instrument-svg argo-svg"
    aria-label="Argo Float illustration"
  >
    <defs>
      <linearGradient id="argoBody" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#fde047" />
        <stop offset="60%" stopColor="#eab308" />
        <stop offset="100%" stopColor="#a16207" />
      </linearGradient>
      <linearGradient id="argoSensorHead" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
    </defs>
    <line x1="40" y1="2" x2="40" y2="22" stroke="#94a3b8" strokeWidth="1.8" />
    <circle cx="40" cy="2" r="1.8" fill="#ef4444" />
    <rect x="30" y="22" width="20" height="10" rx="2" fill="url(#argoSensorHead)" stroke="#0f172a" />
    <circle cx="36" cy="27" r="1.8" fill="#38bdf8" />
    <circle cx="44" cy="27" r="1.8" fill="#22c55e" />
    <rect x="26" y="32" width="28" height="5" rx="1.5" fill="#475569" stroke="#1e293b" />
    <rect x="29" y="37" width="22" height="50" rx="3" fill="url(#argoBody)" stroke="#78350f" strokeWidth="1.2" />
    <line x1="33" y1="46" x2="47" y2="46" stroke="#78350f" strokeWidth="1" strokeDasharray="2,2" />
    <line x1="33" y1="56" x2="47" y2="56" stroke="#78350f" strokeWidth="1" strokeDasharray="2,2" />
    <line x1="33" y1="66" x2="47" y2="66" stroke="#78350f" strokeWidth="1" strokeDasharray="2,2" />
    <line x1="33" y1="76" x2="47" y2="76" stroke="#78350f" strokeWidth="1" strokeDasharray="2,2" />
    <text x="40" y="52" fontSize="5" fill="#78350f" fontWeight="bold" textAnchor="middle">ARGO</text>
    <path d="M 33 87 L 47 87 L 45 98 Q 40 101 35 98 Z" fill="#334155" stroke="#1e293b" />
    <ellipse cx="40" cy="98" rx="8" ry="3" fill="#1e293b" />
  </svg>
);

// 3D Multi-Layer Volumetric Model Icon
const ModelLayerIcon: React.FC = () => (
  <svg viewBox="0 0 100 80" className="instrument-svg model-svg" aria-label="Ocean Model Layer">
    <polygon points="50,10 90,26 50,42 10,26" fill="#0284c7" opacity="0.9" stroke="#38bdf8" strokeWidth="1" />
    <polygon points="50,22 90,38 50,54 10,38" fill="#0d9488" opacity="0.8" stroke="#2dd4bf" strokeWidth="1" />
    <polygon points="50,34 90,50 50,66 10,50" fill="#d97706" opacity="0.85" stroke="#f59e0b" strokeWidth="1" />
    <polygon points="50,46 90,62 50,78 10,62" fill="#c2410c" opacity="0.9" stroke="#ea580c" strokeWidth="1" />
  </svg>
);

function getSampleValueAtDepth(
  samples: ProfileDepthSample[] | undefined,
  variable: ProfileVariable,
  depth: number,
  fallback: number
): number {
  if (!samples || samples.length === 0) return fallback;
  const valid = [...samples]
    .filter((s) => typeof s[variable] === 'number')
    .sort((a, b) => a.depth - b.depth);

  if (valid.length === 0) return fallback;

  if (depth <= valid[0].depth) {
    return (valid[0][variable] as number) ?? fallback;
  }
  if (depth >= valid[valid.length - 1].depth) {
    return (valid[valid.length - 1][variable] as number) ?? fallback;
  }

  // Continuous linear interpolation between adjacent depth layers
  for (let i = 0; i < valid.length - 1; i++) {
    const a = valid[i];
    const b = valid[i + 1];
    if (depth >= a.depth && depth <= b.depth) {
      const valA = a[variable] as number;
      const valB = b[variable] as number;
      const span = Math.max(0.1, b.depth - a.depth);
      const factor = (depth - a.depth) / span;
      return valA + factor * (valB - valA);
    }
  }

  return fallback;
}

export const ObservationProfileModal: React.FC<ObservationProfileModalProps> = ({
  observation: propObs,
  isOpen: propIsOpen,
  onClose: propOnClose,
}) => {
  const [internalObs, setInternalObs] = useState<SelectedObservation | null>(null);
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const [payload, setPayload] = useState<ObservationProfilePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVar, setSelectedVar] = useState<ProfileVariable>('temperature');

  // Depth-oriented navigation state
  const [currentDepth, setCurrentDepth] = useState<number>(500); // meters
  const [selectedRegionId, setSelectedRegionId] = useState<UnderwaterRegionId>('arabian-sea');
  const [showDetailedGraph, setShowDetailedGraph] = useState<boolean>(false);
  const [loadToken, setLoadToken] = useState(0);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setInternalObs(snapshot.selectedObservation);
      setInternalIsOpen(snapshot.observationModalOpen);
      if (snapshot.underwaterRegion) {
        setSelectedRegionId(snapshot.underwaterRegion);
      } else if (snapshot.selectedObservation) {
        const obs = snapshot.selectedObservation;
        const lat =
          obs.type === 'argo'
            ? obs.data.latitude
            : obs.data.waypoints[obs.data.waypoints.length - 1]?.latitude ?? 0;
        const lon =
          obs.type === 'argo'
            ? obs.data.longitude
            : obs.data.waypoints[obs.data.waypoints.length - 1]?.longitude ?? 0;

        for (const [rId, reg] of Object.entries(OCEAN_REGIONS) as [
          UnderwaterRegionId,
          (typeof OCEAN_REGIONS)[UnderwaterRegionId],
        ][]) {
          if (
            rId !== 'indian-ocean' &&
            lon >= reg.bounds.west &&
            lon <= reg.bounds.east &&
            lat >= reg.bounds.south &&
            lat <= reg.bounds.north
          ) {
            setSelectedRegionId(rId);
            break;
          }
        }
      }
      if (snapshot.parameters.depth !== undefined && snapshot.parameters.depth !== null) {
        setCurrentDepth(snapshot.parameters.depth);
      }
    });
    return unsub;
  }, []);

  const activeObs = propObs !== undefined ? propObs : internalObs;
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;

  // Determine active region configuration
  const activeRegionConfig = useMemo(() => {
    return getOceanRegionConfig(selectedRegionId);
  }, [selectedRegionId]);

  const handleClose = useCallback(() => {
    if (propOnClose) {
      propOnClose();
    } else {
      OceanState.getInstance().closeObservationModal();
    }
  }, [propOnClose]);

  const loadData = useCallback(async (obs: SelectedObservation) => {
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
    });
    try {
      const data = await fetchObservationProfile(obs);
      setPayload(data);
    } catch {
      setError('Unable to load observation profile.');
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (activeObs) {
        void loadData(activeObs);
      } else {
        const realGliders = OceanState.getInstance().getGliders();
        const fallbackGlider = realGliders[0];
        const fallback: SelectedObservation = fallbackGlider
          ? { type: 'glider', data: fallbackGlider }
          : {
              type: 'glider',
              data: {
                id: 'ru29-20180812T0220',
                name: 'RU29 Challenger Glider (Arabian Sea)',
                mission: 'Arabian Sea / West Coast Survey',
                waypoints: [
                  {
                    latitude: 15.42,
                    longitude: 72.18,
                    depth: 500,
                    timestamp: new Date().toISOString(),
                    temperature: 18.4,
                    salinity: 35.1,
                  },
                ],
              },
            };
        void loadData(fallback);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isOpen, activeObs, loadToken, loadData]);

  // ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleClose]);

  const handleShowOnGlobe = () => {
    OceanState.getInstance().requestShowOnGlobe();
    if (propOnClose) propOnClose();
  };

  const handleRetry = () => setLoadToken((t) => t + 1);

  // Depth control helpers (scroll up = shallower, scroll down = deeper)
  const handleDepthChange = (newDepth: number) => {
    const clamped = Math.max(0, Math.min(activeRegionConfig.grid.maxDepthM, Math.round(newDepth)));
    setCurrentDepth(clamped);
    OceanState.getInstance().setDepth(clamped);
  };

  const stepDepth = (delta: number) => {
    handleDepthChange(currentDepth + delta);
  };

  const handleRegionChange = (newRegionId: UnderwaterRegionId) => {
    setSelectedRegionId(newRegionId);
    OceanState.getInstance().setUnderwaterRegion(newRegionId);
  };

  // Values at current depth for Model, Glider, Argo
  const currentDepthValues = useMemo(() => {
    const modelProfile = payload?.profile?.model;
    const gliderProfile = payload?.profile?.glider;
    const argoProfile = payload?.profile?.argo;

    return {
      model: {
        temp: getSampleValueAtDepth(modelProfile, 'temperature', currentDepth, 18.2),
        sal: getSampleValueAtDepth(modelProfile, 'salinity', currentDepth, 35.0),
        current: getSampleValueAtDepth(modelProfile, 'currentSpeed', currentDepth, 0.6),
        chl: getSampleValueAtDepth(modelProfile, 'chlorophyll', currentDepth, 0.4),
      },
      glider: {
        temp: getSampleValueAtDepth(gliderProfile, 'temperature', currentDepth, 18.4),
        sal: getSampleValueAtDepth(gliderProfile, 'salinity', currentDepth, 35.1),
        current: getSampleValueAtDepth(gliderProfile, 'currentSpeed', currentDepth, 0.6),
        chl: getSampleValueAtDepth(gliderProfile, 'chlorophyll', currentDepth, 0.6),
      },
      argo: {
        temp: getSampleValueAtDepth(argoProfile, 'temperature', currentDepth, 18.1),
        sal: getSampleValueAtDepth(argoProfile, 'salinity', currentDepth, 35.1),
        current: getSampleValueAtDepth(argoProfile, 'currentSpeed', currentDepth, 0.6),
        chl: getSampleValueAtDepth(argoProfile, 'chlorophyll', currentDepth, 0.8),
      },
    };
  }, [payload, currentDepth]);

  // Coordinates from active observation or region center
  const coords = useMemo(() => {
    if (activeObs?.type === 'argo') {
      return {
        lat: activeObs.data.latitude.toFixed(2),
        lon: activeObs.data.longitude.toFixed(2),
        id: activeObs.data.stationCode || activeObs.data.id,
      };
    }
    if (activeObs?.type === 'glider') {
      const lastWp = activeObs.data.waypoints[activeObs.data.waypoints.length - 1];
      return {
        lat: (lastWp?.latitude ?? 15.42).toFixed(2),
        lon: (lastWp?.longitude ?? 72.18).toFixed(2),
        id: activeObs.data.name || activeObs.data.id,
      };
    }
    return {
      lat: ((activeRegionConfig.bounds.south + activeRegionConfig.bounds.north) / 2).toFixed(2),
      lon: ((activeRegionConfig.bounds.west + activeRegionConfig.bounds.east) / 2).toFixed(2),
      id: activeRegionConfig.name,
    };
  }, [activeObs, activeRegionConfig]);

  // Depth in feet for dual scientific readout
  const depthFt = Math.round(currentDepth * 3.28084);

  // Depth layer index
  const layerIndex = Math.min(
    activeRegionConfig.grid.depthLayers,
    Math.max(1, Math.round((currentDepth / (activeRegionConfig.grid.maxDepthM || 1)) * activeRegionConfig.grid.depthLayers))
  );

  if (!isOpen) return null;

  return (
    <div
      className="obs-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="presentation"
    >
      <div
        className="obs-modal-window obs-modal-depth-oriented"
        role="dialog"
        aria-modal="true"
        aria-labelledby="obs-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ============================================================ */}
        {/* TOP MODAL HEADER: BRAND, REGION DROPDOWN, COORDS, ACTIONS   */}
        {/* ============================================================ */}
        <header className="obs-modal-header">
          <div className="obs-header-left">
            <div className="obs-brand-badge">
              <span className="obs-brand-org">INCOIS</span>
              <span className="obs-brand-name">ARIEL</span>
            </div>
            <div className="obs-title-group">
              <h1 id="obs-profile-title" className="obs-main-title">
                Observation Profile
              </h1>
              <p className="obs-subtitle">
                3D Volumetric Depth Visualizer · In-Situ vs Model Ocean Sounding
              </p>
            </div>
          </div>

          <div className="obs-header-center-tools">
            <div className="obs-region-select-wrap">
              <span className="obs-meta-label">Domain:</span>
              <select
                className="ariel-select select-xs"
                value={selectedRegionId}
                onChange={(e) => handleRegionChange(e.target.value as UnderwaterRegionId)}
              >
                <option value="arabian-sea">Arabian Sea (40×40 Grid)</option>
                <option value="bay-of-bengal">Bay of Bengal (40×40 Grid)</option>
                <option value="laccadive-sea">Laccadive Sea (30×30 Grid)</option>
                <option value="andaman-sea">Andaman Sea (30×30 Grid)</option>
                <option value="java-sea">Java Sea (25×25 Grid)</option>
                <option value="indian-ocean">Indian Ocean (50×50 Basin)</option>
                <option value="southern-ocean">Southern Ocean (45×45 Circumpolar)</option>
              </select>
            </div>

            <div className="obs-coord-tag" title="Selected Observation Coordinates">
              <MapPin size={11} className="text-coral" />
              <span>
                {coords.lat}°N, {coords.lon}°E · {coords.id}
              </span>
            </div>

            <div className="obs-depth-stratum-badge">
              <Layers size={11} className="text-gold" />
              <span>
                Layer {layerIndex}/{activeRegionConfig.grid.depthLayers} · -{currentDepth}m (-{depthFt}ft)
              </span>
            </div>
          </div>

          <div className="obs-header-actions">
            <button
              type="button"
              className="ariel-btn-teal btn-compact"
              onClick={handleShowOnGlobe}
              title="Fly Cesium camera to this observation location on the main globe"
            >
              <Globe2 size={13} /> Show on Globe
            </button>

            <button
              type="button"
              className="obs-close-x-btn"
              onClick={handleClose}
              aria-label="Close Observation Profile Modal"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* ============================================================ */}
        {/* MODAL BODY: 3-COLUMN LAYOUT (MODEL DATA | 3D | DEPTH)         */}
        {/* ============================================================ */}
        <div className="obs-modal-body obs-depth-modal-body">
          {loading && (
            <div className="obs-loading-container">
              <Layers className="animate-spin text-teal" size={26} />
              <p className="loading-title">Loading 3D Depth Profile & Observations...</p>
              <span className="loading-subtext">Cesium globe remains active in background.</span>
            </div>
          )}

          {!loading && error && (
            <div className="obs-error-container">
              <p className="error-title">{error}</p>
              <button type="button" className="ariel-btn-teal btn-sm" onClick={handleRetry}>
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          )}

          {!loading && !error && (
            <div className="obs-depth-grid-layout">
              {/* ---------------------------------------------------- */}
              {/* 1. LEFT PANEL: MODEL / OBSERVATION COMPARISON        */}
              {/* ---------------------------------------------------- */}
              <div className="obs-depth-left-panel">
                {/* Variable Selector Bar */}
                <div className="obs-variable-pills-bar">
                  <span className="pills-title">VARIABLE:</span>
                  <div className="pills-list">
                    {VARIABLE_OPTIONS.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        className={`pill-btn ${selectedVar === v.id ? 'pill-active' : ''}`}
                        onClick={() => setSelectedVar(v.id)}
                      >
                        {v.label.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sounding Depth Telemetry Banner */}
                <div className="obs-sounding-depth-banner">
                  <div className="banner-left">
                    <span className="banner-label">CURRENT SOUNDING LAYER</span>
                    <strong className="banner-depth">-{currentDepth} m</strong>
                    <span className="banner-feet">(-{depthFt} ft)</span>
                  </div>
                  <div className="banner-right">
                    <span className="banner-subline">
                      Spacing: ~{activeRegionConfig.grid.approxVerticalSpacingFt || '760 ft'} / layer
                    </span>
                  </div>
                </div>

                {/* 1. Model Data Card */}
                <div className="obs-card-compact card-model">
                  <div className="card-head">
                    <div className="card-title-wrap">
                      <ModelLayerIcon />
                      <span className="card-title-text">Model Data (INCOIS)</span>
                    </div>
                    <span className="badge-source-model">INCOIS-HCOM</span>
                  </div>
                  <div className="card-metrics-row">
                    <div className="metric-pill">
                      <span className="m-label">TEMP</span>
                      <strong className="m-val">{currentDepthValues.model.temp.toFixed(1)}°C</strong>
                    </div>
                    <div className="metric-pill">
                      <span className="m-label">SAL</span>
                      <strong className="m-val">{currentDepthValues.model.sal.toFixed(1)} PSU</strong>
                    </div>
                    <div className="metric-pill">
                      <span className="m-label">CURR</span>
                      <strong className="m-val">{currentDepthValues.model.current.toFixed(1)} m/s</strong>
                    </div>
                    <div className="metric-pill">
                      <span className="m-label">CHL</span>
                      <strong className="m-val">{currentDepthValues.model.chl.toFixed(2)} mg/m³</strong>
                    </div>
                  </div>
                </div>

                {/* 2. Glider Data Card */}
                <div
                  className={`obs-card-compact card-glider ${
                    activeObs?.type === 'glider' ? 'card-selected' : ''
                  }`}
                >
                  <div className="card-head">
                    <div className="card-title-wrap">
                      <GliderIllustration />
                      <span className="card-title-text">
                        Glider {activeObs?.type === 'glider' ? activeObs.data.name : 'RU29'}
                      </span>
                    </div>
                    <span className="badge-source-glider">
                      {activeObs?.type === 'glider' ? 'Selected Unit' : 'Active Glider'}
                    </span>
                  </div>
                  <div className="card-metrics-row">
                    <div className="metric-pill">
                      <span className="m-label">TEMP</span>
                      <strong className="m-val text-amber">{currentDepthValues.glider.temp.toFixed(1)}°C</strong>
                    </div>
                    <div className="metric-pill">
                      <span className="m-label">SAL</span>
                      <strong className="m-val text-amber">{currentDepthValues.glider.sal.toFixed(1)} PSU</strong>
                    </div>
                    <div className="metric-pill">
                      <span className="m-label">CURR</span>
                      <strong className="m-val text-amber">{currentDepthValues.glider.current.toFixed(1)} m/s</strong>
                    </div>
                    <div className="metric-pill">
                      <span className="m-label">CHL</span>
                      <strong className="m-val text-amber">{currentDepthValues.glider.chl.toFixed(2)} mg/m³</strong>
                    </div>
                  </div>
                </div>

                {/* 3. Argo Data Card */}
                <div
                  className={`obs-card-compact card-argo ${
                    activeObs?.type === 'argo' ? 'card-selected' : ''
                  }`}
                >
                  <div className="card-head">
                    <div className="card-title-wrap">
                      <ArgoIllustration />
                      <span className="card-title-text">
                        Argo Float {activeObs?.type === 'argo' ? activeObs.data.stationCode || `#${activeObs.data.id}` : '#INCOIS-4587'}
                      </span>
                    </div>
                    <span className="badge-source-argo">
                      {activeObs?.type === 'argo' ? 'Selected Float' : 'CTD Float'}
                    </span>
                  </div>
                  <div className="card-metrics-row">
                    <div className="metric-pill">
                      <span className="m-label">TEMP</span>
                      <strong className="m-val text-coral">{currentDepthValues.argo.temp.toFixed(1)}°C</strong>
                    </div>
                    <div className="metric-pill">
                      <span className="m-label">SAL</span>
                      <strong className="m-val text-coral">{currentDepthValues.argo.sal.toFixed(1)} PSU</strong>
                    </div>
                    <div className="metric-pill">
                      <span className="m-label">CURR</span>
                      <strong className="m-val text-coral">{currentDepthValues.argo.current.toFixed(1)} m/s</strong>
                    </div>
                    <div className="metric-pill">
                      <span className="m-label">CHL</span>
                      <strong className="m-val text-coral">{currentDepthValues.argo.chl.toFixed(2)} mg/m³</strong>
                    </div>
                  </div>
                </div>

                {/* Compact Comparison Summary Table */}
                <div className="obs-depth-summary-table-wrap">
                  <table className="ariel-compare-table">
                    <thead>
                      <tr>
                        <th>VARIABLE (@ -{currentDepth}m)</th>
                        <th>MODEL</th>
                        <th>GLIDER</th>
                        <th>ARGO</th>
                        <th>Δ(DIFF)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Temperature (°C)</td>
                        <td className="text-cyan">{currentDepthValues.model.temp.toFixed(1)}</td>
                        <td className="text-amber">{currentDepthValues.glider.temp.toFixed(1)}</td>
                        <td className="text-coral">{currentDepthValues.argo.temp.toFixed(1)}</td>
                        <td className="text-delta">
                          {(currentDepthValues.model.temp - currentDepthValues.glider.temp).toFixed(1)}°C
                        </td>
                      </tr>
                      <tr>
                        <td>Salinity (PSU)</td>
                        <td className="text-cyan">{currentDepthValues.model.sal.toFixed(1)}</td>
                        <td className="text-amber">{currentDepthValues.glider.sal.toFixed(1)}</td>
                        <td className="text-coral">{currentDepthValues.argo.sal.toFixed(1)}</td>
                        <td className="text-delta">
                          {(currentDepthValues.model.sal - currentDepthValues.glider.sal).toFixed(1)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Details Accordion Button */}
                <button
                  type="button"
                  className="obs-toggle-details-btn"
                  onClick={() => setShowDetailedGraph((v) => !v)}
                >
                  <BarChart2 size={12} />
                  <span>{showDetailedGraph ? 'Hide Detailed Profile Graphs' : 'View Detailed 2D Profile Curves & CTD Data'}</span>
                  {showDetailedGraph ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              </div>

              {/* ---------------------------------------------------- */}
              {/* 2. CENTER PANEL: 3D OCEAN VISUALIZER                 */}
              {/* ---------------------------------------------------- */}
              <div className="obs-depth-center-panel">
                <div className="visualizer-header-bar">
                  <div className="vis-meta-left">
                    <span className="vis-tag-basin">{activeRegionConfig.name.toUpperCase()} 3D BASIN</span>
                    <span className="vis-tag-grid">
                      {activeRegionConfig.grid.x}×{activeRegionConfig.grid.y} GRID · {activeRegionConfig.grid.depthLayers} DEPTH LAYERS
                    </span>
                  </div>

                  <div className="vis-color-scale-bar">
                    <span className="color-scale-label">
                      {VARIABLE_OPTIONS.find((v) => v.id === selectedVar)?.label}:
                    </span>
                    <div className="color-scale-gradient" />
                    <span className="color-scale-range">
                      {VARIABLE_OPTIONS.find((v) => v.id === selectedVar)?.min} to{' '}
                      {VARIABLE_OPTIONS.find((v) => v.id === selectedVar)?.max}{' '}
                      {VARIABLE_OPTIONS.find((v) => v.id === selectedVar)?.unit}
                    </span>
                  </div>
                </div>

                {/* 3D WebGL Ocean Visualizer */}
                <div className="visualizer-canvas-frame">
                  <RegionalDepthVisualizer
                    regionConfig={activeRegionConfig}
                    currentDepth={currentDepth}
                    variable={selectedVar}
                    observation={activeObs}
                    payload={payload}
                    onDepthChange={handleDepthChange}
                  />

                  {/* On-canvas interaction guidance overlay */}
                  <div className="canvas-scroll-hint">
                    <span className="scroll-arrow">▲</span>
                    <span>Scroll Up = Shallower</span>
                    <span className="hint-divider">·</span>
                    <span className="scroll-arrow">▼</span>
                    <span>Scroll Down = Deeper</span>
                    <span className="hint-divider">·</span>
                    <span>Drag to Rotate 3D Water Column</span>
                  </div>
                </div>
              </div>

              {/* ---------------------------------------------------- */}
              {/* 3. RIGHT PANEL: VERTICAL DEPTH NAVIGATION            */}
              {/* ---------------------------------------------------- */}
              <div className="obs-depth-right-panel">
                <div className="depth-rail-header">
                  <span className="depth-rail-title">DEPTH</span>
                  <span className="depth-rail-sub">SURFACE → ABYSS</span>
                </div>

                {/* Step Up Button (Shallower) */}
                <button
                  type="button"
                  className="depth-step-btn btn-up"
                  onClick={() => stepDepth(-50)}
                  disabled={currentDepth <= 0}
                  title="Move to shallower depth layer (Scroll Up)"
                >
                  <ArrowUp size={13} />
                  <span>SHALLOWER</span>
                </button>

                {/* Vertical Depth Rail with Clickable Ticks */}
                <div className="depth-rail-container">
                  <div className="depth-track-line" />

                  {/* Active Depth Thumb Marker */}
                  <div
                    className="depth-indicator-thumb"
                    style={{
                      top: `${Math.min(
                        96,
                        Math.max(
                          2,
                          (currentDepth / (activeRegionConfig.grid.maxDepthM || 1)) * 94
                        )
                      )}%`,
                    }}
                  >
                    <div className="thumb-pointer" />
                    <div className="thumb-badge">
                      <span className="thumb-m">-{currentDepth}m</span>
                      <span className="thumb-ft">-{depthFt}ft</span>
                    </div>
                  </div>

                  {/* Interactive Depth Rung Markers */}
                  {DEPTH_TICKS.filter((d) => d <= activeRegionConfig.grid.maxDepthM).map((d) => {
                    const topPct = (d / (activeRegionConfig.grid.maxDepthM || 1)) * 94 + 3;
                    const isActive = Math.abs(currentDepth - d) < 30;
                    return (
                      <div
                        key={d}
                        className={`depth-tick-node ${isActive ? 'tick-active' : ''}`}
                        style={{ top: `${topPct}%` }}
                        onClick={() => handleDepthChange(d)}
                        title={`Sound at -${d} meters`}
                      >
                        <div className="tick-dot" />
                        <span className="tick-label">{d === 0 ? '0m (Surface)' : `${d}m`}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Step Down Button (Deeper) */}
                <button
                  type="button"
                  className="depth-step-btn btn-down"
                  onClick={() => stepDepth(50)}
                  disabled={currentDepth >= activeRegionConfig.grid.maxDepthM}
                  title="Move to deeper depth layer (Scroll Down)"
                >
                  <ArrowDown size={13} />
                  <span>DEEPER</span>
                </button>

                {/* Depth Quick Preset Jumps */}
                <div className="depth-quick-presets">
                  <button
                    type="button"
                    className={`preset-chip ${currentDepth === 0 ? 'chip-active' : ''}`}
                    onClick={() => handleDepthChange(0)}
                  >
                    Surface (0m)
                  </button>
                  <button
                    type="button"
                    className={`preset-chip ${currentDepth === 100 ? 'chip-active' : ''}`}
                    onClick={() => handleDepthChange(100)}
                  >
                    Epipelagic (100m)
                  </button>
                  <button
                    type="button"
                    className={`preset-chip ${currentDepth === 500 ? 'chip-active' : ''}`}
                    onClick={() => handleDepthChange(500)}
                  >
                    Thermocline (500m)
                  </button>
                  <button
                    type="button"
                    className={`preset-chip ${currentDepth === 1000 ? 'chip-active' : ''}`}
                    onClick={() => handleDepthChange(1000)}
                  >
                    Mesopelagic (1000m)
                  </button>
                  <button
                    type="button"
                    className={`preset-chip ${currentDepth === 2000 ? 'chip-active' : ''}`}
                    onClick={() => handleDepthChange(2000)}
                  >
                    Bathypelagic (2000m)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* OPTIONAL EXPANDABLE DETAILS: 2D PROFILE CHART & CTD TABLE    */}
          {/* ============================================================ */}
          {showDetailedGraph && !loading && !error && (
            <div className="obs-expanded-profile-row">
              <div className="obs-graph-panel">
                <div className="graph-panel-header">
                  <span className="graph-title-badge">
                    {VARIABLE_OPTIONS.find((v) => v.id === selectedVar)?.label} vs Depth
                  </span>
                </div>
                <div className="chart-render-wrapper">
                  <svg
                    viewBox="0 0 540 220"
                    className="depth-chart-svg"
                    aria-label="Depth profile curve comparison"
                  >
                    <rect x="0" y="0" width="540" height="220" fill="#141d28" rx="4" />
                    {[0, 500, 1000, 1500, 2000].map((d) => {
                      const y = 25 + (d / 2000) * 160;
                      return (
                        <g key={d}>
                          <line x1="50" y1={y} x2="430" y2={y} stroke="#223344" strokeWidth="1" strokeDasharray="3,3" />
                          <text x="42" y={y + 3} fill="#88909e" fontSize="9" textAnchor="end" fontFamily="monospace">
                            {d}
                          </text>
                        </g>
                      );
                    })}
                    <line x1="50" y1="25" x2="50" y2="185" stroke="#334455" strokeWidth="1.5" />
                    <line x1="50" y1="185" x2="430" y2="185" stroke="#334455" strokeWidth="1.5" />
                    {/* Current Depth Scanning Indicator line on 2D chart */}
                    <line
                      x1="50"
                      y1={25 + (Math.min(2000, currentDepth) / 2000) * 160}
                      x2="430"
                      y2={25 + (Math.min(2000, currentDepth) / 2000) * 160}
                      stroke="#f59e0b"
                      strokeWidth="2"
                      strokeDasharray="4,2"
                    />
                    {/* Model Curve */}
                    <path d="M 410,25 Q 330,50 285,75 T 230,105 T 180,135 T 125,165 T 90,185" fill="none" stroke="#0284c7" strokeWidth="2.2" />
                    {/* Glider Curve */}
                    <path d="M 415,25 Q 328,52 278,80 T 238,105 T 185,138 T 128,168 T 92,185" fill="none" stroke="#facc15" strokeWidth="2.2" />
                    {/* Argo Curve */}
                    <path d="M 408,25 Q 332,48 280,78 T 228,105 T 178,135 T 123,165 T 95,185" fill="none" stroke="#f87171" strokeWidth="2.2" />
                    {/* Legend */}
                    <g transform="translate(445, 35)">
                      <circle cx="6" cy="6" r="3.5" fill="#0284c7" />
                      <text x="16" y="9" fill="#e2e8f0" fontSize="9" fontFamily="sans-serif">Model</text>
                      <circle cx="6" cy="24" r="3.5" fill="#facc15" />
                      <text x="16" y="27" fill="#e2e8f0" fontSize="9" fontFamily="sans-serif">Glider</text>
                      <circle cx="6" cy="42" r="3.5" fill="#f87171" />
                      <text x="16" y="45" fill="#e2e8f0" fontSize="9" fontFamily="sans-serif">Argo</text>
                    </g>
                  </svg>
                </div>
              </div>

              <div className="obs-table-panel">
                <div className="table-panel-header">
                  <span className="profile-table-title">CTD Sounding Table</span>
                </div>
                <div className="profile-table-scroll-wrap">
                  <table className="ariel-profile-grid-table">
                    <thead>
                      <tr>
                        <th>Depth (m)</th>
                        <th>Model</th>
                        <th>Glider</th>
                        <th>Argo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(payload?.profile?.depths || [0, 50, 100, 250, 500, 750, 1000, 1500, 2000]).map((d, idx) => {
                        const mVal = payload?.profile?.model[idx]?.[selectedVar] ?? 20 - (d / 2000) * 15;
                        const gVal = payload?.profile?.glider[idx]?.[selectedVar] ?? 20.2 - (d / 2000) * 15;
                        const aVal = payload?.profile?.argo[idx]?.[selectedVar] ?? 19.9 - (d / 2000) * 15;
                        const isCurrent = Math.abs(d - currentDepth) < 30;
                        return (
                          <tr key={d} className={isCurrent ? 'row-active-depth' : ''}>
                            <td className="cell-depth">-{d}m</td>
                            <td className="cell-model text-cyan">{typeof mVal === 'number' ? mVal.toFixed(1) : '—'}</td>
                            <td className="cell-glider text-amber">{typeof gVal === 'number' ? gVal.toFixed(1) : '—'}</td>
                            <td className="cell-argo text-coral">{typeof aVal === 'number' ? aVal.toFixed(1) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* MODAL FOOTER                                                 */}
        {/* ============================================================ */}
        <footer className="obs-modal-footer">
          <span className="footer-status-text">
            Cesium 3D Globe remains active in background · IHO v3 authoritative geometry · Georeferenced WGS84
          </span>
          <div className="footer-btn-group">
            <button
              type="button"
              className="ariel-btn-ghost btn-xs"
              onClick={handleClose}
            >
              Close
            </button>
            <button
              type="button"
              className="ariel-btn-teal btn-xs"
              onClick={handleShowOnGlobe}
            >
              <Globe2 size={12} /> Show on Globe
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ObservationProfileModal;
