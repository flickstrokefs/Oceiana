import * as Cesium from "cesium";

/**
 * Geographic coordinate utilities for ARIEL underwater rendering.
 *
 * IMPORTANT:
 * - Ocean region data is always [longitude, latitude] in degrees.
 * - Cesium also expects longitude/latitude in degrees when using fromDegrees().
 * - No Web Mercator conversion is required here.
 *
 * The old implementation contained a fixed Arabian Sea coordinate box.
 * That made the same conversion unsuitable for Bay of Bengal, Java Sea,
 * Andaman Sea, Laccadive Sea and Southern Ocean.
 *
 * The exports below are kept compatible with the existing project.
 */

/* -------------------------------------------------------------------------- */
/* Legacy-compatible defaults                                                 */
/* -------------------------------------------------------------------------- */

/**
 * These values are retained only for compatibility with existing imports.
 *
 * They are NOT used by the region mesh to position IHO polygons.
 */
export const UW_BOUNDS = {
  minLon: 58,
  maxLon: 86,
  minLat: 7,
  maxLat: 22,

  centerLon: 72,
  centerLat: 14.5,
};

/**
 * Legacy-compatible underwater dimensions.
 *
 * These values are retained because other parts of the project may import
 * them. Region positioning should NOT depend on these dimensions.
 */
export const UW_DIMENSIONS = {
  halfWidthX: 520000,
  halfLengthY: 360000,
  totalDepthZ: 300000,
};

/**
 * Vertical exaggeration used for underwater visualization.
 *
 * Keep this modest enough that the ocean volume remains visually useful
 * without making the geographic footprint appear displaced.
 */
export const DEPTH_EXAGGERATION = 8;

/* -------------------------------------------------------------------------- */
/* Depth conversion                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Convert ocean depth in meters to a Cesium height.
 *
 * Ocean depth is represented as a negative height below sea level.
 */
export function depthToHeight(depthMeters: number): number {
  return -Math.abs(depthMeters) * DEPTH_EXAGGERATION;
}

/* -------------------------------------------------------------------------- */
/* Geographic → Cesium world                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Convert longitude/latitude/depth directly into Cesium world coordinates.
 *
 * This is the authoritative geographic conversion for ARIEL.
 *
 * longitude = degrees east
 * latitude  = degrees north
 * depth     = positive meters downward
 */
export function geoToWorld(
  longitude: number,
  latitude: number,
  depthMeters = 0,
): Cesium.Cartesian3 {
  return Cesium.Cartesian3.fromDegrees(
    longitude,
    latitude,
    depthToHeight(depthMeters),
  );
}

/* -------------------------------------------------------------------------- */
/* Local coordinate helpers                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Convert a geographic point to a local East/North coordinate system
 * centered on the supplied geographic origin.
 *
 * This is useful for polygon clipping and grid calculations because those
 * operations are much cheaper in a local 2D coordinate system.
 *
 * IMPORTANT:
 * This function is only for local geometry calculations.
 * The final Cesium position should be generated from the same geographic
 * coordinate system / local frame.
 */
export function geoToLocal(
  longitude: number,
  latitude: number,
  depthMeters = 0,
  originLon = UW_BOUNDS.centerLon,
  originLat = UW_BOUNDS.centerLat,
): Cesium.Cartesian3 {
  const origin = Cesium.Cartesian3.fromDegrees(
    originLon,
    originLat,
    0,
  );

  const point = geoToWorld(longitude, latitude, depthMeters);

  const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);
  const inverse = Cesium.Matrix4.inverseTransformation(
    transform,
    new Cesium.Matrix4(),
  );

  return Cesium.Matrix4.multiplyByPoint(
    inverse,
    point,
    new Cesium.Cartesian3(),
  );
}

/**
 * Convert a local East/North/Up point back to Cesium world coordinates.
 *
 * The origin is geographic, so every region can have its own local frame.
 */
export function localToWorld(
  x: number,
  y: number,
  z: number,
  originLon = UW_BOUNDS.centerLon,
  originLat = UW_BOUNDS.centerLat,
): Cesium.Cartesian3 {
  const origin = Cesium.Cartesian3.fromDegrees(
    originLon,
    originLat,
    0,
  );

  const transform = Cesium.Transforms.eastNorthUpToFixedFrame(origin);

  return Cesium.Matrix4.multiplyByPoint(
    transform,
    new Cesium.Cartesian3(x, y, z),
    new Cesium.Cartesian3(),
  );
}

/* -------------------------------------------------------------------------- */
/* Rectangle helpers                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Legacy helper.
 *
 * NOTE:
 * This creates a rectangle and therefore should NOT be used as the actual
 * geographic footprint of an IHO region.
 *
 * It is retained so existing imports do not break.
 */
export function getVolumeCornersAtDepth(
  depthMeters: number,
): Cesium.Cartesian3[] {
  const depth = depthToHeight(depthMeters);

  const minLon = UW_BOUNDS.minLon;
  const maxLon = UW_BOUNDS.maxLon;
  const minLat = UW_BOUNDS.minLat;
  const maxLat = UW_BOUNDS.maxLat;

  return [
    Cesium.Cartesian3.fromDegrees(minLon, minLat, depth),
    Cesium.Cartesian3.fromDegrees(maxLon, minLat, depth),
    Cesium.Cartesian3.fromDegrees(maxLon, maxLat, depth),
    Cesium.Cartesian3.fromDegrees(minLon, maxLat, depth),
  ];
}

/**
 * Legacy perimeter helper.
 *
 * Like getVolumeCornersAtDepth(), this is only a compatibility helper.
 * Actual region geometry must come from ocean.ts footprints.
 */
export function getVolumePerimeterAtDepth(
  depthMeters: number,
): Cesium.Cartesian3[] {
  return getVolumeCornersAtDepth(depthMeters);
}