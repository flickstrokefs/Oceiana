import type {
  FisheryAdvisoryResponse,
  FisheryGridData,
  PFZCoordinate,
  PFZResponse,
} from '../types/fishery';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export async function fetchFisheryAdvisory(
  region: string = 'Arabian Sea',
  variable: string = 'Chlorophyll (mg/m³)',
  timeRange: string = 'Next 7 days'
): Promise<FisheryAdvisoryResponse> {
  const params = new URLSearchParams({
    region,
    variable,
    time_range: timeRange,
  });

  const resp = await fetch(`${API_BASE}/api/fishery/advisory?${params.toString()}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Failed to generate fishery advisory' }));
    throw new Error(err.detail || `Fishery advisory query failed (${resp.status})`);
  }
  return resp.json();
}

export async function fetchPFZList(region: string = 'Arabian Sea'): Promise<PFZResponse> {
  const params = new URLSearchParams({ region });
  const resp = await fetch(`${API_BASE}/api/fishery/pfz?${params.toString()}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Failed to fetch PFZ coordinates' }));
    throw new Error(err.detail || `PFZ query failed (${resp.status})`);
  }
  return resp.json();
}

export const fetchPFZCoordinates = fetchPFZList;

export async function fetchFisheryGrid(
  variable: string = 'Chlorophyll (mg/m³)',
  region: string = 'Arabian Sea',
  timeRange: string = 'Next 7 days'
): Promise<FisheryGridData> {
  const params = new URLSearchParams({
    variable,
    region,
    time_range: timeRange,
  });
  const resp = await fetch(`${API_BASE}/api/fishery/grid?${params.toString()}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Failed to fetch fishery grid data' }));
    throw new Error(err.detail || `Fishery grid query failed (${resp.status})`);
  }
  return resp.json();
}

export async function fetchPFZDetail(id: string): Promise<PFZCoordinate> {
  const resp = await fetch(`${API_BASE}/api/fishery/pfz/${encodeURIComponent(id)}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Failed to load PFZ details' }));
    throw new Error(err.detail || `PFZ detail request failed (${resp.status})`);
  }
  return resp.json();
}
