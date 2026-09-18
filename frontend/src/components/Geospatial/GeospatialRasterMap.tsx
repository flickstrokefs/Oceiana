import React, { useRef, useEffect, useState, useMemo } from 'react';
import type { ProvenanceMetadata } from '../../types/hazard';
import type { PFZCoordinate } from '../../types/fishery';
import { Compass, Crosshair, ShieldCheck, Cpu } from 'lucide-react';

export interface GeospatialRasterMapProps {
  latitudes: number[];
  longitudes: number[];
  values: (number | null)[][];
  mask?: boolean[][];
  unit: string;
  variableName: string;
  threshold?: number | null;
  colorScheme?: 'turbo' | 'viridis' | 'ocean' | 'magma';
  pfzPoints?: PFZCoordinate[];
  selectedPFZId?: string | null;
  onSelectPFZ?: (pfz: PFZCoordinate) => void;
  provenanceMeta?: ProvenanceMetadata | null;
  className?: string;
  isLoading?: boolean;
}

// Simplified high-accuracy coastal boundary vectors for Indian Ocean & Southern Ocean
const COASTLINES = [
  // India West Coast (Gujarat to Kanyakumari)
  [
    [23.7, 68.2], [22.8, 69.1], [22.4, 70.0], [21.6, 69.6], [20.7, 70.9],
    [21.1, 72.8], [19.0, 72.8], [15.5, 73.8], [12.9, 74.8], [10.0, 76.2],
    [8.1, 77.5]
  ],
  // India East Coast (Kanyakumari to Bengal)
  [
    [8.1, 77.5], [9.3, 79.1], [10.8, 79.8], [13.1, 80.3], [15.8, 80.3],
    [17.7, 83.3], [19.8, 85.8], [21.6, 87.5], [21.8, 89.0], [22.5, 91.8]
  ],
  // Sri Lanka
  [
    [9.8, 80.2], [8.6, 81.2], [7.0, 81.8], [5.9, 80.5], [6.9, 79.8], [9.8, 80.2]
  ],
  // Arabian Peninsula (Oman / Yemen)
  [
    [26.2, 56.4], [23.6, 58.5], [20.7, 58.8], [18.2, 56.1], [16.9, 53.8],
    [14.5, 49.2], [12.6, 43.5]
  ],
  // Horn of Africa (Somalia)
  [
    [11.9, 51.3], [10.4, 51.2], [7.8, 49.8], [4.7, 47.9], [2.0, 45.3],
    [-0.5, 42.8]
  ],
  // Southern Ocean reference parallels (Subantarctic / Polar frontal boundaries)
  [
    [-45.0, 20.0], [-45.0, 40.0], [-45.0, 60.0], [-45.0, 80.0], [-45.0, 100.0], [-45.0, 120.0]
  ],
  [
    [-55.0, 20.0], [-55.0, 40.0], [-55.0, 60.0], [-55.0, 80.0], [-55.0, 100.0], [-55.0, 120.0]
  ]
];

/**
 * Colormap mapping: returns RGBA [r, g, b, a] for normalized value [0.0, 1.0].
 */
function getColormapRgba(t: number, scheme: 'turbo' | 'viridis' | 'ocean' | 'magma' = 'turbo'): [number, number, number, number] {
  const c = Math.max(0, Math.min(1, t));

  if (scheme === 'viridis') {
    // Viridis approx
    const r = Math.round(255 * (0.28 + 0.72 * Math.sin(c * Math.PI - 0.5)));
    const g = Math.round(255 * (0.15 + 0.85 * c));
    const b = Math.round(255 * (0.45 + 0.55 * Math.cos(c * Math.PI)));
    return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b)), 220];
  }

  if (scheme === 'ocean') {
    // Deep ocean teal to luminous aqua to amber
    if (c < 0.4) {
      const f = c / 0.4;
      return [Math.round(10 + 20 * f), Math.round(30 + 100 * f), Math.round(80 + 100 * f), 210];
    } else if (c < 0.8) {
      const f = (c - 0.4) / 0.4;
      return [Math.round(30 + 120 * f), Math.round(130 + 95 * f), Math.round(180 - 40 * f), 225];
    } else {
      const f = (c - 0.8) / 0.2;
      return [Math.round(150 + 105 * f), Math.round(225 - 60 * f), Math.round(140 - 100 * f), 240];
    }
  }

  // Default: Oceanographic Turbo-style
  // Deep Blue (0.0) -> Cyan (0.25) -> Emerald (0.5) -> Yellow (0.75) -> Crimson (1.0)
  let r = 0, g = 0, b = 0;
  if (c < 0.25) {
    const f = c / 0.25;
    r = Math.round(30 * (1 - f));
    g = Math.round(80 * f + 20);
    b = Math.round(150 + 105 * f);
  } else if (c < 0.5) {
    const f = (c - 0.25) / 0.25;
    r = Math.round(20 * (1 - f));
    g = Math.round(100 + 120 * f);
    b = Math.round(255 * (1 - f * 0.7));
  } else if (c < 0.75) {
    const f = (c - 0.5) / 0.25;
    r = Math.round(240 * f);
    g = Math.round(220 + 35 * (1 - f));
    b = Math.round(75 * (1 - f));
  } else {
    const f = (c - 0.75) / 0.25;
    r = Math.round(240 + 15 * f);
    g = Math.round(220 * (1 - f * 0.7));
    b = Math.round(40 * (1 - f));
  }
  return [r, g, b, 225];
}

export const GeospatialRasterMap: React.FC<GeospatialRasterMapProps> = ({
  latitudes,
  longitudes,
  values,
  mask,
  unit,
  variableName,
  threshold,
  colorScheme = 'turbo',
  pfzPoints = [],
  selectedPFZId,
  onSelectPFZ,
  provenanceMeta,
  className = '',
  isLoading = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [hoverData, setHoverData] = useState<{
    lat: number;
    lon: number;
    value: number | null;
    isExceeded: boolean;
    pixelX: number;
    pixelY: number;
    tipX: number;
    tipY: number;
  } | null>(null);

  const [hoveredPFZ, setHoveredPFZ] = useState<PFZCoordinate | null>(null);

  // Min and max of values
  const { minVal, maxVal } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (let r = 0; r < values.length; r++) {
      for (let c = 0; c < values[r].length; c++) {
        const v = values[r][c];
        if (v !== null && !isNaN(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    return {
      minVal: min !== Infinity ? min : 0,
      maxVal: max !== -Infinity ? max : 1,
    };
  }, [values]);

  const minLat = latitudes.length > 0 ? Math.min(...latitudes) : 0;
  const maxLat = latitudes.length > 0 ? Math.max(...latitudes) : 30;
  const minLon = longitudes.length > 0 ? Math.min(...longitudes) : 50;
  const maxLon = longitudes.length > 0 ? Math.max(...longitudes) : 100;

  // Render raster grid to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || latitudes.length === 0 || longitudes.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Dark marine bathymetry background
    ctx.fillStyle = '#0a0d14';
    ctx.fillRect(0, 0, width, height);

    const nRows = latitudes.length;
    const nCols = longitudes.length;
    const cellW = width / nCols;
    const cellH = height / nRows;

    const range = maxVal - minVal > 0.0001 ? maxVal - minVal : 1;

    // 1. Draw raster cells
    for (let r = 0; r < nRows; r++) {
      for (let c = 0; c < nCols; c++) {
        const val = values[r][c];
        const isExceeded = mask ? mask[r][c] : (threshold !== undefined && threshold !== null && val !== null && val > threshold);

        // Note: latitude 0 is bottom or top depending on orientation
        // If latitudes are descending (north to south), row 0 is top.
        // If ascending, row 0 is bottom.
        const y = latitudes[0] > latitudes[nRows - 1] ? r * cellH : (nRows - 1 - r) * cellH;
        const x = c * cellW;

        if (val === null || isNaN(val)) {
          ctx.fillStyle = 'rgba(12, 18, 28, 0.6)';
          ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH));
          continue;
        }

        const norm = (val - minVal) / range;
        const [red, grn, blu, alpha] = getColormapRgba(norm, colorScheme);

        ctx.fillStyle = `rgba(${red}, ${grn}, ${blu}, ${alpha / 255})`;
        ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH));

        // Threshold exceedance visual highlight (striated warning overlay & glow outline)
        if (isExceeded) {
          ctx.fillStyle = 'rgba(255, 60, 60, 0.28)';
          ctx.fillRect(x, y, Math.ceil(cellW), Math.ceil(cellH));

          ctx.strokeStyle = 'rgba(255, 100, 100, 0.75)';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, y + 0.5, cellW - 1, cellH - 1);
        }
      }
    }

    // 2. Overlay bathymetry / graticule grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    for (let r = 1; r < nRows; r += Math.max(1, Math.floor(nRows / 5))) {
      const y = r * cellH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let c = 1; c < nCols; c += Math.max(1, Math.floor(nCols / 5))) {
      const x = c * cellW;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 3. Project coastline boundaries
    const lonRange = maxLon - minLon || 1;
    const latRange = maxLat - minLat || 1;

    ctx.strokeStyle = 'rgba(200, 225, 255, 0.45)';
    ctx.lineWidth = 1.5;

    COASTLINES.forEach((line) => {
      let isFirst = true;
      ctx.beginPath();
      line.forEach(([lat, lon]) => {
        if (lat >= minLat - 2 && lat <= maxLat + 2 && lon >= minLon - 2 && lon <= maxLon + 2) {
          const px = ((lon - minLon) / lonRange) * width;
          const py = ((maxLat - lat) / latRange) * height;
          if (isFirst) {
            ctx.moveTo(px, py);
            isFirst = false;
          } else {
            ctx.lineTo(px, py);
          }
        }
      });
      if (!isFirst) {
        ctx.stroke();
      }
    });
  }, [latitudes, longitudes, values, mask, minVal, maxVal, minLat, maxLat, minLon, maxLon, threshold, colorScheme]);

  // Coordinate projector for overlays and PFZ points (using CSS percentages to avoid render-time ref access)
  const projectCoordsPct = (lat: number, lon: number): { xPct: number; yPct: number } => {
    const lonRange = maxLon - minLon || 1;
    const latRange = maxLat - minLat || 1;
    const xPct = Math.max(0, Math.min(100, ((lon - minLon) / lonRange) * 100));
    const yPct = Math.max(0, Math.min(100, ((maxLat - lat) / latRange) * 100));
    return { xPct, yPct };
  };

  // Handle canvas mouse move for pixel/cell inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || latitudes.length === 0 || longitudes.length === 0) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (mouseX < 0 || mouseX > rect.width || mouseY < 0 || mouseY > rect.height) {
      setHoverData(null);
      return;
    }

    const normX = mouseX / rect.width;
    const normY = mouseY / rect.height;

    const nRows = latitudes.length;
    const nCols = longitudes.length;

    const col = Math.max(0, Math.min(nCols - 1, Math.floor(normX * nCols)));
    const row = latitudes[0] > latitudes[nRows - 1]
      ? Math.max(0, Math.min(nRows - 1, Math.floor(normY * nRows)))
      : Math.max(0, Math.min(nRows - 1, Math.floor((1 - normY) * nRows)));

    const cellVal = values[row] ? values[row][col] : null;
    const isExceeded = mask ? mask[row][col] : (threshold !== undefined && threshold !== null && cellVal !== null && cellVal > threshold);

    const tipX = Math.min(mouseX + 16, rect.width - 220);
    const tipY = Math.max(10, Math.min(mouseY - 40, rect.height - 130));

    setHoverData({
      lat: Number(latitudes[row].toFixed(2)),
      lon: Number(longitudes[col].toFixed(2)),
      value: cellVal,
      isExceeded: Boolean(isExceeded),
      pixelX: mouseX,
      pixelY: mouseY,
      tipX,
      tipY,
    });
  };

  const handleMouseLeave = () => {
    setHoverData(null);
  };

  return (
    <div
      ref={containerRef}
      className={`geospatial-canvas-wrap ${className}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Top Map Status / Graticule Header */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '10px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          fontSize: '11px',
          fontFamily: 'var(--font-mono)',
          background: 'rgba(9, 11, 15, 0.9)',
          backdropFilter: 'blur(4px)',
          padding: '4px 10px',
          borderRadius: '3px',
          border: '1px solid #20242b',
          color: '#c5c9d2',
          pointerEvents: 'none',
        }}
      >
        <Compass size={13} style={{ color: '#5bb0f5' }} />
        <span style={{ fontWeight: 600, color: '#ffffff' }}>{variableName}</span>
        <span style={{ color: '#505664' }}>|</span>
        <span>{minLat.toFixed(1)}° to {maxLat.toFixed(1)}°N</span>
        <span style={{ color: '#505664' }}>|</span>
        <span>{minLon.toFixed(1)}° to {maxLon.toFixed(1)}°E</span>
      </div>

      {/* Provenance Badge */}
      {provenanceMeta && (
        <div
          className={`geospatial-provenance-badge ${
            provenanceMeta.provenance === 'OFFICIAL'
              ? 'badge-official'
              : provenanceMeta.provenance === 'MODEL'
              ? 'badge-model'
              : 'badge-derived'
          }`}
        >
          {provenanceMeta.provenance === 'OFFICIAL' ? (
            <>
              <ShieldCheck size={13} /> <span>OFFICIAL (INCOIS)</span>
            </>
          ) : provenanceMeta.provenance === 'MODEL' ? (
            <>
              <Cpu size={13} /> <span>MODEL (Copernicus)</span>
            </>
          ) : (
            <>
              <Crosshair size={13} /> <span>DERIVED (Ocean-X)</span>
            </>
          )}
        </div>
      )}

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        width={720}
        height={420}
        className="geospatial-canvas"
      />

      {/* PFZ Marker Overlay */}
      {pfzPoints.map((pfz) => {
        const { xPct, yPct } = projectCoordsPct(pfz.latitude, pfz.longitude);
        const isSelected = selectedPFZId === pfz.id;
        const isHovered = hoveredPFZ?.id === pfz.id;

        return (
          <button
            key={pfz.id}
            type="button"
            style={{
              position: 'absolute',
              left: `${xPct}%`,
              top: `${yPct}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectPFZ?.(pfz);
            }}
            onMouseEnter={() => setHoveredPFZ(pfz)}
            onMouseLeave={() => setHoveredPFZ(null)}
            aria-label={`PFZ: ${pfz.zone_name}`}
          >
            {pfz.is_official ? (
              // Official INCOIS Radar Beacon
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span
                  style={{
                    position: 'absolute',
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    border: `1.5px solid ${isSelected ? '#f59e0b' : '#4ade80'}`,
                    background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'rgba(74, 222, 128, 0.2)',
                    animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
                  }}
                />
                <span
                  style={{
                    position: 'relative',
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: isSelected ? '#f59e0b' : '#22c55e',
                    color: '#090b0e',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
                  }}
                >
                  <ShieldCheck size={11} strokeWidth={3} />
                </span>
              </div>
            ) : (
              // Ocean-X Derived Front Centroid
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span
                  style={{
                    position: 'relative',
                    width: '15px',
                    height: '15px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: `1px solid ${isSelected ? '#f59e0b' : '#38bdf8'}`,
                    background: isSelected ? '#f59e0b' : '#0284c7',
                    color: '#090b0e',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                  }}
                >
                  <Crosshair size={9} strokeWidth={2.5} />
                </span>
              </div>
            )}

            {/* Hover Tooltip for PFZ Marker */}
            {(isHovered || isSelected) && (
              <div
                className="geospatial-tooltip"
                style={{
                  left: '50%',
                  transform: 'translateX(-50%)',
                  bottom: 'calc(100% + 8px)',
                  minWidth: '190px',
                }}
              >
                <div className="geospatial-tooltip-title">
                  <span style={{ color: pfz.is_official ? '#4ade80' : '#38bdf8' }}>
                    {pfz.is_official ? 'Official INCOIS PFZ' : 'Ocean-X Derived PFZ'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: '#88909e' }}>
                    {pfz.score ? `${pfz.score} pts` : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>{pfz.zone_name}</div>
                  {pfz.landing_center && (
                    <div style={{ color: '#88909e', fontSize: '10px' }}>Base: {pfz.landing_center}</div>
                  )}
                  <div style={{ color: '#88909e', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
                    {pfz.latitude.toFixed(2)}°N, {pfz.longitude.toFixed(2)}°E
                  </div>
                  <div className="geospatial-tooltip-row" style={{ borderTop: '1px solid #20242b', paddingTop: '3px', marginTop: '2px' }}>
                    <span>SST: {pfz.sst}°C</span>
                    <span>Chl: {pfz.chlorophyll} mg/m³</span>
                  </div>
                </div>
              </div>
            )}
          </button>
        );
      })}

      {/* Hover Inspection Crosshair and Tooltip */}
      {hoverData && !hoveredPFZ && (
        <>
          <div
            className="geospatial-crosshair-dot"
            style={{ left: hoverData.pixelX, top: hoverData.pixelY }}
          />

          <div
            className="geospatial-tooltip"
            style={{
              left: hoverData.tipX,
              top: hoverData.tipY,
              minWidth: '200px',
            }}
          >
            <div className="geospatial-tooltip-title">
              <span style={{ color: '#88909e', fontSize: '10px' }}>COORDINATES</span>
              <span style={{ color: '#ffffff' }}>{hoverData.lat}°N, {hoverData.lon}°E</span>
            </div>
            <div className="geospatial-tooltip-row">
              <span style={{ color: '#88909e' }}>VALUE</span>
              <span style={{ fontWeight: 600, color: '#5bb0f5' }}>
                {hoverData.value !== null ? `${hoverData.value.toFixed(2)} ${unit}` : 'N/A (Land/Mask)'}
              </span>
            </div>
            {threshold !== undefined && threshold !== null && (
              <div className="geospatial-tooltip-row">
                <span style={{ color: '#88909e' }}>THRESHOLD</span>
                <span style={{ color: '#c5c9d2' }}>{threshold} {unit}</span>
              </div>
            )}
            <div className="geospatial-tooltip-row" style={{ borderTop: '1px solid #20242b', paddingTop: '4px', marginTop: '3px' }}>
              <span style={{ color: '#88909e' }}>STATUS</span>
              {hoverData.isExceeded ? (
                <span className="badge-risk badge-critical">EXCEEDED</span>
              ) : (
                <span className="badge-risk badge-low">NORMAL</span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Bottom Colormap Legend Bar */}
      <div className="geospatial-legend-wrap">
        <div className="geospatial-legend-labels">
          <span>{minVal.toFixed(2)}</span>
          {threshold !== undefined && threshold !== null && (
            <span style={{ color: '#ff6b7b', fontWeight: 600 }}>{threshold} {unit}</span>
          )}
          <span>{maxVal.toFixed(2)} {unit}</span>
        </div>
        <div style={{ position: 'relative' }}>
          <div
            className="geospatial-legend-gradient"
            style={{
              background:
                colorScheme === 'viridis'
                  ? 'linear-gradient(to right, #440154, #3b528b, #21908d, #5dc963, #fde725)'
                  : colorScheme === 'ocean'
                  ? 'linear-gradient(to right, #0a1e3f, #1e6091, #184e77, #52b69a, #d9ed92)'
                  : 'linear-gradient(to right, #1e3a8a, #06b6d4, #10b981, #facc15, #ef4444)',
            }}
          />
          {threshold !== undefined && threshold !== null && maxVal > minVal && threshold >= minVal && threshold <= maxVal && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                width: '2px',
                background: '#ffffff',
                boxShadow: '0 0 4px #000',
                left: `${((threshold - minVal) / (maxVal - minVal)) * 100}%`,
                transform: 'translateX(-50%)',
              }}
              title={`Threshold: ${threshold}`}
            />
          )}
        </div>
      </div>

      {/* Loading Overlay */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 40,
            background: 'rgba(6, 8, 11, 0.75)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: '#5bb0f5' }}>
            Streaming Operational Gridded Field...
          </span>
        </div>
      )}
    </div>
  );
};
