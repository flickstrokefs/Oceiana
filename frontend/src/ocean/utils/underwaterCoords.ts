import * as Cesium from 'cesium';

// Geographic bounds of the Indian Ocean / Arabian Sea scientific analysis domain
export const UW_BOUNDS = {
  minLon: 58.0,
  maxLon: 86.0,
  centerLon: 72.0,
  minLat: 7.0,
  maxLat: 22.0,
  centerLat: 14.5,
  minDepth: 0,
  maxDepth: 2000,
};

// Dimensions of the 3D analytical volume box in local meters
export const UW_DIMENSIONS = {
  halfWidthX: 520000,   // Total width = 1,040,000 m (~1,040 km)
  halfLengthY: 360000,  // Total length = 720,000 m (~720 km)
  totalDepthZ: 300000,  // Total vertical depth = 300,000 m (~300 km)
};

// Precomputed ENU transformation matrix anchored at the center of the domain
let enuMatrix: Cesium.Matrix4 | null = null;
let inverseEnuMatrix: Cesium.Matrix4 | null = null;

export function getEnuMatrix(): Cesium.Matrix4 {
  if (!enuMatrix) {
    const center = Cesium.Cartesian3.fromDegrees(
      UW_BOUNDS.centerLon,
      UW_BOUNDS.centerLat,
      0.0
    );
    enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(center);
  }
  return enuMatrix;
}

export function getInverseEnuMatrix(): Cesium.Matrix4 {
  if (!inverseEnuMatrix) {
    inverseEnuMatrix = Cesium.Matrix4.inverse(getEnuMatrix(), new Cesium.Matrix4());
  }
  return inverseEnuMatrix;
}

/**
 * Converts geographic coordinates (lon, lat, depth) to flat local coordinates (x, y, z).
 * Local coordinate system:
 * - X: East-West (-halfWidthX to +halfWidthX)
 * - Y: North-South (-halfLengthY to +halfLengthY)
 * - Z: Depth (0 at surface to -totalDepthZ at 2000m)
 */
export function geoToLocal(lon: number, lat: number, depth: number): Cesium.Cartesian3 {
  const normX = (lon - UW_BOUNDS.centerLon) / (UW_BOUNDS.maxLon - UW_BOUNDS.centerLon);
  const normY = (lat - UW_BOUNDS.centerLat) / (UW_BOUNDS.maxLat - UW_BOUNDS.centerLat);
  const normZ = Math.max(0, Math.min(UW_BOUNDS.maxDepth, depth)) / UW_BOUNDS.maxDepth;

  const x = normX * UW_DIMENSIONS.halfWidthX;
  const y = normY * UW_DIMENSIONS.halfLengthY;
  const z = -normZ * UW_DIMENSIONS.totalDepthZ;

  return new Cesium.Cartesian3(x, y, z);
}

/**
 * Converts geographic coordinates (lon, lat, depth) directly to flat Cesium world Cartesian3.
 */
export function geoToWorld(lon: number, lat: number, depth: number): Cesium.Cartesian3 {
  const local = geoToLocal(lon, lat, depth);
  return Cesium.Matrix4.multiplyByPoint(getEnuMatrix(), local, new Cesium.Cartesian3());
}

/**
 * Converts local Cartesian coordinates (x, y, z) directly to flat Cesium world Cartesian3.
 */
export function localToWorld(x: number, y: number, z: number): Cesium.Cartesian3 {
  const local = new Cesium.Cartesian3(x, y, z);
  return Cesium.Matrix4.multiplyByPoint(getEnuMatrix(), local, new Cesium.Cartesian3());
}

/**
 * Converts flat Cesium world Cartesian3 back to local coordinates (x, y, z).
 */
export function worldToLocal(worldPos: Cesium.Cartesian3): Cesium.Cartesian3 {
  return Cesium.Matrix4.multiplyByPoint(getInverseEnuMatrix(), worldPos, new Cesium.Cartesian3());
}

/**
 * Gets the 4 corner positions in world Cartesian3 at a given depth: [SW, SE, NE, NW].
 */
export function getVolumeCornersAtDepth(depth: number): Cesium.Cartesian3[] {
  const normZ = Math.max(0, Math.min(UW_BOUNDS.maxDepth, depth)) / UW_BOUNDS.maxDepth;
  const z = -normZ * UW_DIMENSIONS.totalDepthZ;
  const hx = UW_DIMENSIONS.halfWidthX;
  const hy = UW_DIMENSIONS.halfLengthY;

  return [
    localToWorld(-hx, -hy, z), // SW (minLon, minLat)
    localToWorld(hx, -hy, z),  // SE (maxLon, minLat)
    localToWorld(hx, hy, z),   // NE (maxLon, maxLat)
    localToWorld(-hx, hy, z),  // NW (minLon, maxLat)
  ];
}

/**
 * Gets closed 5-point perimeter loop in world Cartesian3 at a given depth: [SW, SE, NE, NW, SW].
 */
export function getVolumePerimeterAtDepth(depth: number): Cesium.Cartesian3[] {
  const corners = getVolumeCornersAtDepth(depth);
  return [...corners, corners[0]];
}
