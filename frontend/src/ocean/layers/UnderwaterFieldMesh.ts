import * as Cesium from 'cesium';

import {
  UW_BOUNDS,
  UW_DIMENSIONS,
  localToWorld,
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

interface CellRecord {
  entity: Cesium.Entity;
  depth: number;
  baseColor: Cesium.Color;
}

export class UnderwaterFieldMesh {
  private readonly viewer: Cesium.Viewer;
  private readonly definition: UnderwaterRegionDefinition;

  private cells: CellRecord[] = [];
  private dataPoints: SamplePoint[] = [];

  private currentVariable: OceanVariable = 'temperature';
  private currentDepth = 0;

  private isVisible = false;
  private isActive = false;
  private destroyed = false;

  
  private resolution: 7 | 9 | 12 = 9;

  constructor(
    viewer: Cesium.Viewer,
    definition: UnderwaterRegionDefinition,
  ) {
    this.viewer = viewer;
    this.definition = definition;
  }

  // ==========================================================
  // DATA
  // ==========================================================

  public setData(data: UnderwaterRegionData): void {
    if (
      this.destroyed ||
      this.viewer.isDestroyed()
    ) {
      return;
    }

    this.currentVariable = data.variable;
    this.currentDepth = data.depth;

    this.dataPoints = data.points.map((point) => ({
      longitude: point.longitude,
      latitude: point.latitude,
      depth: point.depth,
      temperature: point.temperature,
      salinity: point.salinity,
      value: point.value,
    }));

    this.rebuild();
  }

  // ==========================================================
  // DEPTH
  // ==========================================================

  public setDepth(depth: number): void {
    if (this.destroyed) return;

    this.currentDepth = Math.max(
      0,
      Math.min(
        this.definition.depthMax,
        depth,
      ),
    );

    this.updateDepthEmphasis();
  }

  // ==========================================================
  // ACTIVE
  // ==========================================================

  public setActive(active: boolean): void {
    if (this.destroyed) return;

    this.isActive = active;

    this.updateDepthEmphasis();
  }

  // ==========================================================
  // VISIBILITY
  // ==========================================================

  public setVisible(visible: boolean): void {
    if (this.destroyed) return;

    this.isVisible = visible;

    for (const cell of this.cells) {
      cell.entity.show = visible;
    }
  }

  // ==========================================================
  // BUILD 3D FIELD
  // ==========================================================

  private rebuild(): void {
    this.clearCells();

    if (
      this.destroyed ||
      this.dataPoints.length === 0
    ) {
      return;
    }

    const n = this.resolution;

    /*
     * IMPORTANT:
     *
     * The existing underwater renderer uses:
     *
     * localToWorld(x, y, z)
     *
     * rather than normal Cesium geographic altitude.
     *
     * We therefore calculate the exact same local-space
     * boundaries used by UnderwaterRegionBox.
     */

    const normMinX =
      (
        this.definition.west -
        UW_BOUNDS.centerLon
      ) /
      (
        UW_BOUNDS.maxLon -
        UW_BOUNDS.centerLon
      );

    const normMaxX =
      (
        this.definition.east -
        UW_BOUNDS.centerLon
      ) /
      (
        UW_BOUNDS.maxLon -
        UW_BOUNDS.centerLon
      );

    const normMinY =
      (
        this.definition.south -
        UW_BOUNDS.centerLat
      ) /
      (
        UW_BOUNDS.maxLat -
        UW_BOUNDS.centerLat
      );

    const normMaxY =
      (
        this.definition.north -
        UW_BOUNDS.centerLat
      ) /
      (
        UW_BOUNDS.maxLat -
        UW_BOUNDS.centerLat
      );

    const minX =
      normMinX *
      UW_DIMENSIONS.halfWidthX;

    const maxX =
      normMaxX *
      UW_DIMENSIONS.halfWidthX;

    const minY =
      normMinY *
      UW_DIMENSIONS.halfLengthY;

    const maxY =
      normMaxY *
      UW_DIMENSIONS.halfLengthY;

    const cellX =
      (maxX - minX) / n;

    const cellY =
      (maxY - minY) / n;

    const cellZ =
      UW_DIMENSIONS.totalDepthZ / n;

    // --------------------------------------------------------
    // CREATE EVERY 3D CELL
    // --------------------------------------------------------

    for (let iz = 0; iz < n; iz++) {
      for (let iy = 0; iy < n; iy++) {
        for (let ix = 0; ix < n; ix++) {

          const localX =
            minX +
            (ix + 0.5) *
              cellX;

          const localY =
            minY +
            (iy + 0.5) *
              cellY;

          const normalizedDepth =
            (iz + 0.5) / n;

          const localZ =
            -normalizedDepth *
            UW_DIMENSIONS.totalDepthZ;

          /*
           * Convert the same local coordinates used by
           * the working underwater box into Cesium world
           * coordinates.
           */
          const position =
            localToWorld(
              localX,
              localY,
              localZ,
            );

          /*
           * The data field is still sampled using real
           * geographic coordinates.
           */
          const longitude =
            this.definition.west +
            (
              ix + 0.5
            ) *
            (
              (
                this.definition.east -
                this.definition.west
              ) / n
            );

          const latitude =
            this.definition.south +
            (
              iy + 0.5
            ) *
            (
              (
                this.definition.north -
                this.definition.south
              ) / n
            );

          const depth =
            (
              iz + 0.5
            ) *
            (
              this.definition.depthMax /
              n
            );

          const sample =
            this.interpolate(
              longitude,
              latitude,
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

          /*
           * localToWorld() already defines the underwater
           * coordinate frame.
           *
           * Use that frame for the voxel orientation.
           */
          const orientation =
            Cesium.Transforms.headingPitchRollQuaternion(
              position,
              new Cesium.HeadingPitchRoll(
                0,
                0,
                0,
              ),
            );

          const entity =
            this.viewer.entities.add({
              position,
              orientation,

              box: {
                dimensions:
                  new Cesium.Cartesian3(
                    cellX * 0.92,
                    cellY * 0.92,
                    cellZ * 0.92,
                  ),

                material:
                  new Cesium.ColorMaterialProperty(
                    color,
                  ),

                outline: true,

                outlineColor:
                  new Cesium.Color(
                    color.red,
                    color.green,
                    color.blue,
                    0.18,
                  ),
              },

              properties: {
                regionId:
                  this.definition.id,

                variable:
                  this.currentVariable,

                depth,

                value:
                  sample.value,
              },
            });

          entity.show =
            this.isVisible;

          this.cells.push({
            entity,
            depth,
            baseColor: color,
          });
        }
      }
    }

    /*
     * Keep the mesh visible initially.
     *
     * The depth slider will subsequently control
     * the emphasis around the selected depth.
     */
    this.updateDepthEmphasis();
  }

  // ==========================================================
  // DATA INTERPOLATION
  // ==========================================================

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
      const point of this.dataPoints
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

  // ==========================================================
  // DEPTH VISUALIZATION
  // ==========================================================

  private updateDepthEmphasis(): void {
    if (this.destroyed) return;

    /*
     * IMPORTANT:
     *
     * Do NOT hide most of the volume.
     *
     * We want the entire 3D field visible.
     *
     * The selected depth simply becomes brighter.
     */
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

      if (
        cell.entity.box
      ) {
        cell.entity.box.material =
          new Cesium.ColorMaterialProperty(
            color,
          );

        cell.entity.box.outlineColor =
          new Cesium.ConstantProperty(
            new Cesium.Color(
              color.red,
              color.green,
              color.blue,
              0.14,
            ),
          );
      }

      cell.entity.show =
        this.isVisible;
    }
  }

  // ==========================================================
  // COLOR MAPPING
  // ==========================================================

  private getColor(
    temperature: number,
    salinity: number,
    value: number,
    variable: OceanVariable,
    alpha: number,
  ): Cesium.Color {
    let normalized = 0;

    if (
      variable === 'temperature'
    ) {
      normalized =
        (
          temperature - 2
        ) / 28;
    } else if (
      variable === 'salinity'
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

    /*
     * Blue → cyan → green → yellow → red
     */
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

  // ==========================================================
  // CLEANUP
  // ==========================================================

  private clearCells(): void {
    for (
      const cell of this.cells
    ) {
      this.viewer.entities.remove(
        cell.entity,
      );
    }

    this.cells = [];
  }

  public setResolution(
    resolution: 7 | 9 | 12,
  ): void {
   if (
      this.destroyed ||
      this.resolution === resolution
    ) {
    return;
    }

  this.resolution = resolution;

  this.rebuild();
}

  public getResolution(): 7 | 9 | 12 {
    return this.resolution;
  }

  public getCellCount(): number {
    return this.resolution ** 3;
  }

  public destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;

    this.clearCells();
    this.dataPoints = [];
  }
}