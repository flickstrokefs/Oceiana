import type {
  HazardAnalysisRequest,
  HazardAnalysisResponse,
  HazardGridData,
  HazardLayer,
} from '../types/hazard';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export async function fetchHazardLayers(): Promise<HazardLayer[]> {
  const resp = await fetch(`${API_BASE}/api/hazard/layers`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Failed to fetch hazard layers' }));
    throw new Error(err.detail || `Error ${resp.status}`);
  }
  const data = await resp.json();
  return data.layers || [];
}

export async function runHazardAnalysis(
  payload: HazardAnalysisRequest
): Promise<HazardAnalysisResponse> {
  const resp = await fetch(`${API_BASE}/api/hazard/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Failed to execute hazard analysis' }));
    throw new Error(err.detail || `Analysis request failed with status ${resp.status}`);
  }
  return resp.json();
}

export async function fetchHazardGrid(
  variable: string,
  region: string,
  threshold?: number,
  timeRange?: string
): Promise<HazardGridData> {
  const params = new URLSearchParams({
    variable,
    region,
  });
  if (threshold !== undefined && threshold !== null) {
    params.append('threshold', threshold.toString());
  }
  if (timeRange) {
    params.append('time_range', timeRange);
  }

  const resp = await fetch(`${API_BASE}/api/hazard/grid?${params.toString()}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Failed to retrieve raster grid' }));
    throw new Error(err.detail || `Raster grid query failed (${resp.status})`);
  }
  return resp.json();
}
