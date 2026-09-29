import { IHO_FOOTPRINTS } from './ihoFootprints';
import type {
  UnderwaterRegionId,
  OceanDomainId,
  UnderwaterRegionDefinition,
  OceanDomainDefinition,
} from '../../types/ocean';

export interface RegionGridConfig {
  x: number;
  y: number;
  depthLayers: number;
  maxDepthFt: number;
  maxDepthM: number;
  approxCellSpacingKm?: string;
  approxVerticalSpacingFt?: string;
  approxVertices?: number;
}

export interface OceanRegionConfig {
  id: UnderwaterRegionId;
  name: string;
  label: string;
  ihoName: string;
  type: 'ocean' | 'sea';
  parent?: OceanDomainId;
  children?: UnderwaterRegionId[];
  bounds: {
    west: number;
    east: number;
    south: number;
    north: number;
  };
  grid: RegionGridConfig;
  footprint: [number, number][];
  description: string;
  boundsLabel: string;
}

export const OCEAN_REGIONS: Record<UnderwaterRegionId, OceanRegionConfig> = {
  'indian-ocean': {
    id: 'indian-ocean',
    name: 'Indian Ocean',
    label: 'Indian Ocean',
    ihoName: 'Indian Ocean',
    type: 'ocean',
    children: [
      'arabian-sea',
      'bay-of-bengal',
      'laccadive-sea',
      'andaman-sea',
      'java-sea',
    ],
    bounds: {
      west: 20.0026,
      east: 146.8982,
      south: -60.0,
      north: 10.445,
    },
    grid: {
      x: 50,
      y: 50,
      depthLayers: 25,
      maxDepthFt: 23580,
      maxDepthM: 7187,
      approxVertices: 65000,
    },
    footprint: IHO_FOOTPRINTS['indian-ocean'] || [],
    description:
      'Indian Ocean parent domain encompassing Arabian Sea, Bay of Bengal, Laccadive Sea, Andaman Sea, and Java Sea.',
    boundsLabel: '20.00°–146.90°E · -60.00°–10.45°N',
  },

  'arabian-sea': {
    id: 'arabian-sea',
    name: 'Arabian Sea',
    label: 'Arabian Sea',
    ihoName: 'Arabian Sea',
    type: 'sea',
    parent: 'indian-ocean',
    bounds: {
      west: 51.0223,
      east: 74.335,
      south: -0.7034,
      north: 25.5974,
    },
    grid: {
      x: 40,
      y: 40,
      depthLayers: 20,
      maxDepthFt: 15262,
      maxDepthM: 4652,
      approxCellSpacingKm: '70 km × 70 km',
      approxVerticalSpacingFt: '763 ft',
      approxVertices: 33600,
    },
    footprint: IHO_FOOTPRINTS['arabian-sea'] || [],
    description:
      'Northwestern marginal sea of the Indian Ocean bounded by the Arabian Peninsula, Pakistan, Western India, and the Laccadive Sea.',
    boundsLabel: '51.02°–74.34°E · -0.70°–25.60°N',
  },

  'bay-of-bengal': {
    id: 'bay-of-bengal',
    name: 'Bay of Bengal',
    label: 'Bay of Bengal',
    ihoName: 'Bay of Bengal',
    type: 'sea',
    parent: 'indian-ocean',
    bounds: {
      west: 78.8982,
      east: 95.0488,
      south: 5.734,
      north: 24.3777,
    },
    grid: {
      x: 40,
      y: 40,
      depthLayers: 20,
      maxDepthFt: 15400,
      maxDepthM: 4694,
      approxCellSpacingKm: '52.5 km × 52.5 km',
      approxVerticalSpacingFt: '770 ft',
      approxVertices: 33600,
    },
    footprint: IHO_FOOTPRINTS['bay-of-bengal'] || [],
    description:
      'Northeastern basin of the Indian Ocean bounded by India, Bangladesh, Myanmar, and northern Sumatra.',
    boundsLabel: '78.90°–95.05°E · 5.73°–24.38°N',
  },

  'laccadive-sea': {
    id: 'laccadive-sea',
    name: 'Laccadive Sea',
    label: 'Laccadive Sea',
    ihoName: 'Laccadive Sea',
    type: 'sea',
    parent: 'indian-ocean',
    bounds: {
      west: 71.9824,
      east: 80.5888,
      south: -0.6932,
      north: 14.7927,
    },
    grid: {
      x: 30,
      y: 30,
      depthLayers: 18,
      maxDepthFt: 13553,
      maxDepthM: 4131,
      approxCellSpacingKm: '33 km × 33 km',
      approxVerticalSpacingFt: '753 ft',
      approxVertices: 17100,
    },
    footprint: IHO_FOOTPRINTS['laccadive-sea'] || [],
    description:
      'Marginal sea bordering southwest India, Sri Lanka, and the Lakshadweep/Maldives archipelago.',
    boundsLabel: '71.98°–80.59°E · -0.69°–14.79°N',
  },

  'andaman-sea': {
    id: 'andaman-sea',
    name: 'Andaman Sea',
    label: 'Andaman Sea',
    ihoName: 'Andaman or Burma Sea',
    type: 'sea',
    parent: 'indian-ocean',
    bounds: {
      west: 92.3904,
      east: 99.1397,
      south: 5.5343,
      north: 17.7539,
    },
    grid: {
      x: 30,
      y: 30,
      depthLayers: 18,
      maxDepthFt: 12392,
      maxDepthM: 3777,
      approxCellSpacingKm: '40 km × 40 km',
      approxVerticalSpacingFt: '689 ft',
      approxVertices: 17100,
    },
    footprint: IHO_FOOTPRINTS['andaman-sea'] || [],
    description:
      'Distinct marginal sea enclosed by the Andaman & Nicobar island chain, Myanmar, Thailand, and northern Sumatra.',
    boundsLabel: '92.39°–99.14°E · 5.53°–17.75°N',
  },

  'java-sea': {
    id: 'java-sea',
    name: 'Java Sea',
    label: 'Java Sea',
    ihoName: 'Java Sea',
    type: 'sea',
    parent: 'indian-ocean',
    bounds: {
      west: 104.5271,
      east: 119.4894,
      south: -7.8109,
      north: -1.5494,
    },
    grid: {
      x: 25,
      y: 25,
      depthLayers: 8,
      maxDepthFt: 151,
      maxDepthM: 46,
      approxCellSpacingKm: '48 km × 48 km',
      approxVerticalSpacingFt: '19 ft',
      approxVertices: 5625,
    },
    footprint: IHO_FOOTPRINTS['java-sea'] || [],
    description:
      'Shallow tropical marginal sea within the Indonesian archipelago between Java, Borneo, and Sumatra.',
    boundsLabel: '104.53°–119.49°E · -7.81°– -1.55°S',
  },

  'southern-ocean': {
    id: 'southern-ocean',
    name: 'Southern Ocean',
    label: 'Southern Ocean',
    ihoName: 'Southern Ocean',
    type: 'ocean',
    bounds: {
      west: -180.0,
      east: 180.0,
      south: -85.5625,
      north: -60.0,
    },
    grid: {
      x: 45,
      y: 45,
      depthLayers: 25,
      maxDepthFt: 24383,
      maxDepthM: 7432,
      approxVertices: 53000,
    },
    footprint: IHO_FOOTPRINTS['southern-ocean'] || [],
    description:
      'Circumpolar Antarctic waters bounded to the north by the 60°S parallel and to the south by the Antarctic ice coast.',
    boundsLabel: '180.00°W–180.00°E · -85.56°– -60.00°S',
  },
};

export function getOceanRegionConfig(id: UnderwaterRegionId): OceanRegionConfig {
  return OCEAN_REGIONS[id] || OCEAN_REGIONS['arabian-sea'];
}

export function toUnderwaterRegionDefinition(
  config: OceanRegionConfig
): UnderwaterRegionDefinition {
  return {
    id: config.id,
    name: config.name,
    label: config.label,
    description: config.description,
    boundsLabel: config.boundsLabel,
    west: config.bounds.west,
    east: config.bounds.east,
    south: config.bounds.south,
    north: config.bounds.north,
    depthMin: 0,
    depthMax: config.grid.maxDepthM,
    footprint: config.footprint,
  };
}

export const COMPUTED_UNDERWATER_REGIONS: UnderwaterRegionDefinition[] = [
  toUnderwaterRegionDefinition(OCEAN_REGIONS['arabian-sea']),
  toUnderwaterRegionDefinition(OCEAN_REGIONS['bay-of-bengal']),
  toUnderwaterRegionDefinition(OCEAN_REGIONS['laccadive-sea']),
  toUnderwaterRegionDefinition(OCEAN_REGIONS['andaman-sea']),
  toUnderwaterRegionDefinition(OCEAN_REGIONS['java-sea']),
  toUnderwaterRegionDefinition(OCEAN_REGIONS['indian-ocean']),
  toUnderwaterRegionDefinition(OCEAN_REGIONS['southern-ocean']),
];

export const COMPUTED_OCEAN_DOMAINS: OceanDomainDefinition[] = [
  {
    id: 'indian-ocean',
    name: 'Indian Ocean',
    label: 'Indian Ocean',
    description: OCEAN_REGIONS['indian-ocean'].description,
    footprint: OCEAN_REGIONS['indian-ocean'].footprint,
    children: [
      'arabian-sea',
      'bay-of-bengal',
      'laccadive-sea',
      'andaman-sea',
      'java-sea',
    ],
  },
  {
    id: 'southern-ocean',
    name: 'Southern Ocean',
    label: 'Southern Ocean',
    description: OCEAN_REGIONS['southern-ocean'].description,
    footprint: OCEAN_REGIONS['southern-ocean'].footprint,
    children: ['southern-ocean'],
  },
];
