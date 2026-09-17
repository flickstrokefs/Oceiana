import type {
  OceanParameters,
  SpatialFieldValue,
  ArgoProfile,
  GliderTrajectory,
} from '../../types/ocean';

export interface OceanDataProvider {
  sampleField(
    latitude: number,
    longitude: number,
    depth: number,
    time: Date,
    params: OceanParameters
  ): SpatialFieldValue;

  getFieldSlice(
    minLat: number,
    maxLat: number,
    minLon: number,
    maxLon: number,
    depth: number,
    gridResolution: number,
    time: Date,
    params: OceanParameters
  ): SpatialFieldValue[][];

  getArgoProfiles(): ArgoProfile[];

  getGliderTrajectories(): GliderTrajectory[];
}
