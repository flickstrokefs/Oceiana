import * as Cesium from 'cesium';

import {
  UW_BOUNDS,
  UW_DIMENSIONS,
  localToWorld,
  geoToWorld,
} from '../utils/underwaterCoords';

import { UnderwaterFieldMesh } from './UnderwaterFieldMesh';

import type {
  UnderwaterRegionDefinition,
  UnderwaterRegionData,
  OceanVariable,
} from '../../types/ocean';

interface PointRecord {
  primitive: Cesium.PointPrimitive;
  depth: number;
  temperature: number;
  salinity: number;
  value: number;
}

export class UnderwaterRegionPolygon {
  private viewer: Cesium.Viewer;

  public readonly definition: UnderwaterRegionDefinition;

  // Keep these public because other existing code may use them.
  // They now represent the bounding extent of the polygon,
  // not the actual visible shape.
  public readonly minX: number;
  public readonly maxX: number;
  public readonly minY: number;
  public readonly maxY: number;
  public readonly cx: number;
  public readonly cy: number;

  private currentDepth = 0;
  private currentVariable: OceanVariable = 'temperature';

  private isActive = false;
  private isHovered = false;
  private isVisible = false;
  private isDestroyed = false;

  // ============================================================
  // EXISTING STRUCTURE
  // ============================================================

  private structuralEntities: Cesium.Entity[] = [];
  private depthWireframeEntities: Cesium.Entity[] = [];

  private pointCollection: Cesium.PointPrimitiveCollection;
  private pointRecords: PointRecord[] = [];

  private currentVectorEntities: Cesium.Entity[] = [];

  // ============================================================
  // 3D SCIENTIFIC FIELD
  // ============================================================

  private fieldMesh: UnderwaterFieldMesh;

  // ============================================================
  // SLICE
  // ============================================================

  private slicePolygon: Cesium.Entity | null = null;
  private slicePolyline: Cesium.Entity | null = null;
  private sliceCrosshairX: Cesium.Entity | null = null;
  private sliceCrosshairY: Cesium.Entity | null = null;

  private boxLabel: Cesium.Entity | null = null;

  private wallEntities: Cesium.Entity[] = [];
  private floorEntity: Cesium.Entity | null = null;
  private columnEntities: Cesium.Entity[] = [];

  // Kept for compatibility with the existing structure.
  // The old rectangular vertical grid is no longer generated.
  private depthLabelEntities: Cesium.Entity[] = [];

  private referenceDepths = [
    0,
    100,
    200,
    300,
    500,
    750,
    1000,
    1250,
    1500,
    1750,
    2000,
  ];

  private majorDepths = new Set([
    0,
    200,
    500,
    1000,
    2000,
  ]);

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    viewer: Cesium.Viewer,
    definition: UnderwaterRegionDefinition,
  ) {
    this.viewer = viewer;
    this.definition = definition;

    // ----------------------------------------------------------
    // Bounding extent
    //
    // These values are retained for compatibility with the
    // existing coordinate system and other code.
    //
    // They DO NOT define the visible polygon anymore.
    // The actual visible shape comes from definition.footprint.
    // ----------------------------------------------------------

    const normMinX =
      (definition.west - UW_BOUNDS.centerLon) /
      (UW_BOUNDS.maxLon - UW_BOUNDS.centerLon);

    const normMaxX =
      (definition.east - UW_BOUNDS.centerLon) /
      (UW_BOUNDS.maxLon - UW_BOUNDS.centerLon);

    const normMinY =
      (definition.south - UW_BOUNDS.centerLat) /
      (UW_BOUNDS.maxLat - UW_BOUNDS.centerLat);

    const normMaxY =
      (definition.north - UW_BOUNDS.centerLat) /
      (UW_BOUNDS.maxLat - UW_BOUNDS.centerLat);

    this.minX =
      normMinX * UW_DIMENSIONS.halfWidthX;

    this.maxX =
      normMaxX * UW_DIMENSIONS.halfWidthX;

    this.minY =
      normMinY * UW_DIMENSIONS.halfLengthY;

    this.maxY =
      normMaxY * UW_DIMENSIONS.halfLengthY;

    this.cx =
      (this.minX + this.maxX) / 2;

    this.cy =
      (this.minY + this.maxY) / 2;

    // ----------------------------------------------------------
    // Existing observation points
    // ----------------------------------------------------------

    this.pointCollection =
      new Cesium.PointPrimitiveCollection();

    this.viewer.scene.primitives.add(
      this.pointCollection,
    );

    // ----------------------------------------------------------
    // ACTUAL 3D FIELD MESH
    // ----------------------------------------------------------

    this.fieldMesh =
      new UnderwaterFieldMesh(
        this.viewer,
        this.definition,
      );

    // ----------------------------------------------------------
    // IRREGULAR POLYGON GEOMETRY
    // ----------------------------------------------------------

    this.initPolygonGeometry();
  }

  // ============================================================
  // POLYGON HELPERS
  // ============================================================

  /**
   * Returns the actual geographic footprint of this region
   * converted into the existing ARIEL world coordinate system.
   *
   * footprint format:
   *
   * [
   *   [longitude, latitude],
   *   [longitude, latitude],
   *   ...
   * ]
   *
   * This is the actual shape of the region.
   */
  /**
   * Render-only simplification of the IHO footprint.
   *
   * The original definition.footprint remains untouched.
   * This prevents thousands of IHO vertices from becoming
   * thousands of Cesium entities.
   */
  private getRenderFootprint(): [number, number][] {
    const source =
      this.definition.footprint;

    const maxPoints = 220;

    if (
      source.length <= maxPoints
    ) {
      return source;
    }

    const result:
      [number, number][] = [];

    const step =
      source.length /
      maxPoints;

    for (
      let i = 0;
      i < maxPoints;
      i++
    ) {
      result.push(
        source[
          Math.floor(
            i * step,
          )
        ],
      );
    }

    return result;
  }
  private getFootprintAtDepth(
    depth: number,
  ): Cesium.Cartesian3[] {
    return this.getRenderFootprint().map(([longitude, latitude]) =>
        geoToWorld(
          longitude,
          latitude,
          depth,
        ),
    );
  }

  /**
   * Calculate the geographic center of the polygon.
   *
   * Used for labels and reference crosshairs.
   */
  private getPolygonCenter(): {
    longitude: number;
    latitude: number;
  } {
    const footprint = this.getRenderFootprint();

    if (footprint.length === 0) {
      return {
        longitude: UW_BOUNDS.centerLon,
        latitude: UW_BOUNDS.centerLat,
      };
    }

    let longitude = 0;
    let latitude = 0;

    for (
      const [lon, lat] of footprint
    ) {
      longitude += lon;
      latitude += lat;
    }

    return {
      longitude:
        longitude / footprint.length,
      latitude:
        latitude / footprint.length,
    };
  }

  // ============================================================
  // GEOMETRY HELPERS
  // ============================================================

  /**
   * Kept with the existing method name so existing code does
   * not need to change.
   *
   * It now returns ALL polygon vertices rather than 4 box
   * corners.
   */
  public getCornersAtDepth(
    depth: number,
  ): Cesium.Cartesian3[] {
    return this.getFootprintAtDepth(
      Math.max(
        0,
        Math.min(
          this.definition.depthMax,
          depth,
        ),
      ),
    );
  }

  /**
   * Closed perimeter of the actual irregular polygon.
   */
  public getPerimeterAtDepth(
    depth: number,
  ): Cesium.Cartesian3[] {
    const corners =
      this.getCornersAtDepth(depth);

    if (corners.length === 0) {
      return [];
    }

    return [
      ...corners,
      corners[0],
    ];
  }

  /**
   * Reference crosshairs through the geographic center.
   *
   * These are still based on the polygon bounding extent,
   * but the actual slice itself follows the irregular footprint.
   */
  public getCrosshairsAtDepth(
    depth: number,
  ): {
    lineX: Cesium.Cartesian3[];
    lineY: Cesium.Cartesian3[];
  } {
    const center =
      this.getPolygonCenter();

    const lons =
      this.getRenderFootprint().map(([lon]) => lon,
      );

    const lats =
      this.getRenderFootprint().map(([, lat]) => lat,
      );

    if (
      lons.length === 0 ||
      lats.length === 0
    ) {
      return {
        lineX: [],
        lineY: [],
      };
    }

    const minLon =
      Math.min(...lons);

    const maxLon =
      Math.max(...lons);

    const minLat =
      Math.min(...lats);

    const maxLat =
      Math.max(...lats);

    return {
      lineX: [
        geoToWorld(
          minLon,
          center.latitude,
          depth,
        ),
        geoToWorld(
          maxLon,
          center.latitude,
          depth,
        ),
      ],

      lineY: [
        geoToWorld(
          center.longitude,
          minLat,
          depth,
        ),
        geoToWorld(
          center.longitude,
          maxLat,
          depth,
        ),
      ],
    };
  }

  public setFieldResolution(
    resolution: 7 | 9 | 12,
  ): void {
    if (this.isDestroyed) {
      return;
    }

    this.fieldMesh.setResolution(
      resolution,
    );
  }

  // ============================================================
  // POLYGON GEOMETRY
  // ============================================================

  private initPolygonGeometry(): void {
    const surfaceCorners =
      this.getCornersAtDepth(0);

    const floorCorners =
      this.getCornersAtDepth(
        this.definition.depthMax,
      );

    if (surfaceCorners.length < 3) {
      return;
    }

    // ----------------------------------------------------------
    // FLOOR
    // ----------------------------------------------------------

    this.floorEntity =
      this.viewer.entities.add({
        polygon: {
          hierarchy:
            new Cesium.PolygonHierarchy(
              floorCorners,
            ),

          material:
            new Cesium.ColorMaterialProperty(
              new Cesium.Color(
                0.005,
                0.025,
                0.065,
                0.35,
              ),
            ),

          perPositionHeight: true,
        },

        properties: {
          regionId:
            this.definition.id,
        },
      });

    this.structuralEntities.push(
      this.floorEntity,
    );

    // ----------------------------------------------------------
    // IRREGULAR POLYGON WALLS
    //
    // Instead of 4 rectangular walls, create one wall segment
    // for every edge of the footprint.
    // ----------------------------------------------------------

    for (
      let i = 0;
      i < surfaceCorners.length;
      i++
    ) {
      const next =
        (i + 1) %
        surfaceCorners.length;

      const wallPositions = [
        surfaceCorners[i],
        surfaceCorners[next],
        floorCorners[next],
        floorCorners[i],
      ];

      const wall =
        this.viewer.entities.add({
          polygon: {
            hierarchy:
              new Cesium.PolygonHierarchy(
                wallPositions,
              ),

            material:
              new Cesium.ColorMaterialProperty(
                new Cesium.Color(
                  0.010,
                  0.055,
                  0.13,
                  0.12,
                ),
              ),

            perPositionHeight: true,
          },

          properties: {
            regionId:
              this.definition.id,
          },
        });

      this.wallEntities.push(wall);
      this.structuralEntities.push(wall);
    }

    // ----------------------------------------------------------
    // VERTICAL COLUMNS
    //
    // One column for every polygon vertex.
    // ----------------------------------------------------------

    for (
      let i = 0;
      i < surfaceCorners.length;
      i++
    ) {
      const column =
        this.viewer.entities.add({
          polyline: {
            positions: [
              surfaceCorners[i],
              floorCorners[i],
            ],

            width: 1.5,

            arcType:
              Cesium.ArcType.NONE,

            material:
              new Cesium.ColorMaterialProperty(
                new Cesium.Color(
                  0.0,
                  0.70,
                  0.90,
                  0.35,
                ),
              ),
          },

          properties: {
            regionId:
              this.definition.id,
          },
        });

      this.columnEntities.push(
        column,
      );

      this.structuralEntities.push(
        column,
      );
    }

    // ----------------------------------------------------------
    // NO OLD RECTANGULAR VERTICAL GRID
    //
    // The actual scientific grid is handled by
    // UnderwaterFieldMesh.
    //
    // This prevents the old rectangular grid from appearing
    // inside the new irregular polygon.
    // ----------------------------------------------------------
    // ----------------------------------------------------------
    // DEPTH GUIDES
    //
    // Every depth guide now follows the irregular footprint.
    // ----------------------------------------------------------

    for (
      const depth of this.referenceDepths
    ) {
      const perimeter =
        this.getPerimeterAtDepth(
          depth,
        );

      if (perimeter.length < 2) {
        continue;
      }

      const isBoundary =
        depth === 0 ||
        depth ===
          this.definition.depthMax;

      const isMajor =
        this.majorDepths.has(depth);

      const guide =
        this.viewer.entities.add({
          polyline: {
            positions:
              perimeter,

            width:
              isBoundary
                ? 1.5
                : isMajor
                  ? 1.2
                  : 1.0,

            arcType:
              Cesium.ArcType.NONE,

            material:
              new Cesium.ColorMaterialProperty(
                isBoundary
                  ? new Cesium.Color(
                      0.0,
                      0.75,
                      0.95,
                      0.38,
                    )
                  : isMajor
                    ? new Cesium.Color(
                        0.0,
                        0.65,
                        0.88,
                        0.22,
                      )
                    : new Cesium.Color(
                        0.0,
                        0.50,
                        0.75,
                        0.10,
                      ),
              ),
          },

          properties: {
            regionId:
              this.definition.id,
          },
        });

      this.depthWireframeEntities.push(
        guide,
      );

      this.structuralEntities.push(
        guide,
      );

      // --------------------------------------------------------
      // DEPTH LABEL
      // --------------------------------------------------------

      if (isMajor) {
        const center =
          this.getPolygonCenter();

        const labelPosition =
          geoToWorld(
            center.longitude,
            center.latitude,
            depth,
          );

        const label =
          this.viewer.entities.add({
            position:
              labelPosition,

            label: {
              text:
                `-${depth}m`,

              font:
                '10px JetBrains Mono, monospace',

              style:
                Cesium.LabelStyle.FILL,

              fillColor:
                new Cesium.Color(
                  0.0,
                  0.70,
                  0.90,
                  0.40,
                ),

              verticalOrigin:
                Cesium.VerticalOrigin.CENTER,

              horizontalOrigin:
                Cesium.HorizontalOrigin.RIGHT,

              pixelOffset:
                new Cesium.Cartesian2(
                  -10,
                  0,
                ),

              disableDepthTestDistance:
                Number.POSITIVE_INFINITY,
            },

            properties: {
              regionId:
                this.definition.id,
            },
          });

        this.depthLabelEntities.push(
          label,
        );

        this.structuralEntities.push(
          label,
        );
      }
    }

    // ----------------------------------------------------------
    // SLICE
    // ----------------------------------------------------------

    const sliceCorners =
      this.getCornersAtDepth(
        this.currentDepth,
      );

    const slicePerimeter =
      this.getPerimeterAtDepth(
        this.currentDepth,
      );

    const crosshairs =
      this.getCrosshairsAtDepth(
        this.currentDepth,
      );

    // ----------------------------------------------------------
    // SLICE POLYGON
    // ----------------------------------------------------------

    this.slicePolygon =
      this.viewer.entities.add({
        polygon: {
          hierarchy:
            new Cesium.PolygonHierarchy(
              sliceCorners,
            ),

          material:
            new Cesium.ColorMaterialProperty(
              new Cesium.Color(
                0.0,
                0.80,
                1.0,
                0.08,
              ),
            ),

          perPositionHeight: true,
        },

        properties: {
          regionId:
            this.definition.id,
        },
      });

    this.structuralEntities.push(
      this.slicePolygon,
    );

    // ----------------------------------------------------------
    // SLICE OUTLINE
    // ----------------------------------------------------------

    this.slicePolyline =
      this.viewer.entities.add({
        polyline: {
          positions:
            slicePerimeter,

          width: 1.5,

          arcType:
            Cesium.ArcType.NONE,

          material:
            new Cesium.ColorMaterialProperty(
              new Cesium.Color(
                0.0,
                0.75,
                0.95,
                0.35,
              ),
            ),
        },

        properties: {
          regionId:
            this.definition.id,
        },
      });

    this.structuralEntities.push(
      this.slicePolyline,
    );

    // ----------------------------------------------------------
    // CROSSHAIR X
    // ----------------------------------------------------------

    this.sliceCrosshairX =
      this.viewer.entities.add({
        polyline: {
          positions:
            crosshairs.lineX,

          width: 1,

          arcType:
            Cesium.ArcType.NONE,

          material:
            new Cesium.ColorMaterialProperty(
              new Cesium.Color(
                0.0,
                0.80,
                1.0,
                0.18,
              ),
            ),
        },

        properties: {
          regionId:
            this.definition.id,
        },
      });

    this.structuralEntities.push(
      this.sliceCrosshairX,
    );

    // ----------------------------------------------------------
    // CROSSHAIR Y
    // ----------------------------------------------------------

    this.sliceCrosshairY =
      this.viewer.entities.add({
        polyline: {
          positions:
            crosshairs.lineY,

          width: 1,

          arcType:
            Cesium.ArcType.NONE,

          material:
            new Cesium.ColorMaterialProperty(
              new Cesium.Color(
                0.0,
                0.80,
                1.0,
                0.18,
              ),
            ),
        },

        properties: {
          regionId:
            this.definition.id,
        },
      });

    this.structuralEntities.push(
      this.sliceCrosshairY,
    );

    // ----------------------------------------------------------
    // LABEL
    // ----------------------------------------------------------

    const center =
      this.getPolygonCenter();

    this.boxLabel =
      this.viewer.entities.add({
        position:
          geoToWorld(
            center.longitude,
            center.latitude,
            this.currentDepth,
          ),

        label: {
          text:
            `${this.definition.name.toUpperCase()} | ${Math.round(this.currentDepth)}m`,

          font:
            'bold 11px JetBrains Mono, monospace',

          style:
            Cesium.LabelStyle.FILL_AND_OUTLINE,

          fillColor:
            new Cesium.Color(
              0.0,
              0.80,
              1.0,
              0.60,
            ),

          outlineColor:
            Cesium.Color.BLACK,

          outlineWidth: 3,

          verticalOrigin:
            Cesium.VerticalOrigin.CENTER,

          horizontalOrigin:
            Cesium.HorizontalOrigin.CENTER,

          disableDepthTestDistance:
            Number.POSITIVE_INFINITY,
        },

        properties: {
          regionId:
            this.definition.id,
        },
      });

    this.structuralEntities.push(
      this.boxLabel,
    );

    this.updateVisualStyles();

    this.setVisible(
      this.isVisible,
    );
  }

  // ============================================================
  // CLEAR DATA
  // ============================================================

  public clearData(): void {
    if (
      this.isDestroyed ||
      this.viewer.isDestroyed()
    ) {
      return;
    }

    try {
      if (
        !this.pointCollection.isDestroyed()
      ) {
        this.pointCollection.removeAll();
      }
    } catch {
      // Cesium collection may already be destroyed.
    }

    this.pointRecords = [];

    for (
      const entity of
      this.currentVectorEntities
    ) {
      this.viewer.entities.remove(
        entity,
      );
    }

    this.currentVectorEntities = [];
  }

  // ============================================================
  // SET DATA
  // ============================================================

  public setData(
    data: UnderwaterRegionData,
  ): void {
    if (
      this.isDestroyed ||
      this.viewer.isDestroyed()
    ) {
      return;
    }

    if (
      this.pointCollection.isDestroyed()
    ) {
      return;
    }

    this.currentDepth =
      data.depth;

    this.currentVariable =
      data.variable;

    // ==========================================================
    // SEND DATA TO ACTUAL 3D SCIENTIFIC FIELD
    // ==========================================================

    this.fieldMesh.setData(data);

    this.fieldMesh.setActive(
      this.isActive,
    );

    this.fieldMesh.setVisible(
      this.isVisible,
    );

    // ==========================================================
    // OBSERVATION POINTS
    // ==========================================================

    this.pointCollection.removeAll();

    this.pointRecords = [];

    for (
      const point of data.points
    ) {
      const position =
        geoToWorld(
          point.longitude,
          point.latitude,
          point.depth,
        );

      const color =
        this.getColor(
          point.temperature,
          point.salinity,
          point.value,
          this.currentVariable,
          0.95,
        );

      const primitive =
        this.pointCollection.add({
          position,

          pixelSize: 5,

          color,

          disableDepthTestDistance:
            Number.POSITIVE_INFINITY,

          show:
            this.isVisible,
        });

      this.pointRecords.push({
        primitive,

        depth:
          point.depth,

        temperature:
          point.temperature,

        salinity:
          point.salinity,

        value:
          point.value,
      });
    }

    // ==========================================================
    // CURRENT VECTORS
    // ==========================================================

    for (
      const entity of
      this.currentVectorEntities
    ) {
      this.viewer.entities.remove(
        entity,
      );
    }

    this.currentVectorEntities = [];

    const normZ =
      this.currentDepth /
      this.definition.depthMax;

    const cz =
      -normZ *
      UW_DIMENSIONS.totalDepthZ;

    for (
      const current of data.currents
    ) {
      const length =
        this.isActive
          ? Math.max(
              24000,
              Math.min(
                46000,
                28000 *
                  current.speed,
              ),
            )
          : Math.max(
              14000,
              Math.min(
                28000,
                18000 *
                  current.speed,
              ),
            );

      const headLength =
        length * 0.35;

      const headAngle =
        Math.PI / 6;

      const normX =
        (
          current.longitude -
          UW_BOUNDS.centerLon
        ) /
        (
          UW_BOUNDS.maxLon -
          UW_BOUNDS.centerLon
        );

      const normY =
        (
          current.latitude -
          UW_BOUNDS.centerLat
        ) /
        (
          UW_BOUNDS.maxLat -
          UW_BOUNDS.centerLat
        );

      const x =
        normX *
        UW_DIMENSIONS.halfWidthX;

      const y =
        normY *
        UW_DIMENSIONS.halfLengthY;

      const tipX =
        x +
        Math.cos(
          current.angle,
        ) *
        length;

      const tipY =
        y +
        Math.sin(
          current.angle,
        ) *
        length;

      const leftX =
        tipX -
        Math.cos(
          current.angle -
          headAngle,
        ) *
        headLength;

      const leftY =
        tipY -
        Math.sin(
          current.angle -
          headAngle,
        ) *
        headLength;

      const rightX =
        tipX -
        Math.cos(
          current.angle +
          headAngle,
        ) *
        headLength;

      const rightY =
        tipY -
        Math.sin(
          current.angle +
          headAngle,
        ) *
        headLength;

      const arrowPositions = [
        localToWorld(
          x,
          y,
          cz,
        ),

        localToWorld(
          tipX,
          tipY,
          cz,
        ),

        localToWorld(
          leftX,
          leftY,
          cz,
        ),

        localToWorld(
          tipX,
          tipY,
          cz,
        ),

        localToWorld(
          rightX,
          rightY,
          cz,
        ),
      ];

      const arrowColor =
        this.isActive
          ? new Cesium.Color(
              0.20,
              1.0,
              0.75,
              0.95,
            )
          : new Cesium.Color(
              0.10,
              0.55,
              0.45,
              0.22,
            );

      const arrow =
        this.viewer.entities.add({
          polyline: {
            positions:
              arrowPositions,

            width:
              this.isActive
                ? 2.0
                : 1.0,

            arcType:
              Cesium.ArcType.NONE,

            material:
              new Cesium.ColorMaterialProperty(
                arrowColor,
              ),

            depthFailMaterial:
              new Cesium.ColorMaterialProperty(
                arrowColor,
              ),
          },

          properties: {
            regionId:
              this.definition.id,
          },
        });

      arrow.show =
        this.isVisible;

      this.currentVectorEntities.push(
        arrow,
      );
    }

    this.updatePointStyles();
  }

  // ============================================================
  // DEPTH
  // ============================================================

  public setDepth(
    depth: number,
  ): void {
    this.currentDepth =
      Math.max(
        0,
        Math.min(
          this.definition.depthMax,
          depth,
        ),
      );

    // Keep the scientific mesh synchronized.
    this.fieldMesh.setDepth(
      this.currentDepth,
    );

    // ----------------------------------------------------------
    // IRREGULAR SLICE
    // ----------------------------------------------------------

    const sliceCorners =
      this.getCornersAtDepth(
        this.currentDepth,
      );

    const slicePerimeter =
      this.getPerimeterAtDepth(
        this.currentDepth,
      );

    const crosshairs =
      this.getCrosshairsAtDepth(
        this.currentDepth,
      );

    if (
      this.slicePolygon &&
      this.slicePolygon.polygon
    ) {
      this.slicePolygon
        .polygon
        .hierarchy =
        new Cesium.ConstantProperty(
          new Cesium.PolygonHierarchy(
            sliceCorners,
          ),
        );
    }

    if (
      this.slicePolyline &&
      this.slicePolyline.polyline
    ) {
      this.slicePolyline
        .polyline
        .positions =
        new Cesium.ConstantProperty(
          slicePerimeter,
        );
    }

    if (
      this.sliceCrosshairX &&
      this.sliceCrosshairX.polyline
    ) {
      this.sliceCrosshairX
        .polyline
        .positions =
        new Cesium.ConstantProperty(
          crosshairs.lineX,
        );
    }

    if (
      this.sliceCrosshairY &&
      this.sliceCrosshairY.polyline
    ) {
      this.sliceCrosshairY
        .polyline
        .positions =
        new Cesium.ConstantProperty(
          crosshairs.lineY,
        );
    }

    // ----------------------------------------------------------
    // LABEL
    // ----------------------------------------------------------

    if (this.boxLabel) {
      const center =
        this.getPolygonCenter();

      this.boxLabel.position =
        new Cesium.ConstantPositionProperty(
          geoToWorld(
            center.longitude,
            center.latitude,
            this.currentDepth,
          ),
        );

      if (this.boxLabel.label) {
        const prefix =
          this.isActive
            ? 'â— '
            : this.isHovered
              ? 'â–· '
              : '';

        const suffix =
          this.isActive
            ? ' [ACTIVE]'
            : '';

        this.boxLabel.label.text =
          new Cesium.ConstantProperty(
            `${prefix}${this.definition.name.toUpperCase()}${suffix} | ${Math.round(this.currentDepth)}m`,
          );
      }
    }

    this.updatePointStyles();
  }

  // ============================================================
  // ACTIVE STATE
  // ============================================================

  public setActive(
    isActive: boolean,
  ): void {
    if (
      this.isActive ===
      isActive
    ) {
      return;
    }

    this.isActive =
      isActive;

    this.fieldMesh.setActive(
      isActive,
    );

    this.updateVisualStyles();
    this.updatePointStyles();
  }

  // ============================================================
  // HOVER
  // ============================================================

  public setHovered(
    isHovered: boolean,
  ): void {
    if (
      this.isHovered ===
      isHovered
    ) {
      return;
    }

    this.isHovered =
      isHovered;

    if (!this.isActive) {
      this.updateVisualStyles();
    }
  }

  // ============================================================
  // VISIBILITY
  // ============================================================

  public setVisible(
    visible: boolean,
  ): void {
    this.isVisible =
      visible;

    for (
      const entity of
      this.structuralEntities
    ) {
      entity.show =
        visible;
    }

    for (
      const entity of
      this.currentVectorEntities
    ) {
      entity.show =
        visible;
    }

    this.pointCollection.show =
      visible;

    // ACTUAL 3D FIELD VISIBILITY
    this.fieldMesh.setVisible(
      visible,
    );
  }

  // ============================================================
  // OBSERVATION POINT STYLING
  // ============================================================

  private updatePointStyles(): void {
    const tolerance = 40;
    const falloff = 110;

    for (
      const record of
      this.pointRecords
    ) {
      const difference =
        Math.abs(
          record.depth -
          this.currentDepth,
        );

      if (this.isActive) {
        if (
          difference <=
          tolerance
        ) {
          record.primitive.show =
            true;

          record.primitive.pixelSize =
            10 +
            (
              1 -
              difference /
              tolerance
            ) *
            3;

          record.primitive.color =
            this.getColor(
              record.temperature,
              record.salinity,
              record.value,
              this.currentVariable,
              0.95,
            );
        } else if (
          difference <=
          falloff
        ) {
          record.primitive.show =
            true;

          record.primitive.pixelSize =
            5;

          const fade =
            (
              1 -
              (
                difference -
                tolerance
              ) /
              (
                falloff -
                tolerance
              )
            ) *
            0.40;

          record.primitive.color =
            this.getColor(
              record.temperature,
              record.salinity,
              record.value,
              this.currentVariable,
              Math.max(
                0.08,
                fade,
              ),
            );
        } else {
          record.primitive.show =
            false;
        }
      } else {
        if (
          difference <=
          tolerance
        ) {
          record.primitive.show =
            true;

          record.primitive.pixelSize =
            5;

          record.primitive.color =
            this.getColor(
              record.temperature,
              record.salinity,
              record.value,
              this.currentVariable,
              0.22,
            );
        } else if (
          difference <=
          falloff
        ) {
          record.primitive.show =
            true;

          record.primitive.pixelSize =
            3;

          record.primitive.color =
            this.getColor(
              record.temperature,
              record.salinity,
              record.value,
              this.currentVariable,
              0.08,
            );
        } else {
          record.primitive.show =
            false;
        }
      }
    }
  }

  // ============================================================
  // VARIABLE â†’ COLOR
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
        Math.min(
          1,
          Math.max(
            0,
            (
              temperature -
              2
            ) /
            28,
          ),
        );
    } else if (
      variable ===
      'salinity'
    ) {
      normalized =
        Math.min(
          1,
          Math.max(
            0,
            (
              salinity -
              32
            ) /
            6,
          ),
        );
    } else {
      normalized =
        Math.min(
          1,
          Math.max(
            0,
            value / 5,
          ),
        );
    }

    const hue =
      240 -
      normalized *
      240;

    return Cesium.Color.fromHsl(
      hue / 360,
      0.90,
      0.50,
      alpha,
    );
  }

  // ============================================================
  // VISUAL STYLING
  // ============================================================

  private updateVisualStyles(): void {
    if (this.isActive) {
      if (
        this.slicePolygon &&
        this.slicePolygon.polygon
      ) {
        this.slicePolygon.polygon.material =
          new Cesium.ColorMaterialProperty(
            new Cesium.Color(
              0.0,
              0.85,
              1.0,
              0.24,
            ),
          );
      }

      if (
        this.slicePolyline &&
        this.slicePolyline.polyline
      ) {
        this.slicePolyline.polyline.width =
          new Cesium.ConstantProperty(
            3.5,
          );

        this.slicePolyline.polyline.material =
          new Cesium.PolylineGlowMaterialProperty({
            glowPower: 0.28,

            color:
              new Cesium.Color(
                0.0,
                0.98,
                1.0,
                0.98,
              ),
          });
      }

      for (
        const column of
        this.columnEntities
      ) {
        if (column.polyline) {
          column.polyline.width =
            new Cesium.ConstantProperty(
              2.2,
            );

          column.polyline.material =
            new Cesium.ColorMaterialProperty(
              new Cesium.Color(
                0.0,
                0.85,
                1.0,
                0.70,
              ),
            );
        }
      }

      for (
        const wall of
        this.wallEntities
      ) {
        if (wall.polygon) {
          wall.polygon.material =
            new Cesium.ColorMaterialProperty(
              new Cesium.Color(
                0.015,
                0.08,
                0.18,
                0.18,
              ),
            );
        }
      }
    } else if (
      this.isHovered
    ) {
      if (
        this.slicePolyline &&
        this.slicePolyline.polyline
      ) {
        this.slicePolyline.polyline.width =
          new Cesium.ConstantProperty(
            2.2,
          );

        this.slicePolyline.polyline.material =
          new Cesium.ColorMaterialProperty(
            new Cesium.Color(
              0.0,
              0.85,
              1.0,
              0.75,
            ),
          );
      }
    } else {
      if (
        this.slicePolygon &&
        this.slicePolygon.polygon
      ) {
        this.slicePolygon.polygon.material =
          new Cesium.ColorMaterialProperty(
            new Cesium.Color(
              0.010,
              0.055,
              0.13,
              0.04,
            ),
          );
      }

      if (
        this.slicePolyline &&
        this.slicePolyline.polyline
      ) {
        this.slicePolyline.polyline.width =
          new Cesium.ConstantProperty(
            1.0,
          );

        this.slicePolyline.polyline.material =
          new Cesium.ColorMaterialProperty(
            new Cesium.Color(
              0.0,
              0.55,
              0.80,
              0.20,
            ),
          );
      }

      for (
        const column of
        this.columnEntities
      ) {
        if (column.polyline) {
          column.polyline.width =
            new Cesium.ConstantProperty(
              1.0,
            );

          column.polyline.material =
            new Cesium.ColorMaterialProperty(
              new Cesium.Color(
                0.0,
                0.50,
                0.75,
                0.20,
              ),
            );
        }
      }

      for (
        const wall of
        this.wallEntities
      ) {
        if (wall.polygon) {
          wall.polygon.material =
            new Cesium.ColorMaterialProperty(
              new Cesium.Color(
                0.008,
                0.04,
                0.10,
                0.05,
              ),
            );
        }
      }
    }
  }

  // ============================================================
  // DESTROY
  // ============================================================

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    // Destroy the actual scientific field mesh.
    this.fieldMesh.destroy();

    if (
      !this.viewer.isDestroyed()
    ) {
      for (
        const entity of
        this.structuralEntities
      ) {
        this.viewer.entities.remove(
          entity,
        );
      }

      for (
        const entity of
        this.currentVectorEntities
      ) {
        this.viewer.entities.remove(
          entity,
        );
      }

      try {
        if (
          !this.pointCollection.isDestroyed()
        ) {
          this.viewer.scene.primitives.remove(
            this.pointCollection,
          );
        }
      } catch {
        // Cesium primitives may already be removed.
      }
    }

    this.structuralEntities = [];
    this.depthWireframeEntities = [];
    this.currentVectorEntities = [];
    this.wallEntities = [];
    this.columnEntities = [];
    this.depthLabelEntities = [];
    this.pointRecords = [];
  }
}


