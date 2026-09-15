import type { OceanDepthPoint } from '../../types/ocean';

/**
 * Generates structured ocean depth data across the Arabian Sea / Indian Ocean.
 * Depth bands range from 0m to 2000m.
 */
export function generateMockOceanDepthPoints(): OceanDepthPoint[] {
  const points: OceanDepthPoint[] = [];
  const depthBands = [0, 25, 50, 75, 100, 150, 200, 300, 400, 500, 600, 750, 1000, 1250, 1500, 1750, 2000];

  // Grid coordinates over Arabian Sea and Bay of Bengal
  const latMin = 7.0;
  const latMax = 22.0;
  const lonMin = 58.0;
  const lonMax = 86.0;

  const latSteps = 10;
  const lonSteps = 12;

  let idCounter = 1;

  for (let i = 0; i <= latSteps; i++) {
    const lat = latMin + (i / latSteps) * (latMax - latMin);

    for (let j = 0; j <= lonSteps; j++) {
      const lon = lonMin + (j / lonSteps) * (lonMax - lonMin);

      // Skip landmass approximation (central Indian peninsula)
      const isIndianLandmass = lat > 9.0 && lat < 21.0 && lon > 74.0 && lon < 82.0;
      if (isIndianLandmass) continue;

      const radLat = (lat * Math.PI) / 180;
      const radLon = (lon * Math.PI) / 180;
      const surfaceVariation = Math.sin(radLat * 4 + radLon * 2) * 1.5 + Math.cos(radLon * 3) * 1.0;
      const surfaceTemp = 28.5 + surfaceVariation;

      // Create vertical CTD profile soundings at this geographic location
      for (const depth of depthBands) {
        // Thermocline equation: T(z) = 2.5 + (T_surf - 2.5) * exp(-z / 420) + eddy noise
        const thermoclineTemp = 2.5 + (surfaceTemp - 2.5) * Math.exp(-depth / 420);
        const depthNoise = Math.sin(depth / 80 + radLat * 3) * 0.4;
        const temperature = parseFloat(Math.max(1.5, thermoclineTemp + depthNoise).toFixed(2));

        // Salinity profile (33.0 to 37.0 PSU)
        const isArabianSea = lon < 77.0;
        const baseSalinity = isArabianSea ? 36.2 : 33.4;
        const salinity = parseFloat((baseSalinity + Math.sin(depth / 250) * 0.6).toFixed(2));

        points.push({
          id: `pt-${idCounter++}`,
          latitude: parseFloat(lat.toFixed(4)),
          longitude: parseFloat(lon.toFixed(4)),
          depth,
          temperature,
          salinity,
        });
      }
    }
  }

  return points;
}

/**
 * Loads underwater ocean depth points.
 * To swap in a live API response later, change this function:
 * e.g., return await fetch('/api/ocean-depth-points').then(res => res.json());
 */
export async function loadOceanDepthData(): Promise<OceanDepthPoint[]> {
  try {
    const res = await fetch('/api/ocean-depth-points', { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch {
    // Fall back to local calculation if backend is offline
  }
  return generateMockOceanDepthPoints();
}
