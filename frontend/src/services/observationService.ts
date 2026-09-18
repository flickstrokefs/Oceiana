/**
 * Observation Profile service layer.
 *
 * Tries the Ariel backend (`/api/observations/...`) first.
 * Falls back to composing profiles from OceanState / MockOceanProvider
 * so the UI works without a running API.
 *
 * INTEGRATION NOTE — replace mock composition with real pipelines later:
 * - Argo NetCDF / GDAC
 * - Glider CSV / ERDDAP
 * - Model NetCDF (ROMS / MOM / INCOIS products)
 */

import { OceanState } from '../ocean/OceanState';
import type {
  ArgoProfile,
  GliderTrajectory,
  ObservationProfilePayload,
  ObservationSourceCard,
  ProfileDepthSample,
  ProfileVariable,
  SelectedObservation,
} from '../types/ocean';

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const STANDARD_DEPTHS = [0, 50, 100, 200, 250, 500, 750, 1000, 1500, 2000];

function nearestSample<T extends { depth: number }>(
  samples: T[],
  depth: number
): T | null {
  if (!samples.length) return null;
  let best = samples[0];
  let bestDiff = Math.abs(best.depth - depth);
  for (const s of samples) {
    const d = Math.abs(s.depth - depth);
    if (d < bestDiff) {
      best = s;
      bestDiff = d;
    }
  }
  return best;
}

function interpolateSeries(
  nodes: { depth: number; temperature: number; salinity: number }[],
  depths: number[]
): ProfileDepthSample[] {
  return depths.map((depth) => {
    const n = nearestSample(nodes, depth);
    return {
      depth,
      temperature: n?.temperature ?? null,
      salinity: n?.salinity ?? null,
      currentSpeed: null,
      chlorophyll: null,
      oxygen: null,
    };
  });
}

function buildModelProfile(
  lat: number,
  lon: number,
  depths: number[]
): ProfileDepthSample[] {
  const state = OceanState.getInstance();
  return depths.map((depth) => {
    const field = state.sampleSpatialField(lat, lon, depth);
    const speed = Math.sqrt(
      field.velocity.u ** 2 + field.velocity.v ** 2 + (field.velocity.w ?? 0) ** 2
    );
    return {
      depth,
      temperature: field.temperature,
      salinity: field.salinity,
      currentSpeed: speed,
      chlorophyll: field.chlorophyll,
      // Placeholder until biogeochemical model layer is wired
      oxygen: Math.max(0, 6.5 - depth / 400 + Math.sin(lat) * 0.2),
    };
  });
}

function gliderToCard(glider: GliderTrajectory): ObservationSourceCard {
  const latest = glider.waypoints[glider.waypoints.length - 1];
  return {
    id: glider.id,
    label: glider.name,
    sourceType: 'glider',
    latitude: latest?.latitude ?? 0,
    longitude: latest?.longitude ?? 0,
    timestamp: latest?.timestamp ?? new Date().toISOString(),
    depth: latest?.depth ?? null,
    status: 'Active',
    metadata: {
      mission: glider.mission,
      waypoints: glider.waypoints.length,
      type: 'Underwater Glider',
    },
    surfaceValues: {
      temperature: latest?.temperature ?? null,
      salinity: latest?.salinity ?? null,
      currentSpeed: null,
      chlorophyll: null,
      oxygen: null,
    },
  };
}

function argoToCard(argo: ArgoProfile): ObservationSourceCard {
  const surface = argo.nodes[0];
  const maxDepth = argo.nodes.reduce((m, n) => Math.max(m, n.depth), 0);
  return {
    id: argo.id,
    label: argo.name,
    sourceType: 'argo',
    latitude: argo.latitude,
    longitude: argo.longitude,
    timestamp: argo.timestamp,
    depth: maxDepth,
    status: 'Profiling',
    metadata: {
      stationCode: argo.stationCode,
      type: 'Argo Float',
      nodes: argo.nodes.length,
    },
    surfaceValues: {
      temperature: surface?.temperature ?? null,
      salinity: surface?.salinity ?? null,
      currentSpeed: null,
      chlorophyll: null,
      oxygen: null,
    },
  };
}

function pickCompanionGlider(
  gliders: GliderTrajectory[],
  selected: SelectedObservation,
  lat: number,
  lon: number
): GliderTrajectory | null {
  if (selected.type === 'glider') return selected.data as GliderTrajectory;
  if (!gliders.length) return null;
  let best = gliders[0];
  let bestDist = Infinity;
  for (const g of gliders) {
    const wp = g.waypoints[g.waypoints.length - 1];
    if (!wp) continue;
    const d = (wp.latitude - lat) ** 2 + (wp.longitude - lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = g;
    }
  }
  return best;
}

function pickCompanionArgo(
  argos: ArgoProfile[],
  selected: SelectedObservation,
  lat: number,
  lon: number
): ArgoProfile | null {
  if (selected.type === 'argo') return selected.data as ArgoProfile;
  if (!argos.length) return null;
  let best = argos[0];
  let bestDist = Infinity;
  for (const a of argos) {
    const d = (a.latitude - lat) ** 2 + (a.longitude - lon) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return best;
}

function composeLocalProfile(
  selected: SelectedObservation
): ObservationProfilePayload {
  const oceanState = OceanState.getInstance();
  const provider = oceanState.getProvider();
  const argos = provider.getArgoProfiles();
  const realGliders = oceanState.getGliders();
  const gliders = realGliders.length > 0 ? realGliders : provider.getGliderTrajectories();

  let lat: number;
  let lon: number;
  let timestamp: string;

  if (selected.type === 'argo') {
    const argo = selected.data as ArgoProfile;
    lat = argo.latitude;
    lon = argo.longitude;
    timestamp = argo.timestamp;
  } else {
    const glider = selected.data as GliderTrajectory;
    const latest = glider.waypoints[glider.waypoints.length - 1];
    lat = latest?.latitude ?? 0;
    lon = latest?.longitude ?? 0;
    timestamp = latest?.timestamp ?? new Date().toISOString();
  }

  const modelSamples = buildModelProfile(lat, lon, STANDARD_DEPTHS);
  const modelSurface = modelSamples[0];

  const modelCard: ObservationSourceCard = {
    id: 'model-incois-io',
    label: 'INCOIS Regional Ocean Model',
    sourceType: 'model',
    latitude: lat,
    longitude: lon,
    timestamp,
    depth: STANDARD_DEPTHS[STANDARD_DEPTHS.length - 1],
    status: 'Operational',
    metadata: {
      model: 'IO-ROMS / mock field',
      grid: 'Regional Indian Ocean',
    },
    surfaceValues: {
      temperature: modelSurface?.temperature ?? null,
      salinity: modelSurface?.salinity ?? null,
      currentSpeed: modelSurface?.currentSpeed ?? null,
      chlorophyll: modelSurface?.chlorophyll ?? null,
      oxygen: modelSurface?.oxygen ?? null,
    },
  };

  const glider = pickCompanionGlider(gliders, selected, lat, lon);
  const argo = pickCompanionArgo(argos, selected, lat, lon);

  const gliderProfile = glider
    ? interpolateSeries(
        glider.waypoints.map((wp) => ({
          depth: wp.depth,
          temperature: wp.temperature,
          salinity: wp.salinity,
        })),
        STANDARD_DEPTHS
      )
    : [];

  const argoProfile = argo
    ? interpolateSeries(argo.nodes, STANDARD_DEPTHS)
    : [];

  const availableVariables: ProfileVariable[] = [
    'temperature',
    'salinity',
    'currentSpeed',
    'chlorophyll',
    'oxygen',
  ];

  return {
    selectedId: selected.data.id,
    selectedType: selected.type,
    model: modelCard,
    glider: glider ? gliderToCard(glider) : null,
    argo: argo ? argoToCard(argo) : null,
    profile: {
      depths: STANDARD_DEPTHS,
      model: modelSamples,
      glider: gliderProfile,
      argo: argoProfile,
    },
    availableVariables,
  };
}

async function fetchRemoteProfile(
  selected: SelectedObservation
): Promise<ObservationProfilePayload | null> {
  const id = selected.data.id;
  const url = `${API_BASE}/api/observations/${encodeURIComponent(id)}/profile?type=${selected.type}`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return (await res.json()) as ObservationProfilePayload;
  } catch {
    return null;
  }
}

/**
 * Load Observation Profile comparison payload for the selected marker.
 */
export async function fetchObservationProfile(
  selected: SelectedObservation
): Promise<ObservationProfilePayload> {
  const remote = await fetchRemoteProfile(selected);
  if (remote) return remote;
  // Simulated short delay so loading UI is visible during local fallback
  await new Promise((r) => setTimeout(r, 180));
  return composeLocalProfile(selected);
}

export function getObservationFocusCoords(
  selected: SelectedObservation
): { longitude: number; latitude: number; id: string } {
  if (selected.type === 'argo') {
    const argo = selected.data as ArgoProfile;
    return { longitude: argo.longitude, latitude: argo.latitude, id: argo.id };
  }
  const glider = selected.data as GliderTrajectory;
  const latest = glider.waypoints[glider.waypoints.length - 1];
  return {
    longitude: latest?.longitude ?? 0,
    latitude: latest?.latitude ?? 0,
    id: glider.id,
  };
}
