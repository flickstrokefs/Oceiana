import type { OceanDataProvider } from './OceanDataProvider';
import type {
  OceanParameters,
  SpatialFieldValue,
  ArgoProfile,
  GliderTrajectory,
} from '../../types/ocean';

const EMPTY_FIELD: SpatialFieldValue = {
  temperature: Number.NaN,
  salinity: Number.NaN,
  chlorophyll: Number.NaN,
  velocity: { u: Number.NaN, v: Number.NaN, w: Number.NaN },
};

/**
 * Non-fabricating provider. Surface visualization must load from the API
 * and store results on OceanState rather than sampling this object.
 */
export class EmptyOceanProvider implements OceanDataProvider {
  public sampleField(
    _latitude: number,
    _longitude: number,
    _depth: number,
    _time: Date,
    _params: OceanParameters,
  ): SpatialFieldValue {
    return { ...EMPTY_FIELD, velocity: { ...EMPTY_FIELD.velocity } };
  }

  public getFieldSlice(): SpatialFieldValue[][] {
    return [];
  }

  public getArgoProfiles(): ArgoProfile[] {
    return [];
  }

  public getGliderTrajectories(): GliderTrajectory[] {
    return [];
  }
}
