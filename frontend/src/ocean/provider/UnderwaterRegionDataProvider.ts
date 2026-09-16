import { OceanState } from '../OceanState';
import {
  UNDERWATER_REGIONS,
  type UnderwaterRegionQuery,
  type UnderwaterRegionData,
  type UnderwaterDataPoint,
  type UnderwaterCurrentVector,
} from '../../types/ocean';

/**
 * Service to fetch region-specific ocean analysis data.
 * Architecture:
 * REGION DEFINITION -> DATA QUERY -> DATASET -> VISUALIZATION
 *
 * This provides a clean abstraction boundary. When connecting to a live backend,
 * this function can be pointed to a REST/WebSocket API endpoint:
 * e.g., return await fetch(`/api/regions/${query.regionId}/slice?depth=${query.depth}&var=${query.variable}`).then(r => r.json());
 */
export async function fetchUnderwaterRegionData(
  query: UnderwaterRegionQuery
): Promise<UnderwaterRegionData> {
  try {
    const res = await fetch(`/api/regions/${encodeURIComponent(query.regionId)}/slice?depth=${query.depth}&var=${encodeURIComponent(query.variable)}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const liveData = await res.json();
      if (liveData && Array.isArray(liveData.points) && liveData.points.length > 0) {
        return liveData;
      }
    }
  } catch {
    // Fall back to local calculation if offline
  }

  const region =
    UNDERWATER_REGIONS.find((r) => r.id === query.regionId) ||
    UNDERWATER_REGIONS[0];

  const oceanState = OceanState.getInstance();
  const points: UnderwaterDataPoint[] = [];
  const currents: UnderwaterCurrentVector[] = [];

  // Generate structured spatial sampling within the region's geographic boundaries
  const lonSteps = 6;
  const latSteps = 5;
  const lonDelta = (region.east - region.west) / lonSteps;
  const latDelta = (region.north - region.south) / latSteps;

  // Depth strata to sample around the query depth for 3D volume stratification
  const depthOffsets = [0, -35, 35, -80, 80];

  let idCounter = 1;

  for (let i = 0; i <= latSteps; i++) {
    const lat = region.south + i * latDelta;

    for (let j = 0; j <= lonSteps; j++) {
      const lon = region.west + j * lonDelta;

      // Skip landmass approximation
      if (lat > 9.5 && lat < 21.0 && lon > 74.5 && lon < 82.0) continue;

      for (const dOffset of depthOffsets) {
        const sampleDepth = Math.max(
          region.depthMin,
          Math.min(region.depthMax, query.depth + dOffset)
        );

        const sample = oceanState.sampleSpatialField(lat, lon, sampleDepth);

        let value = sample.temperature;
        if (query.variable === 'salinity') value = sample.salinity;
        else if (query.variable === 'chlorophyll') value = sample.chlorophyll;
        else if (query.variable === 'current') {
          value = Math.hypot(sample.velocity.u, sample.velocity.v);
        }

        points.push({
          id: `${region.id}-pt-${idCounter++}`,
          latitude: parseFloat(lat.toFixed(4)),
          longitude: parseFloat(lon.toFixed(4)),
          depth: sampleDepth,
          value: parseFloat(value.toFixed(2)),
          temperature: parseFloat(sample.temperature.toFixed(2)),
          salinity: parseFloat(sample.salinity.toFixed(2)),
          chlorophyll: parseFloat(sample.chlorophyll.toFixed(2)),
          velocity: sample.velocity,
        });
      }

      // Sample velocity vector at the exact query depth for current visualization
      const surfaceSample = oceanState.sampleSpatialField(lat, lon, query.depth);
      const u = surfaceSample.velocity.u;
      const v = surfaceSample.velocity.v;
      const speed = Math.hypot(u, v);
      const angle = Math.atan2(v, u);

      currents.push({
        latitude: lat,
        longitude: lon,
        depth: query.depth,
        u,
        v,
        speed,
        angle,
      });
    }
  }

  return {
    regionId: query.regionId,
    depth: query.depth,
    variable: query.variable,
    timestamp: new Date().toISOString(),
    points,
    currents,
  };
}

/**
 * Clean alias for external and backend services:
 * fetchRegionData(regionId, depth, variable)
 */
export const fetchRegionData = fetchUnderwaterRegionData;
