import * as Cesium from 'cesium';

import {
  UW_DIMENSIONS,
} from '../utils/underwaterCoords';

import type {
  OceanVariable,
  UnderwaterRegionData,
  UnderwaterRegionDefinition,
} from '../../types/ocean';

interface SamplePoint {
  longitude: number;
  latitude: number;
  depth: number;
  temperature: number;
  salinity: number;
  value: number;
}

interface XYPoint {
  x: number;
  y: number;
}

interface CellRecord {
  id: string;
  depth: number;
  baseColor: Cesium.Color;
}

interface FootprintPoint {
  longitude: number;
  latitude: number;
}

export class UnderwaterFieldMesh {
  private readonly viewer: Cesium.Viewer;
  private readonly definition: UnderwaterRegionDefinition;

  private fieldPrimitive: Cesium.Primitive | null = null;
  private wireframePrimitive: Cesium.Primitive | null = null;

  private cells: CellRecord[] = [];
  private dataPoints: SamplePoint[] = [];

  private currentVariable: OceanVariable =
    'temperature';

  private currentDepth = 0;

  private isVisible = false;
  private isActive = false;
  private destroyed = false;

  private resolution: 7 | 9 | 12 = 9;

  /*
   * ------------------------------------------------------------
   * REGION-SPECIFIC COORDINATE SYSTEM
   * ------------------------------------------------------------
   *
   * The old implementation used UW_BOUNDS.centerLon /
   * centerLat, which was effectively an Arabian-Sea coordinate
   * system.
   *
   * Every region now gets its own local origin based on its
   * actual IHO footprint.
   */
  private regionCenterLon = 0;
  private regionCenterLat = 0;

  /*
   * IHO polygons can contain thousands of vertices.
   *
   * This is ONLY used for the expensive grid clipping.
   * The original definition.footprint is never modified.
   */
  private readonly maxClipVertices = 500;

  constructor(
    viewer: Cesium.Viewer,
    definition: UnderwaterRegionDefinition,
  ) {
    this.viewer = viewer;
    this.definition = definition;

    this.calculateRegionOrigin();
  }

  // ============================================================
  // DATA
  // ============================================================

  public setData(
    data: UnderwaterRegionData,
  ): void {
    if (
      this.destroyed ||
      this.viewer.isDestroyed()
    ) {
      return;
    }

    this.currentVariable =
      data.variable;

    this.currentDepth =
      Math.max(
        0,
        Math.min(
          this.definition.depthMax,
          data.depth,
        ),
      );

    this.dataPoints =
      data.points.map(
        (point) => ({
          longitude:
            point.longitude,

          latitude:
            point.latitude,

          depth:
            point.depth,

          temperature:
            point.temperature,

          salinity:
            point.salinity,

          value:
            point.value,
        }),
      );

    this.rebuild();
  }

  // ============================================================
  // DEPTH
  // ============================================================

  public setDepth(
    depth: number,
  ): void {
    if (this.destroyed) {
      return;
    }

    this.currentDepth =
      Math.max(
        0,
        Math.min(
          this.definition.depthMax,
          depth,
        ),
      );

    this.updateDepthEmphasis();
  }

  // ============================================================
  // ACTIVE
  // ============================================================

  public setActive(
    active: boolean,
  ): void {
    if (this.destroyed) {
      return;
    }

    this.isActive = active;

    this.updateDepthEmphasis();
  }

  // ============================================================
  // VISIBILITY
  // ============================================================

  public setVisible(
    visible: boolean,
  ): void {
    if (this.destroyed) {
      return;
    }

    this.isVisible =
      visible;

    if (
      this.fieldPrimitive
    ) {
      this.fieldPrimitive.show =
        visible;
    }

    if (
      this.wireframePrimitive
    ) {
      this.wireframePrimitive.show =
        visible;
    }
  }

  // ============================================================
  // REGION ORIGIN
  // ============================================================

  private calculateRegionOrigin(): void {
    const footprint =
      this.getFootprint();

    if (
      footprint.length >= 3
    ) {
      let longitude = 0;
      let latitude = 0;

      for (
        const point of footprint
      ) {
        longitude +=
          point.longitude;

        latitude +=
          point.latitude;
      }

      this.regionCenterLon =
        longitude /
        footprint.length;

      this.regionCenterLat =
        latitude /
        footprint.length;

      return;
    }

    /*
     * Fallback only when a footprint is unavailable.
     */
    this.regionCenterLon =
      (
        this.definition.west +
        this.definition.east
      ) / 2;

    this.regionCenterLat =
      (
        this.definition.south +
        this.definition.north
      ) / 2;
  }

  // ============================================================
  // FOOTPRINT
  // ============================================================

  private getFootprint():
    FootprintPoint[] {
    const raw =
      (
        this.definition as unknown as {
          footprint?: unknown;
        }
      ).footprint;

    if (
      !Array.isArray(raw)
    ) {
      return [];
    }

    const points:
      FootprintPoint[] = [];

    for (
      const item of raw
    ) {
      /*
       * [longitude, latitude]
       */
      if (
        Array.isArray(item) &&
        item.length >= 2
      ) {
        const longitude =
          Number(item[0]);

        const latitude =
          Number(item[1]);

        if (
          Number.isFinite(
            longitude,
          ) &&
          Number.isFinite(
            latitude,
          )
        ) {
          points.push({
            longitude,
            latitude,
          });
        }

        continue;
      }

      /*
       * { longitude, latitude }
       */
      if (
        item &&
        typeof item ===
          'object'
      ) {
        const value =
          item as {
            longitude?: unknown;
            latitude?: unknown;
            lon?: unknown;
            lat?: unknown;
          };

        const longitude =
          Number(
            value.longitude ??
              value.lon,
          );

        const latitude =
          Number(
            value.latitude ??
              value.lat,
          );

        if (
          Number.isFinite(
            longitude,
          ) &&
          Number.isFinite(
            latitude,
          )
        ) {
          points.push({
            longitude,
            latitude,
          });
        }
      }
    }

    return points;
  }

  /**
   * Return a reduced copy for clipping only.
   *
   * The actual IHO polygon in ocean.ts remains untouched.
   */
  private getClippingFootprint():
    FootprintPoint[] {
    const raw =
      this.getFootprint();

    if (
      raw.length <=
      this.maxClipVertices
    ) {
      return raw;
    }

    /*
     * Preserve the shape reasonably while avoiding
     * thousands of polygon-edge tests for every grid cell.
     */
    const result:
      FootprintPoint[] = [];

    const step =
      raw.length /
      this.maxClipVertices;

    for (
      let i = 0;
      i < this.maxClipVertices;
      i++
    ) {
      result.push(
        raw[
          Math.floor(
            i * step,
          )
        ],
      );
    }

    return result;
  }

  // ============================================================
  // GEOGRAPHIC → LOCAL
  // ============================================================

  /**
   * Converts lon/lat into local ENU-like meters around the
   * selected region.
   *
   * This replaces the old UW_BOUNDS-based conversion.
   */
  private geographicToLocal(
    longitude: number,
    latitude: number,
  ): XYPoint {
    const earthRadius =
      6378137;

    const centerLatRad =
      Cesium.Math.toRadians(
        this.regionCenterLat,
      );

    const longitudeDelta =
      Cesium.Math.toRadians(
        longitude -
          this.regionCenterLon,
      );

    const latitudeDelta =
      Cesium.Math.toRadians(
        latitude -
          this.regionCenterLat,
      );

    return {
      x:
        earthRadius *
        longitudeDelta *
        Math.cos(
          centerLatRad,
        ),

      y:
        earthRadius *
        latitudeDelta,
    };
  }

  // ============================================================
  // LOCAL → GEOGRAPHIC
  // ============================================================

  private localToGeographic(
    x: number,
    y: number,
  ): FootprintPoint {
    const earthRadius =
      6378137;

    const centerLatRad =
      Cesium.Math.toRadians(
        this.regionCenterLat,
      );

    const longitude =
      this.regionCenterLon +
      Cesium.Math.toDegrees(
        x /
          (
            earthRadius *
            Math.cos(
              centerLatRad,
            )
          ),
      );

    const latitude =
      this.regionCenterLat +
      Cesium.Math.toDegrees(
        y /
          earthRadius,
      );

    return {
      longitude,
      latitude,
    };
  }

  // ============================================================
  // LOCAL → CESIUM WORLD
  // ============================================================

  /**
   * Converts our region-local x/y/z coordinates into
   * Cesium world coordinates.
   *
   * x = East
   * y = North
   * z = Up
   */
  private localToWorld(
    x: number,
    y: number,
    z: number,
  ): Cesium.Cartesian3 {
    const origin =
      Cesium.Cartesian3.fromDegrees(
        this.regionCenterLon,
        this.regionCenterLat,
        0,
      );

    const transform =
      Cesium.Transforms.eastNorthUpToFixedFrame(
        origin,
      );

    return Cesium.Matrix4.multiplyByPoint(
      transform,
      new Cesium.Cartesian3(
        x,
        y,
        z,
      ),
      new Cesium.Cartesian3(),
    );
  }

  // ============================================================
  // FOOTPRINT → LOCAL
  // ============================================================

  private footprintToLocal():
    XYPoint[] {
    return this
      .getClippingFootprint()
      .map(
        (point) =>
          this.geographicToLocal(
            point.longitude,
            point.latitude,
          ),
      );
  }

  // ============================================================
  // REBUILD
  // ============================================================

  private rebuild(): void {
    this.clearMesh();

    if (
      this.destroyed ||
      this.dataPoints.length === 0
    ) {
      return;
    }

    /*
     * Recalculate origin in case the definition was
     * updated dynamically.
     */
    this.calculateRegionOrigin();

    const footprint =
      this.footprintToLocal();

    if (
      footprint.length < 3
    ) {
      return;
    }

    const n =
      this.resolution;

    let minX =
      Number.POSITIVE_INFINITY;

    let maxX =
      Number.NEGATIVE_INFINITY;

    let minY =
      Number.POSITIVE_INFINITY;

    let maxY =
      Number.NEGATIVE_INFINITY;

    for (
      const point of footprint
    ) {
      minX =
        Math.min(
          minX,
          point.x,
        );

      maxX =
        Math.max(
          maxX,
          point.x,
        );

      minY =
        Math.min(
          minY,
          point.y,
        );

      maxY =
        Math.max(
          maxY,
          point.y,
        );
    }

    if (
      !Number.isFinite(minX) ||
      !Number.isFinite(maxX) ||
      !Number.isFinite(minY) ||
      !Number.isFinite(maxY)
    ) {
      return;
    }

    const cellX =
      (maxX - minX) /
      n;

    const cellY =
      (maxY - minY) /
      n;

    const cellZ =
      UW_DIMENSIONS.totalDepthZ /
      n;

    const instances:
      Cesium.GeometryInstance[] =
      [];

    const wirePositions:
      number[] = [];

    const wireIndices:
      number[] = [];

    let wireOffset = 0;

    // ==========================================================
    // 3D GRID
    // ==========================================================

    for (
      let iz = 0;
      iz < n;
      iz++
    ) {
      const topZ =
        -iz * cellZ;

      const bottomZ =
        -(iz + 1) * cellZ;

      const depth =
        (
          iz + 0.5
        ) *
        (
          this.definition
            .depthMax /
          n
        );

      for (
        let iy = 0;
        iy < n;
        iy++
      ) {
        const cellMinY =
          minY +
          iy * cellY;

        const cellMaxY =
          cellMinY +
          cellY;

        for (
          let ix = 0;
          ix < n;
          ix++
        ) {
          const cellMinX =
            minX +
            ix * cellX;

          const cellMaxX =
            cellMinX +
            cellX;

          /*
           * Clip the rectangular grid cell against
           * the actual irregular IHO footprint.
           */
          const clipped =
            this.clipPolygonToRectangle(
              footprint,
              cellMinX,
              cellMaxX,
              cellMinY,
              cellMaxY,
            );

          if (
            clipped.length < 3
          ) {
            continue;
          }

          if (
            Math.abs(
              this.polygonArea(
                clipped,
              ),
            ) <
            0.000001
          ) {
            continue;
          }

          const center =
            this.getPolygonCenter(
              clipped,
            );

          const geo =
            this.localToGeographic(
              center.x,
              center.y,
            );

          const sample =
            this.interpolate(
              geo.longitude,
              geo.latitude,
              depth,
            );

          const color =
            this.getColor(
              sample.temperature,
              sample.salinity,
              sample.value,
              this.currentVariable,
              0.42,
            );

          const geometry =
            this.createPrismGeometry(
              clipped,
              topZ,
              bottomZ,
            );

          if (!geometry) {
            continue;
          }

          const id =
            `uw-cell-${iz}-${iy}-${ix}`;

          instances.push(
            new Cesium.GeometryInstance({
              geometry,

              id,

              attributes: {
                color:
                  Cesium.ColorGeometryInstanceAttribute.fromColor(
                    color,
                  ),
              },
            }),
          );

          this.cells.push({
            id,
            depth,
            baseColor:
              color,
          });

          this.appendWireframe(
            clipped,
            topZ,
            bottomZ,
            wirePositions,
            wireIndices,
            wireOffset,
          );

          wireOffset +=
            clipped.length * 2;
        }
      }
    }

    if (
      instances.length === 0
    ) {
      return;
    }

    // ==========================================================
    // FIELD PRIMITIVE
    // ==========================================================

    this.fieldPrimitive =
      new Cesium.Primitive({
        geometryInstances:
          instances,

        appearance:
          new Cesium.PerInstanceColorAppearance({
            flat: true,
            translucent: true,
            closed: true,
            faceForward: true,
          }),

        asynchronous: false,

        releaseGeometryInstances:
          false,
      });

    this.fieldPrimitive.show =
      this.isVisible;

    this.viewer.scene.primitives.add(
      this.fieldPrimitive,
    );

    // ==========================================================
    // WIREFRAME
    // ==========================================================

    if (
      wirePositions.length > 0 &&
      wireIndices.length > 0
    ) {
      const geometry =
        new Cesium.Geometry({
          attributes:
            ({
              position:
                new Cesium.GeometryAttribute({
                  componentDatatype:
                    Cesium.ComponentDatatype.DOUBLE,

                  componentsPerAttribute:
                    3,

                  values:
                    new Float64Array(
                      wirePositions,
                    ),
                }),
            } as unknown as Cesium.GeometryAttributes),

          indices:
            new Uint32Array(
              wireIndices,
            ),

          primitiveType:
            Cesium.PrimitiveType.LINES,

          boundingSphere:
            Cesium.BoundingSphere.fromVertices(
              wirePositions,
            ),
        });

      this.wireframePrimitive =
        new Cesium.Primitive({
          geometryInstances:
            new Cesium.GeometryInstance({
              geometry,

              attributes: {
                color:
                  Cesium.ColorGeometryInstanceAttribute.fromColor(
                    new Cesium.Color(
                      0.0,
                      0.85,
                      0.95,
                      0.16,
                    ),
                  ),
              },
            }),

          appearance:
            new Cesium.PerInstanceColorAppearance({
              flat: true,
              translucent: true,
            }),

          asynchronous: false,
        });

      this.wireframePrimitive.show =
        this.isVisible;

      this.viewer.scene.primitives.add(
        this.wireframePrimitive,
      );
    }

    this.updateDepthEmphasis();
  }

  // ============================================================
  // RECTANGLE CLIPPING
  // ============================================================

  private clipPolygonToRectangle(
    polygon: XYPoint[],
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ): XYPoint[] {
    let result =
      polygon.map(
        (point) => ({
          x: point.x,
          y: point.y,
        }),
      );

    result =
      this.clipAgainstBoundary(
        result,
        (point) =>
          point.x >= minX,
        (a, b) =>
          this.verticalIntersection(
            a,
            b,
            minX,
          ),
      );

    result =
      this.clipAgainstBoundary(
        result,
        (point) =>
          point.x <= maxX,
        (a, b) =>
          this.verticalIntersection(
            a,
            b,
            maxX,
          ),
      );

    result =
      this.clipAgainstBoundary(
        result,
        (point) =>
          point.y >= minY,
        (a, b) =>
          this.horizontalIntersection(
            a,
            b,
            minY,
          ),
      );

    result =
      this.clipAgainstBoundary(
        result,
        (point) =>
          point.y <= maxY,
        (a, b) =>
          this.horizontalIntersection(
            a,
            b,
            maxY,
          ),
      );

    return result;
  }

  private clipAgainstBoundary(
    polygon: XYPoint[],
    inside: (
      point: XYPoint,
    ) => boolean,
    intersection: (
      a: XYPoint,
      b: XYPoint,
    ) => XYPoint,
  ): XYPoint[] {
    if (
      polygon.length === 0
    ) {
      return [];
    }

    const result:
      XYPoint[] = [];

    let previous =
      polygon[
        polygon.length - 1
      ];

    let previousInside =
      inside(previous);

    for (
      const current of polygon
    ) {
      const currentInside =
        inside(current);

      if (
        currentInside &&
        !previousInside
      ) {
        result.push(
          intersection(
            previous,
            current,
          ),
        );
      }

      if (
        currentInside
      ) {
        result.push({
          x: current.x,
          y: current.y,
        });
      } else if (
        previousInside
      ) {
        result.push(
          intersection(
            previous,
            current,
          ),
        );
      }

      previous =
        current;

      previousInside =
        currentInside;
    }

    return result;
  }

  private verticalIntersection(
    a: XYPoint,
    b: XYPoint,
    x: number,
  ): XYPoint {
    const dx =
      b.x - a.x;

    if (
      Math.abs(dx) <
      1e-12
    ) {
      return {
        x,
        y: a.y,
      };
    }

    const t =
      (x - a.x) /
      dx;

    return {
      x,

      y:
        a.y +
        t *
        (b.y - a.y),
    };
  }

  private horizontalIntersection(
    a: XYPoint,
    b: XYPoint,
    y: number,
  ): XYPoint {
    const dy =
      b.y - a.y;

    if (
      Math.abs(dy) <
      1e-12
    ) {
      return {
        x: a.x,
        y,
      };
    }

    const t =
      (y - a.y) /
      dy;

    return {
      x:
        a.x +
        t *
        (b.x - a.x),

      y,
    };
  }

  // ============================================================
  // 3D PRISM
  // ============================================================

  private createPrismGeometry(
    polygon: XYPoint[],
    topZ: number,
    bottomZ: number,
  ): Cesium.Geometry | null {
    const triangles =
      this.triangulatePolygon(
        polygon,
      );

    if (
      triangles.length < 3
    ) {
      return null;
    }

    const count =
      polygon.length;

    const positions:
      number[] = [];

    // ----------------------------------------------------------
    // TOP
    // ----------------------------------------------------------

    for (
      const point of polygon
    ) {
      const world =
        this.localToWorld(
          point.x,
          point.y,
          topZ,
        );

      positions.push(
        world.x,
        world.y,
        world.z,
      );
    }

    // ----------------------------------------------------------
    // BOTTOM
    // ----------------------------------------------------------

    for (
      const point of polygon
    ) {
      const world =
        this.localToWorld(
          point.x,
          point.y,
          bottomZ,
        );

      positions.push(
        world.x,
        world.y,
        world.z,
      );
    }

    const indices:
      number[] = [];

    // ----------------------------------------------------------
    // TOP + BOTTOM TRIANGLES
    // ----------------------------------------------------------

    for (
      let i = 0;
      i < triangles.length;
      i += 3
    ) {
      const a =
        triangles[i];

      const b =
        triangles[i + 1];

      const c =
        triangles[i + 2];

      indices.push(
        a,
        b,
        c,
      );

      indices.push(
        c + count,
        b + count,
        a + count,
      );
    }

    // ----------------------------------------------------------
    // SIDE WALLS
    // ----------------------------------------------------------

    for (
      let i = 0;
      i < count;
      i++
    ) {
      const next =
        (i + 1) %
        count;

      indices.push(
        i,
        next,
        next + count,
      );

      indices.push(
        i,
        next + count,
        i + count,
      );
    }

    const positionValues =
      new Float64Array(
        positions,
      );

    return new Cesium.Geometry({
      attributes:
        ({
          position:
            new Cesium.GeometryAttribute({
              componentDatatype:
                Cesium.ComponentDatatype.DOUBLE,

              componentsPerAttribute:
                3,

              values:
                positionValues,
            }),
        } as unknown as Cesium.GeometryAttributes),

      indices:
        new Uint32Array(
          indices,
        ),

      primitiveType:
        Cesium.PrimitiveType.TRIANGLES,

      boundingSphere:
        Cesium.BoundingSphere.fromVertices(
          positionValues,
        ),
    });
  }

  // ============================================================
  // TRIANGULATION
  // ============================================================

  private triangulatePolygon(
    polygon: XYPoint[],
  ): number[] {
    if (
      polygon.length < 3
    ) {
      return [];
    }

    const indices:
      number[] = [];

    for (
      let i = 0;
      i < polygon.length;
      i++
    ) {
      indices.push(i);
    }

    /*
     * Ear clipping needs a consistent winding.
     */
    if (
      this.polygonArea(
        polygon,
      ) < 0
    ) {
      indices.reverse();
    }

    const result:
      number[] = [];

    let guard = 0;

    while (
      indices.length > 3 &&
      guard <
        polygon.length *
          polygon.length
    ) {
      let found = false;

      for (
        let i = 0;
        i < indices.length;
        i++
      ) {
        const prev =
          indices[
            (
              i -
              1 +
              indices.length
            ) %
              indices.length
          ];

        const current =
          indices[i];

        const next =
          indices[
            (
              i + 1
            ) %
              indices.length
          ];

        const a =
          polygon[prev];

        const b =
          polygon[current];

        const c =
          polygon[next];

        /*
         * Convex corner.
         */
        if (
          this.cross(
            a,
            b,
            c,
          ) <= 1e-10
        ) {
          continue;
        }

        /*
         * Check whether another polygon vertex
         * lies inside the candidate triangle.
         */
        let containsPoint =
          false;

        for (
          const testIndex of indices
        ) {
          if (
            testIndex ===
              prev ||
            testIndex ===
              current ||
            testIndex ===
              next
          ) {
            continue;
          }

          if (
            this.pointInTriangle(
              polygon[testIndex],
              a,
              b,
              c,
            )
          ) {
            containsPoint =
              true;

            break;
          }
        }

        if (
          containsPoint
        ) {
          continue;
        }

        result.push(
          prev,
          current,
          next,
        );

        indices.splice(
          i,
          1,
        );

        found = true;

        break;
      }

      if (!found) {
        break;
      }

      guard++;
    }

    if (
      indices.length === 3
    ) {
      result.push(
        indices[0],
        indices[1],
        indices[2],
      );
    }

    return result;
  }

  private cross(
    a: XYPoint,
    b: XYPoint,
    c: XYPoint,
  ): number {
    return (
      (b.x - a.x) *
        (c.y - a.y) -
      (b.y - a.y) *
        (c.x - a.x)
    );
  }

  private pointInTriangle(
    p: XYPoint,
    a: XYPoint,
    b: XYPoint,
    c: XYPoint,
  ): boolean {
    const c1 =
      this.cross(
        a,
        b,
        p,
      );

    const c2 =
      this.cross(
        b,
        c,
        p,
      );

    const c3 =
      this.cross(
        c,
        a,
        p,
      );

    const negative =
      c1 < -1e-10 ||
      c2 < -1e-10 ||
      c3 < -1e-10;

    const positive =
      c1 > 1e-10 ||
      c2 > 1e-10 ||
      c3 > 1e-10;

    return !(
      negative &&
      positive
    );
  }

  private polygonArea(
    polygon: XYPoint[],
  ): number {
    let area = 0;

    for (
      let i = 0;
      i < polygon.length;
      i++
    ) {
      const a =
        polygon[i];

      const b =
        polygon[
          (i + 1) %
            polygon.length
        ];

      area +=
        a.x * b.y -
        b.x * a.y;
    }

    return area / 2;
  }

  private getPolygonCenter(
    polygon: XYPoint[],
  ): XYPoint {
    let x = 0;
    let y = 0;

    for (
      const point of polygon
    ) {
      x += point.x;
      y += point.y;
    }

    return {
      x:
        x / polygon.length,

      y:
        y / polygon.length,
    };
  }

  // ============================================================
  // WIREFRAME
  // ============================================================

  private appendWireframe(
    polygon: XYPoint[],
    topZ: number,
    bottomZ: number,
    positions: number[],
    indices: number[],
    offset: number,
  ): void {
    const topStart =
      offset;

    const bottomStart =
      offset +
      polygon.length;

    for (
      const point of polygon
    ) {
      const world =
        this.localToWorld(
          point.x,
          point.y,
          topZ,
        );

      positions.push(
        world.x,
        world.y,
        world.z,
      );
    }

    for (
      const point of polygon
    ) {
      const world =
        this.localToWorld(
          point.x,
          point.y,
          bottomZ,
        );

      positions.push(
        world.x,
        world.y,
        world.z,
      );
    }

    for (
      let i = 0;
      i < polygon.length;
      i++
    ) {
      const next =
        (i + 1) %
        polygon.length;

      /*
       * Top edge.
       */
      indices.push(
        topStart + i,
        topStart + next,
      );

      /*
       * Bottom edge.
       */
      indices.push(
        bottomStart + i,
        bottomStart + next,
      );

      /*
       * Vertical edge.
       */
      indices.push(
        topStart + i,
        bottomStart + i,
      );
    }
  }

  // ============================================================
  // INTERPOLATION
  // ============================================================

  private interpolate(
    longitude: number,
    latitude: number,
    depth: number,
  ): {
    temperature: number;
    salinity: number;
    value: number;
  } {
    if (
      this.dataPoints.length === 0
    ) {
      return {
        temperature: 15,
        salinity: 35,
        value: 1,
      };
    }

    let temperature = 0;
    let salinity = 0;
    let value = 0;
    let totalWeight = 0;

    for (
      const point of
        this.dataPoints
    ) {
      const dx =
        (
          point.longitude -
          longitude
        ) * 90;

      const dy =
        (
          point.latitude -
          latitude
        ) * 110;

      const dz =
        (
          point.depth -
          depth
        ) / 20;

      const distanceSquared =
        dx * dx +
        dy * dy +
        dz * dz;

      const weight =
        1 /
        Math.max(
          1,
          distanceSquared,
        );

      temperature +=
        point.temperature *
        weight;

      salinity +=
        point.salinity *
        weight;

      value +=
        point.value *
        weight;

      totalWeight +=
        weight;
    }

    if (
      totalWeight <= 0
    ) {
      return {
        temperature: 15,
        salinity: 35,
        value: 1,
      };
    }

    return {
      temperature:
        temperature /
        totalWeight,

      salinity:
        salinity /
        totalWeight,

      value:
        value /
        totalWeight,
    };
  }

  // ============================================================
  // COLOR
  // ============================================================

  private getColor(
    temperature: number,
    salinity: number,
    value: number,
    variable: OceanVariable,
    alpha: number,
  ): Cesium.Color {
    let normalized = 0;

    if (
      variable ===
      'temperature'
    ) {
      normalized =
        (
          temperature - 2
        ) / 28;
    } else if (
      variable ===
      'salinity'
    ) {
      normalized =
        (
          salinity - 32
        ) / 6;
    } else {
      normalized =
        value / 5;
    }

    normalized =
      Math.max(
        0,
        Math.min(
          1,
          normalized,
        ),
      );

    const hue =
      (
        1 -
        normalized
      ) * 240;

    return Cesium.Color.fromHsl(
      hue / 360,
      0.90,
      0.52,
      alpha,
    );
  }

  // ============================================================
  // DEPTH EMPHASIS
  // ============================================================

  private updateDepthEmphasis(): void {
    if (
      this.destroyed ||
      !this.fieldPrimitive
    ) {
      return;
    }

    for (
      const cell of this.cells
    ) {
      const difference =
        Math.abs(
          cell.depth -
            this.currentDepth,
        );

      const range =
        this.isActive
          ? 700
          : 1000;

      const falloff =
        Math.max(
          0,
          1 -
            difference /
              range,
        );

      const alpha =
        this.isActive
          ? 0.12 +
            falloff * 0.34
          : 0.07 +
            falloff * 0.20;

      const color =
        cell.baseColor.clone();

      color.alpha =
        alpha;

      try {
        const attributes =
          this.fieldPrimitive
            .getGeometryInstanceAttributes(
              cell.id,
            );

        if (
          attributes
        ) {
          attributes.color =
            Cesium.ColorGeometryInstanceAttribute.toValue(
              color,
            );
        }
      } catch {
        /*
         * Primitive may not be ready yet.
         */
      }
    }
  }

  // ============================================================
  // CLEAR
  // ============================================================

  private clearMesh(): void {
    if (
      this.viewer.isDestroyed()
    ) {
      this.cells = [];
      return;
    }

    if (
      this.fieldPrimitive
    ) {
      this.viewer.scene.primitives.remove(
        this.fieldPrimitive,
      );

      this.fieldPrimitive =
        null;
    }

    if (
      this.wireframePrimitive
    ) {
      this.viewer.scene.primitives.remove(
        this.wireframePrimitive,
      );

      this.wireframePrimitive =
        null;
    }

    this.cells = [];
  }

  // ============================================================
  // RESOLUTION
  // ============================================================

  public setResolution(
    resolution: 7 | 9 | 12,
  ): void {
    if (
      this.destroyed ||
      this.resolution ===
        resolution
    ) {
      return;
    }

    this.resolution =
      resolution;

    this.rebuild();
  }

  public getResolution():
    7 | 9 | 12 {
    return this.resolution;
  }

  public getCellCount():
    number {
    return this.cells.length;
  }

  // ============================================================
  // DESTROY
  // ============================================================

  public destroy(): void {
    if (
      this.destroyed
    ) {
      return;
    }

    this.destroyed = true;

    this.clearMesh();

    this.dataPoints = [];
  }
}

export default UnderwaterFieldMesh;