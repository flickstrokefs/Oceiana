/**
 * ============================================================================
 * ARIEL — ARABIAN SEA INTERNAL SUBREGION MESH
 * ============================================================================
 *
 * IMPORTANT:
 * - These are INTERNAL ARIEL visualization sectors.
 * - The cyan Arabian Sea outer IHO boundary is NOT defined here.
 * - Do NOT modify the existing Arabian Sea IHO footprint for this.
 * - These polygons are deliberately kept inside the Arabian Sea footprint
 *   with an interior safety margin.
 *
 * Visual layout intentionally follows the ARIEL Arabian Sea screen design:
 *
 *                         GULF OF OMAN
 *                    ┌──────────────────┐
 *                    │                  │
 *            WESTERN │    CENTRAL       │ EASTERN
 *            ARABIAN │    ARABIAN       │ ARABIAN
 *              SEA   │      SEA         │   SEA
 *                    │                  │
 *       SOMALI       │    ARABIAN       │ LAKSHADWEEP
 *       BASIN        │     BASIN        │    SEA
 *                    │                  │
 *
 * Green = internal mock sector boundaries
 * Cyan  = existing real Arabian Sea outer boundary
 *
 * The names are geographic/oceanographic names used as labels.
 * The internal polygon boundaries themselves are ARIEL visualization
 * sectors, not claimed as official IHO boundaries.
 * ============================================================================
 */

export interface ArabianSeaSubregion {
  id: string;

  /**
   * Display name shown inside the polygon.
   */
  name: string;

  /**
   * Geographic position where the label/dot should appear.
   */
  center: {
    longitude: number;
    latitude: number;
  };

  /**
   * [longitude, latitude]
   *
   * Irregular polygon describing the internal ARIEL sector.
   *
   * IMPORTANT:
   * These polygons intentionally use shared vertices so the green
   * boundaries form one connected mesh instead of seven unrelated boxes.
   */
  coordinates: [number, number][];

  /**
   * Approximate maximum depth for the sector.
   * Used later when the selected sector is converted into a 3D volume.
   */
  maxDepthFt: number;
}

/* ============================================================================
 * ARABIAN SEA INTERNAL MESH
 * ============================================================================
 *
 * The geometry is designed to visually reproduce the screenshot:
 *
 *                  ┌──── GULF OF OMAN ────┐
 *                  │                       │
 *              ┌───┘        CENTRAL        └───┐
 *              │       ARABIAN SEA              │
 * WESTERN       │                                │ EASTERN
 * ARABIAN       │                                │ ARABIAN
 * SEA           │                                │ SEA
 *              └───────┐              ┌─────────┘
 *                      │ ARABIAN      │
 *          SOMALI      │   BASIN      │ LAKSHADWEEP
 *          BASIN       │              │    SEA
 *                      └──────────────┘
 *
 * ========================================================================== */

export const ARABIAN_SEA_SUBREGIONS: ArabianSeaSubregion[] = [

  // ==========================================================================
  // 1. GULF OF OMAN
  // ==========================================================================

  {
    id: 'gulf-of-oman',

    name: 'Gulf of Oman',

    center: {
      longitude: 61.0,
      latitude: 23.4,
    },

    coordinates: [
      [57.8, 22.4],
      [59.2, 21.9],
      [61.0, 21.7],
      [63.0, 21.9],
      [65.2, 22.2],
      [67.0, 21.7],
      [68.1, 20.6],

      // shared boundary with Eastern Arabian Sea
      [66.7, 19.2],

      // shared boundary with Central Arabian Sea
      [63.2, 19.0],

      // shared boundary with Western Arabian Sea
      [60.2, 19.0],

      [58.4, 18.2],
      [57.0, 19.7],
      [57.8, 22.4],
    ],

    maxDepthFt: 11000,
  },


  // ==========================================================================
  // 2. WESTERN ARABIAN SEA
  // ==========================================================================

  {
    id: 'western-arabian-sea',

    name: 'Western Arabian Sea',

    center: {
      longitude: 59.2,
      latitude: 17.0,
    },

    coordinates: [
      [54.8, 16.8],
      [56.0, 18.0],
      [58.4, 18.2],

      // shared with Gulf of Oman
      [60.2, 19.0],

      // shared with Central Arabian Sea
      [63.2, 19.0],
      [61.9, 16.8],

      // central/southern shared junction
      [60.6, 14.8],

      // Somali Basin boundary
      [58.2, 13.0],

      [55.5, 13.5],
      [54.2, 15.0],
      [54.8, 16.8],
    ],

    maxDepthFt: 14500,
  },


  // ==========================================================================
  // 3. CENTRAL ARABIAN SEA
  // ==========================================================================

  {
    id: 'central-arabian-sea',

    name: 'Central Arabian Sea',

    center: {
      longitude: 64.7,
      latitude: 16.4,
    },

    coordinates: [

      // upper-left
      [63.2, 19.0],

      // Gulf of Oman shared edge
      [66.7, 19.2],

      // Eastern Arabian Sea shared edge
      [68.0, 17.0],

      [68.4, 14.7],

      // Eastern/lower shared junction
      [67.4, 12.8],

      // Arabian Basin shared edge
      [64.8, 12.0],

      [61.8, 13.0],

      // Western Arabian Sea shared edge
      [60.6, 14.8],

      [61.9, 16.8],

      [63.2, 19.0],
    ],

    maxDepthFt: 15000,
  },


  // ==========================================================================
  // 4. EASTERN ARABIAN SEA
  // ==========================================================================

  {
    id: 'eastern-arabian-sea',

    name: 'Eastern Arabian Sea',

    center: {
      longitude: 70.0,
      latitude: 16.5,
    },

    coordinates: [

      // upper-left
      [66.7, 19.2],

      // northern edge
      [68.1, 20.6],
      [69.7, 21.2],
      [71.0, 20.2],
      [72.0, 18.5],

      // eastern edge
      [72.2, 16.2],
      [71.5, 14.3],

      // Lakshadweep shared edge
      [70.4, 13.0],

      // Arabian Basin / Central boundary
      [67.4, 12.8],
      [68.4, 14.7],
      [68.0, 17.0],

      [66.7, 19.2],
    ],

    maxDepthFt: 13500,
  },


  // ==========================================================================
  // 5. SOMALI BASIN
  // ==========================================================================

  {
    id: 'somali-basin',

    name: 'Somali Basin',

    center: {
      longitude: 57.0,
      latitude: 10.0,
    },

    coordinates: [

      // western side
      [54.2, 15.0],
      [55.5, 13.5],

      // Western Arabian Sea shared boundary
      [58.2, 13.0],
      [60.6, 14.8],

      // Arabian Basin boundary
      [61.8, 13.0],
      [60.8, 10.2],

      [59.0, 8.0],
      [56.5, 7.0],
      [54.8, 8.5],
      [53.8, 11.5],
      [54.2, 15.0],
    ],

    maxDepthFt: 15000,
  },


  // ==========================================================================
  // 6. ARABIAN BASIN
  // ==========================================================================

  {
    id: 'arabian-basin',

    name: 'Arabian Basin',

    center: {
      longitude: 63.5,
      latitude: 8.2,
    },

    coordinates: [

      // Somali Basin shared boundary
      [61.8, 13.0],
      [60.8, 10.2],
      [59.0, 8.0],

      // southern boundary
      [61.0, 6.2],
      [64.5, 5.0],
      [67.8, 6.2],

      // Lakshadweep Sea boundary
      [69.2, 8.0],
      [70.4, 13.0],

      // Eastern Arabian Sea boundary
      [67.4, 12.8],

      // Central Arabian Sea boundary
      [64.8, 12.0],

      [61.8, 13.0],
    ],

    maxDepthFt: 15262,
  },


  // ==========================================================================
  // 7. LAKSHADWEEP SEA
  // ==========================================================================

  {
    id: 'lakshadweep-sea',

    name: 'Lakshadweep Sea',

    center: {
      longitude: 71.0,
      latitude: 9.5,
    },

    coordinates: [

      // Arabian Basin boundary
      [67.8, 6.2],
      [69.2, 8.0],
      [70.4, 13.0],

      // Eastern Arabian Sea boundary
      [71.5, 14.3],
      [72.2, 16.2],

      // southern/eastern interior boundary
      [72.5, 12.5],
      [72.8, 10.0],
      [72.0, 8.0],
      [70.5, 6.7],

      [67.8, 6.2],
    ],

    maxDepthFt: 13553,
  },
];


/* ============================================================================
 * OPTIONAL LOOKUP HELPERS
 * ========================================================================== */

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