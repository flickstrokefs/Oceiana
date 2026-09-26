import React, { useState, useEffect, useCallback, useRef, Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Fish,
  AlertTriangle,
  AlertOctagon,
  RefreshCw,
  Sparkles,
  Anchor,
  Globe,
  Grid,
  Compass,
  Crosshair,
  Award,
} from 'lucide-react';
import type {
  FisheryConditions,
  RecommendedFishingZone,
  PFZCoordinate,
  FisheryGridData,
} from '../../types/fishery';
import type { ProvenanceMetadata } from '../../types/hazard';
import {
  fetchFisheryAdvisory,
  fetchPFZCoordinates,
  fetchFisheryGrid,
} from '../../services/fisheryService';
import { GeospatialRasterMap } from '../Geospatial/GeospatialRasterMap';
import { ProvenanceCard } from '../Geospatial/ProvenanceCard';
import type { OceanEngine } from '../../ocean/OceanEngine';
import { FisheryGlobeLayer } from '../../ocean/layers/FisheryGlobeLayer';

interface FisheryAdvisoriesViewProps {
  engine?: OceanEngine | null;
}

const BASIN_OPTIONS = [
  { value: 'Arabian Sea', label: 'Arabian Sea (West Coast / Pelagic)' },
  { value: 'Bay of Bengal', label: 'Bay of Bengal (East Coast / Pelagic)' },
  { value: 'Southern Ocean', label: 'Southern Ocean (Subantarctic Front)' },
];

const VARIABLE_OPTIONS = [
  { value: 'Chlorophyll-a (mg/m³)', label: 'Chlorophyll-a (mg/m³)' },
  { value: 'Sea Surface Temperature (°C)', label: 'Sea Surface Temperature (°C)' },
  { value: 'Thermal Fronts (°C/km)', label: 'Thermal Fronts (°C/km)' },
  { value: 'Primary Productivity', label: 'Primary Productivity Index (0-100)' },
  { value: 'Surface Current (m/s)', label: 'Surface Current Speed (m/s)' },
  { value: 'Significant Wave Height (m)', label: 'Significant Wave Height (m)' },
];

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorText: string;
}

class FisheryErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorText: error?.message || 'Unexpected UI rendering error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Fishery Advisories rendering error caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, errorText: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="fishery-operational-layout" style={{ pointerEvents: 'auto', padding: '30px' }}>
          <div className="ops-alert-banner ops-alert-error" style={{ margin: '30px auto', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertOctagon size={20} />
              <div>
                <strong style={{ display: 'block', color: '#fff' }}>Fishery Advisories Recovered</strong>
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

export const FisheryAdvisoriesView: React.FC<FisheryAdvisoriesViewProps> = (props) => {
  return (
    <FisheryErrorBoundary>
      <FisheryAdvisoriesInner {...props} />
    </FisheryErrorBoundary>
  );
};

const FisheryAdvisoriesInner: React.FC<FisheryAdvisoriesViewProps> = ({ engine }) => {
  const [region, setRegion] = useState('Arabian Sea');
  const [variable, setVariable] = useState('Chlorophyll-a (mg/m³)');
  const [timeRange, setTimeRange] = useState('Next 7 days');
  const [filterType, setFilterType] = useState<'ALL' | 'OFFICIAL' | 'DERIVED'>('ALL');

  const [loading, setLoading] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scientific Data
  const [conditions, setConditions] = useState<FisheryConditions | null>(null);
  const [_zones, setZones] = useState<RecommendedFishingZone[]>([]);
  const [pfzPoints, setPfzPoints] = useState<PFZCoordinate[]>([]);
  const [selectedPFZ, setSelectedPFZ] = useState<PFZCoordinate | null>(null);
  const [gridData, setGridData] = useState<FisheryGridData | null>(null);
  const [provenanceMeta, setProvenanceMeta] = useState<ProvenanceMetadata | null>(null);
  const [advisoryDate, setAdvisoryDate] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>('');

  // 3D View Controls
  const [viewMode, setViewMode] = useState<'3d-globe' | '2d-matrix'>('3d-globe');
  const fisheryGlobeLayerRef = useRef<FisheryGlobeLayer | null>(null);

  // Initialize and bind FisheryGlobeLayer to Cesium
  useEffect(() => {
    if (!engine) return;
    const viewer = engine.getViewer();
    if (!viewer || viewer.isDestroyed()) return;

    const layer = new FisheryGlobeLayer(viewer);
    fisheryGlobeLayerRef.current = layer;

    layer.setOnSelectPFZ((pfz) => {
      setSelectedPFZ(pfz);
    });

    layer.flyToBasin(region);

    return () => {
      layer.destroy();
      fisheryGlobeLayerRef.current = null;
    };
  }, [engine]);

  const loadAdvisory = useCallback(async () => {
    setLoading(true);
    setGridLoading(true);
    setError(null);

    try {
      // 1. Fetch comprehensive advisory
      const advisoryPromise = fetchFisheryAdvisory(region, variable, timeRange);

      // 2. Fetch PFZ coordinates
      const pfzPromise = fetchPFZCoordinates(region);

      // 3. Fetch spatial raster grid for selected variable
      const gridPromise = fetchFisheryGrid(variable, region, timeRange);

      const [advisoryResp, pfzResp, gridResp] = await Promise.all([
        advisoryPromise,
        pfzPromise,
        gridPromise,
      ]);

      setConditions(advisoryResp.conditions);
      setZones(advisoryResp.recommended_zones || []);
      setProvenanceMeta(advisoryResp.provenance_meta || null);
      setAdvisoryDate(advisoryResp.generated_date || advisoryResp.issued_date || '');
      setValidUntil(advisoryResp.valid_until || '');

      const points = pfzResp.points || [];
      setPfzPoints(points);
      if (points.length > 0) {
        setSelectedPFZ(points[0]);
      } else {
        setSelectedPFZ(null);
      }

      setGridData(gridResp);

      // Render onto 3D Cesium Globe
      if (fisheryGlobeLayerRef.current) {
        fisheryGlobeLayerRef.current.renderPFZs(points, points[0]?.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operational oceanographic data provider unavailable';
      setError(msg);
    } finally {
      setLoading(false);
      setGridLoading(false);
    }
  }, [region, variable, timeRange]);

  // Initial load on mount or parameter changes
  useEffect(() => {
    loadAdvisory();
  }, [loadAdvisory]);

  const handleRegionChange = (newRegion: string) => {
    setRegion(newRegion);
    setSelectedPFZ(null);
    if (fisheryGlobeLayerRef.current) {
      fisheryGlobeLayerRef.current.flyToBasin(newRegion);
    }
  };

  const handleSelectPFZ = (pfz: PFZCoordinate) => {
    setSelectedPFZ(pfz);
    if (fisheryGlobeLayerRef.current) {
      fisheryGlobeLayerRef.current.flyToPFZ(pfz.latitude, pfz.longitude);
      fisheryGlobeLayerRef.current.renderPFZs(filteredPoints, pfz.id);
    }
  };

  const handleResetCamera = () => {
    if (fisheryGlobeLayerRef.current) {
      fisheryGlobeLayerRef.current.flyToBasin(region);
    } else if (engine) {
      engine.resetView();
    }
  };

  const filteredPoints = pfzPoints.filter((p) => {
    if (filterType === 'OFFICIAL') return p.is_official !== false;
    if (filterType === 'DERIVED') return p.is_official === false;
    return true;
  });

  return (
    <div className="fishery-operational-layout">
      {/* Top Operations Command Bar */}
      <div className="hazard-top-bar">
        <div className="hazard-top-left">
          <div className="hazard-brand-badge">
            <Fish size={16} className="text-emerald-400" />
            <div className="brand-badge-info">
              <span className="brand-title">INCOIS // POTENTIAL FISHING ZONE (PFZ) ADVISORY</span>
              <span className="brand-mode-pill" style={{ color: '#2dd4bf', borderColor: 'rgba(45, 212, 191, 0.4)' }}>
                MFAS OPERATIONAL
              </span>
            </div>
          </div>

          <div className="hazard-selectors">
            <div className="hazard-field">
              <label>Ocean Variable</label>
              <select
                className="hazard-select"
                value={variable}
                onChange={(e) => setVariable(e.target.value)}
                disabled={loading}
              >
                {VARIABLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="hazard-field">
              <label>Ocean Basin</label>
              <select
                className="hazard-select"
                value={region}
                onChange={(e) => handleRegionChange(e.target.value)}
                disabled={loading}
              >
                {BASIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="hazard-field">
              <label>Forecast Horizon</label>
              <select
                className="hazard-select"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                disabled={loading}
              >
                <option value="Next 7 days">Next 7 days (Synoptic Outlook)</option>
                <option value="Next 3 days">Next 3 days (Operational Cycle)</option>
                <option value="Current 24h">Current 24h (Near-Real-Time)</option>
              </select>
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
            style={{ background: 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)' }}
            onClick={loadAdvisory}
            disabled={loading}
          >
            {loading ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Synthesizing Advisory...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Generate Operational Advisory</span>
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

      {/* Operational Alert Banner */}
      {error && (
        <div className="hazard-alert-banner ops-alert-error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <div>
              <strong style={{ color: '#fff', marginRight: '6px' }}>Fishery Advisory Stream:</strong>
              <span>{error}</span>
            </div>
          </div>
          <button type="button" className="ops-alert-retry-btn" onClick={loadAdvisory}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* 
        MAIN CONTENT BODY:
        - In '3d-globe' mode: Floating glassmorphism panels overlaid on 3D Cesium Globe
        - In '2d-matrix' mode: High-resolution GIS 2D matrix inspection view
      */}
      {viewMode === '3d-globe' ? (
        <div className="hazard-workspace-panels">
          {/* Left Floating Panel: Environmental Conditions & PFZ Filters */}
          <aside className="ariel-panel hazard-panel-left" aria-label="Fishery Habitat Conditions">
            <div className="panel-title-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Fish size={13} style={{ color: '#2dd4bf' }} />
                <h2 className="panel-heading">Habitat Parameters</h2>
              </div>
              <span className="hazard-chip-indicator" style={{ color: '#2dd4bf', borderColor: 'rgba(45, 212, 191, 0.3)' }}>
                INCOIS MFAS
              </span>
            </div>

            <div className="panel-content-scroll">
              {/* Environmental KPI Badges */}
              {conditions && (
                <div className="fishery-conditions-grid" style={{ gridTemplateColumns: '1fr', gap: '8px' }}>
                  <div className="fishery-condition-card" style={{ borderTopColor: '#0d9488' }}>
                    <div className="fishery-cond-label">
                      <Fish size={12} style={{ color: '#2dd4bf' }} /> Chlorophyll-a
                    </div>
                    <div className="fishery-cond-val" style={{ color: '#2dd4bf' }}>
                      {conditions.chlorophyll_range || 'N/A'}
                    </div>
                    <div className="fishery-cond-meta">Copernicus / IRS-P4 Ocean Color</div>
                  </div>

                  <div className="fishery-condition-card" style={{ borderTopColor: '#f59e0b' }}>
                    <div className="fishery-cond-label">
                      <Sparkles size={12} style={{ color: '#fbbf24' }} /> Sea Surface Temp
                    </div>
                    <div className="fishery-cond-val" style={{ color: '#fbbf24' }}>
                      {conditions.sst_range || 'N/A'}
                    </div>
                    <div className="fishery-cond-meta">Copernicus Marine Physics Model</div>
                  </div>

                  <div className="fishery-condition-card" style={{ borderTopColor: '#0284c7' }}>
                    <div className="fishery-cond-label">
                      <Anchor size={12} style={{ color: '#38bdf8' }} /> Sea State & Current
                    </div>
                    <div className="fishery-cond-val" style={{ color: '#38bdf8' }}>
                      {conditions.current_state || 'Moderate'}
                    </div>
                    <div className="fishery-cond-meta">{conditions.wave_state || 'Moderate Swell'}</div>
                  </div>
                </div>
              )}

              {/* PFZ Type Filter */}
              <div className="hazard-ctrl-section" style={{ marginTop: '12px' }}>
                <div className="ctrl-section-label">
                  <span>Advisory Filter</span>
                </div>
                <div className="filter-btn-group" style={{ width: '100%', marginTop: '4px' }}>
                  <button
                    type="button"
                    className={`filter-tag-btn ${filterType === 'ALL' ? 'active' : ''}`}
                    onClick={() => setFilterType('ALL')}
                    style={{ flex: 1 }}
                  >
                    ALL ({pfzPoints.length})
                  </button>
                  <button
                    type="button"
                    className={`filter-tag-btn ${filterType === 'OFFICIAL' ? 'active' : ''}`}
                    onClick={() => setFilterType('OFFICIAL')}
                    style={{ flex: 1 }}
                  >
                    OFFICIAL
                  </button>
                  <button
                    type="button"
                    className={`filter-tag-btn ${filterType === 'DERIVED' ? 'active' : ''}`}
                    onClick={() => setFilterType('DERIVED')}
                    style={{ flex: 1 }}
                  >
                    DERIVED
                  </button>
                </div>
              </div>

              {/* Advisory Validity Card */}
              <div className="hazard-ctrl-section">
                <div className="ctrl-section-label">
                  <span>Operational Horizon</span>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', lineHeight: 1.5 }}>
                  <div>Issued: <strong style={{ color: '#fff' }}>{advisoryDate || 'Current Cycle'}</strong></div>
                  <div>Valid until: <strong style={{ color: '#2dd4bf' }}>{validUntil || '72 hours'}</strong></div>
                </div>
              </div>
            </div>
          </aside>

          {/* Center Floating Callout: Selected PFZ Zone Info */}
          {selectedPFZ && (
            <div className="hazard-center-inspector" style={{ borderColor: 'rgba(45, 212, 191, 0.4)' }}>
              <div className="inspector-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Anchor size={14} style={{ color: '#2dd4bf' }} />
                  <span className="inspector-title">{selectedPFZ.zone_name || selectedPFZ.sector || 'PFZ Beacon'}</span>
                </div>
                <button
                  type="button"
                  className="inspector-close-btn"
                  onClick={() => setSelectedPFZ(null)}
                >
                  ✕
                </button>
              </div>
              <div className="inspector-grid">
                <div className="inspector-stat">
                  <span className="stat-label">Position</span>
                  <span className="stat-val" style={{ color: '#fff' }}>
                    {selectedPFZ.latitude.toFixed(2)}°N, {selectedPFZ.longitude.toFixed(2)}°E
                  </span>
                </div>
                <div className="inspector-stat">
                  <span className="stat-label">Chlorophyll</span>
                  <span className="stat-val" style={{ color: '#2dd4bf' }}>
                    {selectedPFZ.chlorophyll ?? '--'} mg/m³
                  </span>
                </div>
                <div className="inspector-stat">
                  <span className="stat-label">SST</span>
                  <span className="stat-val" style={{ color: '#fbbf24' }}>
                    {selectedPFZ.sst ?? '--'} °C
                  </span>
                </div>
                <div className="inspector-stat">
                  <span className="stat-label">Suitability Score</span>
                  <span className="stat-val" style={{ color: '#10b981', fontWeight: 'bold' }}>
                    {selectedPFZ.score ?? '85'}/100
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Right Floating Panel: Potential Fishing Zones List & Details */}
          <aside className="ariel-panel hazard-panel-right" aria-label="Recommended Potential Fishing Zones">
            <div className="panel-title-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={13} style={{ color: '#10b981' }} />
                <h2 className="panel-heading">Recommended Fishing Zones ({filteredPoints.length})</h2>
              </div>
              <span className="hazard-chip-indicator" style={{ color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                HIGH YIELD
              </span>
            </div>

            <div className="panel-content-scroll">
              <div className="hazard-sectors-list">
                {filteredPoints.length > 0 ? (
                  filteredPoints.map((p) => {
                    const isSelected = selectedPFZ?.id === p.id;
                    const isOfficial = p.is_official !== false;

                    return (
                      <div
                        key={p.id}
                        className={`sector-card ${isSelected ? 'sector-selected' : ''}`}
                        onClick={() => handleSelectPFZ(p)}
                        style={{ borderLeftColor: isOfficial ? '#10b981' : '#06b6d4' }}
                      >
                        <div className="sector-card-top">
                          <span className="sector-name">{p.zone_name || p.sector || p.id}</span>
                          <span className={`status-badge ${isOfficial ? 'badge-low' : 'badge-moderate'}`}>
                            {isOfficial ? 'OFFICIAL INCOIS' : 'OCEAN-X DERIVED'}
                          </span>
                        </div>

                        <div className="sector-card-stats">
                          <div>
                            <span className="stat-label">Harbour: </span>
                            <strong style={{ color: '#fff' }}>{p.landing_center || 'Coastal Hub'}</strong>
                          </div>
                          <div>
                            <span className="stat-label">Score: </span>
                            <strong style={{ color: '#10b981' }}>{p.score ?? 85}/100</strong>
                          </div>
                        </div>

                        <div className="sector-card-action">
                          <button
                            type="button"
                            className="btn-locate-sector"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectPFZ(p);
                            }}
                            title="Fly 3D Camera to PFZ Beacon"
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
                    <Fish size={16} />
                    <span>No active PFZ coordinates in current sector.</span>
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
        /* 2D Matrix Inspection Mode */
        <div className="hazard-2d-matrix-layout">
          <div className="ops-split-layout">
            <div className="ops-panel">
              <div className="ops-panel-header">
                <span className="ops-panel-title">
                  <Compass size={14} /> 2D OCEANOGRAPHIC FRONT &amp; PFZ MATRIX // {region.toUpperCase()}
                </span>
                <span className="ops-panel-meta">Official INCOIS &amp; Derived PFZ Centroids</span>
              </div>

              <div style={{ flex: 1, minHeight: '440px', display: 'flex' }}>
                {gridData ? (
                  <GeospatialRasterMap
                    latitudes={gridData.latitudes}
                    longitudes={gridData.longitudes}
                    values={gridData.values}
                    unit={gridData.unit}
                    variableName={gridData.variable}
                    colorScheme="turbo"
                    pfzPoints={filteredPoints}
                    selectedPFZId={selectedPFZ?.id}
                    onSelectPFZ={handleSelectPFZ}
                    provenanceMeta={gridData.provenance_meta}
                    isLoading={gridLoading}
                  />
                ) : (
                  <div className="geospatial-empty-state">
                    <Globe size={24} />
                    <span>{loading ? 'Synthesizing fishery raster...' : 'No grid data loaded.'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right: PFZ list */}
            <div className="ops-panel" style={{ maxWidth: '420px' }}>
              <div className="ops-panel-header">
                <div className="ops-panel-title">
                  <Fish size={14} style={{ color: '#2dd4bf' }} />
                  <span>RECOMMENDED FISHING GROUNDS</span>
                </div>
                <span className="ops-panel-meta">Valid 72h</span>
              </div>

              <div className="ops-table-wrap">
                <table className="ops-table">
                  <thead>
                    <tr>
                      <th>Sector / Zone</th>
                      <th>Harbour</th>
                      <th style={{ textAlign: 'right' }}>Chl (mg/m³)</th>
                      <th style={{ textAlign: 'right' }}>SST (°C)</th>
                      <th style={{ textAlign: 'center' }}>Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPoints.length > 0 ? (
                      filteredPoints.map((p) => (
                        <tr
                          key={p.id}
                          className={selectedPFZ?.id === p.id ? 'ops-row-active' : ''}
                          onClick={() => handleSelectPFZ(p)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td style={{ fontWeight: 600, color: '#fff' }}>{p.zone_name || p.sector || p.id}</td>
                          <td style={{ color: '#94a3b8' }}>{p.landing_center || 'Port'}</td>
                          <td style={{ textAlign: 'right', color: '#2dd4bf', fontFamily: 'var(--font-mono)' }}>
                            {p.chlorophyll ?? '--'}
                          </td>
                          <td style={{ textAlign: 'right', color: '#fbbf24', fontFamily: 'var(--font-mono)' }}>
                            {p.sst ?? '--'}
                          </td>
                          <td style={{ textAlign: 'center', color: '#10b981', fontWeight: 'bold' }}>
                            {p.score ?? 85}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', color: '#88909e', padding: '24px 0' }}>
                          No fishing zones available.
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
          <span className="bottom-indicator-dot" style={{ background: '#2dd4bf', boxShadow: '0 0 8px #2dd4bf' }} />
          <span className="bottom-status-text">
            OPERATIONAL // INCOIS MARINE FISHERIES ADVISORY SERVICE (MFAS) // HIGH-CONFIDENCE PFZ DETECTOR
          </span>
        </div>
        <div className="hazard-bottom-right">
          <span>TARGET BASIN: <strong>{region}</strong></span>
          <span className="bottom-sep">|</span>
          <span>PFZ BEACONS ACTIVE: <strong>{filteredPoints.length}</strong></span>
          <span className="bottom-sep">|</span>
          <span>VALIDITY: <strong>{validUntil || '72 HOURS'}</strong></span>
        </div>
      </footer>
    </div>
  );
};
