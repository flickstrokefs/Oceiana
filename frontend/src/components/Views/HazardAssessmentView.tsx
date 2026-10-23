import React, { useState, useMemo } from 'react';
import {
  Play,
  AlertTriangle,
  ShieldAlert,
  Info,
  Globe2,
  CheckCircle2,
  Compass,
} from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import { RealHazardMap, type HazardRegionData } from './RealHazardMap';

const INITIAL_HAZARD_REGIONS: HazardRegionData[] = [
  {
    id: 'north-arabian-sea',
    name: 'North Arabian Sea',
    area: '125,000',
    area_km2: 125000,
    maxValue: '2.4',
    max_value_raw: 2.4,
    risk_level: 'CRITICAL',
    impactSummary: 'Severe western boundary jet current with rapid surface shear.',
    recommendedAction: 'Autonomous gliders should steer +18° eastward to counter cross-drift. Small craft advisory in effect.',
    bounds: { west: 58.0, east: 71.0, south: 17.0, north: 24.0 },
    polygon: [
      [24.8, 57.0],
      [25.4, 66.5],
      [24.0, 68.8],
      [21.0, 71.5],
      [18.5, 72.8],
      [15.5, 68.5],
      [15.0, 58.0],
      [21.5, 58.5],
    ],
  },
  {
    id: 'bay-of-bengal',
    name: 'Central Bay of Bengal',
    area: '98,000',
    area_km2: 98000,
    maxValue: '2.1',
    max_value_raw: 2.1,
    risk_level: 'HIGH',
    impactSummary: 'Cyclonic eddy kinetic energy causing intense divergence and surface chop.',
    recommendedAction: 'Maintain navigational surveillance. Deep-sea mooring lines under elevated tension.',
    bounds: { west: 81.0, east: 92.0, south: 11.0, north: 21.0 },
    polygon: [
      [21.8, 87.5],
      [22.2, 91.8],
      [19.5, 93.5],
      [16.0, 94.2],
      [10.5, 92.5],
      [8.0, 82.0],
      [13.2, 80.2],
      [16.5, 83.5],
      [19.5, 86.5],
    ],
  },
  {
    id: 'lakshadweep',
    name: 'Lakshadweep Sea',
    area: '62,000',
    area_km2: 62000,
    maxValue: '1.8',
    max_value_raw: 1.8,
    risk_level: 'HIGH',
    impactSummary: 'Coastal Kelvin wave propagation with strong southward current along the shelf.',
    recommendedAction: 'Fishing vessels should exercise caution near coral bank passes. Glider track deviation expected.',
    bounds: { west: 70.0, east: 74.5, south: 8.0, north: 14.0 },
    polygon: [
      [14.0, 71.5],
      [14.0, 74.8],
      [11.5, 75.8],
      [8.0, 77.5],
      [6.0, 73.0],
      [8.0, 71.0],
    ],
  },
  {
    id: 'andaman-sea',
    name: 'Andaman Sea Basin',
    area: '40,000',
    area_km2: 40000,
    maxValue: '1.7',
    max_value_raw: 1.7,
    risk_level: 'MODERATE',
    impactSummary: 'Internal solitary waves and tidal current intensification through island passages.',
    recommendedAction: 'Monitor acoustic transmission anomalies. Subsurface acoustic sensors may experience noise.',
    bounds: { west: 91.5, east: 95.0, south: 9.0, north: 15.0 },
    polygon: [
      [15.5, 93.0],
      [16.0, 97.5],
      [12.0, 98.5],
      [9.5, 98.5],
      [6.0, 95.0],
      [10.0, 92.5],
      [13.5, 93.0],
    ],
  },
  {
    id: 'southern-ocean',
    name: 'Southern Ocean Polar Front',
    area: '160,000',
    area_km2: 160000,
    maxValue: '2.8',
    max_value_raw: 2.8,
    risk_level: 'CRITICAL',
    impactSummary: 'Antarctic Circumpolar Current thermal front with extreme wave-current interactions.',
    recommendedAction: 'High hull-stress warning for research vessels. Deployment of lightweight surface buoys suspended.',
    bounds: { west: 60.0, east: 80.0, south: -62.0, north: -54.0 },
    polygon: [
      [-52.0, 50.0],
      [-52.0, 95.0],
      [-60.0, 95.0],
      [-60.0, 50.0],
    ],
  },
];

export const HazardAssessmentView: React.FC = () => {
  const [variable, setVariable] = useState('Current Speed (m/s)');
  const [threshold, setThreshold] = useState('1.5');
  const [analyzing, setAnalyzing] = useState(false);
  const [hazardRegions, setHazardRegions] = useState<HazardRegionData[]>(INITIAL_HAZARD_REGIONS);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('north-arabian-sea');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  const selectedRegion = useMemo(() => {
    return hazardRegions.find((r) => r.id === selectedRegionId) || hazardRegions[0];
  }, [hazardRegions, selectedRegionId]);

  const totalExceedanceArea = useMemo(() => {
    return hazardRegions.reduce((acc, r) => acc + (r.area_km2 || 0), 0);
  }, [hazardRegions]);

  const peakValue = useMemo(() => {
    return Math.max(...hazardRegions.map((r) => r.max_value_raw || 0), 0);
  }, [hazardRegions]);

  const peakRegion = useMemo(() => {
    return [...hazardRegions].sort((a, b) => (b.max_value_raw || 0) - (a.max_value_raw || 0))[0];
  }, [hazardRegions]);

  const criticalCount = useMemo(() => {
    return hazardRegions.filter((r) => r.risk_level === 'CRITICAL' || r.risk_level === 'HIGH').length;
  }, [hazardRegions]);

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    try {
      const res = await fetch('/api/hazard/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variable,
          threshold: parseFloat(threshold) || 1.5,
          region: 'Indian Ocean',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.timestamp) {
          setLastSyncTime(data.timestamp);
        }
        if (data && Array.isArray(data.regions)) {
          // Merge API output with operational descriptions
          const merged: HazardRegionData[] = data.regions.map((apiReg: Record<string, unknown>, idx: number) => {
            const apiName = String(apiReg.name || '').toLowerCase();
            const fallback =
              INITIAL_HAZARD_REGIONS.find((f) => f.name.toLowerCase() === apiName) ||
              INITIAL_HAZARD_REGIONS[idx % INITIAL_HAZARD_REGIONS.length];
            const maxValRaw = typeof apiReg.max_value_raw === 'number' ? apiReg.max_value_raw : parseFloat(String(apiReg.maxValue)) || 1.5;
            const areaKm2 = typeof apiReg.area_km2 === 'number' ? apiReg.area_km2 : parseFloat(String(apiReg.area).replace(/,/g, '')) || 0;
            const risk = (apiReg.risk_level as HazardRegionData['risk_level']) || (maxValRaw >= 2.0 ? 'CRITICAL' : maxValRaw >= 1.5 ? 'HIGH' : maxValRaw >= 1.0 ? 'MODERATE' : 'LOW');
            return {
              id: fallback.id,
              name: String(apiReg.name || fallback.name),
              area: String(apiReg.area || fallback.area),
              area_km2: areaKm2,
              maxValue: String(apiReg.maxValue || maxValRaw.toFixed(1)),
              max_value_raw: maxValRaw,
              risk_level: risk,
              impactSummary: fallback.impactSummary,
              recommendedAction: fallback.recommendedAction,
              bounds: fallback.bounds,
              polygon: fallback.polygon,
            };
          });
          setHazardRegions(merged);
        }
      }
    } catch {
      // Fall back smoothly to local dataset
    } finally {
      setAnalyzing(false);
    }
  };

  // Automatically sync with live backend on component mount and variable change
  React.useEffect(() => {
    handleRunAnalysis();
  }, [variable]);

  const handleFlyToRegion = (region: HazardRegionData) => {
    // Zoom Cesium globe to region center
    const centerLon = (region.bounds.west + region.bounds.east) / 2;
    const centerLat = (region.bounds.south + region.bounds.north) / 2;
    OceanState.getInstance().requestShowOnGlobe();
    // Dispatch custom event to fly Cesium camera
    window.dispatchEvent(
      new CustomEvent('ariel:fly-to-location', {
        detail: { longitude: centerLon, latitude: centerLat, height: 1800000 },
      })
    );
  };

  return (
    <div className="ariel-view-container hazard-view">
      {/* 1. Header Banner & Executive KPI Strip */}
      <div className="hazard-header-card">
        <div className="hazard-header-top">
          <div className="hazard-title-group">
            <div className="hazard-badge-pill">
              <ShieldAlert size={14} className="text-amber" />
              <span>MARITIME HAZARD INTELLIGENCE</span>
            </div>
            <h1 className="hazard-main-title">
              Oceanic Threshold Exceedance & Operational Safety Assessment
            </h1>
            <p className="hazard-subtitle">
              Real-time geospatial monitoring of ocean current velocities, shear hazards, and maritime safety alerts across Indian Ocean shipping lanes.
            </p>
          </div>

          {/* Quick Analysis Controls Bar */}
          <div className="hazard-controls-inline">
            <div className="hazard-ctrl-item">
              <span className="ctrl-tiny-label">MONITORED VARIABLE</span>
              <select
                className="ariel-select select-sm"
                value={variable}
                onChange={(e) => setVariable(e.target.value)}
              >
                <option value="Current Speed (m/s)">Current Speed (m/s)</option>
                <option value="Significant Wave Height (m)">Significant Wave Height (m)</option>
                <option value="Sea Surface Height Anomaly (m)">Sea Surface Height Anomaly (m)</option>
                <option value="Thermal Stress Index">Thermal Stress Index (°C)</option>
              </select>
            </div>

            <div className="hazard-ctrl-item">
              <span className="ctrl-tiny-label">SAFETY THRESHOLD</span>
              <div className="threshold-input-wrap">
                <input
                  type="number"
                  step="0.1"
                  className="ariel-input input-sm width-20"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                />
                <span className="unit-tag">m/s</span>
              </div>
            </div>

            <button
              type="button"
              className="ariel-btn-teal btn-sm run-analysis-btn"
              onClick={handleRunAnalysis}
              disabled={analyzing}
            >
              <Play size={13} /> {analyzing ? 'Evaluating Basin...' : 'Run Analysis'}
            </button>
          </div>
        </div>

        {/* Executive Summary Cards */}
        <div className="hazard-kpi-row">
          <div className="hazard-kpi-card">
            <span className="kpi-label">TOTAL HAZARDOUS AREA</span>
            <div className="kpi-value-wrap">
              <span className="kpi-number text-amber">{totalExceedanceArea.toLocaleString()}</span>
              <span className="kpi-unit">km²</span>
            </div>
            <span className="kpi-subtext">Ocean surface exceeding {threshold} m/s threshold</span>
          </div>

          <div className="hazard-kpi-card">
            <span className="kpi-label">PEAK BASIN INTENSITY</span>
            <div className="kpi-value-wrap">
              <span className="kpi-number text-coral">{peakValue.toFixed(1)}</span>
              <span className="kpi-unit">m/s</span>
            </div>
            <span className="kpi-subtext">Detected in {peakRegion?.name || 'Indian Ocean'}</span>
          </div>

          <div className="hazard-kpi-card">
            <span className="kpi-label">ACTIVE SECTOR ALERTS</span>
            <div className="kpi-value-wrap">
              <span className="kpi-number text-rose">{criticalCount}</span>
              <span className="kpi-unit">/ {hazardRegions.length} Sectors</span>
            </div>
            <span className="kpi-subtext">Immediate navigational caution</span>
          </div>

          <div className="hazard-kpi-card">
            <span className="kpi-label">OPERATIONAL BASELINE</span>
            <div className="kpi-value-wrap">
              <span className="live-pulse-dot" />
              <span className="kpi-number text-cyan">INCOIS-HCOM</span>
            </div>
            <span className="kpi-subtext">
              {analyzing ? 'Evaluating Basin...' : lastSyncTime ? `Live Sync · ${lastSyncTime}` : 'Real GIS · WGS84 Mercator'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Two-Column Analysis Grid */}
      <div className="hazard-main-grid">
        {/* Left Column: Real GIS Map with Dynamic Streamlines & Shipping Lanes */}
        <div className="hazard-map-panel">
          <div className="panel-subhead">
            <div className="panel-title-group">
              <Compass size={15} className="text-cyan" />
              <span className="panel-title-text">Indian Ocean Current Streamlines &amp; Hazard Exceedance</span>
            </div>
            <div className="panel-legend-badges">
              <span className="mini-chip chip-cyan">🌊 Streamlines: Flow Speed</span>
              <span className="mini-chip chip-amber">⚠️ Polygons: Risk &gt; {threshold} m/s</span>
              <span className="mini-chip chip-blue">🚢 Corridors: Shipping Lanes</span>
            </div>
          </div>
          <RealHazardMap
            hazardRegions={hazardRegions}
            selectedRegionId={selectedRegionId}
            onSelectRegion={setSelectedRegionId}
            threshold={parseFloat(threshold) || 1.5}
            variable={variable}
          />
        </div>

        {/* Right Column: Regions Exceeding Threshold & Operational Advisory */}
        <div className="hazard-right-col">
          {/* Table of Exceedance Zones */}
          <div className="hazard-table-panel">
            <div className="panel-head-simple">
              <div className="table-title-group">
                <AlertTriangle size={15} className="text-amber" />
                <span className="panel-title">Monitored Hazard Sectors</span>
              </div>
              <span className="table-legend-chip">Threshold &gt; {threshold} m/s</span>
            </div>

            <div className="hazard-table-scroll">
              <table className="ariel-styled-table">
                <thead>
                  <tr>
                    <th>MARITIME SECTOR</th>
                    <th>RISK LEVEL</th>
                    <th className="text-right">AREA (KM²)</th>
                    <th className="text-right">MAX VEL</th>
                  </tr>
                </thead>
                <tbody>
                  {hazardRegions.map((r) => {
                    const isSelected = r.id === selectedRegionId;
                    const badgeClass =
                      r.risk_level === 'CRITICAL'
                        ? 'risk-badge-critical'
                        : r.risk_level === 'HIGH'
                        ? 'risk-badge-high'
                        : r.risk_level === 'MODERATE'
                        ? 'risk-badge-moderate'
                        : 'risk-badge-low';

                    return (
                      <tr
                        key={r.id}
                        onClick={() => setSelectedRegionId(r.id)}
                        className={isSelected ? 'row-selected-hazard' : ''}
                        style={{ cursor: 'pointer' }}
                        title="Click to view detailed operational advisory & fly map"
                      >
                        <td>
                          <div className="sector-name-cell">
                            <span
                              className="sector-dot"
                              style={{
                                background:
                                  r.risk_level === 'CRITICAL'
                                    ? '#ef4444'
                                    : r.risk_level === 'HIGH'
                                    ? '#f97316'
                                    : '#eab308',
                              }}
                            />
                            <strong className="text-white">{r.name}</strong>
                          </div>
                        </td>
                        <td>
                          <span className={`risk-pill ${badgeClass}`}>
                            {r.risk_level}
                          </span>
                        </td>
                        <td className="font-mono text-right text-slate-300">{r.area}</td>
                        <td className="font-mono text-right text-coral font-bold">{r.maxValue} m/s</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Operational Advisory Card for Selected Region */}
          <div className="hazard-advisory-card">
            <div className="advisory-card-header">
              <div className="adv-header-left">
                <Info size={16} className="text-cyan" />
                <span className="adv-header-title">
                  Sector Advisory: {selectedRegion.name}
                </span>
              </div>
              <button
                type="button"
                className="ariel-btn-teal btn-compact fly-globe-btn"
                onClick={() => handleFlyToRegion(selectedRegion)}
                title="Fly 3D Cesium camera to this hazard zone"
              >
                <Globe2 size={13} /> View on 3D Globe
              </button>
            </div>

            <div className="advisory-body">
              <div className="advisory-row">
                <span className="adv-label">CURRENT CONDITIONS:</span>
                <p className="adv-text text-slate-200">
                  Peak current speed of <strong className="text-coral">{selectedRegion.maxValue} m/s</strong> observed across {selectedRegion.area} km². {selectedRegion.impactSummary}
                </p>
              </div>

              <div className="advisory-row">
                <span className="adv-label">OPERATIONAL GUIDANCE:</span>
                <p className="adv-text text-amber">
                  <CheckCircle2 size={12} className="inline mr-1 text-amber" />
                  {selectedRegion.recommendedAction}
                </p>
              </div>

              <div className="advisory-coords-bar">
                <span className="coord-chip">
                  Bounds: {selectedRegion.bounds.west}°E–{selectedRegion.bounds.east}°E · {selectedRegion.bounds.south}°N–{selectedRegion.bounds.north}°N
                </span>
                <span className="coord-chip text-cyan">
                  Status: Active Maritime Alert
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
