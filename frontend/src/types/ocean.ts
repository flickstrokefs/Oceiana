export type OceanMode = 'surface' | 'underwater';

export type OceanVariable =
  | 'temperature'
  | 'salinity'
  | 'current'
  | 'chlorophyll';

export interface OceanParameters {
  temperature: number; // °C (0 - 35)
  salinity: number; // PSU (10 - 40)
  currentSpeed: number; // m/s (0 - 5)
  depth: number; // meters (0 - 5000)
  chlorophyll: number; // mg/m³ (0 - 10)
}

export interface OceanDepthPoint {
  id: string;
  latitude: number;
  longitude: number;
  depth: number;
  temperature: number;
  salinity: number;
}

export interface SpatialPoint {
  latitude: number;
  longitude: number;
  depth: number;
}

export interface VelocityVector {
  u: number;
  v: number;
  w: number;
}

export interface SpatialFieldValue {
  temperature: number;
  salinity: number;
  chlorophyll: number;
  velocity: VelocityVector;
}

export interface ArgoNode {
  depth: number;
  temperature: number;
  salinity: number;
  pressure?: number;
}

export interface ArgoProfile {
  id: string;
  name: string;
  stationCode: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  nodes: ArgoNode[];
}

export interface GliderWaypoint {
  latitude: number;
  longitude: number;
  depth: number;
  timestamp: string;
  temperature: number;
  salinity: number;
}

export interface GliderTrajectory {
  id: string;
  name: string;
  mission: string;
  waypoints: GliderWaypoint[];
  region?: string;
  macroRegion?: string;
  platform?: string;
  operator?: string;
  status?: string;
  battery?: number;
  provenance?: 'REAL' | 'ESTIMATED' | 'SYNTHETIC';
}

export type UnderwaterRegionId =
  | 'bay-of-bengal'
  | 'arabian-sea'
  | 'andaman-sea'
  | 'laccadive-sea'
  | 'java-sea'
  | 'southern-ocean'
  | 'indian-ocean';

export type OceanDomainId =
  | 'indian-ocean'
  | 'southern-ocean';

export interface UnderwaterRegionDefinition {
  id: UnderwaterRegionId;
  name: string;
  label: string;
  description: string;
  boundsLabel: string;
  west: number;
  east: number;
  south: number;
  north: number;
  depthMin: number;
  depthMax: number;
  /**
   * [longitude, latitude]
   *
   * Source: IHO Sea Areas v3.
   * Used as the source of truth for the region outline,
   * grid clipping and 3D mesh footprint.
   */
  footprint: [number, number][];
}

export interface OceanDomainDefinition {
  id: OceanDomainId;
  name: string;
  label: string;
  description: string;
  footprint: [number, number][];
  children: UnderwaterRegionId[];
}

export interface UnderwaterRegionPolygon {
  longitude: number;
  latitude: number;
}

export type UnderwaterRegion = UnderwaterRegionDefinition;

export interface UnderwaterDataPoint {
  id: string;
  latitude: number;
  longitude: number;
  depth: number;
  value: number;
  temperature: number;
  salinity: number;
  chlorophyll?: number;
  velocity?: { u: number; v: number; w?: number };
}

export interface UnderwaterCurrentVector {
  latitude: number;
  longitude: number;
  depth: number;
  u: number;
  v: number;
  speed: number;
  angle: number;
}

export interface UnderwaterRegionQuery {
  regionId: UnderwaterRegionId;
  depth: number;
  variable: OceanVariable;
}

export interface UnderwaterRegionData {
  regionId: UnderwaterRegionId;
  depth: number;
  variable: OceanVariable;
  timestamp: string;
  points: UnderwaterDataPoint[];
  currents: UnderwaterCurrentVector[];
}

export {
  OCEAN_REGIONS,
  COMPUTED_UNDERWATER_REGIONS as UNDERWATER_REGIONS,
  COMPUTED_OCEAN_DOMAINS as OCEAN_DOMAINS,
  type OceanRegionConfig,
  type RegionGridConfig,
  getOceanRegionConfig,
} from '../ocean/data/oceanRegions';

import {
  COMPUTED_UNDERWATER_REGIONS,
} from '../ocean/data/oceanRegions';

export const INDIAN_OCEAN_REGION: UnderwaterRegionDefinition =
  COMPUTED_UNDERWATER_REGIONS.find((r) => r.id === 'indian-ocean')!;


export type SelectedObservation =
  | { type: 'argo'; data: ArgoProfile }
  | { type: 'glider'; data: GliderTrajectory };

export type ProfileVariable =
  | 'temperature'
  | 'salinity'
  | 'currentSpeed'
  | 'chlorophyll'
  | 'oxygen';

export interface ProfileDepthSample {
  depth: number;
  temperature?: number | null;
  salinity?: number | null;
  currentSpeed?: number | null;
  chlorophyll?: number | null;
  oxygen?: number | null;
}

export interface ObservationSourceCard {
  id: string;
  label: string;
  sourceType: 'model' | 'glider' | 'argo';
  latitude: number;
  longitude: number;
  timestamp: string;
  depth: number | null;
  status?: string;
  metadata?: Record<string, string | number | null | undefined>;
  surfaceValues: {
    temperature?: number | null;
    salinity?: number | null;
    currentSpeed?: number | null;
    chlorophyll?: number | null;
    oxygen?: number | null;
  };
}

export interface ObservationProfilePayload {
  selectedId: string;
  selectedType: 'argo' | 'glider';
  model: ObservationSourceCard;
  glider: ObservationSourceCard | null;
  argo: ObservationSourceCard | null;
  profile: {
    depths: number[];
    model: ProfileDepthSample[];
    glider: ProfileDepthSample[];
    argo: ProfileDepthSample[];
  };
  availableVariables: ProfileVariable[];
}

export type ArielPage =
  | '3d-ocean'
  | 'obs-profile'
  | 'data-manager'
  | 'search'
  | 'hazard'
  | 'fishery'
  | 'settings'
  | 'public-view';

export type {
  ColorRange,
  ColorRangeValidationIssue,
  ColorRangeValidationResult,
} from '../ocean/color/colorTypes';

export interface OceanStateSnapshot {
  parameters: OceanParameters;
  mode: OceanMode;
  activeVariable: OceanVariable;
  activePage: ArielPage;
  underwaterRegion: UnderwaterRegionId | null;
  selectedObservation: SelectedObservation | null;
  observationModalOpen: boolean;
  flyToObservationToken: number;
  time: Date;
  selectedOceanDomain:
    | 'indian-ocean'
    | 'southern-ocean'
    | null;
  gliders?: GliderTrajectory[];
  argoProfiles?: ArgoProfile[];
  colorRanges: Record<OceanVariable, import('../ocean/color/colorTypes').ColorRange[]>;
  cameraHeading?: number;
  cameraCoords?: { lat: number; lon: number };
  resetNorthToken?: number;
}
