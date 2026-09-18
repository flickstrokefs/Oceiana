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

export const UNDERWATER_REGIONS: UnderwaterRegionDefinition[] = [
  {
    id: 'arabian-sea',
    name: 'Arabian Sea',
    label: 'Arabian Sea',
    description: 'Western Indian Ocean marginal sea with open-water maritime boundaries.',
    boundsLabel: '51.27°–77.55°E · -0.70°–25.60°N',
    west: 51.27,
    east: 77.55,
    south: -0.70,
    north: 25.60,
    depthMin: 0,
    depthMax: 4500,
    footprint: [
      [51.27, 11.83], // Cape Guardafui / Ras Asir
      [54.00, 12.50], // Socotra Archipelago
      [73.00, 7.10],  // North Maldives Basin
      [73.15, -0.70], // Addu Atoll (South Maldives)
      [77.55, 8.08],  // Cape Comorin / Kanyakumari (demarcation with Bay of Bengal)
      [75.50, 12.00], // Offshore Malabar Coast
      [73.50, 16.00], // Offshore Konkan Coast
      [71.50, 20.00], // Offshore Saurashtra
      [68.20, 23.50], // Sir Creek / Gulf of Kutch
      [66.50, 24.80], // Karachi / Indus Fan
      [62.00, 25.20], // Makran Coast
      [59.85, 22.53], // Ras al Hadd / Gulf of Oman
      [56.00, 18.00], // Southern Oman
      [48.00, 14.00], // Gulf of Aden
      [43.35, 12.60], // Bab-el-Mandeb Strait
      [51.27, 11.83], // Return to Cape Guardafui
    ],
  },
  {
    id: 'bay-of-bengal',
    name: 'Bay of Bengal',
    label: 'Bay of Bengal',
    description: 'Northern Indian Ocean marginal basin bounded by Dondra Head to Sumatra and the Andaman chain.',
    boundsLabel: '80.25°–95.05°E · 5.73°–22.50°N',
    west: 80.00,
    east: 95.05,
    south: 5.73,
    north: 22.50,
    depthMin: 0,
    depthMax: 4000,
    footprint: [
      [80.59, 5.92],  // Dondra Head, Sri Lanka (southern tip)
      [95.05, 5.73],  // Poeloe Bras / Banda Aceh, northern Sumatra (open ocean baseline)
      [93.85, 6.90],  // Great Nicobar
      [92.80, 9.20],  // Car Nicobar
      [92.55, 10.65], // Little Andaman
      [92.70, 11.70], // South Andaman
      [93.00, 13.60], // North Andaman
      [94.20, 16.03], // Cape Negrais, Myanmar
      [93.50, 19.50], // Rakhine Coast
      [90.50, 21.80], // Chittagong
      [89.00, 21.60], // Sundarbans / Ganges Delta mouth
      [86.50, 19.50], // Offshore Odisha
      [83.50, 16.50], // Offshore Andhra
      [81.20, 13.20], // Offshore Chennai
      [80.25, 9.82],  // Point Pedro / Palk Strait
      [81.70, 7.70],  // East Coast Sri Lanka
      [80.59, 5.92],  // Return to Dondra Head
    ],
  },
  {
    id: 'andaman-sea',
    name: 'Andaman Sea',
    label: 'Andaman Sea',
    description: 'Eastern Indian Ocean marginal sea enclosed by the Andaman-Nicobar ridge and Malay Peninsula.',
    boundsLabel: '92.50°–98.50°E · 5.73°–16.03°N',
    west: 92.50,
    east: 98.50,
    south: 5.73,
    north: 16.03,
    depthMin: 0,
    depthMax: 3000,
    footprint: [
      [94.20, 16.03], // Cape Negrais
      [93.00, 13.60], // North Andaman
      [92.70, 11.70], // South Andaman
      [92.55, 10.65], // Little Andaman
      [92.80, 9.20],  // Car Nicobar
      [93.85, 6.90],  // Great Nicobar
      [95.05, 5.73],  // Banda Aceh, Sumatra
      [97.50, 5.50],  // Northern Sumatra coast
      [98.30, 7.90],  // Phuket, Thailand
      [98.20, 10.00], // Mergui Archipelago
      [97.50, 13.50], // Gulf of Martaban
      [96.00, 15.50], // Irrawaddy Delta
      [94.20, 16.03], // Cape Negrais
    ],
  },
  {
    id: 'laccadive-sea',
    name: 'Laccadive Sea',
    label: 'Laccadive Sea',
    description: 'Marginal sea between southern India, the Maldives and Sri Lanka.',
    boundsLabel: '71.50°–80.59°E · -0.70°–13.00°N',
    west: 71.50,
    east: 80.59,
    south: -0.70,
    north: 13.00,
    depthMin: 0,
    depthMax: 3000,
    footprint: [
      [77.55, 8.08],  // Cape Comorin
      [80.59, 5.92],  // Dondra Head, Sri Lanka
      [73.15, -0.70], // Addu Atoll, Maldives
      [71.80, 4.00],  // Central Maldives
      [71.50, 8.50],  // Minicoy Island
      [71.50, 12.00], // Lakshadweep
      [74.50, 12.50], // Off Mangalore
      [77.55, 8.08],  // Cape Comorin
    ],
  },
  {
    id: 'java-sea',
    name: 'Java Sea',
    label: 'Java Sea',
    description: 'Shallow tropical sea of the Indonesian archipelago.',
    boundsLabel: '105.50°–116.50°E · -7.00°– -3.00°S',
    west: 105.50,
    east: 116.50,
    south: -7.00,
    north: -3.00,
    depthMin: 0,
    depthMax: 1000,
    footprint: [
      [105.80, -5.90], // Sunda Strait
      [107.00, -3.20], // Bangka Island
      [110.00, -3.00], // South Borneo
      [114.50, -3.50], // Banjarmasin
      [116.50, -5.00], // Makassar Strait entrance
      [115.50, -7.00], // Madura Strait
      [112.50, -6.80], // North Java coast
      [108.50, -6.30], // Cirebon
      [106.00, -6.00], // Jakarta Bay
      [105.80, -5.90], // Sunda Strait
    ],
  },
  {
    id: 'southern-ocean',
    name: 'Southern Ocean',
    label: 'Southern Ocean',
    description: "Circumpolar Antarctic waters extending south from 60°00'S to the Antarctic continental ice margin.",
    boundsLabel: '20.00°–147.00°E · 75.00°–60.00°S',
    west: 20.00,
    east: 147.00,
    south: -75.00,
    north: -60.00,
    depthMin: 0,
    depthMax: 5000,
    footprint: [
      [20.0, -60.0],   // 60°S Demarcation Parallel
      [40.0, -60.0],
      [60.0, -60.0],
      [80.0, -60.0],
      [100.0, -60.0],
      [120.0, -60.0],
      [140.0, -60.0],
      [147.0, -60.0],  // Tasmania meridian intersection
      [147.0, -68.0],  // Wilkes Land coast
      [135.0, -66.5],
      [120.0, -66.0],
      [100.0, -65.5],
      [80.0, -67.0],   // Prydz Bay
      [70.0, -69.0],   // Amery Ice Shelf
      [50.0, -67.5],   // Enderby Land
      [35.0, -70.0],   // Queen Maud Land
      [20.0, -70.0],
      [20.0, -60.0],   // Return
    ],
  },
];

export const OCEAN_DOMAINS: OceanDomainDefinition[] = [
  {
    id: 'indian-ocean',
    name: 'Indian Ocean',
    label: 'Indian Ocean',
    description: 'Indian Ocean macro analytical domain bounded by 20°E, 147°E, 60°S and Asia.',
    footprint: [
      [20.0, -34.8],  // Cape Agulhas, South Africa
      [20.0, -60.0],  // 20°E meridian to 60°S Demarcation line
      [40.0, -60.0],  // 60°S Parallel (Demarcation with Southern Ocean)
      [60.0, -60.0],
      [80.0, -60.0],
      [100.0, -60.0],
      [120.0, -60.0],
      [140.0, -60.0],
      [147.0, -60.0], // 60°S Demarcation to Tasmania meridian
      [147.0, -43.6], // South East Cape, Tasmania
      [145.0, -38.5], // Bass Strait
      [135.0, -34.0], // Great Australian Bight
      [115.0, -34.0], // Cape Leeuwin
      [113.0, -26.0], // Shark Bay
      [114.0, -21.8], // North West Cape
      [123.0, -10.5], // Timor Sea
      [106.0, -6.0],  // Sunda Strait
      [95.05, 5.73],  // Northern Sumatra
      [94.20, 16.03], // Cape Negrais
      [89.0, 21.6],   // Bay of Bengal north
      [80.59, 5.92],  // Sri Lanka
      [77.55, 8.08],  // Cape Comorin
      [68.2, 23.5],   // Kutch
      [59.85, 22.53], // Oman
      [51.27, 11.83], // Cape Guardafui / Somalia
      [40.5, -4.0],   // East Africa
      [40.0, -10.0],  // Mozambique Channel north
      [35.0, -24.0],  // Maputo
      [31.0, -30.0],  // Durban
      [20.0, -34.8],  // Cape Agulhas
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
    description: "Southern Ocean circumpolar domain south of 60°00'S.",
    footprint: [
      [-180.0, -60.0],
      [-120.0, -60.0],
      [-60.0, -60.0],
      [0.0, -60.0],
      [60.0, -60.0],
      [120.0, -60.0],
      [180.0, -60.0],
      [180.0, -78.0],
      [120.0, -75.0],
      [60.0, -70.0],
      [0.0, -72.0],
      [-60.0, -75.0],
      [-120.0, -78.0],
      [-180.0, -78.0],
      [-180.0, -60.0],
    ],
    children: ['southern-ocean'],
  },
];

export const INDIAN_OCEAN_REGION: UnderwaterRegionDefinition = {
  id: 'indian-ocean',
  name: 'Indian Ocean',
  label: 'Indian Ocean Basin',
  description: 'Indian Ocean analytical domain from 20°E to 147°E and 60°S to Asia.',
  boundsLabel: '20.00°–147.00°E · 60.00°S–25.60°N',
  west: 20.0,
  east: 147.0,
  south: -60.0,
  north: 25.60,
  depthMin: 0,
  depthMax: 5000,
  footprint: OCEAN_DOMAINS[0].footprint,
};

UNDERWATER_REGIONS.push(INDIAN_OCEAN_REGION);

export type SelectedObservation = {
  type: 'argo' | 'glider';
  data: ArgoProfile | GliderTrajectory;
};

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
}
