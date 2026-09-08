import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';
import {
  UNDERWATER_REGIONS,
  type OceanVariable,
  type SpatialFieldValue,
  type UnderwaterRegionId,
} from '../../types/ocean';
import { Activity } from 'lucide-react';

export const UnderwaterAnalysisBar: React.FC = () => {
  const [depth, setDepth] = useState<number>(0);
  const [activeVar, setActiveVar] = useState<OceanVariable>('temperature');
  const [regionId, setRegionId] = useState<UnderwaterRegionId | null>(null);
  const [sample, setSample] = useState<SpatialFieldValue>({
    temperature: 28.0,
    salinity: 35.5,
    chlorophyll: 1.2,
    velocity: { u: 0.8, v: 0.4, w: 0.0 },
  });

  useEffect(() => {
    const oceanState = OceanState.getInstance();
    const unsub = oceanState.subscribe((snapshot) => {
      setDepth(snapshot.parameters.depth);
      setActiveVar(snapshot.activeVariable);
      const reg = snapshot.underwaterRegion;
      setRegionId(reg);

      const regConfig = reg
        ? UNDERWATER_REGIONS.find((r) => r.id === reg) || UNDERWATER_REGIONS[0]
        : UNDERWATER_REGIONS[0];
      const centerLat = (regConfig.south + regConfig.north) / 2;
      const centerLon = (regConfig.west + regConfig.east) / 2;
      const field = oceanState.sampleSpatialField(
        centerLat,
        centerLon,
        snapshot.parameters.depth
      );
      setSample(field);
    });
    return unsub;
  }, []);

  const activeRegionConfig = regionId
    ? UNDERWATER_REGIONS.find((r) => r.id === regionId) || null
    : null;
  const regionDisplayLabel = activeRegionConfig ? activeRegionConfig.label : 'INDIAN OCEAN DOMAIN';

  // Oceanographic physical formulas:
  // 1. Hydrostatic Pressure (dbar ~= meters * 1.01)
  const pressureDbar = (depth * 1.01).toFixed(1);

  // 2. Sound Speed in Seawater (Mackenzie / UNESCO empirical formula)
  // c = 1448.96 + 4.591*T - 0.05304*T^2 + 0.0002374*T^3 + 1.340*(S - 35) + 0.0163*z
  const T = sample.temperature;
  const S = sample.salinity;
  const soundSpeed = (
    1448.96 +
    4.591 * T -
    0.05304 * T * T +
    0.0002374 * T * T * T +
    1.34 * (S - 35) +
    0.0163 * depth
  ).toFixed(1);

  // 3. Potential Density anomaly (sigma-t kg/m^3 approx)
  const densitySigma = (28.0 - 0.22 * T + 0.78 * (S - 35) + 0.0045 * depth).toFixed(2);

  // 4. Current magnitude
  const currentMagnitude = Math.sqrt(sample.velocity.u ** 2 + sample.velocity.v ** 2).toFixed(2);

  // 5. Water layer classification
  let layerName = 'SURFACE MIXED LAYER';
  let layerColor = '#00ff9d';
  if (depth > 50 && depth <= 250) {
    layerName = 'PERMANENT THERMOCLINE';
    layerColor = '#00f0ff';
  } else if (depth > 250 && depth <= 1000) {
    layerName = 'MESOPELAGIC (TWILIGHT ZONE)';
    layerColor = '#2d82ff';
  } else if (depth > 1000) {
    layerName = 'BATHYPELAGIC (ABYSSAL REALM)';
    layerColor = '#a855f7';
  }

  const getPrimaryValueDisplay = () => {
    switch (activeVar) {
      case 'salinity':
        return {
          label: `SALINITY @ -${depth}m`,
          value: `${sample.salinity.toFixed(2)} PSU`,
          color: 'var(--accent-blue)',
        };
      case 'current':
        return {
          label: `FLOW VELOCITY @ -${depth}m`,
          value: `${currentMagnitude} m/s`,
          color: 'var(--accent-cyan)',
        };
      case 'chlorophyll':
        return {
          label: `CHLOROPHYLL @ -${depth}m`,
          value: `${sample.chlorophyll.toFixed(2)} mg/m³`,
          color: 'var(--accent-green)',
        };
      default:
        return {
          label: `IN-SITU TEMPERATURE @ -${depth}m`,
          value: `${sample.temperature.toFixed(2)} °C`,
          color: 'var(--accent-amber)',
        };
    }
  };

  const primary = getPrimaryValueDisplay();

  return (
    <div className="underwater-analysis-bar ocean-panel">
      {/* Primary Highlighted Telemetry Output */}
      <div className="telemetry-primary-card">
        <div className="telemetry-badge">
          <Activity size={13} className="animate-pulse-slow" style={{ color: primary.color }} />
          <span>IN-SITU OBSERVATION</span>
        </div>
        <div className="telemetry-main-val" style={{ color: primary.color }}>
          {primary.value}
        </div>
        <div className="telemetry-meta-label font-mono">
          {regionDisplayLabel.toUpperCase()} · {primary.label}
        </div>
      </div>

      <div className="analysis-divider"></div>

      {/* Layer Classification & Physical Oceanography Readouts */}
      <div className="analysis-metrics-grid">
        <div className="metric-cell">
          <span className="metric-label">SECTOR / STRATUM</span>
          <span className="metric-val" style={{ color: layerColor }}>
            {regionDisplayLabel} · {layerName}
          </span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">HYDROSTATIC PRESSURE</span>
          <span className="metric-val font-mono">{pressureDbar} dbar</span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">SOUND VELOCITY (SOFAR)</span>
          <span className="metric-val font-mono">{soundSpeed} m/s</span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">IN-SITU DENSITY σ_θ</span>
          <span className="metric-val font-mono">10{densitySigma} kg/m³</span>
        </div>
      </div>
    </div>
  );
};
