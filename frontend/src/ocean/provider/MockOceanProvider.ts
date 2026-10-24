import type { OceanDataProvider } from './OceanDataProvider';
import type {
  OceanParameters,
  SpatialFieldValue,
  ArgoProfile,
  GliderTrajectory,
} from '../../types/ocean';

/**
 * ⚠️  SYNTHETIC DATA — NOT FOR USER-FACING NUMBERS
 *
 * MockOceanProvider uses trigonometric formulas (sin/cos/exp) to produce
 * plausible-looking temperature, salinity, and current fields.
 * These are NOT measurements and NOT from any model (ROMS/CMEMS/INCOIS).
 *
 * Permitted uses:
 *   - 3D visual mesh color gradients when no real field data is loaded
 *     (the mesh shows "DEMO — no real field data" badge in the UI)
 *
 * Forbidden uses:
 *   - Any panel, table, or chart that shows numbers to a user
 *   - Any API response with provenance != "SYNTHETIC"
 *   - Comparison against real Argo/glider observations
 */
export class MockOceanProvider implements OceanDataProvider {
  private argoProfiles: ArgoProfile[];
  private gliderTrajectories: GliderTrajectory[];

  constructor() {
    this.argoProfiles = [];
    this.gliderTrajectories = [];
  }

  public sampleField(
    lat: number,
    lon: number,
    depth: number,
    _time: Date,
    params: OceanParameters
  ): SpatialFieldValue {
    const radLat = (lat * Math.PI) / 180;
    const radLon = (lon * Math.PI) / 180;

    const spatialVariation =
      Math.sin(radLat * 3 + radLon * 2) * 1.8 +
      Math.cos(radLon * 4 - radLat * 2) * 1.2;

    const latFactor = Math.cos((lat - 5) * 0.04);
    const surfaceTemp = Math.max(0, params.temperature + spatialVariation * latFactor);

    const deepTemp = 2.5;
    const temperature =
      deepTemp + (surfaceTemp - deepTemp) * Math.exp(-depth / 400);

    const isArabianSea = lon < 77 && lat > 5;
    const isBayOfBengal = lon >= 77 && lat > 5;

    let baseSalinity = params.salinity;
    if (isArabianSea) baseSalinity += 1.8;
    if (isBayOfBengal) baseSalinity -= 2.2;

    const salinityEddy = Math.cos(radLat * 5 + radLon * 3) * 0.6;
    const salinity = Math.min(
      40,
      Math.max(10, baseSalinity + salinityEddy + Math.sin(depth / 300) * 0.4)
    );

    const currentMult = params.currentSpeed;
    const uFlow =
      (Math.sin(radLat * 2.5) * 0.8 + Math.cos(radLon * 2.0) * 0.5) * currentMult;
    const vFlow =
      (Math.cos(radLat * 2.5) * 0.6 - Math.sin(radLon * 1.5) * 0.7) * currentMult;
    const wFlow = Math.sin(radLat * 6) * 0.05 * Math.exp(-depth / 500) * currentMult;

    const isCoastal = lat > 12 && (lon < 60 || (lon > 72 && lon < 77));
    const coastalBloom = isCoastal ? 3.5 : 0.4;
    const chlSurface = params.chlorophyll + coastalBloom + Math.sin(radLon * 6) * 0.8;
    const scmFactor = Math.exp(-Math.pow((depth - 60) / 40, 2));
    const chlorophyll = Math.max(0, chlSurface * (0.3 + 0.7 * scmFactor));

    return {
      temperature,
      salinity,
      chlorophyll,
      velocity: { u: uFlow, v: vFlow, w: wFlow },
    };
  }

  public getFieldSlice(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    depth: number,
    gridResolution: number,
    time: Date,
    params: OceanParameters
  ): SpatialFieldValue[][] {
    const grid: SpatialFieldValue[][] = [];
    const latStep = (maxLat - minLat) / gridResolution;
    const lonStep = (maxLon - minLon) / gridResolution;

    for (let i = 0; i <= gridResolution; i++) {
      const lat = minLat + i * latStep;
      const row: SpatialFieldValue[] = [];
      for (let j = 0; j <= gridResolution; j++) {
        const lon = minLon + j * lonStep;
        row.push(this.sampleField(lat, lon, depth, time, params));
      }
      grid.push(row);
    }
    return grid;
  }

  public getArgoProfiles(): ArgoProfile[] {
    return this.argoProfiles;
  }

  public getGliderTrajectories(): GliderTrajectory[] {
    return this.gliderTrajectories;
  }
}
