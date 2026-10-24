/**
 * Live Physical Glider API Service
 * Fetches real-time COM3 glider telemetry and diagnostic status from the local backend.
 */

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export interface LiveGliderObservation {
  glider_id: string;
  timestamp: string;
  raw_message: string;
  depth_cm?: number | null;
  temp_c?: number | null;
  temp_c_verified: boolean;
  ds18b20_fallback_active: boolean;
  turb_v?: number | null;
  ntu?: number | null;
  turbidity_verified: boolean;
  tds_v?: number | null;
  tds_ppm?: number | null;
  tds_verified: boolean;
  latitude?: number | null;
  longitude?: number | null;
  warnings?: string[];
  parsed_fields?: Record<string, unknown>;
  source?: string;
}

export interface LiveGliderStatus {
  status: 'ONLINE' | 'STALE' | 'DISCONNECTED';
  is_online: boolean;
  glider_id: string;
  latest?: LiveGliderObservation | null;
  last_received_at?: string | null;
  seconds_since_last_update?: number | null;
  ds18b20_fallback_active: boolean;
  active_warnings: string[];
  total_observations_received: number;
  storage_note?: string;
}

export async function fetchLiveGliderStatus(): Promise<LiveGliderStatus | null> {
  try {
    const res = await fetch(`${API_URL}/api/gliders/live?_t=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });
    if (!res.ok) {
      return null;
    }
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchLiveGliderHistory(limit = 20): Promise<LiveGliderObservation[]> {
  try {
    const res = await fetch(`${API_URL}/api/gliders/live/history?limit=${limit}`);
    if (!res.ok) {
      return [];
    }
    return await res.json();
  } catch {
    return [];
  }
}
