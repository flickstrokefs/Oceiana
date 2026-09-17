import React, { useEffect, useMemo, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import type { OceanVariable } from '../../types/ocean';
import type { ColorRange } from '../../ocean/color/colorTypes';
import { normalizeHex, sortRanges } from '../../ocean/color/colorRangeUtils';
import { ColorRangeEditor } from '../../ocean/color/ColorRangeEditor';

const VARIABLE_TITLES: Record<OceanVariable, string> = {
  temperature: 'TEMPERATURE (°C)',
  salinity: 'SALINITY (PSU)',
  current: 'CURRENT (m/s)',
  chlorophyll: 'CHLOROPHYLL-A (mg/m³)',
  oxygen: 'DISSOLVED OXYGEN (ml/L)',
};

export const UnderwaterLegend: React.FC = () => {
  const state = OceanState.getInstance();
  const [activeVar, setActiveVar] = useState<OceanVariable>(() => state.getSnapshot().activeVariable);
  const [open, setOpen] = useState(false);
  const [ranges, setRanges] = useState<ColorRange[]>(() => state.getColorRanges());

  useEffect(() => {
    return state.subscribe((snapshot) => {
      setActiveVar(snapshot.activeVariable);
      setRanges(snapshot.colorRanges[snapshot.activeVariable] || []);
    });
  }, [state]);

  const sortedRanges = useMemo(() => sortRanges(ranges), [ranges]);
  const title = VARIABLE_TITLES[activeVar] || activeVar.toUpperCase();

  const gradient = useMemo(() => {
    if (!sortedRanges.length) return '';
    const start = sortedRanges[0].min;
    const end = sortedRanges[sortedRanges.length - 1].max;
    const span = Math.max(end - start, Number.EPSILON);
    const stops: string[] = [];
    sortedRanges.forEach((r) => {
      const p = ((r.min - start) / span) * 100;
      stops.push(`${normalizeHex(r.color)} ${p.toFixed(2)}%`);
    });
    const last = sortedRanges[sortedRanges.length - 1];
    stops.push(`${normalizeHex(last.color)} 100%`);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }, [sortedRanges]);

  return (
    <div className={`ocean-panel underwater-legend-panel ${open ? 'legend-panel-expanded' : ''}`}>
      <div className="legend-header-row">
        <span className="legend-title">{title}</span>
        <button
          className="legend-config-btn"
          type="button"
          onClick={() => setOpen((v) => !v)}
          title={open ? 'Close Range Editor' : 'Configure Color Ranges'}
        >
          {open ? <X size={12} /> : <SlidersHorizontal size={12} />}
          <span>{open ? 'Close' : 'Configure Ranges'}</span>
        </button>
      </div>

      {sortedRanges.length ? (
        <>
          <div
            className="legend-smooth-bar"
            style={{ background: gradient }}
            aria-label="Smooth scientific color scale"
          />
          <div className="legend-boundary-ticks">
            <span>{sortedRanges[0].min}</span>
            {sortedRanges.map((r, i) => (
              <span key={`${r.id}-${i}`}>{r.max}</span>
            ))}
          </div>
        </>
      ) : (
        <div className="legend-empty-state">
          <span>No color ranges configured</span>
          <button type="button" onClick={() => setOpen(true)}>
            + Configure Ranges
          </button>
        </div>
      )}

      {open && (
        <ColorRangeEditor
          variable={activeVar}
          isOpen={open}
          onClose={() => setOpen(false)}
          title={title}
        />
      )}
    </div>
  );
};
