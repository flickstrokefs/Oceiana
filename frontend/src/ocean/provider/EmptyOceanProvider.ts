import type { OceanDataProvider } from './OceanDataProvider';
import type {
  OceanParameters,
  SpatialFieldValue,
  ArgoProfile,
  GliderTrajectory,
} from '../../types/ocean';
import { MockOceanProvider } from './MockOceanProvider';

/**
 * Resilient provider. Surface visualization loads from API, but spatial sampling
 * delegates to physical equations in MockOceanProvider rather than returning NaN.
 */
export class EmptyOceanProvider implements OceanDataProvider {
  private fallback = new MockOceanProvider();

  public sampleField(
    latitude: number,
    longitude: number,
    depth: number,
    time: Date,
    params: OceanParameters,
  ): SpatialFieldValue {
    return this.fallback.sampleField(latitude, longitude, depth, time, params);
  }

  public getFieldSlice(): SpatialFieldValue[][] {
    return [];
  }

  public getArgoProfiles(): ArgoProfile[] {
    return this.fallback.getArgoProfiles();
  }

  public getGliderTrajectories(): GliderTrajectory[] {
    return this.fallback.getGliderTrajectories();
  }
}

