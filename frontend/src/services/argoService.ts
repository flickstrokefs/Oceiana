import type { ArgoProfile } from '../types/ocean';

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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
  const res = await fetch(`${API_URL}/api/argo/profiles${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch Argo profiles: ${res.statusText}`);
  }
  const data = await res.json();
  const profiles: BackendArgoProfileSummary[] = data.profiles || [];

  return profiles.map((p) => {
    // Real T/S soundings are fetched on demand via fetchArgoReadings(p.profile_id).
    // We do NOT pre-populate nodes here with synthetic values.
    return {
      id: `argo-${p.profile_id}`,
      name: `Argo Float #${p.platform_number || p.profile_id}`,
      stationCode: p.station_code || `IND-ARGO-${p.platform_number || p.profile_id}`,
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp: p.time,
      nodes: [],  // populated on demand via fetchArgoReadings(p.profile_id)
    };
  });
}

export async function fetchArgoReadings(profileId: number): Promise<BackendArgoReading[]> {
  const res = await fetch(`${API_URL}/api/argo/profiles/${profileId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch soundings for profile ${profileId}: ${res.statusText}`);
  }
  return await res.json();
}
