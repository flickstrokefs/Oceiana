import type { GliderTrajectory, GliderWaypoint } from '../types/ocean';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export interface BackendGliderPoint {
  latitude: number;
  longitude: number;
  depth: number;
  timestamp: string;
  temperature?: number | null;
  salinity?: number | null;
}

export interface BackendGliderItem {
  id: string;
  name: string;
  mission?: string | null;
  latitude: number;
  longitude: number;
  timestamp: string;
  depth?: number | null;
  status?: string;
  source?: string;
  source_dataset: string;
  region?: string | null;
  macro_region?: string | null;
  platform?: string | null;
  operator?: string | null;
  wmo_id?: string | null;
  battery?: number | null;
  measurements?: {
    temperature?: number | null;
    salinity?: number | null;
    density?: number | null;
  } | null;
  metadata?: Record<string, unknown> | null;
  waypoints_count?: number;
  waypoints?: BackendGliderPoint[];
  provenance?: 'REAL' | 'ESTIMATED' | 'SYNTHETIC';
}

export interface GliderProfileSounding {
  depth: number;
  temperature: number | null;
  salinity: number | null;
}

export function mapBackendGliderToTrajectory(item: BackendGliderItem): GliderTrajectory {
  const waypoints: GliderWaypoint[] =
    item.waypoints && item.waypoints.length > 0
      ? item.waypoints.map((wp) => ({
          latitude: wp.latitude,
          longitude: wp.longitude,
          depth: wp.depth ?? 0,
          timestamp: wp.timestamp,
          temperature: wp.temperature ?? item.measurements?.temperature ?? 20.0,
          salinity: wp.salinity ?? item.measurements?.salinity ?? 35.0,
        }))
      : [
          {
            latitude: item.latitude,
            longitude: item.longitude,
            depth: item.depth ?? 0,
            timestamp: item.timestamp,
            temperature: item.measurements?.temperature ?? 20.0,
            salinity: item.measurements?.salinity ?? 35.0,
          },
        ];

  return {
    id: item.id,
    name: item.name,
    mission: item.mission || `${item.region || 'Ocean'} Hydrographic Survey`,
    waypoints,
    region: item.region ?? undefined,
    macroRegion: item.macro_region ?? undefined,
    platform: item.platform ?? undefined,
    operator: item.operator ?? undefined,
    status: item.status ?? 'Active',
    battery: item.battery ?? 80,
    provenance: item.provenance ?? 'REAL',
  };
}

export async function fetchGliders(region?: string): Promise<GliderTrajectory[]> {
  const query = region ? `?region=${encodeURIComponent(region)}` : '';
  const res = await fetch(`${API_BASE}/api/gliders${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch gliders: ${res.statusText}`);
  }
  const data: BackendGliderItem[] = await res.json();
  return data.map(mapBackendGliderToTrajectory);
}

export async function fetchGliderTrack(id: string, downsample?: number): Promise<GliderWaypoint[]> {
  const query = downsample ? `?downsample=${downsample}` : '';
  const res = await fetch(`${API_BASE}/api/gliders/${encodeURIComponent(id)}/track${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch glider track for ${id}: ${res.statusText}`);
  }
  const points: BackendGliderPoint[] = await res.json();
  return points.map((p) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    depth: p.depth ?? 0,
    timestamp: p.timestamp,
    temperature: p.temperature ?? 20.0,
    salinity: p.salinity ?? 35.0,
  }));
}

export async function fetchGliderProfile(id: string): Promise<GliderProfileSounding[]> {
  const res = await fetch(`${API_BASE}/api/gliders/${encodeURIComponent(id)}/profile`);
  if (!res.ok) {
    throw new Error(`Failed to fetch glider profile for ${id}: ${res.statusText}`);
  }
  return await res.json();
}
