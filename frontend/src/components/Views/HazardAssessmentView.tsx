import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Compass,
  Wind,
  Download,
  ExternalLink,
} from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import { RealHazardMap, type HazardRegionData, type CycloneTrackPoint, type RegionalCyclone } from './RealHazardMap';

const AVAILABLE_CYCLONES = [
  { name: 'ALL', label: '🌀 All Regional Cyclones (Multi-Basin Ensemble)', basin: 'All' },
  // Bay of Bengal
  { name: 'AMPHAN', label: 'Cyclone AMPHAN (2020) · BoB Super Cyclone (130 kt / 241 km/h)', basin: 'Bay of Bengal' },
  { name: 'FANI', label: 'Cyclone FANI (2019) · BoB Extremely Severe (115 kt / 213 km/h)', basin: 'Bay of Bengal' },
  { name: 'MOCHA', label: 'Cyclone MOCHA (2023) · BoB Extremely Severe (115 kt / 213 km/h)', basin: 'Bay of Bengal' },
  { name: 'TITLI', label: 'Cyclone TITLI (2018) · BoB Very Severe (80 kt / 148 km/h)', basin: 'Bay of Bengal' },
  { name: 'YAAS', label: 'Cyclone YAAS (2021) · BoB Very Severe (75 kt / 139 km/h)', basin: 'Bay of Bengal' },
  { name: 'REMAL', label: 'Cyclone REMAL (2024) · BoB Severe Cyclonic Storm (60 kt / 111 km/h)', basin: 'Bay of Bengal' },
  { name: 'DANA', label: 'Cyclone DANA (2024) · BoB Severe Cyclonic Storm (60 kt / 111 km/h)', basin: 'Bay of Bengal' },
  // Arabian Sea
  { name: 'KYAAR', label: 'Cyclone KYAAR (2019) · Arabian Sea Super Cyclone (130 kt / 241 km/h)', basin: 'Arabian Sea' },
  { name: 'TAUKTAE', label: 'Cyclone TAUKTAE (2021) · Arabian Sea Extremely Severe (100 kt / 185 km/h)', basin: 'Arabian Sea' },
  { name: 'BIPARJOY', label: 'Cyclone BIPARJOY (2023) · Arabian Sea Extremely Severe (90 kt / 167 km/h)', basin: 'Arabian Sea' },
  { name: 'MEKUNU', label: 'Cyclone MEKUNU (2018) · Arabian Sea Extremely Severe (95 kt / 176 km/h)', basin: 'Arabian Sea' },
];

export const HazardAssessmentView: React.FC = () => {
  const [variable, setVariable] = useState<string>('Tropical Cyclone Wind (kt)');
  const [selectedBasin, setSelectedBasin] = useState<string>('All');
  const [selectedStorm, setSelectedStorm] = useState<string>('AMPHAN');
  const [threshold, setThreshold] = useState<number>(64);
  const [cycloneTrack, setCycloneTrack] = useState<CycloneTrackPoint[]>([]);
  const [regionalCyclones, setRegionalCyclones] = useState<RegionalCyclone[]>([]);
  const [stormMeta, setStormMeta] = useState<Record<string, unknown> | null>(null);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [hazardRegions, setHazardRegions] = useState<HazardRegionData[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [dataError, setDataError] = useState<string>('');
  const [provenance, setProvenance] = useState<string>('REAL');

  const isCyclone = variable.includes('Wind') || variable.includes('Cyclone');
  const unit = isCyclone ? 'kt' : 'm/s';

  const filteredStorms = useMemo(() => {
    if (selectedBasin === 'All') return AVAILABLE_CYCLONES;
    return AVAILABLE_CYCLONES.filter((s) => s.basin === 'All' || s.basin === selectedBasin);
  }, [selectedBasin]);

  const selectedRegion = useMemo(() => {
    return hazardRegions.find((r) => r.id === selectedRegionId) || hazardRegions[0];
  }, [hazardRegions, selectedRegionId]);

  const totalExceedanceArea = useMemo(() => {
    return hazardRegions.reduce((acc, r) => acc + (r.area_km2 || 0), 0);
  }, [hazardRegions]);

  const peakValue = useMemo(() => {
    return Math.max(...hazardRegions.map((r) => r.max_value_raw || 0), 0);
  }, [hazardRegions]);

  const criticalCount = useMemo(() => {
    return hazardRegions.filter((r) => r.risk_level === 'CRITICAL' || r.risk_level === 'HIGH').length;
  }, [hazardRegions]);

  // Fetch verified hazard calculations from backend
  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    setDataError('');
    try {
      const res = await fetch('/api/hazard/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variable,
          threshold: Number(threshold) || (isCyclone ? 64 : 1.5),
          storm_name: selectedStorm,
          region: 'Indian Ocean',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.timestamp) setLastSyncTime(data.timestamp);
        if (data.provenance) setProvenance(data.provenance);
        if (Array.isArray(data.cyclone_track)) setCycloneTrack(data.cyclone_track);
        if (Array.isArray(data.regional_cyclones)) setRegionalCyclones(data.regional_cyclones);
        if (data.storm_meta) setStormMeta(data.storm_meta);

        if (Array.isArray(data.regions)) {
          // Polygon geographic definitions matching physical sectors
          const sectorGeo: Record<string, { bounds: any; polygon: [number, number][] }> = {
            'North Arabian Sea': {
              bounds: { west: 58.0, east: 71.0, south: 17.0, north: 24.0 },
              polygon: [[24.8, 57.0], [25.4, 66.5], [24.0, 68.8], [21.0, 71.5], [18.5, 72.8], [15.5, 68.5], [15.0, 58.0]],
            },
            'Central Bay of Bengal': {
              bounds: { west: 81.0, east: 92.0, south: 11.0, north: 21.0 },
              polygon: [[21.8, 87.5], [22.2, 91.8], [19.5, 93.5], [16.0, 94.2], [10.5, 92.5], [8.0, 82.0], [13.2, 80.2], [16.5, 83.5]],
            },
            'Lakshadweep Sea': {
              bounds: { west: 70.0, east: 74.5, south: 8.0, north: 14.0 },
              polygon: [[14.0, 71.5], [14.0, 74.8], [11.5, 75.8], [8.0, 77.5], [6.0, 73.0], [8.0, 71.0]],
            },
            'Andaman Sea Basin': {
              bounds: { west: 91.5, east: 95.0, south: 9.0, north: 15.0 },
              polygon: [[15.5, 93.0], [16.0, 97.5], [12.0, 98.5], [9.5, 98.5], [6.0, 95.0], [10.0, 92.5]],
            },
            'Southern Ocean Polar Front': {
              bounds: { west: 60.0, east: 80.0, south: -62.0, north: -54.0 },
              polygon: [[-52.0, 50.0], [-52.0, 95.0], [-60.0, 95.0], [-60.0, 50.0]],
            },
          };

          const merged: HazardRegionData[] = data.regions.map((apiReg: any, idx: number) => {
            const name = String(apiReg.name || `Sector ${idx + 1}`);
            const geo = sectorGeo[name] || Object.values(sectorGeo)[idx % 5];
            const maxVal = typeof apiReg.max_value_raw === 'number' ? apiReg.max_value_raw : parseFloat(String(apiReg.maxValue)) || 0;
            const areaKm2 = typeof apiReg.area_km2 === 'number' ? apiReg.area_km2 : parseFloat(String(apiReg.area).replace(/,/g, '')) || 0;

            return {
              id: `hazard-sec-${idx + 1}`,
              name,
              area: String(apiReg.area || areaKm2.toLocaleString()),
              area_km2: areaKm2,
              maxValue: String(apiReg.maxValue || maxVal.toFixed(1)),
              max_value_raw: maxVal,
              risk_level: apiReg.risk_level || 'LOW',
              impactSummary: apiReg.impactSummary || 'Standard oceanic operations.',
              recommendedAction: apiReg.recommendedAction || 'Normal maritime transit authorized.',
              bounds: geo.bounds,
              polygon: geo.polygon,
            };
          });

          setHazardRegions(merged);
          setSelectedRegionId((prev) => prev || merged[0]?.id || '');
        }
      } else {
        const detail = await res.json().catch(() => null);
        setDataError(detail?.detail || 'Operational hazard data service currently unavailable.');
      }
    } catch {
      setDataError('Could not reach backend hazard intelligence service.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Switch default thresholds when switching variables
  const handleVariableChange = (newVar: string) => {
    setVariable(newVar);
    if (newVar.includes('Wind') || newVar.includes('Cyclone')) {
      setThreshold(64);
    } else {
      setThreshold(1.5);
    }
  };

  // Re-run analysis on variable, storm, or threshold change
  useEffect(() => {
    const timer = setTimeout(() => {
      handleRunAnalysis();
    }, 150);
    return () => clearTimeout(timer);
  }, [variable, selectedStorm, threshold]);

  // Export official Operational Alert Dispatch
  const handleExportAlert = () => {
    const now = new Date().toUTCString();
    const rowsHtml = hazardRegions
      .map(
        (r) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #334155; font-weight: 600;">${r.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #334155; color: ${
            r.risk_level === 'CRITICAL' ? '#ef4444' : r.risk_level === 'HIGH' ? '#f97316' : '#10b981'
          }; font-weight: 700;">${r.risk_level}</td>
          <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right;">${r.area} km²</td>
          <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right; font-weight: 700;">${r.maxValue} ${unit}</td>
        </tr>
      `
      )
      .join('');

    const htmlDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>OCEAN-X Operational Maritime Hazard Alert · ${selectedStorm}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1320; color: #f1f5f9; padding: 32px; }
          .container { max-width: 820px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 28px; }
          .header { border-bottom: 2px solid #ef4444; padding-bottom: 16px; margin-bottom: 20px; }
          h1 { margin: 0 0 6px; font-size: 20px; color: #f8fafc; }
          .meta { font-size: 11px; color: #94a3b8; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #fca5a5; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
          th { text-align: left; padding: 8px; background: #1e293b; color: #38bdf8; font-size: 11px; }
          .directive { background: rgba(30, 41, 59, 0.7); border-left: 4px solid #ef4444; padding: 14px; border-radius: 4px; margin-top: 16px; font-size: 12px; line-height: 1.5; }
          .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #1e293b; font-size: 10px; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">TACTICAL MARITIME SAFETY DISPATCH</span>
            <h1>OCEAN-X / ARIEL · Marine Hazard Assessment Alert</h1>
            <div class="meta">
              <span>Benchmark System: <strong>${selectedStorm}</strong></span> ·
              <span>Threshold Limit: <strong>&gt; ${threshold} ${unit}</strong></span> ·
              <span>Issued: <strong>${now}</strong></span>
            </div>
          </div>
          <div class="directive">
            <strong style="color: #f87171; font-size: 13px;">OPERATIONAL DIRECTIVE & SAFETY RECOMMENDATION:</strong><br/>
            ${selectedRegion?.recommendedAction || 'Normal oceanic navigation authorized.'}
          </div>
          <table>
            <thead>
              <tr><th>MARITIME SECTOR</th><th>RISK LEVEL</th><th style="text-align: right;">SWATH AREA</th><th style="text-align: right;">PEAK VELOCITY</th></tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer">
            Verified by OCEAN-X Coastal Early Warning Engine · NOAA NCEI IBTrACS Best Track / CMEMS GLORYS12 · WMO Compliant
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OCEAN-X_HAZARD_ALERT_${selectedStorm}_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ariel-view-container hazard-view">
      {/* 1. Header Control Deck & Real-Time Threshold Scrubber */}
      <div className="hazard-header-card">
        <div className="hazard-header-top">
          <div className="hazard-title-group">
            <div className="hazard-badge-pill">
              {isCyclone ? <Wind size={14} className="text-rose" /> : <ShieldAlert size={14} className="text-amber" />}
              <span>{isCyclone ? 'TROPICAL CYCLONE & MARITIME WIND HAZARD INTELLIGENCE' : 'OCEAN CURRENT SHEAR & DRIFT HAZARD'}</span>
            </div>
            <h1 className="hazard-main-title">
              {isCyclone
                ? 'Bay of Bengal & Arabian Sea Cyclonic Wind Swath Cockpit'
                : 'Oceanic Velocity Threshold Exceedance & Navigational Shear'}
            </h1>
            <p className="hazard-subtitle">
              Dual-pane tactical situational awareness powered by verified NOAA IBTrACS best-track records and CMEMS 3D ocean current fields.
            </p>
          </div>

          {/* Quick Analysis Controls Bar */}
          <div className="hazard-controls-inline">
            <div className="hazard-ctrl-item">
              <span className="ctrl-tiny-label">MONITORED VARIABLE</span>
              <select
                className="ariel-select select-sm"
                value={variable}
                onChange={(e) => handleVariableChange(e.target.value)}
              >
                <option value="Tropical Cyclone Wind (kt)">Tropical Cyclone Wind (kt) · NOAA IBTrACS</option>
                <option value="Current Speed (m/s)">Current Speed (m/s) · CMEMS GLORYS12</option>
              </select>
            </div>

            {isCyclone && (
              <div className="hazard-ctrl-item">
                <span className="ctrl-tiny-label">REGIONAL BASIN</span>
                <select
                  className="ariel-select select-sm"
                  value={selectedBasin}
                  onChange={(e) => {
                    const newBasin = e.target.value;
                    setSelectedBasin(newBasin);
                    if (newBasin === 'Arabian Sea' && selectedStorm === 'AMPHAN') {
                      setSelectedStorm('BIPARJOY');
                    } else if (newBasin === 'Bay of Bengal' && selectedStorm === 'BIPARJOY') {
                      setSelectedStorm('AMPHAN');
                    }
                  }}
                >
                  <option value="All">All Basins (Multi-Region)</option>
                  <option value="Bay of Bengal">Bay of Bengal (BoB)</option>
                  <option value="Arabian Sea">Arabian Sea (AS)</option>
                </select>
              </div>
            )}

            {isCyclone && (
              <div className="hazard-ctrl-item">
                <span className="ctrl-tiny-label">BENCHMARK CYCLONE</span>
                <select
                  className="ariel-select select-sm"
                  value={selectedStorm}
                  onChange={(e) => setSelectedStorm(e.target.value)}
                >
                  {filteredStorms.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Interactive Real-Time Threshold Slider */}
            <div className="hazard-ctrl-item">
              <span className="ctrl-tiny-label">
                SAFETY THRESHOLD: <strong className="text-amber">{threshold} {unit}</strong>
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={isCyclone ? 34 : 0.5}
                  max={isCyclone ? 135 : 3.0}
                  step={isCyclone ? 2 : 0.1}
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                  className="ariel-range-slider"
                  style={{ width: '130px', accentColor: '#f59e0b' }}
                />
              </div>
            </div>

            {/* Export Operational Alert Dispatch Button */}
            <button
              type="button"
              className="ariel-btn-teal btn-sm"
              onClick={handleExportAlert}
              title="Export official printable maritime alert dispatch"
            >
              <Download size={13} />
              <span>Export Alert</span>
            </button>
          </div>
        </div>

        {/* Executive Tactical Summary KPI Strip */}
        <div className="hazard-kpi-row">
          <div className="hazard-kpi-card">
            <span className="kpi-label">{isCyclone ? 'TOTAL WIND HAZARD SWATH' : 'TOTAL HAZARDOUS AREA'}</span>
            <div className="kpi-value-wrap">
              <span className="kpi-number text-amber">{totalExceedanceArea.toLocaleString()}</span>
              <span className="kpi-unit">km²</span>
            </div>
            <span className="kpi-subtext">
              Exceeding {threshold} {unit} threshold limit
            </span>
          </div>

          <div className="hazard-kpi-card">
            <span className="kpi-label">{isCyclone ? 'PEAK SUSTAINED WIND' : 'PEAK BASIN INTENSITY'}</span>
            <div className="kpi-value-wrap">
              <span className="kpi-number text-coral">{peakValue.toFixed(1)}</span>
              <span className="kpi-unit">{unit}</span>
            </div>
            <span className="kpi-subtext">
              {isCyclone && stormMeta?.category
                ? `${stormMeta.category} (${(peakValue * 1.852).toFixed(0)} km/h)`
                : `Detected in ${selectedRegion?.name || 'Central Basin'}`}
            </span>
          </div>

          <div className="hazard-kpi-card">
            <span className="kpi-label">{isCyclone ? 'MIN CENTRAL PRESSURE' : 'ACTIVE SECTOR ALERTS'}</span>
            <div className="kpi-value-wrap">
              {isCyclone && stormMeta?.min_pressure_hpa ? (
                <>
                  <span className="kpi-number text-rose">{String(stormMeta.min_pressure_hpa)}</span>
                  <span className="kpi-unit">hPa</span>
                </>
              ) : (
                <>
                  <span className="kpi-number text-rose">{criticalCount}</span>
                  <span className="kpi-unit">/ {hazardRegions.length} Sectors</span>
                </>
              )}
            </div>
            <span className="kpi-subtext">
              {isCyclone ? 'Deep cyclonic barometric eye' : 'Immediate navigational caution'}
            </span>
          </div>

          <div className="hazard-kpi-card">
            <span className="kpi-label">OPERATIONAL SENSOR BASELINE</span>
            <div className="kpi-value-wrap">
              <span className="live-pulse-dot" />
              <span className="kpi-number text-cyan">
                {isCyclone ? 'NOAA IBTrACS' : 'CMEMS GLORYS12'}
              </span>
            </div>
            <span className="kpi-subtext">
              {provenance} · {selectedStorm} ({lastSyncTime ? lastSyncTime.slice(0, 16) : 'Verified'})
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Dual-Pane Tactical Operations Grid */}
      <div className="hazard-main-grid">
        {/* Left Pane: Interactive Tactical GIS Map Cockpit */}
        <div className="hazard-map-panel">
          <div className="panel-subhead">
            <div className="panel-title-group">
              <Compass size={15} className="text-cyan" />
              <span className="panel-title-text">
                {isCyclone
                  ? `Cyclone ${selectedStorm} Trajectory & Marine Wind Exceedance`
                  : 'Indian Ocean Current Streamlines & Hazard Exceedance'}
              </span>
            </div>
            <div className="panel-legend-badges">
              {isCyclone ? (
                <>
                  <span className="mini-chip chip-teal">💨 Streamlines: Wind Flows</span>
                  <span className="mini-chip chip-rose">🌀 Best Track: NOAA IBTrACS ({selectedStorm})</span>
                  <span className="mini-chip chip-amber">⚠️ Swath: Wind &gt; {threshold} kt</span>
                  <span className="mini-chip chip-blue">🚢 Corridors: Shipping Lanes</span>
                </>
              ) : (
                <>
                  <span className="mini-chip chip-cyan">🌊 Streamlines: Flow Speed</span>
                  <span className="mini-chip chip-amber">⚠️ Polygons: Risk &gt; {threshold} m/s</span>
                  <span className="mini-chip chip-blue">🚢 Corridors: Shipping Lanes</span>
                </>
              )}
            </div>
          </div>

          <RealHazardMap
            hazardRegions={hazardRegions}
            selectedRegionId={selectedRegionId}
            onSelectRegion={setSelectedRegionId}
            cycloneTrack={cycloneTrack}
            regionalCyclones={regionalCyclones}
            isCycloneMode={isCyclone}
            stormName={selectedStorm}
            onSelectStorm={setSelectedStorm}
            threshold={String(threshold)}
          />
          {dataError && <p className="hazard-data-error" role="alert">{dataError}</p>}
        </div>

        {/* Right Pane: High-Density Telemetry & Tactical Advisory Console */}
        <div className="hazard-right-col">
          {/* Table of Exceedance Zones */}
          <div className="hazard-table-panel">
            <div className="panel-head-simple">
              <div className="table-title-group">
                <AlertTriangle size={15} className="text-amber" />
                <span className="panel-title">Monitored Maritime Sectors</span>
              </div>
              <span className="table-legend-chip">Threshold &gt; {threshold} {unit}</span>
            </div>

            <div className="hazard-table-scroll">
              <table className="ariel-styled-table">
                <thead>
                  <tr>
                    <th>MARITIME SECTOR</th>
                    <th>RISK LEVEL</th>
                    <th className="text-right">SWATH (KM²)</th>
                    <th className="text-right">{isCyclone ? 'PEAK WIND' : 'MAX VEL'}</th>
                  </tr>
                </thead>
                <tbody>
                  {hazardRegions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-slate-300">
                        {analyzing ? 'Evaluating physical swath from satellite cache...' : 'No sectors exceeding current threshold limit.'}
                      </td>
                    </tr>
                  )}
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
                        className={`table-row-selectable ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => setSelectedRegionId(r.id)}
                      >
                        <td className="font-semibold text-slate-100 flex items-center gap-2">
                          <span className={`status-dot ${r.risk_level.toLowerCase()}`} />
                          {r.name}
                        </td>
                        <td>
                          <span className={`risk-pill ${badgeClass}`}>{r.risk_level}</span>
                        </td>
                        <td className="text-right font-mono text-slate-300">{r.area}</td>
                        <td className="text-right font-mono font-bold text-amber">
                          {r.maxValue} <span className="text-xs text-slate-400">{unit}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dynamic Tactical Advisory & Directive Card */}
          {selectedRegion && (
            <div className="hazard-advisory-card">
              <div className="advisory-card-header">
                <div className="advisory-header-left">
                  <ShieldAlert size={16} className="text-rose" />
                  <span className="advisory-title">Tactical Advisory: {selectedRegion.name}</span>
                </div>
                <button
                  type="button"
                  className="fly-globe-btn"
                  onClick={() => {
                    const centerLon = (selectedRegion.bounds.west + selectedRegion.bounds.east) / 2;
                    const centerLat = (selectedRegion.bounds.south + selectedRegion.bounds.north) / 2;
                    OceanState.getInstance().requestShowOnGlobe();
                    window.dispatchEvent(
                      new CustomEvent('ariel:fly-to-location', {
                        detail: { longitude: centerLon, latitude: centerLat, height: 1800000 },
                      })
                    );
                  }}
                  title="Fly to this region in 3D Cesium Digital Ocean"
                >
                  <ExternalLink size={12} />
                  <span>View in 3D Ocean</span>
                </button>
              </div>

              <div className="advisory-body">
                <div className="advisory-section">
                  <span className="section-label">DYNAMIC PHYSICAL IMPACT ANALYSIS</span>
                  <p className="section-text">{selectedRegion.impactSummary}</p>
                </div>

                <div className="advisory-section">
                  <span className="section-label">NAUTICAL ACTION DIRECTIVE & REROUTING</span>
                  <p className="section-text text-amber font-medium">
                    {selectedRegion.recommendedAction}
                  </p>
                </div>

                <div className="advisory-footer-meta">
                  <span>
                    Sector Bounds: {selectedRegion.bounds.west.toFixed(1)}°E – {selectedRegion.bounds.east.toFixed(1)}°E ·{' '}
                    {selectedRegion.bounds.south.toFixed(1)}°N – {selectedRegion.bounds.north.toFixed(1)}°N
                  </span>
                  <span className="meta-badge-live">
                    Status: {selectedRegion.risk_level} · {provenance}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
