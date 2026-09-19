/**
 * ============================================================================
 * ARIEL — ARABIAN SEA INTERNAL SECTOR REGISTRY
 * ============================================================================
 * Canonical lightweight observation sectors for the Arabian Sea.
 *
 * Source: Marine Regions / IHO Sea Area reference / ARIEL Sector Registry
 * CRS: EPSG:4326 (WGS84)
 * Coordinate order: [longitude (X), latitude (Y)]
 * Max vertices per sector: <= 10 (lightweight contextual boundary, not high-cost mesh)
 * ============================================================================
 */

export interface ArabianSeaSubregion {
  id: string;
  name: string;
  type: string;
  description: string;
  center: {
    longitude: number;
    latitude: number;
  };
  bbox: {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
  };
  coordinates: [number, number][];
  provenance: 'REAL' | 'DERIVED' | 'SIMULATED' | 'ARIEL_DEFINED';
  crs: string;
  vertexCount: number;
  maxDepthFt: number;
}

export const ARABIAN_SEA_SUBREGIONS: ArabianSeaSubregion[] = [
  // 1. GULF OF OMAN
  {
    id: 'gulf-of-oman',
    name: 'Gulf of Oman',
    type: 'named_marine_feature',
    description: 'Northern Arabian Sea sector around the Gulf of Oman.',
    center: {
      longitude: 58.75,
      latitude: 23.9,
    },
    bbox: {
      minLon: 56.1,
      maxLon: 61.75,
      minLat: 22.15,
      maxLat: 25.7,
    },
    coordinates: [
      [56.1, 22.45],
      [58.2, 22.15],
      [61.75, 22.5],
      [61.45, 25.45],
      [59.0, 25.7],
      [57.0, 24.8],
      [56.1, 22.45],
    ],
    provenance: 'ARIEL_DEFINED',
    crs: 'EPSG:4326',
    vertexCount: 7,
    maxDepthFt: 11000,
  },

  // 2. NORTHWESTERN ARABIAN BASIN
  {
    id: 'northwestern-arabian-basin',
    name: 'Northwestern Arabian Basin',
    type: 'oceanographic_sector',
    description: 'Open-water sector between the Gulf of Oman, Pakistan coast and central Arabian Basin.',
    center: {
      longitude: 61.2,
      latitude: 23.4,
    },
    bbox: {
      minLon: 56.1,
      maxLon: 68.0,
      minLat: 21.0,
      maxLat: 25.7,
    },
    coordinates: [
      [56.1, 22.45],
      [58.2, 22.15],
      [61.75, 22.5],
      [65.2, 21.0],
      [68.0, 23.0],
      [65.2, 25.0],
      [61.45, 25.45],
      [59.0, 25.7],
      [57.0, 24.8],
      [56.1, 22.45],
    ],
    provenance: 'ARIEL_DEFINED',
    crs: 'EPSG:4326',
    vertexCount: 10,
    maxDepthFt: 14000,
  },

  // 3. CENTRAL ARABIAN BASIN
  {
    id: 'central-arabian-basin',
    name: 'Central Arabian Basin',
    type: 'oceanographic_sector',
    description: 'Central open-ocean sector of the Arabian Sea for regional observations.',
    center: {
      longitude: 62.0,
      latitude: 18.5,
    },
    bbox: {
      minLon: 56.1,
      maxLon: 68.0,
      minLat: 14.0,
      maxLat: 23.0,
    },
    coordinates: [
      [58.0, 16.0],
      [61.5, 14.0],
      [64.8, 15.0],
      [68.0, 18.0],
      [68.0, 23.0],
      [65.2, 21.0],
      [61.75, 22.5],
      [58.2, 22.15],
      [56.1, 19.0],
      [58.0, 16.0],
    ],
    provenance: 'ARIEL_DEFINED',
    crs: 'EPSG:4326',
    vertexCount: 10,
    maxDepthFt: 15000,
  },

  // 4. SOUTHWESTERN ARABIAN SEA
  {
    id: 'southwestern-arabian-sea',
    name: 'Southwestern Arabian Sea',
    type: 'oceanographic_sector',
    description: 'Southern and southwestern open-water sector within the Arabian Sea envelope.',
    center: {
      longitude: 56.5,
      latitude: 9.0,
    },
    bbox: {
      minLon: 51.2,
      maxLon: 63.0,
      minLat: 1.0,
      maxLat: 16.0,
    },
    coordinates: [
      [51.2, 1.0],
      [55.5, 3.0],
      [60.0, 6.0],
      [63.0, 10.0],
      [61.5, 14.0],
      [58.0, 16.0],
      [54.5, 13.0],
      [52.0, 8.0],
      [51.2, 1.0],
    ],
    provenance: 'ARIEL_DEFINED',
    crs: 'EPSG:4326',
    vertexCount: 9,
    maxDepthFt: 15000,
  },

  // 5. SOUTHEASTERN ARABIAN SEA
  {
    id: 'southeastern-arabian-sea',
    name: 'Southeastern Arabian Sea',
    type: 'oceanographic_sector',
    description: 'Southern/eastern Arabian Sea sector adjacent to the western Indian margin.',
    center: {
      longitude: 67.5,
      latitude: 14.0,
    },
    bbox: {
      minLon: 61.5,
      maxLon: 74.0,
      minLat: 9.0,
      maxLat: 18.0,
    },
    coordinates: [
      [63.0, 10.0],
      [67.0, 9.0],
      [71.0, 10.5],
      [74.0, 14.5],
      [72.5, 18.0],
      [68.0, 18.0],
      [64.8, 15.0],
      [61.5, 14.0],
      [63.0, 10.0],
    ],
    provenance: 'ARIEL_DEFINED',
    crs: 'EPSG:4326',
    vertexCount: 9,
    maxDepthFt: 14500,
  },

  // 6. WESTERN INDIAN MARGIN
  {
    id: 'western-indian-margin',
    name: 'Western Indian Margin',
    type: 'coastal_sector',
    description: 'Eastern Arabian Sea sector along the western Indian margin.',
    center: {
      longitude: 71.0,
      latitude: 21.2,
    },
    bbox: {
      minLon: 68.0,
      maxLon: 74.2,
      minLat: 18.0,
      maxLat: 24.5,
    },
    coordinates: [
      [68.0, 18.0],
      [72.5, 18.0],
      [74.2, 20.5],
      [74.0, 24.0],
      [71.0, 24.5],
      [68.0, 23.0],
      [68.0, 18.0],
    ],
    provenance: 'ARIEL_DEFINED',
    crs: 'EPSG:4326',
    vertexCount: 7,
    maxDepthFt: 13000,
  },

  // 7. GULF OF KUTCH SECTOR
  {
    id: 'gulf-of-kutch-sector',
    name: 'Gulf of Kutch Sector',
    type: 'named_marine_feature',
    description: 'ARIEL coastal sector around the Gulf of Kutch area.',
    center: {
      longitude: 69.8,
      latitude: 22.4,
    },
    bbox: {
      minLon: 68.2,
      maxLon: 71.4,
      minLat: 21.0,
      maxLat: 24.0,
    },
    coordinates: [
      [68.2, 21.2],
      [69.3, 21.0],
      [70.8, 22.0],
      [71.4, 23.0],
      [70.2, 24.0],
      [68.5, 23.5],
      [68.2, 21.2],
    ],
    provenance: 'ARIEL_DEFINED',
    crs: 'EPSG:4326',
    vertexCount: 7,
    maxDepthFt: 9000,
  },
];

/**
 * Find one ARIEL Arabian Sea sector by ID.
 */
export function getArabianSeaSubregion(
  id: string,
): ArabianSeaSubregion | undefined {
  return ARABIAN_SEA_SUBREGIONS.find(
    (region) => region.id === id,
  );
}

/**
 * Get all Arabian Sea sector IDs.
 */
export function getArabianSeaSubregionIds(): string[] {
  return ARABIAN_SEA_SUBREGIONS.map(
    (region) => region.id,
  );
}

/**
 * Test whether a point (lat, lon) is inside a sector polygon using ray-casting.
 */
export function pointInSubregion(
  latitude: number,
  longitude: number,
  sector: ArabianSeaSubregion,
): boolean {
  const ring = sector.coordinates;
  if (!ring || ring.length < 3) return false;

  let inside = false;
  const px = longitude;
  const py = latitude;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[j];

    const intersects =
      ay > py !== by > py &&
      px < ((bx - ax) * (py - ay)) / (by - ay) + ax;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Resolve a lat/lon coordinate to an Arabian Sea sector.
 */
export function resolveArabianSeaSubregion(
  latitude: number,
  longitude: number,
): ArabianSeaSubregion | null {
  for (const sector of ARABIAN_SEA_SUBREGIONS) {
    if (pointInSubregion(latitude, longitude, sector)) {
      return sector;
    }
  }
  return null;
}