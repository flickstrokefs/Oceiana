import type { ArgoProfile } from '../types/ocean';
import { getApiBaseUrl } from '../config/api';
import { OceanState } from '../ocean/OceanState';

const API_URL = getApiBaseUrl();
const STANDARD_DEPTHS = [0, 50, 100, 200, 500, 750, 1000, 1500, 2000];

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
  const state = OceanState.getInstance();

  return profiles.map((p) => {
    const nodes = STANDARD_DEPTHS.map((depth) => {
      const field = state.sampleSpatialField(p.latitude, p.longitude, depth);
      const temp = Number.isFinite(field?.temperature) ? parseFloat(field.temperature.toFixed(2)) : 28.0;
      const sal = Number.isFinite(field?.salinity) ? parseFloat(field.salinity.toFixed(2)) : 35.0;
      return { depth, temperature: temp, salinity: sal };
    });

    return {
      id: `argo-${p.profile_id}`,
      name: `Argo Float #${p.platform_number || p.profile_id}`,
      stationCode: p.station_code || `IND-ARGO-${p.platform_number || p.profile_id}`,
      latitude: p.latitude,
      longitude: p.longitude,
      timestamp: p.time,
      nodes,
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
