import React, { useState, useEffect, useCallback, Component, type ErrorInfo, type ReactNode } from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Crosshair,
  Fish,
  Thermometer,
  Wind,
  Waves,
  Info,
  Compass,
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
        <div className="fishery-view">
          <div className="ops-alert-banner ops-alert-error" style={{ margin: '30px auto', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertOctagon size={20} />
              <div>
                <strong style={{ display: 'block', color: '#fff' }}>Fishery Advisories Display Recovered</strong>
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

const FisheryAdvisoriesInner: React.FC = () => {
  const [region, setRegion] = useState('Arabian Sea');
  const [variable, setVariable] = useState('Chlorophyll-a (mg/m³)');
  const [timeRange, setTimeRange] = useState('Next 7 days');
  const [filterType, setFilterType] = useState<'ALL' | 'OFFICIAL' | 'DERIVED'>('ALL');

  const [loading, setLoading] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Loaded Scientific Data
  const [conditions, setConditions] = useState<FisheryConditions | null>(null);
  const [zones, setZones] = useState<RecommendedFishingZone[]>([]);
  const [pfzPoints, setPfzPoints] = useState<PFZCoordinate[]>([]);
  const [selectedPFZ, setSelectedPFZ] = useState<PFZCoordinate | null>(null);
  const [gridData, setGridData] = useState<FisheryGridData | null>(null);
  const [provenanceMeta, setProvenanceMeta] = useState<ProvenanceMetadata | null>(null);
  const [advisoryDate, setAdvisoryDate] = useState<string>('');
  const [validUntil, setValidUntil] = useState<string>('');

  const loadAdvisory = useCallback(async () => {
    setLoading(true);
    setGridLoading(true);
    setError(null);

    try {
      // 1. Fetch comprehensive advisory
      const advisoryPromise = fetchFisheryAdvisory(region, variable, timeRange);

      // 2. Fetch PFZ points with coordinate georeferencing
      const pfzPromise = fetchPFZCoordinates(region);

      // 3. Fetch spatial raster grid for the selected variable
      const gridPromise = fetchFisheryGrid(region, variable);

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

      setPfzPoints(pfzResp.points || []);
      if (pfzResp.points && pfzResp.points.length > 0) {
        setSelectedPFZ(pfzResp.points[0]);
      } else {
        setSelectedPFZ(null);
      }

      setGridData(gridResp);
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

  // Filtered PFZ points and zones
  const filteredPoints = pfzPoints.filter((p) => {
    if (filterType === 'OFFICIAL') return p.is_official;
    if (filterType === 'DERIVED') return !p.is_official;
    return true;
  });

  const filteredZones = zones.filter((z) => {
    if (filterType === 'OFFICIAL') return z.is_official;
    if (filterType === 'DERIVED') return !z.is_official;
    return true;
  });

  return (
    <div className="fishery-view">
      {/* Top Operations Command Bar */}
      <div className="ops-top-controls">
        <div className="ops-control-group">
          <div className="ops-control-field">
            <label className="ops-control-label">Ocean Variable</label>
            <select
              className="ops-select"
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

          <div className="ops-control-field">
            <label className="ops-control-label">Ocean Basin</label>
            <select
              className="ops-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={loading}
            >
              {BASIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ops-control-field">
            <label className="ops-control-label">Forecast Horizon</label>
            <select
              className="ops-select"
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

        <button
          type="button"
          className="ops-btn-action"
          onClick={loadAdvisory}
          disabled={loading}
        >
          {loading ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              <span>Synthesizing Ocean Advisory...</span>
            </>
          ) : (
            <>
              <Sparkles size={13} />
              <span>Generate Operational Advisory</span>
            </>
          )}
        </button>
      </div>

      {/* Operational Alert Banner */}
      {error && (
        <div className="ops-alert-banner ops-alert-error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} />
            <div>
              <strong style={{ color: '#fff', marginRight: '6px' }}>Fishery Advisory Unavailable:</strong>
              <span>{error}</span>
            </div>
          </div>
          <button type="button" className="ops-alert-retry-btn" onClick={loadAdvisory}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* Dynamic Environmental Conditions KPI Cards */}
      {conditions && (
        <div className="fishery-conditions-grid">
          <div className="fishery-condition-card" style={{ borderTopColor: '#0d9488' }}>
            <div className="fishery-cond-label">
              <Fish size={12} style={{ color: '#2dd4bf' }} /> Chlorophyll-a
            </div>
            <div className="fishery-cond-val" style={{ color: '#2dd4bf' }}>
              {conditions.chlorophyll_range || 'N/A'}
            </div>
            <div className="fishery-cond-meta">Copernicus / IRS OLCI</div>
          </div>

          <div className="fishery-condition-card" style={{ borderTopColor: '#f59e0b' }}>
            <div className="fishery-cond-label">
              <Thermometer size={12} style={{ color: '#fbbf24' }} /> SST Thermal
            </div>
            <div className="fishery-cond-val" style={{ color: '#fbbf24' }}>
              {conditions.sst_range || 'N/A'}
            </div>
            <div className="fishery-cond-meta">Physical In-situ / Model</div>
          </div>

          <div className="fishery-condition-card" style={{ borderTopColor: '#0284c7' }}>
            <div className="fishery-cond-label">
              <Wind size={12} style={{ color: '#38bdf8' }} /> Surface Current
            </div>
            <div className="fishery-cond-val" style={{ color: '#38bdf8' }}>
              {conditions.current_state || 'N/A'}
            </div>
            <div className="fishery-cond-meta">GLORYS12V1 Dynamics</div>
          </div>

          <div className="fishery-condition-card" style={{ borderTopColor: '#06b6d4' }}>
            <div className="fishery-cond-label">
              <Waves size={12} style={{ color: '#22d3ee' }} /> Significant Wave
            </div>
            <div className="fishery-cond-val" style={{ color: '#22d3ee' }}>
              {conditions.wave_state || 'N/A'}
            </div>
            <div className="fishery-cond-meta">Maritime Safety Check</div>
          </div>

          <div className="fishery-condition-card" style={{ borderTopColor: '#16a34a' }}>
            <div className="fishery-cond-label">
              <ShieldCheck size={12} style={{ color: '#4ade80' }} /> Active PFZs
            </div>
            <div className="fishery-cond-val" style={{ color: '#4ade80' }}>
              {pfzPoints.length} Zones
            </div>
            <div className="fishery-cond-meta">
              {pfzPoints.filter((p) => p.is_official).length} Off. &bull; {pfzPoints.filter((p) => !p.is_official).length} Deriv.
            </div>
          </div>

          <div className="fishery-condition-card" style={{ borderTopColor: '#9333ea' }}>
            <div className="fishery-cond-label">
              <Sparkles size={12} style={{ color: '#c084fc' }} /> Productivity
            </div>
            <div className="fishery-cond-val" style={{ color: '#c084fc' }}>
              {conditions.mean_productivity_score ?? 'N/A'} / 100
            </div>
            <div className="fishery-cond-meta">Multi-factor front index</div>
          </div>
        </div>
      )}

      {/* Main Split Layout: Map Panel + Recommended PFZ List & Detail Drawer */}
      <div className="ops-split-layout">
        {/* Left: Scientific Raster Map + PFZ Radar Beacons */}
        <div className="ops-panel">
          <div className="ops-panel-header">
            <div className="ops-panel-title">
              <Compass size={14} />
              <span>OCEANOGRAPHIC FRONT & PFZ CENTROIDS</span>
              <span style={{ color: '#505664' }}>|</span>
              <span style={{ color: '#2dd4bf' }}>{region}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#4ade80' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80' }} /> Official INCOIS
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#38bdf8', marginLeft: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8' }} /> Ocean-X Derived
              </span>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: '380px', display: 'flex' }}>
            {gridData ? (
              <GeospatialRasterMap
                latitudes={gridData.latitudes}
                longitudes={gridData.longitudes}
                values={gridData.values}
                unit={gridData.unit}
                variableName={gridData.variable}
                colorScheme={variable.includes('Chlorophyll') ? 'ocean' : 'turbo'}
                pfzPoints={filteredPoints}
                selectedPFZId={selectedPFZ?.id}
                onSelectPFZ={(pfz) => setSelectedPFZ(pfz)}
                provenanceMeta={gridData.provenance_meta}
                isLoading={gridLoading}
              />
            ) : (
              <div className="geospatial-empty-state">
                <Compass size={24} />
                <span>{loading ? 'Synthesizing operational oceanographic grids...' : 'No grid data loaded.'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: PFZ Advisory List and Deep Inspection Drawer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Header & Filter Tabs */}
          <div className="ops-panel" style={{ minHeight: 'auto' }}>
            <div className="ops-panel-header">
              <div>
                <h3 className="ops-panel-title">
                  RECOMMENDED FISHING ZONES ({filteredZones.length})
                </h3>
                <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#88909e', display: 'block', marginTop: '2px' }}>
                  Issued: {advisoryDate || 'NRT'} &bull; Valid: {validUntil || '3 Days'}
                </span>
              </div>
              <div className="pfz-filter-tabs">
                <button
                  type="button"
                  className={`pfz-filter-btn ${filterType === 'ALL' ? 'active' : ''}`}
                  onClick={() => setFilterType('ALL')}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`pfz-filter-btn ${filterType === 'OFFICIAL' ? 'active' : ''}`}
                  onClick={() => setFilterType('OFFICIAL')}
                >
                  Official
                </button>
                <button
                  type="button"
                  className={`pfz-filter-btn ${filterType === 'DERIVED' ? 'active' : ''}`}
                  onClick={() => setFilterType('DERIVED')}
                >
                  Derived
                </button>
              </div>
            </div>

            {/* Scrollable Zones List */}
            <div className="pfz-list-scroll" style={{ maxHeight: '180px' }}>
              {filteredZones.length > 0 ? (
                filteredZones.map((z) => {
                  const isSelected = selectedPFZ?.id === z.id;
                  return (
                    <div
                      key={z.id}
                      className={`pfz-zone-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        const matchedPoint = pfzPoints.find((p) => p.id === z.id);
                        if (matchedPoint) setSelectedPFZ(matchedPoint);
                      }}
                    >
                      <div className="pfz-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            style={{
                              width: '7px',
                              height: '7px',
                              borderRadius: '50%',
                              background: z.is_official ? '#4ade80' : '#38bdf8',
                              boxShadow: z.is_official ? '0 0 6px rgba(74, 222, 128, 0.8)' : 'none',
                            }}
                          />
                          <span className="pfz-card-title">{z.name}</span>
                          <span className={`pfz-card-badge ${z.is_official ? 'badge-incois' : 'badge-derived'}`}>
                            {z.is_official ? 'INCOIS' : 'DERIVED'}
                          </span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#2dd4bf', fontFamily: 'var(--font-mono)' }}>
                            {z.score} pts
                          </span>
                        </div>
                      </div>

                      <div className="pfz-card-meta-row">
                        <span>{z.sector || z.region} {z.landing_center ? `• Base: ${z.landing_center}` : ''}</span>
                        <span>Conf: {Math.round(z.confidence * 100)}%</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: '#505664', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                  {loading ? 'Synthesizing PFZ advisories...' : 'No potential fishing zones match filter.'}
                </div>
              )}
            </div>
          </div>

          {/* Selected PFZ Detail Inspection Drawer */}
          {selectedPFZ ? (
            <div className="ops-panel" style={{ minHeight: 'auto', borderColor: '#0d9488' }}>
              <div className="ops-panel-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  {selectedPFZ.is_official ? (
                    <ShieldCheck size={16} style={{ color: '#4ade80' }} />
                  ) : (
                    <Crosshair size={16} style={{ color: '#38bdf8' }} />
                  )}
                  <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '12px' }}>
                    {selectedPFZ.zone_name}
                  </span>
                </div>
                <span className="pfz-card-badge badge-incois" style={{ background: 'rgba(13, 148, 136, 0.2)', color: '#2dd4bf', borderColor: '#0d9488' }}>
                  {selectedPFZ.score ? `${selectedPFZ.score} / 100 PTS` : 'ACTIVE'}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#c5c9d2' }}>
                <div>
                  <span style={{ color: '#505664', fontSize: '9.5px', textTransform: 'uppercase', display: 'block' }}>COORDINATES</span>
                  <span style={{ color: '#ffffff', fontWeight: 600 }}>
                    {selectedPFZ.latitude.toFixed(2)}°N, {selectedPFZ.longitude.toFixed(2)}°E
                  </span>
                </div>

                <div>
                  <span style={{ color: '#505664', fontSize: '9.5px', textTransform: 'uppercase', display: 'block' }}>COASTAL SECTOR</span>
                  <span style={{ color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                    {selectedPFZ.sector || 'Offshore Pelagic Zone'}
                  </span>
                </div>

                {selectedPFZ.landing_center && (
                  <div>
                    <span style={{ color: '#505664', fontSize: '9.5px', textTransform: 'uppercase', display: 'block' }}>PRIMARY LANDING CENTER</span>
                    <span style={{ color: '#2dd4bf' }}>{selectedPFZ.landing_center}</span>
                  </div>
                )}

                <div>
                  <span style={{ color: '#505664', fontSize: '9.5px', textTransform: 'uppercase', display: 'block' }}>THERMAL FRONT STRENGTH</span>
                  <span style={{ color: '#fbbf24' }}>
                    {selectedPFZ.front_strength ? selectedPFZ.front_strength.toFixed(2) : '0.45'} °C/100km
                  </span>
                </div>

                <div>
                  <span style={{ color: '#505664', fontSize: '9.5px', textTransform: 'uppercase', display: 'block' }}>SEA SURFACE TEMPERATURE</span>
                  <span style={{ color: '#ffffff' }}>{selectedPFZ.sst ? selectedPFZ.sst.toFixed(1) : '27.5'} °C</span>
                </div>

                <div>
                  <span style={{ color: '#505664', fontSize: '9.5px', textTransform: 'uppercase', display: 'block' }}>CHLOROPHYLL-A DENSITY</span>
                  <span style={{ color: '#2dd4bf' }}>{selectedPFZ.chlorophyll ? selectedPFZ.chlorophyll.toFixed(2) : '1.85'} mg/m³</span>
                </div>

                {selectedPFZ.current_speed !== undefined && selectedPFZ.current_speed !== null && (
                  <div>
                    <span style={{ color: '#505664', fontSize: '9.5px', textTransform: 'uppercase', display: 'block' }}>SURFACE CURRENT SPEED</span>
                    <span style={{ color: '#ffffff' }}>{selectedPFZ.current_speed.toFixed(2)} m/s</span>
                  </div>
                )}

                {selectedPFZ.wave_height !== undefined && selectedPFZ.wave_height !== null && (
                  <div>
                    <span style={{ color: '#505664', fontSize: '9.5px', textTransform: 'uppercase', display: 'block' }}>SIGNIFICANT WAVE HEIGHT</span>
                    <span style={{ color: '#38bdf8' }}>{selectedPFZ.wave_height.toFixed(1)} m</span>
                  </div>
                )}
              </div>

              {/* Confidence Meter */}
              <div style={{ borderTop: '1px solid #1c212a', paddingTop: '8px', marginTop: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--font-mono)', color: '#88909e', marginBottom: '3px' }}>
                  <span>Advisory Oceanographic Confidence</span>
                  <span style={{ color: '#ffffff', fontWeight: 700 }}>
                    {Math.round((selectedPFZ.confidence || 0.8) * 100)}%
                  </span>
                </div>
                <div className="pfz-confidence-bar-wrap">
                  <div
                    className="pfz-confidence-bar"
                    style={{ width: `${Math.round((selectedPFZ.confidence || 0.8) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Legal Maritime Safety Notice */}
              <div style={{ background: '#090b0e', border: '1px solid #20242b', borderRadius: '3px', padding: '8px 10px', fontSize: '10px', color: '#88909e', lineHeight: '1.45', marginTop: '6px' }}>
                <span style={{ fontWeight: 700, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                  <Info size={11} /> Maritime Operations & Safety Advisory
                </span>
                PFZ advisories indicate zones of probable pelagic fish aggregation identified via thermal/chlorophyll fronts. Advisories are strictly advisory. Always confirm local Coast Guard weather alerts and ocean state warnings before navigation.
              </div>
            </div>
          ) : (
            <div className="ops-panel" style={{ minHeight: 'auto', textAlign: 'center', padding: '30px', color: '#505664', fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
              Select a PFZ beacon on the map or from the list above to inspect in-situ parameters.
            </div>
          )}
        </div>
      </div>

      {/* Scientific Provenance Audit Card */}
      <ProvenanceCard metadata={provenanceMeta} />
    </div>
  );
};

export const FisheryAdvisoriesView: React.FC = () => {
  return (
    <FisheryErrorBoundary>
      <FisheryAdvisoriesInner />
    </FisheryErrorBoundary>
  );
};
