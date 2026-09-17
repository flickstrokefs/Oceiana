import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SlidersHorizontal, Plus, Trash2, RotateCcw, AlertCircle, X } from 'lucide-react';
import { OceanState } from '../../ocean/OceanState';
import type { OceanVariable } from '../../types/ocean';
import type { ColorRange } from '../../ocean/color/colorTypes';
import { DEFAULT_COLOR_RANGES, normalizeHex, sortRanges, validateColorRanges } from '../../ocean/color/colorRangeUtils';

const makeId = () => `range-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const FALLBACK_COLORS = ['#0022ff', '#00d4ff', '#00ff9d', '#ffd000', '#ff2200', '#a855f7', '#06b6d4', '#f97316', '#ec4899'];

export const UnderwaterLegend: React.FC = () => {
  const state = OceanState.getInstance();
  const [activeVar, setActiveVar] = useState<OceanVariable>(() => state.getSnapshot().activeVariable);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ColorRange[]>(() => state.getColorRanges());
  const [committed, setCommitted] = useState<ColorRange[]>(() => state.getColorRanges());
  const activeVarRef = useRef(activeVar);

  useEffect(() => state.subscribe((snapshot) => {
    const next = snapshot.colorRanges[snapshot.activeVariable] || [];
    setActiveVar(snapshot.activeVariable);
    setCommitted(next);
    if (snapshot.activeVariable !== activeVarRef.current) {
      activeVarRef.current = snapshot.activeVariable;
      setDraft(next.map((r) => ({ ...r })));
    }
  }), [state]);

  const validation = useMemo(() => validateColorRanges(draft), [draft]);
  const ranges = useMemo(() => sortRanges(validation.isValid ? draft : committed), [draft, committed, validation.isValid]);
  const sortedDraft = useMemo(() => sortRanges(draft), [draft]);

  const title = ({ temperature: 'TEMPERATURE (°C)', salinity: 'SALINITY (PSU)', current: 'CURRENT (m/s)', chlorophyll: 'CHLOROPHYLL-A (mg/m³)' } as Record<OceanVariable, string>)[activeVar];

  const gradient = useMemo(() => {
    if (!ranges.length) return '';
    const start = ranges[0].min;
    const end = ranges[ranges.length - 1].max;
    const span = Math.max(end - start, Number.EPSILON);
    const stops: string[] = [];
    ranges.forEach((r) => {
      const p = ((r.min - start) / span) * 100;
      stops.push(`${normalizeHex(r.color)} ${p}%`);
    });
    const last = ranges[ranges.length - 1];
    stops.push(`${normalizeHex(last.color)} 100%`);
    return `linear-gradient(90deg, ${stops.join(', ')})`;
  }, [ranges]);

  const commit = (next: ColorRange[]) => {
    if (validateColorRanges(next).isValid) state.setColorRanges(activeVar, next);
  };

  const update = (id: string, field: 'min' | 'max' | 'color', value: string) => {
    const next = draft.map((r) => r.id !== id ? r : {
      ...r,
      ...(field === 'color' ? { color: normalizeHex(value) } : { [field]: value === '' ? NaN : Number(value) }),
    });
    setDraft(next);
    commit(next);
  };

  const add = () => {
    const sorted = sortRanges(draft);
    const last = sorted[sorted.length - 1];
    const step = last ? Math.max(last.max - last.min, 1) : 5;
    const min = last?.max ?? 0;
    const used = new Set(draft.map((r) => normalizeHex(r.color)));
    const color = FALLBACK_COLORS.find((c) => !used.has(c)) || '#ffffff';
    const next = [...draft, { id: makeId(), min, max: min + step, color }];
    setDraft(next);
    commit(next);
  };

  const remove = (id: string) => {
    const next = draft.filter((r) => r.id !== id);
    setDraft(next);
    commit(next);
  };

  const reset = () => {
    const next = (DEFAULT_COLOR_RANGES[activeVar] || []).map((r) => ({ ...r }));
    setDraft(next);
    state.setColorRanges(activeVar, next);
  };

  return (
    <div className={`ocean-panel underwater-legend-panel ${open ? 'legend-panel-expanded' : ''}`}>
      <div className="legend-header-row">
        <span className="legend-title">{title}</span>
        <button className="legend-config-btn" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? <X size={12} /> : <SlidersHorizontal size={12} />}
          <span>{open ? 'Close' : 'Configure'}</span>
        </button>
      </div>

      {ranges.length ? (
        <>
          <div className="legend-smooth-bar" style={{ background: gradient }} aria-label="Smooth scientific color scale" />
          <div className="legend-boundary-ticks">
            <span>{ranges[0].min}</span>
            {ranges.map((r, i) => <span key={`${r.id}-${i}`}>{r.max}</span>)}
          </div>
        </>
      ) : (
        <div className="legend-empty-state"><span>No color ranges configured</span><button type="button" onClick={() => { setOpen(true); add(); }}>+ Add Range</button></div>
      )}

      {open && (
        <div className="legend-editor-wrapper">
          {!validation.isValid && (
            <div className="legend-validation-banner"><AlertCircle size={12} /> Fix the highlighted ranges. The last valid colors remain active.</div>
          )}

          <div className="editor-ranges-list">
            {sortedDraft.map((r, i) => {
              const errors = validation.errors.filter((e) => e.rangeId === r.id);
              const minError = errors.find((e) => e.field === 'min');
              const maxError = errors.find((e) => e.field === 'max');
              const colorError = errors.find((e) => e.field === 'color');
              return (
                <div className={`editor-range-row ${errors.length ? 'row-has-error' : ''}`} key={r.id}>
                  <div className="row-main-inputs">
                    <span className="row-index">{i + 1}</span>
                    <div className="input-group">
                      <input className={`editor-input-num ${minError ? 'input-error' : ''}`} type="number" step="any" value={Number.isFinite(r.min) ? r.min : ''} onChange={(e) => update(r.id, 'min', e.target.value)} aria-label="Minimum" />
                    </div>
                    <span className="range-to-sep">–</span>
                    <div className="input-group">
                      <input className={`editor-input-num ${maxError ? 'input-error' : ''}`} type="number" step="any" value={Number.isFinite(r.max) ? r.max : ''} onChange={(e) => update(r.id, 'max', e.target.value)} aria-label="Maximum" />
                    </div>
                    <div className={`color-picker-wrap ${colorError ? 'color-error' : ''}`}>
                      <input type="color" value={normalizeHex(r.color)} onChange={(e) => update(r.id, 'color', e.target.value)} aria-label="Range color" />
                      <span className="color-hex-text">{normalizeHex(r.color).toUpperCase()}</span>
                    </div>
                    <button className="editor-btn-delete" type="button" onClick={() => remove(r.id)} aria-label={`Delete range ${i + 1}`}><Trash2 size={13} /></button>
                  </div>
                  {errors.length > 0 && <div className="row-error-feedback"><AlertCircle size={10} /> {errors.map((e) => e.message).filter((m, idx, a) => a.indexOf(m) === idx).join(' · ')}</div>}
                </div>
              );
            })}
          </div>

          <div className="editor-action-footer">
            <button className="editor-btn-action" type="button" onClick={add}><Plus size={12} /> Add Range</button>
            <button className="editor-btn-action secondary" type="button" onClick={reset}><RotateCcw size={12} /> Reset</button>
            {validation.isValid && <span className="editor-status-valid">Live</span>}
          </div>
        </div>
      )}
    </div>
  );
};
