import { fetchApiJson } from '../config/api';
import type { OceanVariable } from '../types/ocean';

export interface OceanSliceResponse {
  parameter: string;
  unit: string;
  depth: number;
  time: string;
  latitudes: number[];
  longitudes: number[];
  values: Array<Array<number | null>>;
  min_val: number;
  max_val: number;
  provenance?: string;
}

export interface OceanCurrentVector {
  latitude: number;
  longitude: number;
  depth: number;
  u: number;
  v: number;
  speed: number;
  angle: number;
}

export interface CurrentsSliceResponse {
  depth: number;
  time: string;
  count: number;
  vectors: OceanCurrentVector[];
  provenance?: string;
}

export interface OceanPointSample {
  latitude: number;
  longitude: number;
  depth: number;
  time: string;
  temperature: number | null;
  salinity: number | null;
  chlorophyll: number | null;
  velocity: { u?: number | null; v?: number | null; w?: number | null };
  provenance?: string;
}

export interface OceanTimeSeriesPoint {
  timestamp: string;
  value: number;
  unit: string;
  provenance?: string;
}

export interface OceanTimeSeriesResponse {
  parameter: string;
  latitude: number;
  longitude: number;
  depth: number;
  unit: string;
  points: OceanTimeSeriesPoint[];
}

export function oceanVariableToApiParameter(variable: OceanVariable): string {
  if (variable === 'current') return 'current';
  return variable;
}

function queryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const encoded = search.toString();
  return encoded ? `?${encoded}` : '';
}

export async function fetchDepthSlice(options: {
  parameter: OceanVariable;
  depth: number;
  time?: string | null;
  resolution?: number;
}): Promise<OceanSliceResponse> {
  const query = queryString({
    parameter: oceanVariableToApiParameter(options.parameter),
    depth: options.depth,
    time: options.time,
    resolution: options.resolution ?? 40,
  });
  return fetchApiJson<OceanSliceResponse>(`/api/ocean/depth-slice${query}`);
}

export async function fetchOceanCurrents(options: {
  depth: number;
  time?: string | null;
  step?: number;
}): Promise<CurrentsSliceResponse> {
  const query = queryString({
    depth: options.depth,
    time: options.time,
    step: options.step ?? 1.5,
  });
  return fetchApiJson<CurrentsSliceResponse>(`/api/ocean/currents${query}`);
}

export async function fetchOceanProfile(options: {
  lat: number;
  lon: number;
  depth: number;
}): Promise<OceanPointSample> {
  const query = queryString({
    lat: options.lat,
    lon: options.lon,
    depth: options.depth,
  });
  return fetchApiJson<OceanPointSample>(`/api/ocean/profile${query}`);
}

export async function fetchOceanTimeseries(options: {
  parameter: OceanVariable;
  lat: number;
  lon: number;
  depth: number;
}): Promise<OceanTimeSeriesResponse> {
  const query = queryString({
    parameter: oceanVariableToApiParameter(options.parameter),
    lat: options.lat,
    lon: options.lon,
    depth: options.depth,
  });
  return fetchApiJson<OceanTimeSeriesResponse>(`/api/ocean/timeseries${query}`);
}

export function currentSpeedFromSample(sample: OceanPointSample | null): number | null {
  if (!sample?.velocity) return null;
  const u = sample.velocity.u;
  const v = sample.velocity.v;
  if (u == null || v == null || !Number.isFinite(u) || !Number.isFinite(v)) return null;
  return Math.hypot(u, v);
}

export function sliceHasValues(slice: OceanSliceResponse | null): boolean {
  if (!slice?.values?.length) return false;
  for (const row of slice.values) {
    for (const cell of row) {
      if (cell != null && Number.isFinite(cell)) return true;
    }
  }
  return false;
}
