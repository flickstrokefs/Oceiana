import * as Cesium from 'cesium';
import {
  UW_BOUNDS,
  UW_DIMENSIONS,
  localToWorld,
  geoToWorld,
} from '../utils/underwaterCoords';
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

export class UnderwaterRegionBox {
  private viewer: Cesium.Viewer;
  public readonly definition: UnderwaterRegionDefinition;

  // Local metric boundary extents for this box
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

  // Cesium primitives and entities for this independent box
  private structuralEntities: Cesium.Entity[] = [];
  private depthWireframeEntities: Cesium.Entity[] = [];
  private pointCollection: Cesium.PointPrimitiveCollection;
  private pointRecords: PointRecord[] = [];
  private currentVectorEntities: Cesium.Entity[] = [];

  // Dedicated slice entities for this box
  private slicePolygon: Cesium.Entity | null = null;
  private slicePolyline: Cesium.Entity | null = null;
  private sliceCrosshairX: Cesium.Entity | null = null;
  private sliceCrosshairY: Cesium.Entity | null = null;
  private boxLabel: Cesium.Entity | null = null;

  // Wall polygon entities for dynamic active/subdued styling
  private wallEntities: Cesium.Entity[] = [];
  private floorEntity: Cesium.Entity | null = null;
  private columnEntities: Cesium.Entity[] = [];
  private verticalGridEntities: Cesium.Entity[] = [];
  private depthLabelEntities: Cesium.Entity[] = [];

  // Intermediate and major reference depth milestones (m)
  private referenceDepths = [0, 100, 200, 300, 500, 750, 1000, 1250, 1500, 1750, 2000];
  private majorDepths = new Set([0, 200, 500, 1000, 2000]);

  constructor(viewer: Cesium.Viewer, definition: UnderwaterRegionDefinition) {
    this.viewer = viewer;
    this.definition = definition;

    // Compute local coordinate bounds from geographic definition
    const normMinX = (definition.west - UW_BOUNDS.centerLon) / (UW_BOUNDS.maxLon - UW_BOUNDS.centerLon);
    const normMaxX = (definition.east - UW_BOUNDS.centerLon) / (UW_BOUNDS.maxLon - UW_BOUNDS.centerLon);
    const normMinY = (definition.south - UW_BOUNDS.centerLat) / (UW_BOUNDS.maxLat - UW_BOUNDS.centerLat);
    const normMaxY = (definition.north - UW_BOUNDS.centerLat) / (UW_BOUNDS.maxLat - UW_BOUNDS.centerLat);

    this.minX = normMinX * UW_DIMENSIONS.halfWidthX;
    this.maxX = normMaxX * UW_DIMENSIONS.halfWidthX;
    this.minY = normMinY * UW_DIMENSIONS.halfLengthY;
    this.maxY = normMaxY * UW_DIMENSIONS.halfLengthY;
    this.cx = (this.minX + this.maxX) / 2;
    this.cy = (this.minY + this.maxY) / 2;

    this.pointCollection = new Cesium.PointPrimitiveCollection();
    this.viewer.scene.primitives.add(this.pointCollection);

    this.initBoxGeometry();
  }

  /**
   * Returns 4 world Cartesian corners of this box at a specific depth
   */
  public getCornersAtDepth(depth: number): Cesium.Cartesian3[] {
    const normZ = Math.max(0, Math.min(this.definition.depthMax, depth)) / this.definition.depthMax;
    const z = -normZ * UW_DIMENSIONS.totalDepthZ;

    return [
      localToWorld(this.minX, this.minY, z), // SW
      localToWorld(this.maxX, this.minY, z), // SE
      localToWorld(this.maxX, this.maxY, z), // NE
      localToWorld(this.minX, this.maxY, z), // NW
    ];
  }

  public getPerimeterAtDepth(depth: number): Cesium.Cartesian3[] {
    const corners = this.getCornersAtDepth(depth);
    return [...corners, corners[0]];
  }

  public getCrosshairsAtDepth(depth: number): { lineX: Cesium.Cartesian3[]; lineY: Cesium.Cartesian3[] } {
    const normZ = Math.max(0, Math.min(this.definition.depthMax, depth)) / this.definition.depthMax;
    const z = -normZ * UW_DIMENSIONS.totalDepthZ;

    return {
      lineX: [
        localToWorld(this.minX, this.cy, z),
        localToWorld(this.maxX, this.cy, z),
      ],
      lineY: [
        localToWorld(this.cx, this.minY, z),
        localToWorld(this.cx, this.maxY, z),
      ],
    };
  }

  private initBoxGeometry(): void {
    const surfaceCorners = this.getCornersAtDepth(0);
    const floorCorners = this.getCornersAtDepth(this.definition.depthMax);
    const hz = UW_DIMENSIONS.totalDepthZ;

    // 1. Abyssal Floor at 2000m
    this.floorEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(floorCorners),
        material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.005, 0.025, 0.065, 0.35)),
        perPositionHeight: true,
      },
      properties: { regionId: this.definition.id },
    });
    this.structuralEntities.push(this.floorEntity);

    // 2. 4 Cutaway Boundary Walls
    const wallPositions = [
      [surfaceCorners[0], surfaceCorners[1], floorCorners[1], floorCorners[0]], // South
      [surfaceCorners[1], surfaceCorners[2], floorCorners[2], floorCorners[1]], // East
      [surfaceCorners[2], surfaceCorners[3], floorCorners[3], floorCorners[2]], // North
      [surfaceCorners[3], surfaceCorners[0], floorCorners[0], floorCorners[3]], // West
    ];

    for (const wp of wallPositions) {
      const wall = this.viewer.entities.add({
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(wp),
          material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.010, 0.055, 0.13, 0.12)),
          perPositionHeight: true,
        },
        properties: { regionId: this.definition.id },
      });
      this.wallEntities.push(wall);
      this.structuralEntities.push(wall);
    }

    // 3. 4 Straight Corner Columns
    for (let i = 0; i < 4; i++) {
      const col = this.viewer.entities.add({
        polyline: {
          positions: [surfaceCorners[i], floorCorners[i]],
          width: 1.5,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.0, 0.70, 0.90, 0.35)),
        },
        properties: { regionId: this.definition.id },
      });
      this.columnEntities.push(col);
      this.structuralEntities.push(col);
    }

    // 4. Vertical Reference Grid Lines (subtle subdivision lines at 1/3 and 2/3 along each wall)
    const xStep = (this.maxX - this.minX) / 3;
    const yStep = (this.maxY - this.minY) / 3;

    // South wall (y = minY) & North wall (y = maxY)
    for (let k = 1; k <= 2; k++) {
      const vx = this.minX + k * xStep;

      const sLine = this.viewer.entities.add({
        polyline: {
          positions: [localToWorld(vx, this.minY, 0), localToWorld(vx, this.minY, -hz)],
          width: 1.0,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.0, 0.55, 0.80, 0.12)),
        },
        properties: { regionId: this.definition.id },
      });
      this.verticalGridEntities.push(sLine);
      this.structuralEntities.push(sLine);

      const nLine = this.viewer.entities.add({
        polyline: {
          positions: [localToWorld(vx, this.maxY, 0), localToWorld(vx, this.maxY, -hz)],
          width: 1.0,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.0, 0.55, 0.80, 0.12)),
        },
        properties: { regionId: this.definition.id },
      });
      this.verticalGridEntities.push(nLine);
      this.structuralEntities.push(nLine);
    }

    // West wall (x = minX) & East wall (x = maxX)
    for (let k = 1; k <= 2; k++) {
      const vy = this.minY + k * yStep;

      const wLine = this.viewer.entities.add({
        polyline: {
          positions: [localToWorld(this.minX, vy, 0), localToWorld(this.minX, vy, -hz)],
          width: 1.0,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.0, 0.55, 0.80, 0.12)),
        },
        properties: { regionId: this.definition.id },
      });
      this.verticalGridEntities.push(wLine);
      this.structuralEntities.push(wLine);

      const eLine = this.viewer.entities.add({
        polyline: {
          positions: [localToWorld(this.maxX, vy, 0), localToWorld(this.maxX, vy, -hz)],
          width: 1.0,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.0, 0.55, 0.80, 0.12)),
        },
        properties: { regionId: this.definition.id },
      });
      this.verticalGridEntities.push(eLine);
      this.structuralEntities.push(eLine);
    }

    // 5. Horizontal Reference Depth Guides & Stratum Milestone Labels
    for (const d of this.referenceDepths) {
      const perimeter = this.getPerimeterAtDepth(d);
      const isBoundary = d === 0 || d === this.definition.depthMax;
      const isMajor = this.majorDepths.has(d);

      const guide = this.viewer.entities.add({
        polyline: {
          positions: perimeter,
          width: isBoundary ? 1.5 : isMajor ? 1.2 : 1.0,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.ColorMaterialProperty(
            isBoundary
              ? new Cesium.Color(0.0, 0.75, 0.95, 0.38)
              : isMajor
              ? new Cesium.Color(0.0, 0.65, 0.88, 0.22)
              : new Cesium.Color(0.0, 0.50, 0.75, 0.10)
          ),
        },
        properties: { regionId: this.definition.id },
      });
      this.depthWireframeEntities.push(guide);
      this.structuralEntities.push(guide);

      // Depth milestone tick label on NW corner
      if (isMajor) {
        const nwCorner = this.getCornersAtDepth(d)[3];
        const depthLabel = this.viewer.entities.add({
          position: nwCorner,
          label: {
            text: `-${d}m`,
            font: '10px JetBrains Mono, monospace',
            style: Cesium.LabelStyle.FILL,
            fillColor: new Cesium.Color(0.0, 0.70, 0.90, 0.40),
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            horizontalOrigin: Cesium.HorizontalOrigin.RIGHT,
            pixelOffset: new Cesium.Cartesian2(-10, 0),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          properties: { regionId: this.definition.id },
        });
        this.depthLabelEntities.push(depthLabel);
        this.structuralEntities.push(depthLabel);
      }
    }

    // 6. Selected Depth Slice Horizontal Plane & Crosshair Grid
    const sliceCorners = this.getCornersAtDepth(this.currentDepth);
    const slicePerimeter = this.getPerimeterAtDepth(this.currentDepth);
    const crosshairs = this.getCrosshairsAtDepth(this.currentDepth);

    this.slicePolygon = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(sliceCorners),
        material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.0, 0.80, 1.0, 0.08)),
        perPositionHeight: true,
      },
      properties: { regionId: this.definition.id },
    });
    this.structuralEntities.push(this.slicePolygon);

    this.slicePolyline = this.viewer.entities.add({
      polyline: {
        positions: slicePerimeter,
        width: 1.5,
        arcType: Cesium.ArcType.NONE,
        material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.0, 0.75, 0.95, 0.35)),
      },
      properties: { regionId: this.definition.id },
    });
    this.structuralEntities.push(this.slicePolyline);

    this.sliceCrosshairX = this.viewer.entities.add({
      polyline: {
        positions: crosshairs.lineX,
        width: 1.0,
        arcType: Cesium.ArcType.NONE,
        material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.0, 0.80, 1.0, 0.18)),
      },
      properties: { regionId: this.definition.id },
    });
    this.structuralEntities.push(this.sliceCrosshairX);

    this.sliceCrosshairY = this.viewer.entities.add({
      polyline: {
        positions: crosshairs.lineY,
        width: 1.0,
        arcType: Cesium.ArcType.NONE,
        material: new Cesium.ColorMaterialProperty(new Cesium.Color(0.0, 0.80, 1.0, 0.18)),
      },
      properties: { regionId: this.definition.id },
    });
    this.structuralEntities.push(this.sliceCrosshairY);

    // 7. 3D Region Name & Depth Banner
    const normZ = this.currentDepth / this.definition.depthMax;
    const cz = -normZ * UW_DIMENSIONS.totalDepthZ;

    this.boxLabel = this.viewer.entities.add({
      position: localToWorld(this.cx, this.cy, cz + 10000),
      label: {
        text: `${this.definition.name.toUpperCase()}  |  ${Math.round(this.currentDepth)}m`,
        font: 'bold 11px JetBrains Mono, monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: new Cesium.Color(0.0, 0.80, 1.0, 0.60),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.CENTER,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      properties: { regionId: this.definition.id },
    });
    this.structuralEntities.push(this.boxLabel);

    this.updateVisualStyles();
    this.setVisible(this.isVisible);
  }

  public clearData(): void {
    if (this.isDestroyed || this.viewer.isDestroyed()) return;
    try {
      if (!this.pointCollection.isDestroyed()) {
        this.pointCollection.removeAll();
      }
    } catch {}
    this.pointRecords = [];
    for (const e of this.currentVectorEntities) {
      this.viewer.entities.remove(e);
    }
    this.currentVectorEntities = [];
  }

  /**
   * Ingests decoupled region data from the backend data service
   */
  public setData(data: UnderwaterRegionData): void {
    if (this.isDestroyed || this.viewer.isDestroyed()) return;
    if (this.pointCollection.isDestroyed()) return;

    this.currentDepth = data.depth;
    this.currentVariable = data.variable;

    // 1. Rebuild data points
    this.pointCollection.removeAll();
    this.pointRecords = [];

    for (const pt of data.points) {
      const position = geoToWorld(pt.longitude, pt.latitude, pt.depth);
      const color = this.getColor(pt.temperature, pt.salinity, pt.value, this.currentVariable, 0.95);

      const p = this.pointCollection.add({
        position,
        pixelSize: 5,
        color,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        show: this.isVisible,
      });

      this.pointRecords.push({
        primitive: p,
        depth: pt.depth,
        temperature: pt.temperature,
        salinity: pt.salinity,
        value: pt.value,
      });
    }

    // 2. Rebuild current vector arrows on slice
    for (const e of this.currentVectorEntities) {
      this.viewer.entities.remove(e);
    }
    this.currentVectorEntities = [];

    const normZ = this.currentDepth / this.definition.depthMax;
    const cz = -normZ * UW_DIMENSIONS.totalDepthZ;

    for (const cv of data.currents) {
      const len = this.isActive
        ? Math.max(24000, Math.min(46000, 28000 * cv.speed))
        : Math.max(14000, Math.min(28000, 18000 * cv.speed));

      const headLen = len * 0.35;
      const headAngle = Math.PI / 6;

      // In local coordinates:
      const normX = (cv.longitude - UW_BOUNDS.centerLon) / (UW_BOUNDS.maxLon - UW_BOUNDS.centerLon);
      const normY = (cv.latitude - UW_BOUNDS.centerLat) / (UW_BOUNDS.maxLat - UW_BOUNDS.centerLat);
      const cx = normX * UW_DIMENSIONS.halfWidthX;
      const cy = normY * UW_DIMENSIONS.halfLengthY;

      const tipX = cx + Math.cos(cv.angle) * len;
      const tipY = cy + Math.sin(cv.angle) * len;

      const leftX = tipX - Math.cos(cv.angle - headAngle) * headLen;
      const leftY = tipY - Math.sin(cv.angle - headAngle) * headLen;

      const rightX = tipX - Math.cos(cv.angle + headAngle) * headLen;
      const rightY = tipY - Math.sin(cv.angle + headAngle) * headLen;

      const arrowPositions = [
        localToWorld(cx, cy, cz),
        localToWorld(tipX, tipY, cz),
        localToWorld(leftX, leftY, cz),
        localToWorld(tipX, tipY, cz),
        localToWorld(rightX, rightY, cz),
      ];

      const arrowColor = this.isActive
        ? new Cesium.Color(0.20, 1.0, 0.75, 0.95)
        : new Cesium.Color(0.10, 0.55, 0.45, 0.22);

      const arrow = this.viewer.entities.add({
        polyline: {
          positions: arrowPositions,
          width: this.isActive ? 2.0 : 1.0,
          arcType: Cesium.ArcType.NONE,
          material: new Cesium.ColorMaterialProperty(arrowColor),
          depthFailMaterial: new Cesium.ColorMaterialProperty(arrowColor),
        },
        properties: { regionId: this.definition.id },
      });
      arrow.show = this.isVisible;
      this.currentVectorEntities.push(arrow);
    }

    this.updatePointStyles();
  }

  public setDepth(depth: number): void {
    this.currentDepth = Math.max(0, Math.min(this.definition.depthMax, depth));

    const sliceCorners = this.getCornersAtDepth(this.currentDepth);
    const slicePerimeter = this.getPerimeterAtDepth(this.currentDepth);
    const crosshairs = this.getCrosshairsAtDepth(this.currentDepth);

    if (this.slicePolygon && this.slicePolygon.polygon) {
      this.slicePolygon.polygon.hierarchy = new Cesium.ConstantProperty(
        new Cesium.PolygonHierarchy(sliceCorners)
      );
    }

    if (this.slicePolyline && this.slicePolyline.polyline) {
      this.slicePolyline.polyline.positions = new Cesium.ConstantProperty(slicePerimeter);
    }

    if (this.sliceCrosshairX && this.sliceCrosshairX.polyline) {
      this.sliceCrosshairX.polyline.positions = new Cesium.ConstantProperty(crosshairs.lineX);
    }

    if (this.sliceCrosshairY && this.sliceCrosshairY.polyline) {
      this.sliceCrosshairY.polyline.positions = new Cesium.ConstantProperty(crosshairs.lineY);
    }

    if (this.boxLabel) {
      const normZ = this.currentDepth / this.definition.depthMax;
      const cz = -normZ * UW_DIMENSIONS.totalDepthZ;
      this.boxLabel.position = new Cesium.ConstantPositionProperty(
        localToWorld(this.cx, this.cy, cz + 10000)
      );
      if (this.boxLabel.label) {
        const prefix = this.isActive ? '● ' : this.isHovered ? '▷ ' : '';
        const suffix = this.isActive ? ' [ACTIVE]' : '';
        this.boxLabel.label.text = new Cesium.ConstantProperty(
          `${prefix}${this.definition.name.toUpperCase()}${suffix}  |  ${Math.round(this.currentDepth)}m`
        );
      }
    }

    this.updatePointStyles();
  }

  public setActive(isActive: boolean): void {
    if (this.isActive === isActive) return;
    this.isActive = isActive;
    this.updateVisualStyles();
    this.updatePointStyles();
  }

  public setHovered(isHovered: boolean): void {
    if (this.isHovered === isHovered) return;
    this.isHovered = isHovered;
    if (!this.isActive) {
      this.updateVisualStyles();
    }
  }

  private updateVisualStyles(): void {
    if (this.isActive) {
      // ACTIVE BOX: Vivid, glowing boundary, illuminated slice
      if (this.slicePolygon && this.slicePolygon.polygon) {
        this.slicePolygon.polygon.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.85, 1.0, 0.24)
        );
      }
      if (this.slicePolyline && this.slicePolyline.polyline) {
        this.slicePolyline.polyline.width = new Cesium.ConstantProperty(3.5);
        this.slicePolyline.polyline.material = new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.28,
          color: new Cesium.Color(0.0, 0.98, 1.0, 0.98),
        });
      }
      if (this.sliceCrosshairX && this.sliceCrosshairX.polyline) {
        this.sliceCrosshairX.polyline.width = new Cesium.ConstantProperty(1.2);
        this.sliceCrosshairX.polyline.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.90, 1.0, 0.35)
        );
      }
      if (this.sliceCrosshairY && this.sliceCrosshairY.polyline) {
        this.sliceCrosshairY.polyline.width = new Cesium.ConstantProperty(1.2);
        this.sliceCrosshairY.polyline.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.90, 1.0, 0.35)
        );
      }
      for (const vg of this.verticalGridEntities) {
        if (vg.polyline) {
          vg.polyline.width = new Cesium.ConstantProperty(1.0);
          vg.polyline.material = new Cesium.ColorMaterialProperty(
            new Cesium.Color(0.0, 0.70, 0.95, 0.18)
          );
        }
      }
      for (const col of this.columnEntities) {
        if (col.polyline) {
          col.polyline.width = new Cesium.ConstantProperty(2.2);
          col.polyline.material = new Cesium.ColorMaterialProperty(
            new Cesium.Color(0.0, 0.85, 1.0, 0.70)
          );
        }
      }
      for (const wall of this.wallEntities) {
        if (wall.polygon) {
          wall.polygon.material = new Cesium.ColorMaterialProperty(
            new Cesium.Color(0.015, 0.08, 0.18, 0.18)
          );
        }
      }
      if (this.boxLabel && this.boxLabel.label) {
        this.boxLabel.label.text = new Cesium.ConstantProperty(
          `● ${this.definition.name.toUpperCase()} [ACTIVE]  |  ${Math.round(this.currentDepth)}m`
        );
        this.boxLabel.label.font = new Cesium.ConstantProperty(
          'bold 12px JetBrains Mono, monospace'
        );
        this.boxLabel.label.fillColor = new Cesium.ConstantProperty(
          new Cesium.Color(0.0, 1.0, 1.0, 0.98)
        );
      }
      for (const cv of this.currentVectorEntities) {
        if (cv.polyline) {
          cv.polyline.width = new Cesium.ConstantProperty(2.0);
          cv.polyline.material = new Cesium.ColorMaterialProperty(
            new Cesium.Color(0.20, 1.0, 0.75, 0.95)
          );
        }
      }
    } else if (this.isHovered) {
      // HOVERED BOX: Subtle highlight outline
      if (this.slicePolygon && this.slicePolygon.polygon) {
        this.slicePolygon.polygon.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.70, 0.90, 0.12)
        );
      }
      if (this.slicePolyline && this.slicePolyline.polyline) {
        this.slicePolyline.polyline.width = new Cesium.ConstantProperty(2.2);
        this.slicePolyline.polyline.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.85, 1.0, 0.75)
        );
      }
      if (this.sliceCrosshairX && this.sliceCrosshairX.polyline) {
        this.sliceCrosshairX.polyline.width = new Cesium.ConstantProperty(1.0);
        this.sliceCrosshairX.polyline.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.75, 0.95, 0.22)
        );
      }
      if (this.sliceCrosshairY && this.sliceCrosshairY.polyline) {
        this.sliceCrosshairY.polyline.width = new Cesium.ConstantProperty(1.0);
        this.sliceCrosshairY.polyline.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.75, 0.95, 0.22)
        );
      }
      for (const vg of this.verticalGridEntities) {
        if (vg.polyline) {
          vg.polyline.width = new Cesium.ConstantProperty(1.0);
          vg.polyline.material = new Cesium.ColorMaterialProperty(
            new Cesium.Color(0.0, 0.60, 0.85, 0.12)
          );
        }
      }
      if (this.boxLabel && this.boxLabel.label) {
        this.boxLabel.label.text = new Cesium.ConstantProperty(
          `▷ ${this.definition.name.toUpperCase()}  |  ${Math.round(this.currentDepth)}m`
        );
        this.boxLabel.label.font = new Cesium.ConstantProperty(
          '11px JetBrains Mono, monospace'
        );
        this.boxLabel.label.fillColor = new Cesium.ConstantProperty(
          new Cesium.Color(0.40, 0.90, 1.0, 0.90)
        );
      }
    } else {
      // SUBDUED BOX (~20-30% context): Faint lines and transparent body
      if (this.slicePolygon && this.slicePolygon.polygon) {
        this.slicePolygon.polygon.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.010, 0.055, 0.13, 0.04)
        );
      }
      if (this.slicePolyline && this.slicePolyline.polyline) {
        this.slicePolyline.polyline.width = new Cesium.ConstantProperty(1.0);
        this.slicePolyline.polyline.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.55, 0.80, 0.20)
        );
      }
      if (this.sliceCrosshairX && this.sliceCrosshairX.polyline) {
        this.sliceCrosshairX.polyline.width = new Cesium.ConstantProperty(1.0);
        this.sliceCrosshairX.polyline.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.50, 0.75, 0.08)
        );
      }
      if (this.sliceCrosshairY && this.sliceCrosshairY.polyline) {
        this.sliceCrosshairY.polyline.width = new Cesium.ConstantProperty(1.0);
        this.sliceCrosshairY.polyline.material = new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.50, 0.75, 0.08)
        );
      }
      for (const vg of this.verticalGridEntities) {
        if (vg.polyline) {
          vg.polyline.width = new Cesium.ConstantProperty(1.0);
          vg.polyline.material = new Cesium.ColorMaterialProperty(
            new Cesium.Color(0.0, 0.45, 0.70, 0.06)
          );
        }
      }
      for (const col of this.columnEntities) {
        if (col.polyline) {
          col.polyline.width = new Cesium.ConstantProperty(1.0);
          col.polyline.material = new Cesium.ColorMaterialProperty(
            new Cesium.Color(0.0, 0.50, 0.75, 0.20)
          );
        }
      }
      for (const wall of this.wallEntities) {
        if (wall.polygon) {
          wall.polygon.material = new Cesium.ColorMaterialProperty(
            new Cesium.Color(0.008, 0.04, 0.10, 0.05)
          );
        }
      }
      if (this.boxLabel && this.boxLabel.label) {
        this.boxLabel.label.text = new Cesium.ConstantProperty(
          `${this.definition.name.toUpperCase()}  |  ${Math.round(this.currentDepth)}m`
        );
        this.boxLabel.label.font = new Cesium.ConstantProperty(
          '10px JetBrains Mono, monospace'
        );
        this.boxLabel.label.fillColor = new Cesium.ConstantProperty(
          new Cesium.Color(0.0, 0.65, 0.85, 0.35)
        );
      }
      for (const cv of this.currentVectorEntities) {
        if (cv.polyline) {
          cv.polyline.width = new Cesium.ConstantProperty(1.0);
          cv.polyline.material = new Cesium.ColorMaterialProperty(
            new Cesium.Color(0.10, 0.55, 0.45, 0.22)
          );
        }
      }
    }
  }

  private updatePointStyles(): void {
    const tolerance = 40;
    const falloff = 110;

    for (const pr of this.pointRecords) {
      const diff = Math.abs(pr.depth - this.currentDepth);

      if (this.isActive) {
        // ACTIVE BOX: High-contrast, bright points
        if (diff <= tolerance) {
          pr.primitive.show = true;
          const proximity = 1.0 - (diff / tolerance) * 0.15;
          pr.primitive.pixelSize = 10 + (1.0 - diff / tolerance) * 3;
          pr.primitive.color = this.getColor(pr.temperature, pr.salinity, pr.value, this.currentVariable, proximity);
        } else if (diff <= falloff) {
          pr.primitive.show = true;
          const fade = (1.0 - (diff - tolerance) / (falloff - tolerance)) * 0.40;
          pr.primitive.pixelSize = 5;
          pr.primitive.color = this.getColor(pr.temperature, pr.salinity, pr.value, this.currentVariable, Math.max(0.08, fade));
        } else {
          pr.primitive.show = false;
        }
      } else {
        // SUBDUED BOX: Dimmed to ~20-25% opacity
        if (diff <= tolerance) {
          pr.primitive.show = true;
          pr.primitive.pixelSize = 5;
          pr.primitive.color = this.getColor(pr.temperature, pr.salinity, pr.value, this.currentVariable, 0.22);
        } else if (diff <= falloff) {
          pr.primitive.show = true;
          pr.primitive.pixelSize = 3;
          pr.primitive.color = this.getColor(pr.temperature, pr.salinity, pr.value, this.currentVariable, 0.08);
        } else {
          pr.primitive.show = false;
        }
      }
    }
  }

  private getColor(
    temp: number,
    sal: number,
    _val: number,
    variable: OceanVariable,
    alpha: number
  ): Cesium.Color {
    if (variable === 'salinity') {
      const norm = Math.min(1.0, Math.max(0.0, (sal - 32.0) / 6.0));
      const hue = (1.0 - norm) * 200.0 + 40.0;
      return Cesium.Color.fromHsl(hue / 360.0, 0.95, 0.52, alpha);
    } else {
      const norm = Math.min(1.0, Math.max(0.0, (temp - 2.0) / 28.0));
      const hue = (1.0 - norm) * 240.0;
      return Cesium.Color.fromHsl(hue / 360.0, 0.95, 0.52, alpha);
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    for (const e of this.structuralEntities) {
      e.show = visible;
    }
    for (const cv of this.currentVectorEntities) {
      cv.show = visible;
    }
    this.pointCollection.show = visible;
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (!this.viewer.isDestroyed()) {
      for (const e of this.structuralEntities) {
        this.viewer.entities.remove(e);
      }
      for (const cv of this.currentVectorEntities) {
        this.viewer.entities.remove(cv);
      }
      try {
        if (!this.pointCollection.isDestroyed()) {
          this.viewer.scene.primitives.remove(this.pointCollection);
        }
      } catch (err) {
        console.warn('Point collection remove warning:', err);
      }
    }
    this.structuralEntities = [];
    this.currentVectorEntities = [];
    this.pointRecords = [];
  }
}
