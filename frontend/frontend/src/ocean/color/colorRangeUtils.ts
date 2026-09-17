import * as Cesium from 'cesium';
import type { ColorRange, ColorRangeValidationIssue, ColorRangeValidationResult } from './colorTypes';
import type { OceanVariable } from '../../types/ocean';

export const normalizeHex = (hex: string): string => {
  const raw = String(hex || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return '#000000';
};

export const sortRanges = (ranges: ColorRange[]): ColorRange[] =>
  [...ranges].sort((a, b) => a.min - b.min || a.max - b.max || a.id.localeCompare(b.id));

export function validateColorRanges(ranges: ColorRange[]): ColorRangeValidationResult {
  const errors: ColorRangeValidationIssue[] = [];
  const sorted = sortRanges(ranges);
  const add = (rangeId: string, field: ColorRangeValidationIssue['field'], message: string) =>
    errors.push({ rangeId, field, message });

  for (const range of sorted) {
    if (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min >= range.max) {
      add(range.id, 'min', 'Minimum must be less than maximum.');
      add(range.id, 'max', 'Maximum must be greater than minimum.');
    }
  }

  const colors = new Map<string, string[]>();
  for (const range of sorted) {
    const color = normalizeHex(range.color);
    const ids = colors.get(color) || [];
    ids.push(range.id);
    colors.set(color, ids);
  }
  for (const ids of colors.values()) {
    if (ids.length > 1) {
      ids.forEach((id) => add(id, 'color', 'This color is already used by another range.'));
    }
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    if (Number.isFinite(a.max) && Number.isFinite(b.min) && a.max > b.min) {
      add(a.id, 'max', 'This range overlaps the next range.');
      add(b.id, 'min', 'This range overlaps the previous range.');
    }
  }

  return { isValid: errors.length === 0, errors };
}

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(normalizeHex(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

/**
 * Smooth scalar color mapping. Each configured range contributes an anchor at
 * its minimum, while the final range also contributes an anchor at its maximum.
 * Values between anchors are linearly interpolated; there are no hard bands.
 */
export const getInterpolatedColorForValue = (
  value: number,
  ranges: ColorRange[],
  fallbackColor = '#2d5e94',
): string => {
  const valid = sortRanges(ranges).filter(
    (r) => Number.isFinite(r.min) && Number.isFinite(r.max) && r.min < r.max,
  );
  if (!valid.length || !Number.isFinite(value)) return normalizeHex(fallbackColor);

  const anchors: { value: number; color: string }[] = [];
  for (let i = 0; i < valid.length; i++) {
    const r = valid[i];
    anchors.push({ value: r.min, color: normalizeHex(r.color) });
    const next = valid[i + 1];
    if (!next || r.max < next.min) {
      anchors.push({ value: r.max, color: normalizeHex(r.color) });
    }
  }

  if (anchors.length === 1) return anchors[0].color;
  if (value <= anchors[0].value) return anchors[0].color;
  if (value >= anchors[anchors.length - 1].value) return anchors[anchors.length - 1].color;

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    if (value >= a.value && value <= b.value) {
      const span = b.value - a.value;
      if (span <= 0) return b.color;
      const t = (value - a.value) / span;
      const ca = hexToRgb(a.color);
      const cb = hexToRgb(b.color);
      return rgbToHex(
        ca[0] + (cb[0] - ca[0]) * t,
        ca[1] + (cb[1] - ca[1]) * t,
        ca[2] + (cb[2] - ca[2]) * t,
      );
    }
  }

  return normalizeHex(fallbackColor);
};

export const getColorForValue = getInterpolatedColorForValue;

export const cesiumColorFromHex = (hex: string, alpha = 1): Cesium.Color => {
  const [r, g, b] = hexToRgb(hex);
  return new Cesium.Color(r / 255, g / 255, b / 255, alpha);
};

const make = (id: string, min: number, max: number, color: string): ColorRange => ({ id, min, max, color });

export const DEFAULT_COLOR_RANGES: Record<OceanVariable, ColorRange[]> = {
  temperature: [
    make('temperature-0', 2, 8, '#0022ff'),
    make('temperature-1', 8, 14, '#00d4ff'),
    make('temperature-2', 14, 20, '#00ff9d'),
    make('temperature-3', 20, 26, '#ffd000'),
    make('temperature-4', 26, 32, '#ff2200'),
  ],
  salinity: [
    make('salinity-0', 32, 33.5, '#2d5e94'),
    make('salinity-1', 33.5, 35, '#38bdf8'),
    make('salinity-2', 35, 36.5, '#facc15'),
    make('salinity-3', 36.5, 38, '#ef4444'),
  ],
  current: [
    make('current-0', 0, 0.75, '#161920'),
    make('current-1', 0.75, 1.5, '#2d5e94'),
    make('current-2', 1.5, 2.25, '#38bdf8'),
    make('current-3', 2.25, 3, '#f0f2f6'),
  ],
  chlorophyll: [
    make('chlorophyll-0', 0, 1.5, '#001f3f'),
    make('chlorophyll-1', 1.5, 3, '#0074D9'),
    make('chlorophyll-2', 3, 4.5, '#2ECC40'),
    make('chlorophyll-3', 4.5, 6, '#FFDC00'),
  ],
  oxygen: [
    make('oxygen-0', 0, 2, '#450a0a'),
    make('oxygen-1', 2, 4, '#dc2626'),
    make('oxygen-2', 4, 6, '#f59e0b'),
    make('oxygen-3', 6, 8, '#10b981'),
    make('oxygen-4', 8, 10, '#06b6d4'),
  ],
};

const cloneDefaults = (): Record<OceanVariable, ColorRange[]> =>
  Object.fromEntries(Object.entries(DEFAULT_COLOR_RANGES).map(([k, v]) => [k, v.map((r) => ({ ...r }))])) as Record<OceanVariable, ColorRange[]>;

const STORAGE_KEY = 'ocean-x-color-ranges-v2';

export const loadStoredRanges = (): Record<OceanVariable, ColorRange[]> => {
  const defaults = cloneDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, ColorRange[]>;
    for (const key of Object.keys(defaults) as OceanVariable[]) {
      const candidate = parsed?.[key];
      if (Array.isArray(candidate)) {
        defaults[key] = candidate
          .filter((r) => r && typeof r.id === 'string' && Number.isFinite(r.min) && Number.isFinite(r.max) && typeof r.color === 'string')
          .map((r) => ({ id: r.id, min: r.min, max: r.max, color: normalizeHex(r.color) }));
      }
    }
  } catch { /* use defaults */ }
  return defaults;
};

export const saveStoredRanges = (ranges: Record<OceanVariable, ColorRange[]>): void => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ranges)); } catch { /* storage is optional */ }
};
