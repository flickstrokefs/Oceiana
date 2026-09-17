import type { OceanDataProvider } from './OceanDataProvider';
import type {
  OceanParameters,
  SpatialFieldValue,
  ArgoProfile,
  GliderTrajectory,
} from '../../types/ocean';

export class MockOceanProvider implements OceanDataProvider {
  private argoProfiles: ArgoProfile[];
  private gliderTrajectories: GliderTrajectory[];

  constructor() {
    this.argoProfiles = this.generateMockArgoProfiles();
    this.gliderTrajectories = this.generateMockGliders();
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
    const oxygen = Math.max(0.1, 6.2 - depth / 450 + Math.sin(radLon * 4) * 0.4);

    return {
      temperature,
      salinity,
      chlorophyll,
      oxygen,
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

  private generateMockArgoProfiles(): ArgoProfile[] {
    return [
      {
        id: 'argo-2901633',
        name: 'Argo Float #2901633',
        stationCode: 'IND-AS-01',
        latitude: 14.5,
        longitude: 64.2,
        timestamp: new Date().toISOString(),
        nodes: [
          { depth: 0, temperature: 28.4, salinity: 36.2 },
          { depth: 50, temperature: 27.8, salinity: 36.4 },
          { depth: 100, temperature: 24.1, salinity: 36.1 },
          { depth: 200, temperature: 18.5, salinity: 35.7 },
          { depth: 500, temperature: 11.2, salinity: 35.2 },
          { depth: 1000, temperature: 6.8, salinity: 34.9 },
          { depth: 2000, temperature: 3.1, salinity: 34.7 },
        ],
      },
      {
        id: 'argo-2902844',
        name: 'Argo Float #2902844',
        stationCode: 'IND-BOB-04',
        latitude: 12.8,
        longitude: 85.6,
        timestamp: new Date().toISOString(),
        nodes: [
          { depth: 0, temperature: 29.1, salinity: 32.8 },
          { depth: 50, temperature: 28.2, salinity: 33.4 },
          { depth: 100, temperature: 23.5, salinity: 34.6 },
          { depth: 200, temperature: 17.2, salinity: 35.1 },
          { depth: 500, temperature: 10.4, salinity: 35.0 },
          { depth: 1000, temperature: 6.1, salinity: 34.8 },
          { depth: 2000, temperature: 2.9, salinity: 34.7 },
        ],
      },
      {
        id: 'argo-5903912',
        name: 'Argo Float #5903912',
        stationCode: 'IND-EQ-09',
        latitude: -2.4,
        longitude: 73.1,
        timestamp: new Date().toISOString(),
        nodes: [
          { depth: 0, temperature: 27.9, salinity: 35.1 },
          { depth: 50, temperature: 27.4, salinity: 35.2 },
          { depth: 100, temperature: 22.0, salinity: 35.4 },
          { depth: 200, temperature: 16.1, salinity: 35.3 },
          { depth: 500, temperature: 9.8, salinity: 34.9 },
          { depth: 1000, temperature: 5.4, salinity: 34.8 },
          { depth: 2000, temperature: 2.6, salinity: 34.7 },
        ],
      },
    ];
  }

  private generateMockGliders(): GliderTrajectory[] {
    const waypoints = [];
    const baseLat = 15.0;
    const baseLon = 68.0;

    for (let i = 0; i <= 30; i++) {
      const lat = baseLat + i * 0.12;
      const lon = baseLon + Math.sin(i * 0.4) * 0.25;
      const depth = Math.abs(Math.sin((i / 30) * Math.PI * 4)) * 950 + 10;
      const temp = 28.0 - (depth / 1000) * 22;

      waypoints.push({
        latitude: lat,
        longitude: lon,
        depth: depth,
        timestamp: new Date(Date.now() - (30 - i) * 3600000).toISOString(),
        temperature: temp,
        salinity: 36.0 + Math.sin(i * 0.2) * 0.5,
      });
    }

    return [
      {
        id: 'glider-seaexplorer-01',
        name: 'Deep Glider SEA-EXPLORER-IO4',
        mission: 'Arabian Sea Thermocline Survey',
        waypoints,
      },
    ];
  }
}
