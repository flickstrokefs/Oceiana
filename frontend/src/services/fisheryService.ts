import type {
  FisheryAdvisoryResponse,
  FisheryGridData,
  PFZCoordinate,
  PFZResponse,
} from '../types/fishery';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

function normalizeRegionAndVariable(argA: string, argB: string): { region: string; variable: string } {
  const BASIN_KEYWORDS = ['arabian', 'bengal', 'southern', 'indian', 'bay'];
  const aIsRegion = BASIN_KEYWORDS.some((k) => argA.toLowerCase().includes(k));
  const bIsRegion = BASIN_KEYWORDS.some((k) => argB.toLowerCase().includes(k));

  if (aIsRegion && !bIsRegion) {
    return { region: argA, variable: argB };
  }
  if (bIsRegion && !aIsRegion) {
    return { region: argB, variable: argA };
  }
  return {
    region: aIsRegion ? argA : 'Arabian Sea',
    variable: !aIsRegion ? argA : (argB || 'Chlorophyll-a (mg/m³)'),
  };
}

export async function fetchFisheryAdvisory(
  arg1: string = 'Arabian Sea',
  arg2: string = 'Chlorophyll-a (mg/m³)',
  timeRange: string = 'Next 7 days'
): Promise<FisheryAdvisoryResponse> {
  const { region, variable } = normalizeRegionAndVariable(arg1, arg2);
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
  // Ensure region is clean
  let cleanRegion = region;
  if (cleanRegion.includes('(')) cleanRegion = cleanRegion.split('(')[0].trim();
  const params = new URLSearchParams({ region: cleanRegion });
  const resp = await fetch(`${API_BASE}/api/fishery/pfz?${params.toString()}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: 'Failed to fetch PFZ coordinates' }));
    throw new Error(err.detail || `PFZ query failed (${resp.status})`);
  }
  return resp.json();
}

export const fetchPFZCoordinates = fetchPFZList;

export async function fetchFisheryGrid(
  arg1: string = 'Chlorophyll-a (mg/m³)',
  arg2: string = 'Arabian Sea',
  timeRange: string = 'Next 7 days'
): Promise<FisheryGridData> {
  const { region, variable } = normalizeRegionAndVariable(arg1, arg2);
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
