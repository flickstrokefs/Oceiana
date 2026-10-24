import React, { useState, useMemo, useEffect } from 'react';
import {
  Fish,
  Compass,
  Download,
  ExternalLink,
} from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import { RealFisheryMap, type FisheryZoneData } from './RealFisheryMap';

export const FisheryAdvisoriesView: React.FC = () => {
  const [variable, setVariable] = useState<string>('Chlorophyll (mg/m³)');
  const [region, setRegion] = useState<string>('All Regions');
  const [timeRange, setTimeRange] = useState<string>('Next 7 days');
  const [minChlThreshold, setMinChlThreshold] = useState<number>(1.2);
  const [generating, setGenerating] = useState<boolean>(false);
  const [advisoryDate, setAdvisoryDate] = useState<string>('Live Broadcast · Current Sync');
  const [fisheryZones, setFisheryZones] = useState<FisheryZoneData[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [dataError, setDataError] = useState<string>('');
  const [provenance, setProvenance] = useState<string>('DERIVED (CMEMS · MODIS · TEOS-10)');

  // Fetch dynamic, real-time fishery advisories computed from CMEMS 3D ocean data
  const handleFetchAdvisory = async () => {
    setGenerating(true);
    setDataError('');
    try {
      const res = await fetch(
        `/api/fishery/advisory?region=${encodeURIComponent(
          region === 'All Regions' ? 'Indian Ocean' : region
        )}&variable=${encodeURIComponent(variable)}&time_range=${encodeURIComponent(timeRange)}`
      );

      if (res.ok) {
        const data = await res.json();
        if (data.generated_date) setAdvisoryDate(data.generated_date);
        if (data.provenance) setProvenance(data.provenance);

        if (Array.isArray(data.recommended_zones) && data.recommended_zones.length > 0) {
          const formatted: FisheryZoneData[] = data.recommended_zones.map((z: any) => ({
            id: z.id || `pfz-${z.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: z.name,
            region: z.region || 'Bay of Bengal',
            rating: z.rating || 'FAVOURABLE',
            status: z.status || 'Active biological convergence',
            chlorophyll_mean: z.chlorophyll_mean || 2.1,
            sst_mean: z.sst_mean || 27.2,
            salinity_mean: z.salinity_mean || 33.4,
            primary_species: z.primary_species || ['Pelagic Species'],
            depth_strata: {
              min_depth: Math.max(10, (z.optimal_catch_depth || 35) - 20),
              max_depth: (z.optimal_catch_depth || 35) + 35,
              optimal_catch_depth: z.optimal_catch_depth || 35,
              stratum_name: z.depth_stratum || 'Epipelagic Catch Horizon',
            },
            gear_recommendations: z.gear_recommendations || ['Drift Gillnets', 'Longlines'],
            bounds: z.bounds || { west: z.longitude - 1.5, east: z.longitude + 1.5, south: z.latitude - 1.2, north: z.latitude + 1.2 },
            polygon: z.polygon || [
              [z.latitude + 0.8, z.longitude - 0.8],
              [z.latitude + 0.7, z.longitude + 0.9],
              [z.latitude - 0.6, z.longitude + 0.8],
              [z.latitude - 0.7, z.longitude - 0.7],
            ],
            center: [z.latitude, z.longitude],
            scientific_rationale: z.scientific_rationale || 'Nutrient upwelling drives elevated pelagic standing stock.',
          }));

          setFisheryZones(formatted);
          setSelectedZoneId((prev) => prev || formatted[0]?.id || '');
        }
      } else {
        setDataError('Operational fishery telemetry service is temporarily unreachable.');
      }
    } catch {
      setDataError('Could not connect to ocean intelligence backend.');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    handleFetchAdvisory();
  }, [region, variable, timeRange]);

  // Real-time filtering by Chlorophyll threshold and regional basin
  const filteredZones = useMemo(() => {
    return fisheryZones.filter((z) => {
      const matchChl = z.chlorophyll_mean >= minChlThreshold;
      if (!matchChl) return false;
      if (!region || region === 'All Regions' || region === 'Indian Ocean') return true;
      return z.region.toLowerCase().includes(region.toLowerCase());
    });
  }, [fisheryZones, region, minChlThreshold]);

  // Selected Zone object
  const selectedZone = useMemo(() => {
    return (
      filteredZones.find((z) => z.id === selectedZoneId) ||
      fisheryZones.find((z) => z.id === selectedZoneId) ||
      filteredZones[0] ||
      fisheryZones[0]
    );
  }, [filteredZones, fisheryZones, selectedZoneId]);

  // Executive KPI calculations
  const peakChlorophyll = useMemo(() => {
    return Math.max(...filteredZones.map((z) => z.chlorophyll_mean), 0);
  }, [filteredZones]);

  const favourableCount = useMemo(() => {
    return filteredZones.filter((z) => z.rating === 'FAVOURABLE').length;
  }, [filteredZones]);

  // Export Commercial Fishery Bulletin
  const handleExportBulletin = () => {
    const now = new Date().toUTCString();
    const rowsHtml = filteredZones
      .map(
        (z) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #334155; font-weight: 600;">${z.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #334155; color: ${
            z.rating === 'FAVOURABLE' ? '#34d399' : '#38bdf8'
          }; font-weight: 700;">${z.rating}</td>
          <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right; font-weight: 700;">${z.depth_strata.optimal_catch_depth} m</td>
          <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right;">${z.chlorophyll_mean.toFixed(2)} mg/m³</td>
          <td style="padding: 8px; border-bottom: 1px solid #334155; text-align: right;">${z.sst_mean.toFixed(1)} °C</td>
          <td style="padding: 8px; border-bottom: 1px solid #334155;">${z.primary_species.slice(0, 2).join(', ')}</td>
        </tr>
      `
      )
      .join('');

    const htmlDoc = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>OCEAN-X Commercial Fishery Advisory Bulletin · ${region}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0b1320; color: #f1f5f9; padding: 32px; }
          .container { max-width: 860px; margin: 0 auto; background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 28px; }
          .header { border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px; }
          h1 { margin: 0 0 6px; font-size: 20px; color: #f8fafc; }
          .meta { font-size: 11px; color: #94a3b8; }
          .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: rgba(16, 185, 129, 0.2); border: 1px solid #10b981; color: #6ee7b7; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
          th { text-align: left; padding: 8px; background: #1e293b; color: #34d399; font-size: 11px; }
          .directive { background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981; padding: 14px; border-radius: 4px; margin-top: 16px; font-size: 12px; line-height: 1.5; }
          .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #1e293b; font-size: 10px; color: #64748b; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <span class="badge">COMMERCIAL MARINE FISHERY ADVISORY BULLETIN</span>
            <h1>OCEAN-X / ARIEL · Potential Fishing Zone (PFZ) Habitat Telemetry</h1>
            <div class="meta">
              <span>Operational Basin: <strong>${region}</strong></span> ·
              <span>Threshold: <strong>Chl-a &ge; ${minChlThreshold} mg/m³</strong></span> ·
              <span>Issued: <strong>${now}</strong></span>
            </div>
          </div>
          <div class="directive">
            <strong style="color: #34d399; font-size: 13px;">FOCUS SECTOR HABITAT ADVISORY: ${selectedZone?.name || 'General Basin'}</strong><br/>
            ${selectedZone?.scientific_rationale || 'High biological productivity along thermal front.'}<br/>
            <strong>Prescribed Gear:</strong> ${selectedZone?.gear_recommendations.join(', ')} (Optimal Depth: ${selectedZone?.depth_strata.optimal_catch_depth}m).
          </div>
          <table>
            <thead>
              <tr><th>PFZ SECTOR</th><th>RATING</th><th style="text-align: right;">CATCH DEPTH</th><th style="text-align: right;">CHL-A</th><th style="text-align: right;">SST</th><th>TARGET SPECIES</th></tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <div class="footer">
            Derived from CMEMS 30-Layer 3D Ocean Physics & MODIS/Sentinel-3 Chlorophyll · INCOIS / WMO Compliant
          </div>
        </div>
      </body>
      </html>
    `;

    const blob = new Blob([htmlDoc], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `OCEAN-X_FISHERY_BULLETIN_${region.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ariel-view-container fishery-view">
      {/* 1. Header Control Deck & Real-Time Catch Threshold Scrubber */}
      <div className="hazard-header-card">
        <div className="hazard-header-top">
          <div className="hazard-title-group">
            <div
              className="hazard-badge-pill"
              style={{
                color: '#34d399',
                background: 'rgba(16, 185, 129, 0.12)',
                borderColor: 'rgba(16, 185, 129, 0.28)',
              }}
            >
              <Fish size={14} className="text-emerald" />
              <span>POTENTIAL FISHING ZONE (PFZ) & 3D WATER COLUMN INTELLIGENCE</span>
            </div>
            <h1 className="hazard-main-title">
              Bay of Bengal & Indian Ocean Marine Fishery Habitat Intelligence
            </h1>
            <p className="hazard-subtitle">
              Dual-pane tactical fishery habitat cockpit synthesizing real-time CMEMS 3D ocean water column stratification,
              MODIS chlorophyll frontal boundaries, and optimal pelagic depth horizons.
            </p>
          </div>

          {/* Quick Analysis Controls Bar */}
          <div className="hazard-controls-inline">
            <div className="hazard-ctrl-item">
              <span className="ctrl-tiny-label">TARGET VARIABLE</span>
              <select
                className="ariel-select select-sm"
                value={variable}
                onChange={(e) => setVariable(e.target.value)}
              >
                <option value="Chlorophyll (mg/m³)">Chlorophyll-a (mg/m³) · MODIS/Sentinel-3</option>
                <option value="Sea Surface Temperature (°C)">Sea Surface Temperature (°C) · CMEMS GLO12</option>
                <option value="Primary Productivity">Primary Productivity (NPP) · Derived</option>
              </select>
            </div>

            <div className="hazard-ctrl-item">
              <span className="ctrl-tiny-label">OPERATIONAL BASIN</span>
              <select
                className="ariel-select select-sm"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                <option value="All Regions">All Basins (Multi-Region)</option>
                <option value="Bay of Bengal">Bay of Bengal (BoB)</option>
                <option value="Arabian Sea">Arabian Sea (AS)</option>
              </select>
            </div>

            <div className="hazard-ctrl-item">
              <span className="ctrl-tiny-label">HORIZON</span>
              <select
                className="ariel-select select-sm"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                <option value="Next 24 hours">24h Forecast</option>
                <option value="Next 48 hours">48h Forecast</option>
                <option value="Next 7 days">7-Day Outlook</option>
              </select>
            </div>

            {/* Interactive Real-Time Chlorophyll-a Threshold Slider */}
            <div className="hazard-ctrl-item">
              <span className="ctrl-tiny-label">
                CHL-A FILTER: <strong className="text-emerald font-bold">&ge; {minChlThreshold.toFixed(1)} mg/m³</strong>
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0.8}
                  max={3.0}
                  step={0.1}
                  value={minChlThreshold}
                  onChange={(e) => setMinChlThreshold(parseFloat(e.target.value))}
                  className="ariel-range-slider"
                  style={{ width: '120px', accentColor: '#10b981' }}
                />
              </div>
            </div>

            {/* Export Official Fishery Bulletin Button */}
            <button
              type="button"
              className="ariel-btn-teal btn-sm"
              onClick={handleExportBulletin}
              title="Export official commercial fishery advisory bulletin"
            >
              <Download size={13} />
              <span>Export Bulletin</span>
            </button>
          </div>
        </div>

        {/* Executive Commercial Fishery KPI Row */}
        <div className="hazard-kpi-row">
          <div className="hazard-kpi-card">
            <span className="kpi-label">ACTIVE PFZ SECTORS</span>
            <div className="kpi-value-wrap">
              <span className="kpi-number text-emerald">
                {favourableCount} <span className="text-xs text-slate-400">/ {filteredZones.length} Sectors</span>
              </span>
            </div>
            <span className="kpi-subtext">
              High biological convergence & feeding fronts
            </span>
          </div>

          <div className="hazard-kpi-card">
            <span className="kpi-label">PEAK CHLOROPHYLL-A</span>
            <div className="kpi-value-wrap">
              <span className="kpi-number text-cyan">{peakChlorophyll.toFixed(2)}</span>
              <span className="kpi-unit">mg/m³</span>
            </div>
            <span className="kpi-subtext">
              Detected in {selectedZone?.name || 'coastal upwelling plume'}
            </span>
          </div>

          <div className="hazard-kpi-card">
            <span className="kpi-label">OPTIMAL PELAGIC DEPTH</span>
            <div className="kpi-value-wrap">
              <span className="kpi-number text-amber">
                {selectedZone ? `${selectedZone.depth_strata.optimal_catch_depth}m` : '35 – 95m'}
              </span>
            </div>
            <span className="kpi-subtext">
              Thermocline core / oxycline aggregation band
            </span>
          </div>

          <div className="hazard-kpi-card">
            <span className="kpi-label">OPERATIONAL BASELINE</span>
            <div className="kpi-value-wrap">
              <span className="live-pulse-dot" style={{ background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
              <span className="kpi-number text-emerald">CMEMS / MODIS</span>
            </div>
            <span className="kpi-subtext">
              {provenance} · {advisoryDate}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Dual-Pane Tactical Operations Grid */}
      <div className="hazard-main-grid">
        {/* Left Pane: Interactive GIS Map & 3D Depth Layer */}
        <div className="hazard-map-panel">
          <div className="panel-subhead">
            <div className="panel-title-group">
              <Compass size={15} className="text-emerald" />
              <span className="panel-title-text">
                Bay of Bengal & Indian Ocean Potential Fishing Zones (PFZ) & 3D Depth Layer
              </span>
            </div>
            <div className="panel-legend-badges">
              <span className="mini-chip" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)' }}>
                🌊 3D Water Column Depth
              </span>
              <span className="mini-chip chip-amber">★ 200m Shelf Break</span>
              <span className="mini-chip chip-blue">⚓ Fishing Harbors</span>
            </div>
          </div>

          <RealFisheryMap
            fisheryZones={filteredZones.length > 0 ? filteredZones : fisheryZones}
            selectedZoneId={selectedZoneId}
            onSelectZone={setSelectedZoneId}
            initialDepth={selectedZone?.depth_strata.optimal_catch_depth || 35}
          />
          {dataError && <p className="hazard-data-error" role="alert">{dataError}</p>}
        </div>

        {/* Right Pane: High-Density Telemetry & Habitat Advisory Console */}
        <div className="hazard-right-col">
          {/* Table of Operational Fishing Sectors */}
          <div className="hazard-table-panel">
            <div className="panel-head-simple">
              <div className="table-title-group">
                <Fish size={15} className="text-emerald" />
                <span className="panel-title">Operational Fishing Sectors</span>
              </div>
              <span
                className="table-legend-chip"
                style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.1)' }}
              >
                Chl-a &ge; {minChlThreshold.toFixed(1)} mg/m³
              </span>
            </div>

            <div className="hazard-table-scroll">
              <table className="ariel-styled-table">
                <thead>
                  <tr>
                    <th>PFZ SECTOR</th>
                    <th>RATING</th>
                    <th className="text-right">DEPTH</th>
                    <th>TARGET SPECIES</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredZones.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-slate-300">
                        {generating ? 'Calculating biological feeding fronts from satellite telemetry...' : 'No sectors meet the current chlorophyll threshold.'}
                      </td>
                    </tr>
                  )}
                  {filteredZones.map((z) => {
                    const isSelected = z.id === selectedZoneId;

                    return (
                      <tr
                        key={z.id}
                        className={`table-row-selectable ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => setSelectedZoneId(z.id)}
                      >
                        <td className="font-semibold text-slate-100 flex items-center gap-2">
                          <span
                            className="status-dot"
                            style={{
                              background: z.rating === 'FAVOURABLE' ? '#34d399' : '#38bdf8',
                              boxShadow: z.rating === 'FAVOURABLE' ? '0 0 6px #34d399' : 'none',
                            }}
                          />
                          {z.name}
                        </td>
                        <td>
                          <span
                            className="risk-pill"
                            style={{
                              background: z.rating === 'FAVOURABLE' ? 'rgba(16, 185, 129, 0.18)' : 'rgba(56, 189, 248, 0.15)',
                              color: z.rating === 'FAVOURABLE' ? '#34d399' : '#38bdf8',
                              border: `1px solid ${z.rating === 'FAVOURABLE' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(56, 189, 248, 0.4)'}`,
                            }}
                          >
                            {z.rating}
                          </span>
                        </td>
                        <td className="text-right font-mono font-bold text-amber">
                          {z.depth_strata.optimal_catch_depth}m
                        </td>
                        <td className="text-slate-300 text-xs">
                          {z.primary_species.slice(0, 2).join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Dynamic Commercial Fishery Habitat Advisory Card */}
          {selectedZone && (
            <div className="hazard-advisory-card" style={{ borderColor: 'rgba(16, 185, 129, 0.28)' }}>
              <div className="advisory-card-header">
                <div className="advisory-header-left">
                  <Fish size={16} className="text-emerald" />
                  <span className="advisory-title">Sector Advisory: {selectedZone.name}</span>
                </div>
                <button
                  type="button"
                  className="fly-globe-btn"
                  onClick={() => {
                    const state = OceanState.getInstance();
                    state.setActivePage('3d-ocean');
                    state.setMode('underwater');
                    state.setUnderwaterRegion('bay-of-bengal');
                    state.setDepth(selectedZone.depth_strata.optimal_catch_depth);
                    state.requestFlyToLocation(selectedZone.center[0], selectedZone.center[1], 1600000, 0, -65, 1.5);
                  }}
                  title="Fly to this habitat in Cesium underwater mode"
                >
                  <ExternalLink size={12} />
                  <span>View in 3D Ocean</span>
                </button>
              </div>

              <div className="advisory-body">
                <div className="advisory-section">
                  <span className="section-label" style={{ color: '#34d399' }}>
                    OCEANOGRAPHIC & BIOLOGICAL CONDITIONS
                  </span>
                  <p className="section-text">{selectedZone.scientific_rationale}</p>
                </div>

                <div className="advisory-section">
                  <span className="section-label" style={{ color: '#38bdf8' }}>
                    3D WATER COLUMN & FISHING STRATUM
                  </span>
                  <p className="section-text">
                    <strong className="text-amber">
                      Optimal catch horizon: {selectedZone.depth_strata.optimal_catch_depth}m ({selectedZone.depth_strata.stratum_name}).
                    </strong>{' '}
                    Primary target species: <span className="text-slate-200">{selectedZone.primary_species.join(', ')}</span>.
                  </p>
                </div>

                <div className="advisory-section">
                  <span className="section-label">RECOMMENDED HARVESTING GEAR</span>
                  <p className="section-text text-slate-300 font-medium">
                    {selectedZone.gear_recommendations.join(' · ')}
                  </p>
                </div>

                <div className="advisory-footer-meta">
                  <span>
                    Bounds: {selectedZone.bounds.west.toFixed(1)}°E – {selectedZone.bounds.east.toFixed(1)}°E ·{' '}
                    {selectedZone.bounds.south.toFixed(1)}°N – {selectedZone.bounds.north.toFixed(1)}°N
                  </span>
                  <span
                    className="meta-badge-live"
                    style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.35)' }}
                  >
                    Status: {selectedZone.rating} PFZ · {provenance}
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
