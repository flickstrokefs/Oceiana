/**
 * Indian Ocean Domain Land Mask
 * Accurately masks out the Indian Subcontinent, Arabian Peninsula,
 * East Africa, Madagascar, Southeast Asia, Sri Lanka, and Indonesian archipelagos
 * so that satellite basemap terrain and coastlines remain 100% visible and unpainted.
 */

interface LandPolygon {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  points: [number, number][];
}

const rawPolygons: [number, number][][] = [
  // Indian Subcontinent & Asian mainland
  [
    [25.3, 61.5], [24.8, 66.8], [23.8, 68.2], [23.2, 69.5], [22.4, 69.0],
    [20.7, 70.9], [20.9, 72.0], [21.7, 72.3], [21.1, 72.7], [18.9, 72.8],
    [15.4, 73.8], [12.9, 74.8], [9.9, 76.2], [8.08, 77.55],
    [9.3, 79.3], [10.3, 79.9], [13.1, 80.4], [16.2, 81.4], [17.7, 83.4],
    [19.8, 85.9], [21.5, 87.1], [21.8, 88.5], [22.3, 91.8], [21.4, 92.0],
    [20.1, 92.9], [16.0, 94.5], [15.8, 95.5], [16.5, 96.3], [30.5, 96.5],
    [30.5, 61.5], [25.3, 61.5],
  ],
  // Sri Lanka
  [
    [9.8, 80.2], [8.6, 81.2], [7.0, 81.8], [5.9, 80.5], [6.9, 79.8],
    [8.5, 79.8], [9.8, 80.2],
  ],
  // Arabian Peninsula & Middle East
  [
    [28.0, 34.5], [22.0, 39.0], [17.0, 42.0], [12.6, 43.5], [12.8, 45.0],
    [14.5, 49.2], [17.0, 54.0], [19.0, 57.8], [22.5, 59.8], [23.6, 58.6],
    [26.2, 56.4], [27.2, 56.3], [25.3, 60.6], [25.3, 61.5], [30.5, 61.5],
    [30.5, 34.5], [28.0, 34.5],
  ],
  // East Africa & Horn of Africa
  [
    [28.0, 34.5], [19.6, 37.2], [15.6, 39.5], [13.0, 42.7], [11.6, 43.1],
    [10.4, 45.0], [11.3, 49.2], [11.8, 51.3], [10.4, 51.4], [8.0, 50.0],
    [2.0, 45.3], [-0.4, 42.5], [-2.3, 40.9], [-4.1, 39.7], [-5.1, 39.1],
    [-6.8, 39.3], [-10.3, 40.2], [-13.0, 40.5], [-14.5, 40.7], [-15.0, 40.7],
    [-17.8, 37.0], [-19.8, 35.0], [-23.8, 35.4], [-26.0, 32.6], [-30.0, 31.0],
    [-30.0, 34.5], [28.0, 34.5],
  ],
  // Madagascar
  [
    [-25.6, 45.2], [-25.0, 47.0], [-20.0, 48.6], [-16.0, 50.0], [-11.9, 49.3],
    [-13.3, 48.3], [-15.7, 46.3], [-20.3, 44.3], [-23.4, 43.7], [-25.6, 45.2],
  ],
  // Southeast Asia / Malay Peninsula
  [
    [15.0, 97.5], [12.0, 98.6], [8.0, 98.3], [7.9, 98.3], [5.4, 100.3],
    [2.2, 102.2], [1.3, 103.8], [2.5, 104.2], [6.1, 102.2], [10.0, 99.2],
    [13.5, 100.5], [10.0, 105.0], [30.5, 105.0], [30.5, 97.0], [15.0, 97.5],
  ],
  // Sumatra
  [
    [5.6, 95.3], [5.2, 97.1], [3.6, 98.7], [1.7, 101.4], [-2.9, 104.8],
    [-5.8, 105.7], [-3.8, 102.3], [-0.9, 100.3], [4.1, 96.1], [5.6, 95.3],
  ],
  // Java
  [
    [-5.9, 106.0], [-6.2, 107.0], [-6.8, 110.0], [-8.5, 110.0], [-7.7, 108.5],
    [-6.9, 106.5], [-5.9, 106.0],
  ],
];

const landPolygons: LandPolygon[] = rawPolygons.map((pts) => {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const [lat, lon] of pts) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
  }
  return { minLat, maxLat, minLon, maxLon, points: pts };
});

function pointInPolygon(lat: number, lon: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0];
    const xi = polygon[i][1];
    const yj = polygon[j][0];
    const xj = polygon[j][1];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Returns true if the coordinate is situated on a continental landmass or major island.
 */
export function isLand(lat: number, lon: number): boolean {
  for (let i = 0; i < landPolygons.length; i++) {
    const poly = landPolygons[i];
    if (
      lat < poly.minLat ||
      lat > poly.maxLat ||
      lon < poly.minLon ||
      lon > poly.maxLon
    ) {
      continue;
    }
    if (pointInPolygon(lat, lon, poly.points)) {
      return true;
    }
  }
  return false;
}
