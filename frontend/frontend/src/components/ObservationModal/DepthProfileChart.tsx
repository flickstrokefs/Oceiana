import React, { useMemo } from 'react';
import type { ProfileDepthSample, ProfileVariable } from '../../types/ocean';

export interface DepthProfileSeries {
  key: 'model' | 'glider' | 'argo';
  label: string;
  color: string;
  samples: ProfileDepthSample[];
}

interface DepthProfileChartProps {
  variable: ProfileVariable;
  series: DepthProfileSeries[];
  width?: number;
  height?: number;
}

const VARIABLE_LABELS: Record<ProfileVariable, string> = {
  temperature: 'Temperature (°C)',
  salinity: 'Salinity (PSU)',
  currentSpeed: 'Current Speed (m/s)',
  chlorophyll: 'Chlorophyll (mg/m³)',
  oxygen: 'Oxygen (ml/L)',
};

function readValue(sample: ProfileDepthSample, variable: ProfileVariable): number | null {
  const v = sample[variable];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Scientific depth-vs-variable comparison chart (SVG).
 * No charting library dependency — keeps the existing package footprint.
 *
 * Y-axis: Depth (m) increasing downward (oceanographic convention).
 * X-axis: Selected variable.
 */
export const DepthProfileChart: React.FC<DepthProfileChartProps> = ({
  variable,
  series,
  width = 520,
  height = 280,
}) => {
  const pad = { top: 28, right: 18, bottom: 36, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const { maxDepth, minX, maxX, paths } = useMemo(() => {
    let maxD = 0;
    let minV = Infinity;
    let maxV = -Infinity;

    for (const s of series) {
      for (const sample of s.samples) {
        maxD = Math.max(maxD, sample.depth);
        const val = readValue(sample, variable);
        if (val !== null) {
          minV = Math.min(minV, val);
          maxV = Math.max(maxV, val);
        }
      }
    }

    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) {
      minV = 0;
      maxV = 1;
    }
    if (minV === maxV) {
      minV -= 1;
      maxV += 1;
    }
    // Small padding on x-range
    const span = maxV - minV;
    minV -= span * 0.05;
    maxV += span * 0.05;
    if (maxD <= 0) maxD = 2000;

    const built = series.map((s) => {
      const pts: string[] = [];
      for (const sample of s.samples) {
        const val = readValue(sample, variable);
        if (val === null) continue;
        const x = pad.left + ((val - minV) / (maxV - minV)) * innerW;
        const y = pad.top + (sample.depth / maxD) * innerH;
        pts.push(`${x},${y}`);
      }
      return { ...s, d: pts.length ? `M ${pts.join(' L ')}` : '' };
    });

    return { maxDepth: maxD, minX: minV, maxX: maxV, paths: built };
  }, [series, variable, innerW, innerH, pad.left, pad.top]);

  const depthTicks = [0, 250, 500, 1000, 1500, 2000].filter((d) => d <= maxDepth + 1);
  const xTicks = 5;
  const xTickValues = Array.from({ length: xTicks }, (_, i) => minX + ((maxX - minX) * i) / (xTicks - 1));

  return (
    <svg
      className="op-chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${VARIABLE_LABELS[variable]} versus depth`}
    >
      <rect x={0} y={0} width={width} height={height} className="op-chart-bg" />

      {/* Grid */}
      {depthTicks.map((d) => {
        const y = pad.top + (d / maxDepth) * innerH;
        return (
          <g key={`d-${d}`}>
            <line
              x1={pad.left}
              y1={y}
              x2={pad.left + innerW}
              y2={y}
              className="op-chart-grid"
            />
            <text x={pad.left - 8} y={y + 3} textAnchor="end" className="op-chart-axis-label">
              {d}
            </text>
          </g>
        );
      })}

      {xTickValues.map((v, i) => {
        const x = pad.left + (i / (xTicks - 1)) * innerW;
        return (
          <g key={`x-${i}`}>
            <line
              x1={x}
              y1={pad.top}
              x2={x}
              y2={pad.top + innerH}
              className="op-chart-grid"
            />
            <text x={x} y={height - 10} textAnchor="middle" className="op-chart-axis-label">
              {v.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* Axes labels */}
      <text
        x={14}
        y={pad.top + innerH / 2}
        textAnchor="middle"
        className="op-chart-axis-title"
        transform={`rotate(-90 14 ${pad.top + innerH / 2})`}
      >
        Depth (m)
      </text>
      <text
        x={pad.left + innerW / 2}
        y={16}
        textAnchor="middle"
        className="op-chart-axis-title"
      >
        {VARIABLE_LABELS[variable]}
      </text>

      {/* Series */}
      {paths.map((p) =>
        p.d ? (
          <path key={p.key} d={p.d} fill="none" stroke={p.color} strokeWidth={2.2} />
        ) : null
      )}

      {/* Legend */}
      {paths.map((p, i) => (
        <g key={`leg-${p.key}`} transform={`translate(${pad.left + i * 90}, ${height - 2})`}>
          <line x1={0} y1={-14} x2={16} y2={-14} stroke={p.color} strokeWidth={2.2} />
          <text x={20} y={-11} className="op-chart-legend">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
};
