export type OceanMode = 'surface' | 'underwater';

export type OceanVariable = 'temperature' | 'salinity' | 'current' | 'chlorophyll';

export interface OceanParameters {
  temperature: number; // °C (0 - 35)
  salinity: number;    // PSU (10 - 40)
  currentSpeed: number;// m/s (0 - 5)
  depth: number;       // meters (0 - 5000)
  chlorophyll: number; // mg/m³ (0 - 10)
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

export interface OceanStateSnapshot {
  parameters: OceanParameters;
  mode: OceanMode;
  activeVariable: OceanVariable;
  selectedObservation: {
    type: 'argo' | 'glider';
    data: ArgoProfile | GliderTrajectory;
  } | null;
  time: Date;
}
