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
  | 'arabian-sea'
  | 'western-indian-ocean'
  | 'central-indian-ocean'
  | 'eastern-indian-ocean';

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
    description: 'High-salinity evaporative basin influenced by seasonal monsoon gyres and prominent oxygen minimum zones.',
    boundsLabel: '58°–71°E · 15°–22°N',
    west: 58.0,
    east: 71.0,
    south: 15.0,
    north: 22.0,
    depthMin: 0,
    depthMax: 2000,
  },
  {
    id: 'central-indian-ocean',
    name: 'Central Indian Ocean',
    label: 'Central Indian Ocean',
    description: 'Central equatorial basin featuring deep internal waves, equatorial jets, and dynamic thermocline stratification.',
    boundsLabel: '73°–86°E · 15°–22°N',
    west: 73.0,
    east: 86.0,
    south: 15.0,
    north: 22.0,
    depthMin: 0,
    depthMax: 2000,
  },
  {
    id: 'eastern-indian-ocean',
    name: 'Eastern Indian Ocean',
    label: 'Eastern Indian Ocean',
    description: 'Freshwater-influenced tropical region driven by monsoonal precipitation and equatorial upwelling pulses.',
    boundsLabel: '73°–86°E · 7°–14°N',
    west: 73.0,
    east: 86.0,
    south: 7.0,
    north: 14.0,
    depthMin: 0,
    depthMax: 2000,
  },
  {
    id: 'western-indian-ocean',
    name: 'Western Indian Ocean',
    label: 'Western Indian Ocean',
    description: 'Dynamic Somali current boundary zone exhibiting intense seasonal coastal upwelling and mesoscale eddies.',
    boundsLabel: '58°–71°E · 7°–14°N',
    west: 58.0,
    east: 71.0,
    south: 7.0,
    north: 14.0,
    depthMin: 0,
    depthMax: 2000,
  },
];

export interface OceanStateSnapshot {
  parameters: OceanParameters;
  mode: OceanMode;
  activeVariable: OceanVariable;
  underwaterRegion: UnderwaterRegionId | null;
  selectedObservation: {
    type: 'argo' | 'glider';
    data: ArgoProfile | GliderTrajectory;
  } | null;
  time: Date;
}
