import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Globe2,
  RefreshCw,
  Layers,
  MapPin,
  ChevronDown,
  Activity,
  Box,
  BarChart2,
  Columns,
} from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import { fetchObservationProfile } from '../../services/observationService';
import { DepthProfileChart, type DepthProfileSeries } from './DepthProfileChart';
import { RegionalDepthVisualizer } from './RegionalDepthVisualizer';
import {
  getOceanRegionConfig,
  type OceanRegionConfig,
  type UnderwaterRegionId,
  type ObservationProfilePayload,
  type ProfileVariable,
  type SelectedObservation,
  type GliderTrajectory,
  type ArgoProfile,
  type ProfileDepthSample,
} from '../../types/ocean';

interface ObservationProfileModalProps {
  observation?: SelectedObservation | null;
  isOpen?: boolean;
  onClose?: () => void;
}

const VARIABLE_OPTIONS: { id: ProfileVariable; label: string; unit: string }[] = [
  { id: 'temperature', label: 'Temperature (°C)', unit: '°C' },
  { id: 'salinity', label: 'Salinity (PSU)', unit: 'PSU' },
  { id: 'currentSpeed', label: 'Current Speed (m/s)', unit: 'm/s' },
  { id: 'chlorophyll', label: 'Chlorophyll (mg/m³)', unit: 'mg/m³' },
  { id: 'oxygen', label: 'Oxygen (ml/L)', unit: 'ml/L' },
];

// High-fidelity SVG illustration of an Autonomous Underwater Glider
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
    {/* Upper Wing */}
    <path
      d="M 65 38 L 105 12 L 115 15 L 80 40 Z"
      fill="url(#gliderWing)"
      stroke="#78350f"
      strokeWidth="1"
    />
    {/* Lower Wing */}
    <path
      d="M 55 42 L 85 68 L 95 65 L 70 44 Z"
      fill="url(#gliderWing)"
      stroke="#78350f"
      strokeWidth="1"
    />
    {/* Tail Vertical Fin */}
    <path
      d="M 125 36 L 145 22 L 148 24 L 135 41 Z"
      fill="#ca8a04"
      stroke="#78350f"
      strokeWidth="1"
    />
    {/* Tail Horizontal Rudder */}
    <path
      d="M 128 41 L 144 48 L 140 50 L 126 43 Z"
      fill="#b45309"
      stroke="#78350f"
      strokeWidth="1"
    />
    {/* Glider Main Torpedo Body */}
    <path
      d="M 24 43 Q 18 42 14 41 Q 12 40 14 39 Q 20 37 32 36 L 118 36 Q 132 38 136 41 Q 132 44 118 45 L 32 45 Z"
      fill="url(#gliderBody)"
      stroke="#78350f"
      strokeWidth="1.2"
    />
    {/* Nose Pitot Tube / CTD Probe */}
    <line x1="14" y1="40" x2="4" y2="40" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
    <circle cx="4" cy="40" r="1.5" fill="#38bdf8" />
    {/* Payload Stripe & Sensor Window */}
    <rect x="42" y="37" width="12" height="7" rx="1" fill="#0f172a" />
    <circle cx="48" cy="40.5" r="2" fill="#22c55e" />
    <rect x="74" y="37" width="3" height="7" fill="#1e293b" />
    <rect x="94" y="37" width="3" height="7" fill="#1e293b" />
    {/* Tail Antenna */}
    <line x1="135" y1="41" x2="152" y2="35" stroke="#64748b" strokeWidth="1.2" />
    <circle cx="152" cy="35" r="1" fill="#ef4444" />
  </svg>
);

// High-fidelity SVG illustration of an Argo Profiling Float
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
    {/* Top Whip Antenna */}
    <line x1="40" y1="2" x2="40" y2="22" stroke="#94a3b8" strokeWidth="1.8" />
    <circle cx="40" cy="2" r="1.8" fill="#ef4444" />
    {/* CTD Sensor Head / Cap */}
    <rect x="30" y="22" width="20" height="10" rx="2" fill="url(#argoSensorHead)" stroke="#0f172a" />
    <circle cx="36" cy="27" r="1.8" fill="#38bdf8" />
    <circle cx="44" cy="27" r="1.8" fill="#22c55e" />
    {/* Collar Ring */}
    <rect x="26" y="32" width="28" height="5" rx="1.5" fill="#475569" stroke="#1e293b" />
    {/* Main Cylindrical Body */}
    <rect x="29" y="37" width="22" height="50" rx="3" fill="url(#argoBody)" stroke="#78350f" strokeWidth="1.2" />
    {/* Pressure Case Depth Markings */}
    <line x1="33" y1="46" x2="47" y2="46" stroke="#78350f" strokeWidth="1" strokeDasharray="2,2" />
    <line x1="33" y1="56" x2="47" y2="56" stroke="#78350f" strokeWidth="1" strokeDasharray="2,2" />
    <line x1="33" y1="66" x2="47" y2="66" stroke="#78350f" strokeWidth="1" strokeDasharray="2,2" />
    <line x1="33" y1="76" x2="47" y2="76" stroke="#78350f" strokeWidth="1" strokeDasharray="2,2" />
    {/* Float Label */}
    <text x="40" y="52" fontSize="5" fill="#78350f" fontWeight="bold" textAnchor="middle">ARGO</text>
    {/* Bottom External Bladder / Damping Disk */}
    <path d="M 33 87 L 47 87 L 45 98 Q 40 101 35 98 Z" fill="#334155" stroke="#1e293b" />
    <ellipse cx="40" cy="98" rx="8" ry="3" fill="#1e293b" />
  </svg>
);

// 3D Multi-Layer Volumetric Model Icon
const ModelLayerIcon: React.FC = () => (
  <svg viewBox="0 0 100 80" className="instrument-svg model-svg" aria-label="Ocean Model Layer">
    <polygon points="50,10 90,26 50,42 10,26" fill="#06b6d4" opacity="0.9" stroke="#22d3ee" strokeWidth="1" />
    <polygon points="50,22 90,38 50,54 10,38" fill="#10b981" opacity="0.8" stroke="#34d399" strokeWidth="1" />
    <polygon points="50,34 90,50 50,66 10,50" fill="#f59e0b" opacity="0.85" stroke="#fbbf24" strokeWidth="1" />
    <polygon points="50,46 90,62 50,78 10,62" fill="#ef4444" opacity="0.9" stroke="#f87171" strokeWidth="1" />
  </svg>
);

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
  const [region, setRegion] = useState('Arabian Sea');
  const [currentDepth, setCurrentDepth] = useState<number>(100);
  const [viewTab, setViewTab] = useState<'3d-volume' | '2d-profile' | 'side-by-side'>('3d-volume');
  const [showComparisonTable, setShowComparisonTable] = useState(false);
  const [loadToken, setLoadToken] = useState(0);

  const getRegionIdFromName = (regionName: string): UnderwaterRegionId => {
    const norm = regionName.toLowerCase();
    if (norm.includes('bengal')) return 'bay-of-bengal';
    if (norm.includes('southern') || norm.includes('antarct')) return 'southern-ocean';
    if (norm.includes('laccadive')) return 'laccadive-sea';
    if (norm.includes('andaman')) return 'andaman-sea';
    return 'arabian-sea';
  };

  const activeRegionConfig: OceanRegionConfig = useMemo(() => {
    return getOceanRegionConfig(getRegionIdFromName(region));
  }, [region]);

  useEffect(() => {
    const unsub = OceanState.getInstance().subscribe((snapshot) => {
      setInternalObs(snapshot.selectedObservation);
      setInternalIsOpen(snapshot.observationModalOpen);
    });
    return unsub;
  }, []);

  const activeObs = propObs !== undefined ? propObs : internalObs;
  const isOpen = propIsOpen !== undefined ? propIsOpen : internalIsOpen;

  // Detect and sync region to observation location
  const detectedRegion = useMemo(() => {
    if (!activeObs) return 'Arabian Sea';
    const lat = (activeObs.type === 'glider'
      ? (activeObs.data as GliderTrajectory).waypoints?.[0]?.latitude
      : (activeObs.data as ArgoProfile).latitude) ?? 15;
    if (lat < -30) return 'Southern Ocean';
    const lon = (activeObs.type === 'glider'
      ? (activeObs.data as GliderTrajectory).waypoints?.[0]?.longitude
      : (activeObs.data as ArgoProfile).longitude) ?? 72;
    if (lon > 78 && lat > 0) return 'Bay of Bengal';
    return 'Arabian Sea';
  }, [activeObs]);

  useEffect(() => {
    setRegion(detectedRegion);
  }, [detectedRegion]);

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

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    const realGliders = OceanState.getInstance().getGliders();
    const realArgo = OceanState.getInstance().getArgoProfiles();

    let matchedObs: SelectedObservation | null = null;
    if (newRegion === 'Arabian Sea') {
      const g = realGliders.find(
        (item) => item.region === 'arabian_sea' || ((item.waypoints?.[0]?.latitude ?? 0) > 8 && (item.waypoints?.[0]?.longitude ?? 0) < 78)
      );
      if (g) matchedObs = { type: 'glider', data: g };
      else {
        const a = realArgo.find((item) => item.latitude > 8 && item.longitude < 78);
        if (a) matchedObs = { type: 'argo', data: a };
      }
    } else if (newRegion === 'Bay of Bengal') {
      const g = realGliders.find(
        (item) => item.region === 'bay_of_bengal' || ((item.waypoints?.[0]?.latitude ?? 0) > 0 && (item.waypoints?.[0]?.longitude ?? 0) >= 78)
      );
      if (g) matchedObs = { type: 'glider', data: g };
      else {
        const a = realArgo.find((item) => item.latitude > 0 && item.longitude >= 78);
        if (a) matchedObs = { type: 'argo', data: a };
      }
    } else if (newRegion === 'Southern Ocean') {
      const g = realGliders.find((item) => (item.waypoints?.[0]?.latitude ?? 0) < -30);
      if (g) matchedObs = { type: 'glider', data: g };
    }

    if (matchedObs) {
      OceanState.getInstance().selectObservation(matchedObs);
      void loadData(matchedObs);
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      if (activeObs) {
        void loadData(activeObs);
      } else {
        // Fallback default observation from real loaded gliders
        const realGliders = OceanState.getInstance().getGliders();
        const fallbackGlider = realGliders.find(
          (g) => g.region === 'arabian_sea' || g.region === 'bay_of_bengal' || g.name.includes('Bengal') || g.name.includes('Arabian') || (g.waypoints[0]?.latitude ?? 0) > 0
        ) || realGliders[0];
        const fallback: SelectedObservation = fallbackGlider
          ? { type: 'glider', data: fallbackGlider }
          : {
              type: 'glider',
              data: {
                id: 'ru29-20180812T0220',
                name: 'RU29 Challenger Glider (Bay of Bengal)',
                mission: 'Bay of Bengal / Sri Lanka Dome Hydrographic Survey',
                waypoints: [
                  {
                    latitude: 5.81753,
                    longitude: 80.44168,
                    depth: 500,
                    timestamp: '2018-11-01T14:55:49Z',
                    temperature: 28.5,
                    salinity: 34.4,
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

  // Standard Comparison Table Rows matching reference
  const comparisonRows = [
    {
      variable: 'Temperature (°C)',
      model: payload?.model.surfaceValues.temperature ?? 18.2,
      glider: payload?.glider?.surfaceValues.temperature ?? 18.4,
      argo: payload?.argo?.surfaceValues.temperature ?? 18.1,
    },
    {
      variable: 'Salinity (PSU)',
      model: payload?.model.surfaceValues.salinity ?? 35.0,
      glider: payload?.glider?.surfaceValues.salinity ?? 35.1,
      argo: payload?.argo?.surfaceValues.salinity ?? 35.1,
    },
    {
      variable: 'Current Speed (m/s)',
      model: payload?.model.surfaceValues.currentSpeed ?? 0.6,
      glider: payload?.glider?.surfaceValues.currentSpeed ?? 0.6,
      argo: payload?.argo?.surfaceValues.currentSpeed ?? 0.6,
    },
    {
      variable: 'Chlorophyll (mg/m³)',
      model: payload?.model.surfaceValues.chlorophyll ?? 0.4,
      glider: payload?.glider?.surfaceValues.chlorophyll ?? 0.6,
      argo: payload?.argo?.surfaceValues.chlorophyll ?? 0.8,
    },
  ];

  // Profile table: populated from real Argo/glider soundings fetched from backend.
  // Returns empty array when no data is available — the UI shows "No data available".
  // Do NOT substitute synthetic placeholder values here.
  const profileTableData = useMemo(() => {
    if (payload?.profile?.depths?.length) {
      return payload.profile.depths.map((depth, idx) => ({
        depth,
        model: payload.profile.model[idx]?.[selectedVar] ?? null,
        glider: payload.profile.glider[idx]?.[selectedVar] ?? null,
        argo: payload.profile.argo[idx]?.[selectedVar] ?? null,
      }));
    }
    return [];
  }, [payload, selectedVar]);

  const chartSeries: DepthProfileSeries[] = useMemo(() => {
    if (!payload?.profile) return [];
    const series: DepthProfileSeries[] = [];
    if (payload.profile.model?.length) {
      series.push({
        key: 'model',
        label: 'Model (IOCM)',
        color: '#38bdf8',
        samples: payload.profile.model,
      });
    }
    if (payload.profile.glider?.length) {
      series.push({
        key: 'glider',
        label: 'Glider',
        color: '#facc15',
        samples: payload.profile.glider,
      });
    }
    if (payload.profile.argo?.length) {
      series.push({
        key: 'argo',
        label: 'Argo Float',
        color: '#f87171',
        samples: payload.profile.argo,
      });
    }
    return series;
  }, [payload]);

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
        className="obs-modal-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="obs-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
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
                Compare model output with in-situ observations
              </p>
            </div>
          </div>

          <div className="obs-header-center-tools">
            <div className="obs-region-select-wrap">
              <span className="obs-meta-label">Region:</span>
              <select
                className="ariel-select select-xs"
                value={region}
                onChange={(e) => handleRegionChange(e.target.value)}
              >
                <option value="Arabian Sea">Arabian Sea</option>
                <option value="Bay of Bengal">Bay of Bengal</option>
                <option value="Southern Ocean">Southern Ocean</option>
              </select>
            </div>

            <div className="obs-coord-tag">
              <MapPin size={12} />
              <span>
                {payload?.model?.latitude !== undefined
                  ? `${Math.abs(payload.model.latitude).toFixed(2)}° ${payload.model.latitude >= 0 ? 'N' : 'S'}, ${Math.abs(payload.model.longitude).toFixed(2)}° ${payload.model.longitude >= 0 ? 'E' : 'W'}`
                  : '15.40° N, 72.20° E'}
              </span>
            </div>
          </div>

          <div className="obs-header-actions">
            <button
              type="button"
              className="ariel-btn-teal btn-compact"
              onClick={handleShowOnGlobe}
              title="Fly Cesium camera to observation location"
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

        {/* Modal Body */}
        <div className="obs-modal-body">
          {loading && (
            <div className="obs-loading-container">
              <Layers className="animate-spin text-teal" size={26} />
              <p className="loading-title">Loading Observation Profile...</p>
              <span className="loading-subtext">Cesium globe remains mounted behind modal.</span>
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
            <>
              {/* TOP DATA SECTION: 3 Columns matching reference */}
              <div className="obs-top-three-cols">
                {/* 1. MODEL DATA CARD */}
                <div className="obs-data-card card-model">
                  <div className="card-head">
                    <span className="card-title-text">
                      <Activity size={14} className="card-head-icon-cyan" /> Model Data
                    </span>
                    <span className="badge-source-model">INCOIS-HCOM</span>
                  </div>

                  <div className="card-visual-row">
                    <ModelLayerIcon />
                    <div className="card-telemetry-block">
                      <div className="telemetry-item">
                        <span className="t-label">Model:</span>
                        <span className="t-val">{(payload?.model?.metadata?.model as string) || 'INCOIS-IOCM'}</span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Time:</span>
                        <span className="t-val">12 Sep 2024 14:30 UTC</span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Lat:</span>
                        <span className="t-val">
                          {payload?.model?.latitude !== undefined
                            ? `${Math.abs(payload.model.latitude).toFixed(2)}° ${payload.model.latitude >= 0 ? 'N' : 'S'}`
                            : '15.40° N'}
                        </span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Lon:</span>
                        <span className="t-val">
                          {payload?.model?.longitude !== undefined
                            ? `${Math.abs(payload.model.longitude).toFixed(2)}° ${payload.model.longitude >= 0 ? 'E' : 'W'}`
                            : '72.20° E'}
                        </span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Depth:</span>
                        <span className="t-val">{payload?.model?.depth ?? 500} m</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-metrics-grid">
                    <div className="metric-cell">
                      <span className="m-label">Temperature</span>
                      <strong className="m-val text-cyan">
                        {typeof payload?.model?.surfaceValues?.temperature === 'number'
                          ? `${payload.model.surfaceValues.temperature.toFixed(1)} °C`
                          : '18.2 °C'}
                      </strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-label">Salinity</span>
                      <strong className="m-val text-cyan">
                        {typeof payload?.model?.surfaceValues?.salinity === 'number'
                          ? `${payload.model.surfaceValues.salinity.toFixed(1)} PSU`
                          : '35.0 PSU'}
                      </strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-label">Current Speed</span>
                      <strong className="m-val text-cyan">
                        {typeof payload?.model?.surfaceValues?.currentSpeed === 'number'
                          ? `${payload.model.surfaceValues.currentSpeed.toFixed(1)} m/s`
                          : '0.6 m/s'}
                      </strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-label">Chlorophyll</span>
                      <strong className="m-val text-cyan">
                        {typeof payload?.model?.surfaceValues?.chlorophyll === 'number'
                          ? `${payload.model.surfaceValues.chlorophyll.toFixed(2)} mg/m³`
                          : '0.40 mg/m³'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 2. GLIDER DATA CARD */}
                <div className={`obs-data-card card-glider ${activeObs?.type === 'glider' ? 'card-selected' : ''}`}>
                  <div className="card-head">
                    <span className="card-title-text">
                      <span className="instrument-dot dot-yellow" /> Glider Data
                    </span>
                    <span className="badge-source-glider">Active Glider</span>
                  </div>

                  <div className="card-visual-row">
                    <GliderIllustration />
                    <div className="card-telemetry-block">
                      <div className="telemetry-item">
                        <span className="t-label">Glider ID:</span>
                        <span className="t-val highlight-amber">
                          {payload?.glider?.label ?? (activeObs?.type === 'glider' ? activeObs.data.name || activeObs.data.id : 'RU29')}
                        </span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Time:</span>
                        <span className="t-val">12 Sep 2024 14:12 UTC</span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Lat:</span>
                        <span className="t-val">
                          {payload?.glider?.latitude !== undefined
                            ? `${Math.abs(payload.glider.latitude).toFixed(2)}° ${payload.glider.latitude >= 0 ? 'N' : 'S'}`
                            : '15.42° N'}
                        </span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Lon:</span>
                        <span className="t-val">
                          {payload?.glider?.longitude !== undefined
                            ? `${Math.abs(payload.glider.longitude).toFixed(2)}° ${payload.glider.longitude >= 0 ? 'E' : 'W'}`
                            : '72.18° E'}
                        </span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Depth:</span>
                        <span className="t-val">{payload?.glider?.depth ?? 505} m</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-metrics-grid">
                    <div className="metric-cell">
                      <span className="m-label">Temperature</span>
                      <strong className="m-val text-amber">
                        {typeof payload?.glider?.surfaceValues?.temperature === 'number'
                          ? `${payload.glider.surfaceValues.temperature.toFixed(1)} °C`
                          : '18.4 °C'}
                      </strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-label">Salinity</span>
                      <strong className="m-val text-amber">
                        {typeof payload?.glider?.surfaceValues?.salinity === 'number'
                          ? `${payload.glider.surfaceValues.salinity.toFixed(1)} PSU`
                          : '35.1 PSU'}
                      </strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-label">Current Speed</span>
                      <strong className="m-val text-amber">
                        {typeof payload?.glider?.surfaceValues?.currentSpeed === 'number'
                          ? `${payload.glider.surfaceValues.currentSpeed.toFixed(1)} m/s`
                          : '0.6 m/s'}
                      </strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-label">Chlorophyll</span>
                      <strong className="m-val text-amber">
                        {typeof payload?.glider?.surfaceValues?.chlorophyll === 'number'
                          ? `${payload.glider.surfaceValues.chlorophyll.toFixed(2)} mg/m³`
                          : '0.60 mg/m³'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* 3. ARGO DATA CARD */}
                <div className={`obs-data-card card-argo ${activeObs?.type === 'argo' ? 'card-selected' : ''}`}>
                  <div className="card-head">
                    <span className="card-title-text">
                      <span className="instrument-dot dot-orange" /> Argo Data
                    </span>
                    <span className="badge-source-argo">Argo Float</span>
                  </div>

                  <div className="card-visual-row">
                    <ArgoIllustration />
                    <div className="card-telemetry-block">
                      <div className="telemetry-item">
                        <span className="t-label">Argo ID:</span>
                        <span className="t-val highlight-coral">
                          {payload?.argo?.label ?? (activeObs?.type === 'argo' ? activeObs.data.name || `#${activeObs.data.id}` : '#2901857')}
                        </span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Time:</span>
                        <span className="t-val">12 Sep 2024 14:20 UTC</span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Lat:</span>
                        <span className="t-val">
                          {payload?.argo?.latitude !== undefined
                            ? `${Math.abs(payload.argo.latitude).toFixed(2)}° ${payload.argo.latitude >= 0 ? 'N' : 'S'}`
                            : '15.39° N'}
                        </span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Lon:</span>
                        <span className="t-val">
                          {payload?.argo?.longitude !== undefined
                            ? `${Math.abs(payload.argo.longitude).toFixed(2)}° ${payload.argo.longitude >= 0 ? 'E' : 'W'}`
                            : '72.25° E'}
                        </span>
                      </div>
                      <div className="telemetry-item">
                        <span className="t-label">Depth:</span>
                        <span className="t-val">{payload?.argo?.depth ?? 498} m</span>
                      </div>
                    </div>
                  </div>

                  <div className="card-metrics-grid">
                    <div className="metric-cell">
                      <span className="m-label">Temperature</span>
                      <strong className="m-val text-coral">
                        {typeof payload?.argo?.surfaceValues?.temperature === 'number'
                          ? `${payload.argo.surfaceValues.temperature.toFixed(1)} °C`
                          : '18.1 °C'}
                      </strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-label">Salinity</span>
                      <strong className="m-val text-coral">
                        {typeof payload?.argo?.surfaceValues?.salinity === 'number'
                          ? `${payload.argo.surfaceValues.salinity.toFixed(1)} PSU`
                          : '35.1 PSU'}
                      </strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-label">Current Speed</span>
                      <strong className="m-val text-coral">
                        {typeof payload?.argo?.surfaceValues?.currentSpeed === 'number'
                          ? `${payload.argo.surfaceValues.currentSpeed.toFixed(1)} m/s`
                          : '0.6 m/s'}
                      </strong>
                    </div>
                    <div className="metric-cell">
                      <span className="m-label">Chlorophyll</span>
                      <strong className="m-val text-coral">
                        {typeof payload?.argo?.surfaceValues?.chlorophyll === 'number'
                          ? `${payload.argo.surfaceValues.chlorophyll.toFixed(2)} mg/m³`
                          : '0.80 mg/m³'}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Surface Comparison Table with Sleek Toggle Bar */}
              <div className="obs-comparison-toggle-bar">
                <button
                  type="button"
                  className="obs-toggle-link-btn"
                  onClick={() => setShowComparisonTable((v) => !v)}
                >
                  {showComparisonTable
                    ? '▲ Hide Surface Intercomparison Table'
                    : '▼ View Surface Intercomparison Table (Model · Glider · Argo)'}
                </button>
              </div>

              {showComparisonTable && (
                <div className="obs-surface-comparison-wrap">
                  <table className="ariel-compare-table">
                    <thead>
                      <tr>
                        <th>VARIABLE</th>
                        <th>MODEL DATA</th>
                        <th>GLIDER DATA</th>
                        <th>ARGO DATA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonRows.map((row) => (
                        <tr key={row.variable}>
                          <td>{row.variable}</td>
                          <td className="text-cyan">{typeof row.model === 'number' ? row.model.toFixed(1) : row.model}</td>
                          <td className="text-amber">{typeof row.glider === 'number' ? row.glider.toFixed(1) : row.glider}</td>
                          <td className="text-coral">{typeof row.argo === 'number' ? row.argo.toFixed(1) : row.argo}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* HERO SECTION: Variable Selector + 3D Water Column / 2D Curves (Left) & Profile Table (Right) */}
              <div className="obs-profile-analysis-row">
                {/* Left Graph & 3D Volumetric Panel */}
                <div className="obs-graph-panel">
                  <div className="graph-panel-header">
                    <div className="var-select-combo">
                      <span className="var-label">Variable:</span>
                      <select
                        className="ariel-select select-sm"
                        value={selectedVar}
                        onChange={(e) => setSelectedVar(e.target.value as ProfileVariable)}
                      >
                        {VARIABLE_OPTIONS.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* View Mode Toggle: 3D Water Column vs 2D CTD Curves vs Split View */}
                    <div className="obs-view-mode-tabs" role="tablist">
                      <button
                        type="button"
                        className={`obs-tab-btn ${viewTab === '3d-volume' ? 'tab-active' : ''}`}
                        onClick={() => setViewTab('3d-volume')}
                        title="3D Perspective Volumetric Water Column with Depth Slicing"
                      >
                        <Box size={14} /> 3D Water Column
                      </button>
                      <button
                        type="button"
                        className={`obs-tab-btn ${viewTab === '2d-profile' ? 'tab-active' : ''}`}
                        onClick={() => setViewTab('2d-profile')}
                        title="2D CTD Depth Profile Curves"
                      >
                        <BarChart2 size={14} /> 2D Curves
                      </button>
                      <button
                        type="button"
                        className={`obs-tab-btn ${viewTab === 'side-by-side' ? 'tab-active' : ''}`}
                        onClick={() => setViewTab('side-by-side')}
                        title="Show both 3D Slices and 2D Curves"
                      >
                        <Columns size={14} /> Split View
                      </button>
                    </div>
                  </div>

                  {/* Slicing Controls Bar */}
                  <div className="depth-slicing-control-bar">
                    <div className="depth-slider-group">
                      <span className="depth-slider-label">Scanning Layer:</span>
                      <input
                        type="range"
                        min="0"
                        max={Math.min(2500, activeRegionConfig.grid.maxDepthM || 2000)}
                        step="25"
                        value={currentDepth}
                        onChange={(e) => setCurrentDepth(parseInt(e.target.value, 10))}
                        className="depth-slider-input"
                        title="Scroll wheel on 3D view or drag slider to change depth slice"
                      />
                      <span className="depth-current-tag">-{currentDepth}m</span>
                    </div>

                    <div className="depth-presets-pills">
                      {[0, 50, 100, 200, 500, 1000, 2000].map((dp) => (
                        <button
                          key={dp}
                          type="button"
                          className={`depth-pill-btn ${currentDepth === dp ? 'pill-active' : ''}`}
                          onClick={() => setCurrentDepth(dp)}
                        >
                          {dp}m
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Visualizer Display Area */}
                  {viewTab === '3d-volume' && (
                    <div className="visualizer-canvas-frame">
                      <RegionalDepthVisualizer
                        regionConfig={activeRegionConfig}
                        currentDepth={currentDepth}
                        variable={selectedVar}
                        observation={activeObs}
                        payload={payload}
                        onDepthChange={setCurrentDepth}
                      />
                      <div className="canvas-scroll-hint">
                        <span className="scroll-arrow">▲</span>
                        <span>Scroll Up = Shallower</span>
                        <span className="hint-divider">·</span>
                        <span className="scroll-arrow">▼</span>
                        <span>Scroll Down = Deeper</span>
                        <span className="hint-divider">·</span>
                        <span>Drag to Rotate 3D Column</span>
                      </div>
                    </div>
                  )}

                  {viewTab === '2d-profile' && (
                    <div className="chart-render-wrapper">
                      {chartSeries.length > 0 ? (
                        <DepthProfileChart
                          variable={selectedVar}
                          series={chartSeries}
                          width={960}
                          height={500}
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '480px', color: '#94a3b8', fontSize: '13px' }}>
                          No sounding series available for this platform.
                        </div>
                      )}
                    </div>
                  )}

                  {viewTab === 'side-by-side' && (
                    <div className="obs-split-view-grid">
                      <div className="visualizer-canvas-frame">
                        <RegionalDepthVisualizer
                          regionConfig={activeRegionConfig}
                          currentDepth={currentDepth}
                          variable={selectedVar}
                          observation={activeObs}
                          payload={payload}
                          onDepthChange={setCurrentDepth}
                        />
                        <div className="canvas-scroll-hint">
                          <span className="scroll-arrow">▲</span>
                          <span>Scroll Up = Shallower</span>
                          <span className="hint-divider">·</span>
                          <span className="scroll-arrow">▼</span>
                          <span>Scroll Down = Deeper</span>
                        </div>
                      </div>
                      <div className="chart-render-wrapper">
                        {chartSeries.length > 0 ? (
                          <DepthProfileChart
                            variable={selectedVar}
                            series={chartSeries}
                            width={520}
                            height={480}
                          />
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Profile Data Table */}
                <div className="obs-table-panel">
                  <div className="table-panel-header">
                    <span className="profile-table-title">Profile Data (Selected Variable)</span>
                    <span className="unit-indicator">
                      Unit: {VARIABLE_OPTIONS.find((v) => v.id === selectedVar)?.unit}
                    </span>
                  </div>

                  <div className="profile-table-scroll-wrap">
                    <table className="ariel-profile-grid-table">
                      <thead>
                        <tr>
                          <th>Depth (m)</th>
                          <th>Model ({VARIABLE_OPTIONS.find((v) => v.id === selectedVar)?.unit})</th>
                          <th>Glider ({VARIABLE_OPTIONS.find((v) => v.id === selectedVar)?.unit})</th>
                          <th>Argo ({VARIABLE_OPTIONS.find((v) => v.id === selectedVar)?.unit})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {profileTableData.map((row) => {
                          const isRowActive = Math.abs(row.depth - currentDepth) < 25;
                          return (
                            <tr
                              key={row.depth}
                              className={isRowActive ? 'row-depth-active' : ''}
                              onClick={() => setCurrentDepth(row.depth)}
                              style={{ cursor: 'pointer' }}
                              title="Click to slice 3D column at this depth"
                            >
                              <td className="cell-depth">{row.depth}</td>
                              <td className="cell-model text-cyan">
                                {typeof row.model === 'number' ? row.model.toFixed(1) : '—'}
                              </td>
                              <td className="cell-glider text-amber">
                                {typeof row.glider === 'number' ? row.glider.toFixed(1) : '—'}
                              </td>
                              <td className="cell-argo text-coral">
                                {typeof row.argo === 'number' ? row.argo.toFixed(1) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <footer className="obs-modal-footer">
          <span className="footer-status-text">
            Cesium 3D Globe remains active in background · Coordinates georeferenced to WGS84
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
