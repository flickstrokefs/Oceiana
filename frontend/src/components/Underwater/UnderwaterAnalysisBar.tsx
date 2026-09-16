import React, { useEffect, useState } from 'react';
import { OceanState } from '../../ocean/OceanState';

import {
  UNDERWATER_REGIONS,
  type OceanVariable,
  type SpatialFieldValue,
  type UnderwaterRegionId,
} from '../../types/ocean';

import {
  Activity,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

export const UnderwaterAnalysisBar: React.FC = () => {
  const [depth, setDepth] = useState<number>(0);

  const [activeVar, setActiveVar] =
    useState<OceanVariable>('temperature');

  const [regionId, setRegionId] =
    useState<UnderwaterRegionId | null>(null);

  const [sample, setSample] =
    useState<SpatialFieldValue>({
      temperature: 28.0,
      salinity: 35.5,
      chlorophyll: 1.2,
      velocity: {
        u: 0.8,
        v: 0.4,
        w: 0.0,
      },
    });

  const [collapsed, setCollapsed] =
    useState(false);

  useEffect(() => {
    const oceanState =
      OceanState.getInstance();

    const unsub =
      oceanState.subscribe((snapshot) => {
        setDepth(
          snapshot.parameters.depth,
        );

        setActiveVar(
          snapshot.activeVariable,
        );

        const reg =
          snapshot.underwaterRegion;

        setRegionId(reg);

        const regConfig = reg
          ? UNDERWATER_REGIONS.find(
              (r) => r.id === reg,
            ) ||
            UNDERWATER_REGIONS[0]
          : UNDERWATER_REGIONS[0];

        const centerLat =
          (regConfig.south +
            regConfig.north) /
          2;

        const centerLon =
          (regConfig.west +
            regConfig.east) /
          2;

        const field =
          oceanState.sampleSpatialField(
            centerLat,
            centerLon,
            snapshot.parameters.depth,
          );

        setSample(field);
      });

    return unsub;
  }, []);

  const activeRegionConfig =
    regionId
      ? UNDERWATER_REGIONS.find(
          (r) => r.id === regionId,
        ) || null
      : null;

  const regionDisplayLabel =
    activeRegionConfig
      ? activeRegionConfig.label
      : 'INDIAN OCEAN DOMAIN';

  /* ============================================
     OCEANOGRAPHIC CALCULATIONS
     ============================================ */

  const pressureDbar =
    (depth * 1.01).toFixed(1);

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

  const densitySigma = (
    28.0 -
    0.22 * T +
    0.78 * (S - 35) +
    0.0045 * depth
  ).toFixed(2);

  const currentMagnitude =
    Math.sqrt(
      sample.velocity.u ** 2 +
        sample.velocity.v ** 2,
    ).toFixed(2);

  /* ============================================
     WATER LAYER
     ============================================ */

  let layerName =
    'SURFACE MIXED LAYER';

  let layerColor =
    '#2d5e94';

  if (
    depth > 50 &&
    depth <= 250
  ) {
    layerName =
      'PERMANENT THERMOCLINE';

    layerColor =
      '#88909e';
  } else if (
    depth > 250 &&
    depth <= 1000
  ) {
    layerName =
      'MESOPELAGIC (TWILIGHT ZONE)';

    layerColor =
      '#2d5e94';
  } else if (
    depth > 1000
  ) {
    layerName =
      'BATHYPELAGIC (DEEP ABYSS)';

    layerColor =
      '#505664';
  }

  /* ============================================
     PRIMARY VALUE
     ============================================ */

  const getPrimaryValueDisplay = () => {
    switch (activeVar) {
      case 'salinity':
        return {
          label: `SALINITY @ -${depth}m`,
          value: `${sample.salinity.toFixed(
            2,
          )} PSU`,
          color:
            '#f0f2f6',
        };

      case 'current':
        return {
          label: `FLOW VELOCITY @ -${depth}m`,
          value: `${currentMagnitude} m/s`,
          color:
            '#f0f2f6',
        };

      case 'chlorophyll':
        return {
          label: `CHLOROPHYLL @ -${depth}m`,
          value: `${sample.chlorophyll.toFixed(
            2,
          )} mg/m³`,
          color:
            '#f0f2f6',
        };

      default:
        return {
          label: `IN-SITU TEMPERATURE @ -${depth}m`,
          value: `${sample.temperature.toFixed(
            2,
          )} °C`,
          color:
            '#f0f2f6',
        };
    }
  };

  const primary =
    getPrimaryValueDisplay();

  /* ============================================
     COLLAPSED STATE
     ============================================ */

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          setCollapsed(false);
        }}
        title="Expand Analysis Bar"
        aria-label="Expand Analysis Bar"
        style={{
          position: 'fixed',
          top: '29px',
          right: '15px',

          width: '32px',
          height: '32px',

          padding: 0,
          margin: 0,

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',

          background: '#161920',
          color: '#88909e',

          border: '1px solid #20242b',
          borderRadius: '2px',

          cursor: 'pointer',

          zIndex: 99999,

          boxSizing: 'border-box',

          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        }}
      >
        <ChevronUp size={14} />
      </button>
    );
  }

  /* ============================================
     EXPANDED ANALYSIS BAR
     ============================================ */

  return (
    <div
      className="underwater-analysis-bar ocean-panel"
      style={{
        position: 'relative',
      }}
    >
      {/* ========================================
          ANALYSIS BAR COLLAPSE BUTTON
          ======================================== */}

      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          setCollapsed(true);
        }}
        title="Collapse Analysis Bar"
        aria-label="Collapse Analysis Bar"
        style={{
          position: 'absolute',

          right: '8px',
          top: '50%',

          transform:
            'translateY(-50%)',

          width: '28px',
          height: '28px',

          padding: 0,
          margin: 0,

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',

          background: '#161920',
          color: '#88909e',

          border: '1px solid #20242b',
          borderRadius: '2px',

          cursor: 'pointer',

          zIndex: 99999,

          boxSizing: 'border-box',
        }}
      >
        <ChevronDown size={14} />
      </button>

      {/* ========================================
          PRIMARY TELEMETRY
          ======================================== */}

      <div className="telemetry-primary-card">
        <div className="telemetry-badge">
          <Activity
            size={13}
            className="animate-pulse-slow"
            style={{
              color: primary.color,
            }}
          />

          <span>
            IN-SITU OBSERVATION
          </span>
        </div>

        <div
          className="telemetry-main-val"
          style={{
            color: primary.color,
          }}
        >
          {primary.value}
        </div>

        <div className="telemetry-meta-label font-mono">
          {regionDisplayLabel.toUpperCase()} ·{' '}
          {primary.label}
        </div>
      </div>

      <div className="analysis-divider" />

      {/* ========================================
          METRICS
          ======================================== */}

      <div className="analysis-metrics-grid">
        <div className="metric-cell">
          <span className="metric-label">
            SECTOR / STRATUM
          </span>

          <span
            className="metric-val"
            style={{
              color: layerColor,
            }}
          >
            {regionDisplayLabel} ·{' '}
            {layerName}
          </span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">
            HYDROSTATIC PRESSURE
          </span>

          <span className="metric-val font-mono">
            {pressureDbar} dbar
          </span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">
            SOUND VELOCITY (SOFAR)
          </span>

          <span className="metric-val font-mono">
            {soundSpeed} m/s
          </span>
        </div>

        <div className="metric-cell">
          <span className="metric-label">
            IN-SITU DENSITY σθ
          </span>

          <span className="metric-val font-mono">
            10{densitySigma} kg/m³
          </span>
        </div>
      </div>
    </div>
  );
};

export default UnderwaterAnalysisBar;