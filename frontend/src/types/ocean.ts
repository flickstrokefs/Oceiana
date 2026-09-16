export type OceanMode = 'surface' | 'underwater';

export type OceanVariable = 'temperature' | 'salinity' | 'current' | 'chlorophyll';

export interface OceanParameters {
  temperature: number; // °C (0 - 35)
  salinity: number;    // PSU (10 - 40)
  currentSpeed: number;// m/s (0 - 5)
  depth: number;       // meters (0 - 5000)
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
  u: number; // Eastward velocity m/s
  v: number; // Northward velocity m/s
  w: number; // Vertical velocity m/s
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
}

export type UnderwaterRegionId =
  | 'bay-of-bengal'
  | 'arabian-sea'
  | 'bay-of-bengal'
  | 'andaman-sea'
  | 'laccadive-sea'
  | 'java-sea'
  | 'southern-ocean';

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
   * Approximate visualization footprint.
   * [longitude, latitude]
   *
   * Replace with authoritative GIS polygons later.
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

export const UNDERWATER_REGIONS: UnderwaterRegionDefinition[] = [
  {
    id: 'arabian-sea',
    name: 'Arabian Sea',
    label: 'Arabian Sea',
    description:
      'Western Indian Ocean marginal sea containing Argo and underwater glider observations.',
    boundsLabel: '50°–72°E · 5°–25°N',
    west: 50,
    east: 72,
    south: 5,
    north: 25,
    depthMin: 0,
    depthMax: 2000,
    footprint: [
      [50, 25],
      [72, 25],
      [72, 8],
      [65, 5],
      [55, 8],
      [50, 15],
    ],
  },

  {
    id: 'bay-of-bengal',
    name: 'Bay of Bengal',
    label: 'Bay of Bengal',
    description:
      'Northern Indian Ocean marginal sea containing Argo and underwater glider observations.',
    boundsLabel: '80°–100°E · 5°–22°N',
    west: 80,
    east: 100,
    south: 5,
    north: 22,
    depthMin: 0,
    depthMax: 2000,
    footprint: [
      [80, 22],
      [91, 22],
      [96, 17],
      [94, 10],
      [87, 6],
      [80, 10],
    ],
  },

  {
    id: 'andaman-sea',
    name: 'Andaman Sea',
    label: 'Andaman Sea',
    description:
      'Eastern Indian Ocean marginal sea east of the Bay of Bengal.',
    boundsLabel: '92°–100°E · 2°–15°N',
    west: 92,
    east: 100,
    south: 2,
    north: 15,
    depthMin: 0,
    depthMax: 2000,
    footprint: [
      [92, 15],
      [100, 15],
      [100, 6],
      [97, 2],
      [93, 5],
    ],
  },

  {
    id: 'laccadive-sea',
    name: 'Laccadive Sea',
    label: 'Laccadive Sea',
    description:
      'Sea between southern India, the Maldives and Sri Lanka.',
    boundsLabel: '72°–81°E · 0°–15°N',
    west: 72,
    east: 81,
    south: 0,
    north: 15,
    depthMin: 0,
    depthMax: 2000,
    footprint: [
      [72, 15],
      [79, 15],
      [81, 9],
      [79, 2],
      [73, 0],
      [72, 7],
    ],
  },

  {
    id: 'java-sea',
    name: 'Java Sea',
    label: 'Java Sea',
    description:
      'Shallow sea of the Indonesian archipelago.',
    boundsLabel: '104°–120°E · 8°S–2°N',
    west: 104,
    east: 120,
    south: -8,
    north: 2,
    depthMin: 0,
    depthMax: 2000,
    footprint: [
      [104, 2],
      [120, 2],
      [120, -5],
      [116, -8],
      [106, -7],
      [104, -3],
    ],
  },

  {
    id: 'southern-ocean',
    name: 'Southern Ocean',
    label: 'Southern Ocean',
    description:
      'Southern Ocean observation domain surrounding Antarctica.',
    boundsLabel: '20°E–147°E · 60°–90°S',
    west: 20,
    east: 147,
    south: -90,
    north: -60,
    depthMin: 0,
    depthMax: 2000,
    footprint: [
      [20, -60],
      [147, -60],
      [147, -90],
      [20, -90],
    ],
  },
];

export const OCEAN_DOMAINS: OceanDomainDefinition[] = [
  {
    id: 'indian-ocean',
    name: 'Indian Ocean',
    label: 'Indian Ocean',
    description:
      'Indian Ocean analytical domain containing its selected marginal seas.',
    footprint: [
      [20, 30],
      [80, 30],
      [110, 25],
      [147, 0],
      [147, -60],
      [20, -60],
    ],
    children: [
      'arabian-sea',
      'bay-of-bengal',
      'andaman-sea',
      'laccadive-sea',
      'java-sea',
    ],
  },

  {
    id: 'southern-ocean',
    name: 'Southern Ocean',
    label: 'Southern Ocean',
    description:
      'Southern Ocean analytical domain surrounding Antarctica.',
    footprint: [
      [20, -60],
      [147, -60],
      [147, -90],
      [20, -90],
    ],
    children: [
      'southern-ocean',
    ],
  },
];

export type SelectedObservation = {
  type: 'argo' | 'glider';
  data: ArgoProfile | GliderTrajectory;
};

/** Profile variable keys used by Observation Profile comparison UI */
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

/**
 * Unified observation profile payload for Webpage 2 (Observation Profile).
 * Built by observationService — mock now, real Argo/Glider/NetCDF later.
 */
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
    'indian-ocean' | 'southern-ocean' | null;
}

