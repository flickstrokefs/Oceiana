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
// Request deduplication cache
const inFlightRequests = new Map<string, Promise<UnderwaterRegionData>>();
let currentActiveController: AbortController | null = null;

/**
 * Service to fetch region-specific ocean analysis data.
 * Architecture:
 * REGION DEFINITION -> DATA QUERY -> DATASET -> VISUALIZATION
 *
 * Strict lazy loading:
 * - Validates authorized region IDs
 * - Rejects unauthorized regions (andaman-sea, laccadive-sea, java-sea)
 * - Request deduplication
 * - AbortController cancellation for stale requests
 */
export async function fetchUnderwaterRegionData(
  query: UnderwaterRegionQuery,
  externalSignal?: AbortSignal
): Promise<UnderwaterRegionData> {
  // 1. Strict validation: check authorized scope
  const region = UNDERWATER_REGIONS.find((r) => r.id === query.regionId);
  if (!region) {
    throw new Error(`Unauthorized or invalid underwater region ID: ${query.regionId}`);
  }

  // 2. Cancel previous in-flight request if switching regions
  if (currentActiveController) {
    currentActiveController.abort();
  }
  const controller = new AbortController();
  currentActiveController = controller;

  // Deduplication key
  const cacheKey = `${query.regionId}:${query.depth}:${query.variable}`;
  const existingRequest = inFlightRequests.get(cacheKey);
  if (existingRequest) {
    return existingRequest;
  }

  const fetchPromise = (async () => {
    try {
      // Abort if external signal triggers or internal controller triggers
      const combinedSignal = externalSignal
        ? AbortSignal.any([externalSignal, controller.signal, AbortSignal.timeout(5000)])
        : AbortSignal.any([controller.signal, AbortSignal.timeout(5000)]);

      const res = await fetch(
        `/api/regions/${encodeURIComponent(query.regionId)}/slice?depth=${query.depth}&var=${encodeURIComponent(query.variable)}`,
        { signal: combinedSignal }
      );

      if (res.ok) {
        const liveData = await res.json();
        if (liveData && Array.isArray(liveData.points) && liveData.points.length > 0) {
          return liveData;
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      // Fall back to local calculation if offline or backend unavailable
    } finally {
      inFlightRequests.delete(cacheKey);
    }

    if (controller.signal.aborted || externalSignal?.aborted) {
      throw new DOMException('Request aborted', 'AbortError');
    }

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
        const temp = Number.isFinite(sample?.temperature) ? sample.temperature : 24.0;
        const sal = Number.isFinite(sample?.salinity) ? sample.salinity : 35.0;
        const chl = Number.isFinite(sample?.chlorophyll) ? sample.chlorophyll : 0.8;
        const uVal = Number.isFinite(sample?.velocity?.u) ? sample.velocity.u : 0.4;
        const vVal = Number.isFinite(sample?.velocity?.v) ? sample.velocity.v : 0.3;

        let value = temp;
        if (query.variable === 'salinity') value = sal;
        else if (query.variable === 'chlorophyll') value = chl;
        else if (query.variable === 'current') {
          value = Math.hypot(uVal, vVal);
        }

        points.push({
          id: `${region.id}-pt-${idCounter++}`,
          latitude: parseFloat(lat.toFixed(4)),
          longitude: parseFloat(lon.toFixed(4)),
          depth: sampleDepth,
          value: parseFloat(value.toFixed(2)),
          temperature: parseFloat(temp.toFixed(2)),
          salinity: parseFloat(sal.toFixed(2)),
          chlorophyll: parseFloat(chl.toFixed(2)),
          velocity: { u: uVal, v: vVal, w: sample?.velocity?.w ?? 0 },
        });
      }

      // Sample velocity vector at the exact query depth for current visualization
      const surfaceSample = oceanState.sampleSpatialField(lat, lon, query.depth);
      const u = Number.isFinite(surfaceSample?.velocity?.u) ? surfaceSample.velocity.u : 0.4;
      const v = Number.isFinite(surfaceSample?.velocity?.v) ? surfaceSample.velocity.v : 0.3;
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
  })();

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

/**
 * Clean alias for external and backend services:
 * fetchRegionData(regionId, depth, variable)
 */
export const fetchRegionData = fetchUnderwaterRegionData;
