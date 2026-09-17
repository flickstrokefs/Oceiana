import type { ArgoProfile, ArgoNode } from '../types/ocean';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export interface BackendArgoProfileSummary {
  profile_id: number;
  platform_number?: number | null;
  station_code: string;
  latitude: number;
  longitude: number;
  time: string;
  min_pressure: number;
  max_pressure: number;
  levels_count: number;
  provenance?: string;
}

export interface BackendArgoReading {
  profile_id: number;
  latitude: number;
  longitude: number;
  time: string;
  pres: number;
  temp?: number | null;
  psal?: number | null;
  platform_number?: number | null;
  cycle_number?: number | null;
}

export async function fetchArgoProfiles(region?: string): Promise<ArgoProfile[]> {
  const query = region ? `?region=${encodeURIComponent(region)}` : '';
  const res = await fetch(`${API_BASE}/api/argo/profiles${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Argo profiles: ${res.statusText}`);
  }
  const data = await res.json();
  const profiles: BackendArgoProfileSummary[] = data.profiles || [];

  return profiles.map((p) => {
    // Construct default standard nodes for immediate HUD inspection
    const maxPres = p.max_pressure || 2000;
    const sampleNodes: ArgoNode[] = [
      { depth: 0, temperature: 28.2, salinity: 35.2 },
      { depth: 50, temperature: 27.5, salinity: 35.4 },
      { depth: 100, temperature: 23.8, salinity: 35.3 },
      { depth: 200, temperature: 18.0, salinity: 35.1 },
      { depth: 500, temperature: 11.0, salinity: 35.0 },
      { depth: 1000, temperature: 6.5, salinity: 34.8 },
      { depth: maxPres, temperature: 3.0, salinity: 34.7 },
    ];

    return {
      id: `argo-${p.profile_id}`,
      name: `Argo Float #${p.platform_number || p.profile_id}`,
      stationCode: p.station_code || `IND-ARGO-${p.platform_number || p.profile_id}`,
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp: p.time,
      nodes: sampleNodes,
    };
  });
}

export async function fetchArgoReadings(profileId: number): Promise<BackendArgoReading[]> {
  const res = await fetch(`${API_BASE}/api/argo/profiles/${profileId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch soundings for profile ${profileId}: ${res.statusText}`);
  }
  return await res.json();
}
