import React, { useState, useEffect, useCallback, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Play,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  ShieldAlert,
  Globe,
  Grid,
  Compass,
  Crosshair,
  Sliders,
  Info,
  MapPin,
} from 'lucide-react';
import type {
  HazardRegionResult,
  HazardGridData,
  HazardLayer,
  ProvenanceMetadata,
} from '../../types/hazard';
import {
  fetchHazardLayers,
  fetchHazardGrid,
  runHazardAnalysis,
} from '../../services/hazardService';
import { GeospatialRasterMap } from '../Geospatial/GeospatialRasterMap';
import { ProvenanceCard } from '../Geospatial/ProvenanceCard';
import type { OceanEngine } from '../../ocean/OceanEngine';
import { HazardGlobeLayer, SUB_BASIN_COORDINATES } from '../../ocean/layers/HazardGlobeLayer';

interface HazardAssessmentViewProps {
  engine?: OceanEngine | null;
}

const REGION_OPTIONS = [
  { value: 'Arabian Sea', label: 'Arabian Sea (West Coast / Pelagic)' },
  { value: 'Bay of Bengal', label: 'Bay of Bengal (East Coast / Pelagic)' },
  { value: 'Southern Ocean', label: 'Southern Ocean (Subantarctic Front)' },
  { value: 'Indian Ocean', label: 'All Project Basins (Indian Ocean Overview)' },
];

const VARIABLE_OPTIONS = [
  { value: 'Current Speed (m/s)', label: 'Current Speed (m/s)', unit: 'm/s', defaultThresh: 1.5, min: 0.1, max: 4.0, step: 0.1 },
  { value: 'Significant Wave Height (m)', label: 'Significant Wave Height (m)', unit: 'm', defaultThresh: 3.0, min: 0.5, max: 10.0, step: 0.5 },
  { value: 'Sea Surface Height Anomaly (m)', label: 'Sea Surface Height Anomaly (m)', unit: 'm', defaultThresh: 0.25, min: -0.5, max: 1.0, step: 0.05 },
  { value: 'Thermal Stress Index', label: 'Thermal Stress Index (°C-weeks)', unit: 'DHW', defaultThresh: 4.0, min: 1.0, max: 16.0, step: 1.0 },
];

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorText: string;
}

class HazardErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorText: error?.message || 'Unexpected UI rendering error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Hazard Assessment rendering error caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorText: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="hazard-operational-layout" style={{ pointerEvents: 'auto', padding: '30px' }}>
          <div className="ops-alert-banner ops-alert-error" style={{ margin: '30px auto', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertOctagon size={20} />
              <div>
                <strong style={{ display: 'block', color: '#fff' }}>Hazard Assessment Recovered</strong>
                <span>{this.state.errorText}</span>
              </div>
            </div>
            <button type="button" className="ops-alert-retry-btn" onClick={this.handleReload}>
              <RefreshCw size={12} /> Reload View
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const HazardAssessmentView: React.FC<HazardAssessmentViewProps> = (props) => {
  return (
    <HazardErrorBoundary>
      <HazardAssessmentInner {...props} />
    </HazardErrorBoundary>
  );
};

const HazardAssessmentInner: React.FC<HazardAssessmentViewProps> = ({ engine }) => {
  const [layers, setLayers] = useState<HazardLayer[]>([]);
  const [variable, setVariable] = useState('Current Speed (m/s)');
  const [region, setRegion] = useState('Arabian Sea');
  const [threshold, setThreshold] = useState('1.5');
  const [unit, setUnit] = useState<string>('m/s');

  const [analyzing, setAnalyzing] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analytical state from backend
  const [hazardRegions, setHazardRegions] = useState<HazardRegionResult[]>([]);
  const [gridData, setGridData] = useState<HazardGridData | null>(null);
  const [provenanceMeta, setProvenanceMeta] = useState<ProvenanceMetadata | null>(null);
  const [totalAreaExceeded, setTotalAreaExceeded] = useState<number>(0);
  const [peakValue, setPeakValue] = useState<number>(0);

  // 3D Visualization Controls & Interactions
  const [viewMode, setViewMode] = useState<'3d-globe' | '2d-matrix'>('3d-globe');
  const [globeOpacity, setGlobeOpacity] = useState<number>(0.75);
  const [showAnomalyOverlay, setShowAnomalyOverlay] = useState(true);
  const [showSectorBoundaries, setShowSectorBoundaries] = useState(true);
  const [selectedSector, setSelectedSector] = useState<HazardRegionResult | null>(null);
  const [palette, setPalette] = useState<'turbo' | 'viridis' | 'ocean' | 'magma'>('turbo');
  const [filterRisk, setFilterRisk] = useState<'ALL' | 'CRITICAL' | 'HIGH+'>('ALL');

  // Dedicated 3D Globe Layer instance
  const hazardGlobeLayerRef = useRef<HazardGlobeLayer | null>(null);

  // Load configured hazard layers on mount
  useEffect(() => {
    fetchHazardLayers()
      .then((fetchedLayers) => {
        if (fetchedLayers && fetchedLayers.length > 0) {
          setLayers(fetchedLayers);
        }
      })
      .catch((err) => {
        console.warn('Could not load hazard layers configuration:', err);
      });
  }, []);

  // Initialize and bind HazardGlobeLayer to Cesium
  useEffect(() => {
    if (!engine) return;
    const viewer = engine.getViewer();
    if (!viewer || viewer.isDestroyed()) return;

    const layer = new HazardGlobeLayer(viewer);
    hazardGlobeLayerRef.current = layer;

    layer.setOnSelectSector((sector) => {
      setSelectedSector(sector);
    });

    // Fly camera initially to selected basin
    layer.flyToBasin(region);

    return () => {
      layer.destroy();
      hazardGlobeLayerRef.current = null;
    };
  }, [engine]);

  // Update threshold parameters when variable changes
  const handleVariableChange = (newVar: string) => {
    setVariable(newVar);
    const matched = layers.find((l) => l.name === newVar || l.id === newVar);
    if (matched) {
      setThreshold(matched.default_threshold.toString());
      setUnit(matched.unit);
    } else {
      const preset = VARIABLE_OPTIONS.find((v) => v.value === newVar);
      if (preset) {
        setThreshold(preset.defaultThresh.toString());
        setUnit(preset.unit);
      } else {
        setThreshold('1.5');
        setUnit('m/s');
      }
    }
  };

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    setSelectedSector(null);
    if (hazardGlobeLayerRef.current) {
      hazardGlobeLayerRef.current.flyToBasin(newRegion);
    }
  };

  // Run full quantitative geodesic hazard analysis and fetch spatial grid
  const executeAnalysis = useCallback(async () => {
    setAnalyzing(true);
    setGridLoading(true);
    setError(null);

    const threshVal = parseFloat(threshold) || 1.5;

    try {
      // 1. Run analysis for analytical table
      const analysisPromise = runHazardAnalysis({
        variable,
        threshold: threshVal,
        region,
      });

      // 2. Fetch spatial raster grid for map visualization
      const gridPromise = fetchHazardGrid(variable, region, threshVal);

      const [analysisResp, gridResp] = await Promise.all([analysisPromise, gridPromise]);

      const regions = analysisResp.regions || [];
      setHazardRegions(regions);

      const totalExceeded =
        analysisResp.total_area_exceeded_km2 ??
        (analysisResp as unknown as { total_exceedance_area_km2?: number }).total_exceedance_area_km2 ??
        0;
      setTotalAreaExceeded(totalExceeded);

      const maxVal =
        analysisResp.max_value ??
        (analysisResp as unknown as { max_value_raw?: number }).max_value_raw ??
        0;
      setPeakValue(maxVal);

      setUnit(analysisResp.unit || 'm/s');
      setProvenanceMeta(analysisResp.provenance_meta || null);
      setGridData(gridResp);

      // Render onto 3D Cesium Globe
      if (hazardGlobeLayerRef.current) {
        hazardGlobeLayerRef.current.renderSectors(regions, selectedSector?.region_id);
        if (showAnomalyOverlay) {
          hazardGlobeLayerRef.current.renderHazardGrid(gridResp, globeOpacity, threshVal);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operational data provider unavailable';
      setError(msg);
      setHazardRegions([]);
      setGridData(null);
    } finally {
      setAnalyzing(false);
      setGridLoading(false);
    }
  }, [variable, threshold, region, showAnomalyOverlay, globeOpacity]);

  // Initial load
  useEffect(() => {
    executeAnalysis();
  }, [executeAnalysis]);

  // Sync 3D Globe Layer when opacity or toggles change
  useEffect(() => {
    if (!hazardGlobeLayerRef.current) return;

    if (showSectorBoundaries) {
      hazardGlobeLayerRef.current.renderSectors(hazardRegions, selectedSector?.region_id);
    } else {
      hazardGlobeLayerRef.current.renderSectors([], null);
    }

    if (showAnomalyOverlay && gridData) {
      hazardGlobeLayerRef.current.renderHazardGrid(
        gridData,
        globeOpacity,
        parseFloat(threshold) || null
      );
    } else {
      hazardGlobeLayerRef.current.setGridOpacity(0);
    }
  }, [globeOpacity, showAnomalyOverlay, showSectorBoundaries, gridData, hazardRegions, selectedSector, threshold]);

  // Fly to specific sector hotspot
  const handleFocusSector = (sector: HazardRegionResult) => {
    setSelectedSector(sector);
    if (hazardGlobeLayerRef.current) {
      const secKey = sector.region_id || sector.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const coords = SUB_BASIN_COORDINATES[secKey];
      if (coords) {
        hazardGlobeLayerRef.current.flyToSector(coords.lat, coords.lon, 1200000);
      }
      hazardGlobeLayerRef.current.renderSectors(hazardRegions, sector.region_id || sector.name);
    }
  };

  const handleResetCamera = () => {
    if (hazardGlobeLayerRef.current) {
      hazardGlobeLayerRef.current.flyToBasin(region);
    } else if (engine) {
      engine.resetView();
    }
  };

  // Determine overall risk tier
  const hasCritical = hazardRegions.some((r) => r.risk_level === 'CRITICAL');
  const hasElevated = hazardRegions.some((r) => r.risk_level === 'HIGH');
  const maxRisk = hasCritical ? 'CRITICAL' : hasElevated ? 'HIGH' : hazardRegions.length > 0 ? 'NORMAL' : 'MONITORED';

  const filteredRegions = hazardRegions.filter((r) => {
    if (filterRisk === 'CRITICAL') return r.risk_level === 'CRITICAL';
    if (filterRisk === 'HIGH+') return r.risk_level === 'CRITICAL' || r.risk_level === 'HIGH';
    return true;
  });

  const activePreset = VARIABLE_OPTIONS.find((v) => v.value === variable);

  return (
    <div className="hazard-operational-layout">
      {/* Top Operations Command Bar */}
      <div className="hazard-top-bar">
        <div className="hazard-top-left">
          <div className="hazard-brand-badge">
            <ShieldAlert size={16} className={hasCritical ? 'text-red-500 animate-pulse' : 'text-amber-400'} />
            <div className="brand-badge-info">
              <span className="brand-title">OCEAN-X // MARINE HAZARD ASSESSMENT</span>
              <span className="brand-mode-pill">3D DIGITAL TWIN GLOBE</span>
            </div>
          </div>

          <div className="hazard-selectors">
            <div className="hazard-field">
              <label>Ocean Variable</label>
              <select
                className="hazard-select"
                value={variable}
                onChange={(e) => handleVariableChange(e.target.value)}
                disabled={analyzing}
              >
                {VARIABLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="hazard-field">
              <label>Basin Scope</label>
              <select
                className="hazard-select"
                value={region}
                onChange={(e) => handleRegionChange(e.target.value)}
                disabled={analyzing}
              >
                {REGION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="hazard-field">
              <label>Threshold ({unit})</label>
              <input
                type="number"
                step={activePreset?.step || '0.1'}
                className="hazard-input"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                disabled={analyzing}
              />
            </div>
          </div>
        </div>

        <div className="hazard-top-right">
          {/* View Mode Switcher */}
          <div className="hazard-mode-toggle">
            <button
              type="button"
              className={`hazard-toggle-btn ${viewMode === '3d-globe' ? 'active' : ''}`}
              onClick={() => setViewMode('3d-globe')}
              title="Interactive 3D Digital Twin Globe"
            >
              <Globe size={13} />
              <span>3D Ocean</span>
            </button>
            <button
              type="button"
              className={`hazard-toggle-btn ${viewMode === '2d-matrix' ? 'active' : ''}`}
              onClick={() => setViewMode('2d-matrix')}
              title="High-Resolution 2D Raster Matrix"
            >
              <Grid size={13} />
              <span>2D Matrix</span>
            </button>
          </div>

          <button
            type="button"
            className="hazard-btn-action"
            onClick={executeAnalysis}
            disabled={analyzing}
          >
            {analyzing ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Evaluating Grids...</span>
              </>
            ) : (
              <>
                <Play size={13} />
                <span>Run Marine Hazard Analysis</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="hazard-btn-reset-cam"
            onClick={handleResetCamera}
            title="Reset 3D Camera View to Basin"
          >
            <Compass size={14} />
          </button>
        </div>
      </div>

      {/* Operational Alert Banner if Provider Error */}
      {error && (
        <div className="hazard-alert-banner ops-alert-error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertOctagon size={16} />
            <div>
              <strong style={{ color: '#fff', marginRight: '6px' }}>Operational Data Stream:</strong>
              <span>{error}</span>
            </div>
          </div>
          <button type="button" className="ops-alert-retry-btn" onClick={executeAnalysis}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* 
        MAIN CONTENT BODY:
        - In '3d-globe' mode: Sleek floating glassmorphism panels overlaid on live Cesium Globe
        - In '2d-matrix' mode: High-resolution GIS 2D matrix inspection view
      */}
      {viewMode === '3d-globe' ? (
        <div className="hazard-workspace-panels">
          {/* Left Floating Panel: Parameters, Threshold Slider & 3D Layer Controls */}
          <aside className="ariel-panel hazard-panel-left" aria-label="Hazard Visualization Controls">
            <div className="panel-title-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sliders size={13} style={{ color: '#00f0ff' }} />
                <h2 className="panel-heading">Hazard Parameters</h2>
              </div>
              <span className="hazard-chip-indicator">L4 REAL-TIME</span>
            </div>

            <div className="panel-content-scroll">
              {/* Dynamic Overall Risk Status Box */}
              <div className={`hazard-status-box risk-${maxRisk.toLowerCase()}`}>
                <div className="status-box-header">
                  <span className="status-label">Basin Threat Level</span>
                  <span className={`status-badge badge-${maxRisk.toLowerCase()}`}>{maxRisk}</span>
                </div>
                <div className="status-desc">
                  {maxRisk === 'CRITICAL'
                    ? 'Extreme dynamic exceedance detected. High maritime hazard advisory.'
                    : maxRisk === 'HIGH'
                    ? 'Elevated threshold exceedance in sub-basin sectors. Monitor ship tracks.'
                    : 'Values within standard physical bounds. Continuous surveillance active.'}
                </div>
              </div>

              {/* Threshold Slider */}
              <div className="hazard-ctrl-section">
                <div className="ctrl-section-label">
                  <span>Physical Threshold ({unit})</span>
                  <strong style={{ color: '#00f0ff', fontFamily: 'var(--font-mono)' }}>{threshold} {unit}</strong>
                </div>
                <input
                  type="range"
                  min={activePreset?.min ?? 0.1}
                  max={activePreset?.max ?? 5.0}
                  step={activePreset?.step ?? 0.1}
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="hazard-range-slider"
                />
                <div className="slider-ticks">
                  <span>{activePreset?.min ?? 0.1}</span>
                  <span>Mid: {(((activePreset?.max ?? 5.0) + (activePreset?.min ?? 0.1)) / 2).toFixed(1)}</span>
                  <span>{activePreset?.max ?? 5.0}</span>
                </div>
              </div>

              {/* 3D Globe Layer Opacity */}
              <div className="hazard-ctrl-section">
                <div className="ctrl-section-label">
                  <span>3D Heat Overlay Opacity</span>
                  <span style={{ color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>{Math.round(globeOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={globeOpacity}
                  onChange={(e) => setGlobeOpacity(parseFloat(e.target.value))}
                  className="hazard-range-slider"
                />
              </div>

              {/* Colormap Selector */}
              <div className="hazard-ctrl-section">
                <div className="ctrl-section-label">
                  <span>Scientific Color Palette</span>
                </div>
                <div className="palette-preview-wrap">
                  <div className={`palette-strip palette-${palette}`} />
                  <select
                    className="ops-select"
                    style={{ width: '100%', marginTop: '6px' }}
                    value={palette}
                    onChange={(e) => setPalette(e.target.value as 'turbo' | 'viridis' | 'ocean' | 'magma')}
                  >
                    <option value="turbo">Turbo (Spectral Thermal)</option>
                    <option value="viridis">Viridis (Perceptually Uniform)</option>
                    <option value="ocean">Ocean Aqua (Depth Gradient)</option>
                    <option value="magma">Magma (High-Contrast Heat)</option>
                  </select>
                </div>
              </div>

              {/* Toggles */}
              <div className="hazard-ctrl-section">
                <div className="ctrl-section-label">
                  <span>3D Layer Toggles</span>
                </div>
                <label className="hazard-checkbox-label">
                  <input
                    type="checkbox"
                    checked={showAnomalyOverlay}
                    onChange={(e) => setShowAnomalyOverlay(e.target.checked)}
                  />
                  <span>Drape Exceedance Raster on Ocean Globe</span>
                </label>
                <label className="hazard-checkbox-label">
                  <input
                    type="checkbox"
                    checked={showSectorBoundaries}
                    onChange={(e) => setShowSectorBoundaries(e.target.checked)}
                  />
                  <span>Show 3D Sector Boundaries & Radar Beacons</span>
                </label>
              </div>

              {/* Basin Fly-To Quick Presets */}
              <div className="hazard-ctrl-section">
                <div className="ctrl-section-label">
                  <span>Quick Basin Navigation</span>
                </div>
                <div className="basin-quick-btn-grid">
                  <button type="button" className="basin-pill-btn" onClick={() => handleRegionChange('Arabian Sea')}>
                    Arabian Sea
                  </button>
                  <button type="button" className="basin-pill-btn" onClick={() => handleRegionChange('Bay of Bengal')}>
                    Bay of Bengal
                  </button>
                  <button type="button" className="basin-pill-btn" onClick={() => handleRegionChange('Southern Ocean')}>
                    Southern Ocean
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* Center Floating Callout: Selected Sector On-Globe Info */}
          {selectedSector && (
            <div className="hazard-center-inspector">
              <div className="inspector-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={14} style={{ color: '#ef4444' }} />
                  <span className="inspector-title">{selectedSector.name}</span>
                </div>
                <button
                  type="button"
                  className="inspector-close-btn"
                  onClick={() => setSelectedSector(null)}
                >
                  ✕
                </button>
              </div>
              <div className="inspector-grid">
                <div className="inspector-stat">
                  <span className="stat-label">Exceeded Area</span>
                  <span className="stat-val" style={{ color: '#f59e0b' }}>
                    {selectedSector.area_exceeded_km2 ? `${selectedSector.area_exceeded_km2.toLocaleString()} km²` : '0 km²'}
                  </span>
                </div>
                <div className="inspector-stat">
                  <span className="stat-label">Peak Recorded</span>
                  <span className="stat-val" style={{ color: '#00f0ff' }}>
                    {selectedSector.max_value ?? '--'} {unit}
                  </span>
                </div>
                <div className="inspector-stat">
                  <span className="stat-label">Basin Exceedance</span>
                  <span className="stat-val">
                    {selectedSector.exceedance_pct !== undefined
                      ? `${selectedSector.exceedance_pct.toFixed(1)}%`
                      : '0.0%'}
                  </span>
                </div>
                <div className="inspector-stat">
                  <span className="stat-label">Evaluated Risk</span>
                  <span className={`status-badge badge-${(selectedSector.risk_level || 'low').toLowerCase()}`}>
                    {selectedSector.risk_level || 'LOW'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Right Floating Panel: Sectors Table & Exceedance Analytics */}
          <aside className="ariel-panel hazard-panel-right" aria-label="Hazard Sectors & Analytics">
            <div className="panel-title-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={13} style={{ color: '#f59e0b' }} />
                <h2 className="panel-heading">Exceedance Analytics</h2>
              </div>
              <span className="hazard-chip-indicator">&gt; {threshold} {unit}</span>
            </div>

            <div className="panel-content-scroll">
              {/* Top Analytical KPI Mini Cards */}
              <div className="hazard-kpi-row">
                <div className="kpi-mini-card">
                  <div className="kpi-mini-label">Total Exceeded Area</div>
                  <div className="kpi-mini-val" style={{ color: totalAreaExceeded > 0 ? '#f59e0b' : '#10b981' }}>
                    {totalAreaExceeded > 0 ? `${totalAreaExceeded.toLocaleString()} km²` : '0 km²'}
                  </div>
                  <div className="kpi-mini-sub">Geodesic WGS84</div>
                </div>

                <div className="kpi-mini-card">
                  <div className="kpi-mini-label">Peak Observed</div>
                  <div className="kpi-mini-val" style={{ color: '#00f0ff' }}>
                    {peakValue ? `${peakValue} ${unit}` : `-- ${unit}`}
                  </div>
                  <div className="kpi-mini-sub">Active basin maximum</div>
                </div>
              </div>

              {/* Sectors Filter Toolbar */}
              <div className="sector-filter-bar">
                <span className="filter-title">BASIN SECTORS ({filteredRegions.length})</span>
                <div className="filter-btn-group">
                  <button
                    type="button"
                    className={`filter-tag-btn ${filterRisk === 'ALL' ? 'active' : ''}`}
                    onClick={() => setFilterRisk('ALL')}
                  >
                    ALL
                  </button>
                  <button
                    type="button"
                    className={`filter-tag-btn ${filterRisk === 'HIGH+' ? 'active' : ''}`}
                    onClick={() => setFilterRisk('HIGH+')}
                  >
                    HIGH+
                  </button>
                  <button
                    type="button"
                    className={`filter-tag-btn ${filterRisk === 'CRITICAL' ? 'active' : ''}`}
                    onClick={() => setFilterRisk('CRITICAL')}
                  >
                    CRITICAL
                  </button>
                </div>
              </div>

              {/* Interactive Basin Sectors List */}
              <div className="hazard-sectors-list">
                {filteredRegions.length > 0 ? (
                  filteredRegions.map((sec) => {
                    const isSelected = selectedSector?.region_id === sec.region_id;
                    const rLevel = sec.risk_level || 'LOW';
                    const areaKm = sec.area_exceeded_km2 ?? 0;

                    return (
                      <div
                        key={sec.region_id || sec.name}
                        className={`sector-card ${isSelected ? 'sector-selected' : ''}`}
                        onClick={() => handleFocusSector(sec)}
                      >
                        <div className="sector-card-top">
                          <span className="sector-name">{sec.name}</span>
                          <span className={`status-badge badge-${rLevel.toLowerCase()}`}>{rLevel}</span>
                        </div>

                        <div className="sector-card-stats">
                          <div>
                            <span className="stat-label">Exceeded: </span>
                            <strong style={{ color: areaKm > 0 ? '#f59e0b' : '#94a3b8' }}>
                              {areaKm > 0 ? `${areaKm.toLocaleString()} km²` : '0 km²'}
                            </strong>
                          </div>
                          <div>
                            <span className="stat-label">Peak: </span>
                            <strong style={{ color: '#00f0ff' }}>{sec.max_value ?? '--'} {unit}</strong>
                          </div>
                        </div>

                        <div className="sector-card-action">
                          <button
                            type="button"
                            className="btn-locate-sector"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFocusSector(sec);
                            }}
                            title="Fly 3D Camera to Sector"
                          >
                            <Crosshair size={11} />
                            <span>Locate on 3D Globe</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="hazard-empty-box">
                    <Info size={16} />
                    <span>No sectors matching filter '{filterRisk}'</span>
                  </div>
                )}
              </div>

              {/* Provenance Card */}
              {provenanceMeta && (
                <div style={{ marginTop: '12px' }}>
                  <ProvenanceCard metadata={provenanceMeta} />
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : (
        /* 2D High-Resolution Raster Matrix Inspection Mode */
        <div className="hazard-2d-matrix-layout">
          <div className="ops-split-layout">
            <div className="ops-panel">
              <div className="ops-panel-header">
                <span className="ops-panel-title">
                  <Compass size={14} /> 2D SCIENTIFIC RASTER FIELD // {region.toUpperCase()}
                </span>
                <span className="ops-panel-meta">Hover or click cell for in-situ parameters</span>
              </div>

              <div style={{ flex: 1, minHeight: '440px', display: 'flex' }}>
                {gridData ? (
                  <GeospatialRasterMap
                    latitudes={gridData.latitudes}
                    longitudes={gridData.longitudes}
                    values={gridData.values}
                    mask={gridData.mask}
                    unit={gridData.unit}
                    variableName={gridData.variable}
                    threshold={parseFloat(threshold) || null}
                    colorScheme={palette}
                    provenanceMeta={gridData.provenance_meta}
                    isLoading={gridLoading}
                  />
                ) : (
                  <div className="geospatial-empty-state">
                    <Globe size={24} />
                    <span>{analyzing ? 'Streaming spatial raster grid...' : 'No raster data available.'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Regions Exceeding Threshold Table */}
            <div className="ops-panel" style={{ maxWidth: '420px' }}>
              <div className="ops-panel-header">
                <div className="ops-panel-title">
                  <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                  <span>REGIONS EXCEEDING THRESHOLD</span>
                </div>
                <span className="ops-panel-meta">&gt; {threshold} {unit}</span>
              </div>

              <div className="ops-table-wrap">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Basin Sector</th>
                      <th>Area (km²)</th>
                      <th style={{ textAlign: 'right' }}>% Basin</th>
                      <th style={{ textAlign: 'right' }}>Peak</th>
                      <th style={{ textAlign: 'center' }}>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hazardRegions.length > 0 ? (
                      hazardRegions.map((r) => {
                        const areaExceeded = r.area_exceeded_km2 ?? 0;
                        const pctExceeded = r.exceedance_pct ?? 0;
                        const maxVal = r.max_value ?? 0;
                        const riskTier = r.risk_level || 'LOW';

                        return (
                          <tr
                            key={r.region_id || r.name}
                            className={selectedSector?.region_id === r.region_id ? 'ops-row-active' : ''}
                            onClick={() => handleFocusSector(r)}
                            style={{ cursor: 'pointer' }}
                          >
                            <td style={{ fontWeight: 600, color: '#fff' }}>{r.name}</td>
                            <td style={{ color: areaExceeded > 0 ? '#f59e0b' : '#94a3b8' }}>
                              {areaExceeded > 0 ? areaExceeded.toLocaleString() : '0'}
                            </td>
                            <td style={{ textAlign: 'right', color: '#94a3b8' }}>
                              {pctExceeded ? `${pctExceeded.toFixed(1)}%` : '0.0%'}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#00f0ff' }}>
                              {maxVal} {unit}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <span className={`status-badge badge-${riskTier.toLowerCase()}`}>{riskTier}</span>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: '#88909e', padding: '24px 0' }}>
                          No regional exceedance data available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {provenanceMeta && (
                <div style={{ padding: '12px' }}>
                  <ProvenanceCard metadata={provenanceMeta} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Operational Status Bar */}
      <footer className="hazard-bottom-bar">
        <div className="hazard-bottom-left">
          <span className="bottom-indicator-dot" />
          <span className="bottom-status-text">
            OPERATIONAL // COPERNICUS MARINE & INCOIS ERDDAP // WGS84 GEODESIC CELL INTEGRATION
          </span>
        </div>
        <div className="hazard-bottom-right">
          <span>SURVEYED BASIN: <strong>{region}</strong></span>
          <span className="bottom-sep">|</span>
          <span>GRID RESOLUTION: <strong>0.083° (~9 km)</strong></span>
          <span className="bottom-sep">|</span>
          <span>EVALUATED AT: <strong>{new Date().toUTCString().slice(17, 25)} UTC</strong></span>
        </div>
      </footer>
    </div>
  );
};
