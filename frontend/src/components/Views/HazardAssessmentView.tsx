import React, { useState, useEffect, useCallback, Component, type ErrorInfo, type ReactNode } from 'react';
import { Play, AlertTriangle, AlertOctagon, RefreshCw, ShieldAlert, Globe, Compass } from 'lucide-react';
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

const REGION_OPTIONS = [
  { value: 'Indian Ocean', label: 'All Project Basins (Indian Ocean)' },
  { value: 'Arabian Sea', label: 'Arabian Sea (West Coast / Pelagic)' },
  { value: 'Bay of Bengal', label: 'Bay of Bengal (East Coast / Pelagic)' },
  { value: 'Southern Ocean', label: 'Southern Ocean (Subantarctic Front)' },
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
        <div className="hazard-view">
          <div className="ops-alert-banner ops-alert-error" style={{ margin: '30px auto', maxWidth: '600px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertOctagon size={20} />
              <div>
                <strong style={{ display: 'block', color: '#fff' }}>Hazard Assessment Display Recovered</strong>
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

const HazardAssessmentInner: React.FC = () => {
  const [layers, setLayers] = useState<HazardLayer[]>([]);
  const [variable, setVariable] = useState('Current Speed (m/s)');
  const [region, setRegion] = useState('Indian Ocean');
  const [threshold, setThreshold] = useState('1.5');
  const [analyzing, setAnalyzing] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Analytical results from backend
  const [hazardRegions, setHazardRegions] = useState<HazardRegionResult[]>([]);
  const [gridData, setGridData] = useState<HazardGridData | null>(null);
  const [provenanceMeta, setProvenanceMeta] = useState<ProvenanceMetadata | null>(null);
  const [totalAreaExceeded, setTotalAreaExceeded] = useState<number>(0);
  const [peakValue, setPeakValue] = useState<number>(0);
  const [unit, setUnit] = useState<string>('m/s');

  // Load configured hazard layers on mount
  useEffect(() => {
    fetchHazardLayers()
      .then((fetchedLayers) => {
        if (fetchedLayers.length > 0) {
          setLayers(fetchedLayers);
        }
      })
      .catch((err) => {
        console.warn('Could not load hazard layers configuration:', err);
      });
  }, []);

  // Update default threshold when variable changes
  const handleVariableChange = (newVar: string) => {
    setVariable(newVar);
    const matched = layers.find((l) => l.name === newVar);
    if (matched) {
      setThreshold(matched.default_threshold.toString());
      setUnit(matched.unit);
    } else if (newVar.includes('Wave')) {
      setThreshold('3.0');
      setUnit('m');
    } else if (newVar.includes('Sea Surface Height')) {
      setThreshold('0.25');
      setUnit('m');
    } else if (newVar.includes('Thermal')) {
      setThreshold('4.0');
      setUnit('DHW');
    } else {
      setThreshold('1.5');
      setUnit('m/s');
    }
  };

  // Run full quantitative geodesic hazard analysis and fetch grid
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

      setHazardRegions(analysisResp.regions || []);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Operational data provider unavailable';
      setError(msg);
      setHazardRegions([]);
      setGridData(null);
    } finally {
      setAnalyzing(false);
      setGridLoading(false);
    }
  }, [variable, threshold, region]);

  // Initial load
  useEffect(() => {
    executeAnalysis();
  }, [executeAnalysis]);

  // Determine overall risk tier
  const hasCritical = hazardRegions.some((r) => r.risk_level === 'CRITICAL');
  const hasElevated = hazardRegions.some((r) => r.risk_level === 'HIGH');
  const exceedingCount = hazardRegions.filter(
    (r) => (r.area_exceeded_km2 ?? (r as unknown as { area_km2?: number }).area_km2 ?? 0) > 0
  ).length;

  return (
    <div className="hazard-view">
      {/* Top Operations Command Bar */}
      <div className="ops-top-controls">
        <div className="ops-control-group">
          <div className="ops-control-field">
            <label className="ops-control-label">Ocean Variable</label>
            <select
              className="ops-select"
              value={variable}
              onChange={(e) => handleVariableChange(e.target.value)}
              disabled={analyzing}
            >
              <option value="Current Speed (m/s)">Current Speed (m/s)</option>
              <option value="Significant Wave Height (m)">Significant Wave Height (m)</option>
              <option value="Sea Surface Height Anomaly (m)">Sea Surface Height Anomaly (m)</option>
              <option value="Thermal Stress Index">Thermal Stress Index (°C-weeks)</option>
            </select>
          </div>

          <div className="ops-control-field">
            <label className="ops-control-label">Basin Scope</label>
            <select
              className="ops-select"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={analyzing}
            >
              {REGION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ops-control-field">
            <label className="ops-control-label">Threshold ({unit})</label>
            <input
              type="number"
              step="0.1"
              className="ops-input"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              disabled={analyzing}
            />
          </div>
        </div>

        <button
          type="button"
          className="ops-btn-action"
          onClick={executeAnalysis}
          disabled={analyzing}
        >
          {analyzing ? (
            <>
              <RefreshCw size={13} className="animate-spin" />
              <span>Analyzing Operational Grids...</span>
            </>
          ) : (
            <>
              <Play size={13} />
              <span>Run Marine Hazard Analysis</span>
            </>
          )}
        </button>
      </div>

      {/* Operational Alert Banner */}
      {error && (
        <div className="ops-alert-banner ops-alert-error">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertOctagon size={16} />
            <div>
              <strong style={{ color: '#fff', marginRight: '6px' }}>Operational Data Unavailable:</strong>
              <span>{error}</span>
            </div>
          </div>
          <button type="button" className="ops-alert-retry-btn" onClick={executeAnalysis}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* KPI Analytical Summary Cards */}
      <div className="ops-kpi-grid">
        <div className="ops-kpi-card kpi-info">
          <div className="ops-kpi-title">Total Exceeded Basin Area</div>
          <div className="ops-kpi-val" style={{ color: '#f59e0b' }}>
            {(totalAreaExceeded ?? 0) > 0 ? `${(totalAreaExceeded ?? 0).toLocaleString()} km²` : '0 km²'}
          </div>
          <div className="ops-kpi-sub">WGS84 spherical cell integration</div>
        </div>

        <div className="ops-kpi-card kpi-critical">
          <div className="ops-kpi-title">Peak Field Intensity</div>
          <div className="ops-kpi-val" style={{ color: '#ff6b7b' }}>
            {(peakValue ?? 0) > 0 ? `${(peakValue ?? 0).toFixed(2)} ${unit}` : 'N/A'}
          </div>
          <div className="ops-kpi-sub">Threshold: {threshold} {unit}</div>
        </div>

        <div className="ops-kpi-card kpi-normal">
          <div className="ops-kpi-title">Monitored Basins Exceeding</div>
          <div className="ops-kpi-val" style={{ color: '#5bb0f5' }}>
            {exceedingCount} of {hazardRegions.length || 5}
          </div>
          <div className="ops-kpi-sub">Sectors exceeding trigger limits</div>
        </div>

        <div className={`ops-kpi-card ${hasCritical ? 'kpi-critical' : hasElevated ? 'kpi-elevated' : 'kpi-normal'}`}>
          <div className="ops-kpi-title">Overall Risk Tier</div>
          <div className="ops-kpi-val" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {hasCritical ? (
              <span style={{ color: '#ff6b7b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertOctagon size={16} /> CRITICAL
              </span>
            ) : hasElevated ? (
              <span style={{ color: '#d49c57', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} /> ELEVATED
              </span>
            ) : (
              <span style={{ color: '#7ec46e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldAlert size={16} /> NORMAL / LOW
              </span>
            )}
          </div>
          <div className="ops-kpi-sub">Multi-factor threshold evaluation</div>
        </div>
      </div>

      {/* Main Split Layout: Map Panel + Analytical Exceedance Table */}
      <div className="ops-split-layout">
        {/* Left: Scientific Raster Map */}
        <div className="ops-panel">
          <div className="ops-panel-header">
            <span className="ops-panel-title">
              <Compass size={14} /> OPERATIONAL GEOSPATIAL RASTER FIELD
            </span>
            <span className="ops-panel-meta">Hover or click cell for in-situ parameters</span>
          </div>

          <div style={{ flex: 1, minHeight: '380px', display: 'flex' }}>
            {gridData ? (
              <GeospatialRasterMap
                latitudes={gridData.latitudes}
                longitudes={gridData.longitudes}
                values={gridData.values}
                mask={gridData.mask}
                unit={gridData.unit}
                variableName={gridData.variable}
                threshold={parseFloat(threshold) || null}
                colorScheme="turbo"
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
        <div className="ops-panel">
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
                  <th style={{ textAlign: 'center' }}>Risk Tier</th>
                </tr>
              </thead>
              <tbody>
                {hazardRegions.length > 0 ? (
                  hazardRegions.map((r, idx) => {
                    const areaExceeded = (r.area_exceeded_km2 ?? (r as unknown as { area_km2?: number }).area_km2 ?? 0);
                    const pctExceeded = (r.exceedance_pct ?? ((r as unknown as { exceedance_fraction?: number }).exceedance_fraction ? (r as unknown as { exceedance_fraction?: number }).exceedance_fraction! * 100 : 0));
                    const maxVal = (r.max_value ?? (r as unknown as { max_value_raw?: number }).max_value_raw ?? 0);
                    const riskTier = r.risk_level || 'LOW';

                    return (
                      <tr key={r.region_id || `${r.name}-${idx}`}>
                        <td style={{ fontWeight: 500, color: '#ffffff' }}>
                          {r.name}
                          <span style={{ display: 'block', fontSize: '9.5px', color: '#505664', marginTop: '1px' }}>
                            {r.status || 'MONITORED'}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>
                          {areaExceeded.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: '#88909e' }}>
                          {pctExceeded.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: '#f59e0b' }}>
                          {maxVal.toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className={`badge-risk ${
                              riskTier === 'CRITICAL'
                                ? 'badge-critical'
                                : riskTier === 'HIGH'
                                ? 'badge-high'
                                : riskTier === 'MODERATE'
                                ? 'badge-moderate'
                                : 'badge-low'
                            }`}
                          >
                            {riskTier}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#505664' }}>
                      {analyzing ? 'Computing geodesic exceedance areas...' : 'No regions currently exceed threshold.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ borderTop: '1px solid #1c212a', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: '#505664' }}>
            <span>Algorithm: WGS84 Geodesic Oblate Spheroid</span>
            <span style={{ color: '#5bb0f5' }}>CMEMS Grid: 0.083°</span>
          </div>
        </div>
      </div>

      {/* Scientific Provenance Audit Card */}
      <ProvenanceCard metadata={provenanceMeta} />
    </div>
  );
};

export const HazardAssessmentView: React.FC = () => {
  return (
    <HazardErrorBoundary>
      <HazardAssessmentInner />
    </HazardErrorBoundary>
  );
};
