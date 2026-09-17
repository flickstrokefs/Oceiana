import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, RotateCcw, AlertCircle, X } from 'lucide-react';
import { OceanState } from '../OceanState';
import type { OceanVariable } from '../../types/ocean';
import type { ColorRange } from './colorTypes';
import {
  DEFAULT_COLOR_RANGES,
  normalizeHex,
  sortRanges,
  validateColorRanges,
} from './colorRangeUtils';

const makeId = () => `range-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const FALLBACK_PALETTE = [
  '#0022ff',
  '#00d4ff',
  '#00ff9d',
  '#ffd000',
  '#ff2200',
  '#a855f7',
  '#06b6d4',
  '#f97316',
  '#ec4899',
  '#10b981',
  '#eab308',
  '#ef4444',
  '#3b82f6',
];

interface ColorRangeEditorProps {
  variable: OceanVariable;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const ColorRangeEditor: React.FC<ColorRangeEditorProps> = ({
  variable,
  isOpen,
  onClose,
  title,
}) => {
  const state = OceanState.getInstance();
  const [draft, setDraft] = useState<ColorRange[]>(() => state.getColorRanges(variable));

  // Sync draft when variable changes or when state ranges change externally
  useEffect(() => {
    const unsub = state.subscribe((snapshot) => {
      const currentRanges = snapshot.colorRanges[variable] || DEFAULT_COLOR_RANGES[variable] || [];
      setDraft(currentRanges.map((r) => ({ ...r })));
    });
    return unsub;
  }, [state, variable]);

  const validation = useMemo(() => validateColorRanges(draft), [draft]);
  const sortedDraft = useMemo(() => sortRanges(draft), [draft]);

  const commitIfValid = (nextRanges: ColorRange[]) => {
    const result = validateColorRanges(nextRanges);
    if (result.isValid) {
      state.setColorRanges(variable, nextRanges);
    }
  };

  const updateRange = (id: string, field: 'min' | 'max' | 'color', rawValue: string) => {
    const next = draft.map((r) => {
      if (r.id !== id) return r;
      if (field === 'color') {
        return { ...r, color: normalizeHex(rawValue) };
      }
      return {
        ...r,
        [field]: rawValue === '' ? NaN : Number(rawValue),
      };
    });
    setDraft(next);
    commitIfValid(next);
  };

  const addRange = () => {
    const sorted = sortRanges(draft);
    const last = sorted[sorted.length - 1];
    const step = last && Number.isFinite(last.max - last.min) && last.max > last.min
      ? Math.round((last.max - last.min) * 100) / 100
      : 5;
    const min = last && Number.isFinite(last.max) ? last.max : 0;
    const max = min + (step > 0 ? step : 5);

    const usedColors = new Set(draft.map((r) => normalizeHex(r.color)));
    const color = FALLBACK_PALETTE.find((c) => !usedColors.has(c)) || '#ffffff';

    const newRange: ColorRange = {
      id: makeId(),
      min,
      max,
      color,
    };
    const next = [...draft, newRange];
    setDraft(next);
    commitIfValid(next);
  };

  const deleteRange = (id: string) => {
    const next = draft.filter((r) => r.id !== id);
    setDraft(next);
    commitIfValid(next);
  };

  const resetDefaults = () => {
    const defaults = (DEFAULT_COLOR_RANGES[variable] || []).map((r) => ({ ...r }));
    setDraft(defaults);
    state.setColorRanges(variable, defaults);
  };

  if (!isOpen) return null;

  return (
    <div className="legend-editor-wrapper" role="dialog" aria-label="Color Range Configuration">
      <div className="legend-editor-header">
        <span className="legend-editor-title">
          {title ? `${title} · RANGES` : 'COLOR RANGES'}
        </span>
        <button
          className="legend-editor-close-btn"
          type="button"
          onClick={onClose}
          aria-label="Close editor"
        >
          <X size={12} />
        </button>
      </div>

      {!validation.isValid && (
        <div className="legend-validation-banner" role="alert">
          <AlertCircle size={12} />
          <span>Fix highlighted errors. Last valid configuration remains active.</span>
        </div>
      )}

      {sortedDraft.length === 0 ? (
        <div className="legend-empty-state">
          <span>No color ranges configured</span>
          <button type="button" className="editor-btn-action" onClick={addRange}>
            <Plus size={12} /> Add Range
          </button>
        </div>
      ) : (
        <div className="editor-ranges-list">
          {sortedDraft.map((r, i) => {
            const errors = validation.errors.filter((e) => e.rangeId === r.id);
            const minError = errors.find((e) => e.field === 'min');
            const maxError = errors.find((e) => e.field === 'max');
            const colorError = errors.find((e) => e.field === 'color');
            const hasError = errors.length > 0;

            return (
              <div
                className={`editor-range-row ${hasError ? 'row-has-error' : ''}`}
                key={r.id}
              >
                <div className="row-main-inputs">
                  <span className="row-index">{i + 1}</span>
                  <div className="input-group">
                    <input
                      className={`editor-input-num ${minError ? 'input-error' : ''}`}
                      type="number"
                      step="any"
                      value={Number.isFinite(r.min) ? r.min : ''}
                      onChange={(e) => updateRange(r.id, 'min', e.target.value)}
                      aria-label={`Range ${i + 1} Minimum`}
                    />
                  </div>
                  <span className="range-to-sep">–</span>
                  <div className="input-group">
                    <input
                      className={`editor-input-num ${maxError ? 'input-error' : ''}`}
                      type="number"
                      step="any"
                      value={Number.isFinite(r.max) ? r.max : ''}
                      onChange={(e) => updateRange(r.id, 'max', e.target.value)}
                      aria-label={`Range ${i + 1} Maximum`}
                    />
                  </div>
                  <div className={`color-picker-wrap ${colorError ? 'color-error' : ''}`}>
                    <input
                      type="color"
                      value={normalizeHex(r.color)}
                      onChange={(e) => updateRange(r.id, 'color', e.target.value)}
                      aria-label={`Range ${i + 1} Color`}
                    />
                    <span className="color-hex-text">{normalizeHex(r.color).toUpperCase()}</span>
                  </div>
                  <button
                    className="editor-btn-delete"
                    type="button"
                    onClick={() => deleteRange(r.id)}
                    aria-label={`Delete range ${i + 1}`}
                    title="Delete range"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {hasError && (
                  <div className="row-error-feedback">
                    <AlertCircle size={10} />
                    <span>
                      {errors
                        .map((e) => e.message)
                        .filter((m, idx, arr) => arr.indexOf(m) === idx)
                        .join(' · ')}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="editor-action-footer">
        <button className="editor-btn-action" type="button" onClick={addRange}>
          <Plus size={12} /> Add Range
        </button>
        <button
          className="editor-btn-action secondary"
          type="button"
          onClick={resetDefaults}
          title={`Reset ${variable} to scientific defaults`}
        >
          <RotateCcw size={12} /> Reset Defaults
        </button>
        {validation.isValid ? (
          <span className="editor-status-valid">Active</span>
        ) : (
          <span className="editor-status-invalid">Invalid</span>
        )}
      </div>
    </div>
  );
};
