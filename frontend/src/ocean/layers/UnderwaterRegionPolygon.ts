import * as Cesium from 'cesium';

import {
  UW_BOUNDS,
  UW_DIMENSIONS,
  geoToWorld,
} from '../utils/underwaterCoords';

import { OceanState } from '../OceanState';

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

  public readonly minX: number;
  public readonly maxX: number;
  public readonly minY: number;
  public readonly maxY: number;
  public readonly cx: number;
  public readonly cy: number;

  private currentDepth = 0;
  private currentVariable: OceanVariable = 'temperature';

  public getCurrentDepth(): number {
    return this.currentDepth;
  }

  private isActive = false;
  private isHovered = false;
  private isVisible = false;
  private isDestroyed = false;

  // Surface boundary entity (preserves sea outline boundary layer)
  private boundaryEntity: Cesium.Entity | null = null;
  private surfaceFillEntity: Cesium.Entity | null = null;

  // In-situ observation point collection
  private pointCollection: Cesium.PointPrimitiveCollection;
  private pointRecords: PointRecord[] = [];

  constructor(
    viewer: Cesium.Viewer,
    definition: UnderwaterRegionDefinition,
  ) {
    this.viewer = viewer;
    this.definition = definition;

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

    this.minX = normMinX * UW_DIMENSIONS.halfWidthX;
    this.maxX = normMaxX * UW_DIMENSIONS.halfWidthX;
    this.minY = normMinY * UW_DIMENSIONS.halfLengthY;
    this.maxY = normMaxY * UW_DIMENSIONS.halfLengthY;

    this.cx = (this.minX + this.maxX) / 2;
    this.cy = (this.minY + this.maxY) / 2;

    this.pointCollection = new Cesium.PointPrimitiveCollection();
    this.viewer.scene.primitives.add(this.pointCollection);

    this.initBoundaryEntities();
  }

  private getRegionColor(): Cesium.Color {
    switch (this.definition.id) {
      case 'arabian-sea':
        return Cesium.Color.fromCssColorString('#00f0ff');
      case 'bay-of-bengal':
        return Cesium.Color.fromCssColorString('#3b82f6');
      case 'andaman-sea':
        return Cesium.Color.fromCssColorString('#a855f7');
      case 'laccadive-sea':
        return Cesium.Color.fromCssColorString('#10b981');
      case 'java-sea':
        return Cesium.Color.fromCssColorString('#f59e0b');
      case 'southern-ocean':
        return Cesium.Color.fromCssColorString('#38bdf8');
      case 'indian-ocean':
      default:
        return Cesium.Color.fromCssColorString('#00e5ff');
    }
  }

  private initBoundaryEntities(): void {
    if (this.definition.footprint.length < 3) return;

    const positions = this.definition.footprint.map(([lon, lat]) =>
      geoToWorld(lon, lat, 0)
    );
    positions.push(positions[0]);

    const color = this.getRegionColor();

    // Distinct Surface Boundary Layer Polyline
    this.boundaryEntity = this.viewer.entities.add({
      polyline: {
        positions,
        width: 2.5,
        arcType: Cesium.ArcType.NONE,
        material: new Cesium.ColorMaterialProperty(color.withAlpha(0.85)),
      },
      properties: {
        regionId: this.definition.id,
      },
    });
    this.boundaryEntity.show = false;

    // Subtle Surface Fill for Picking / Interaction
    this.surfaceFillEntity = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions),
        material: new Cesium.ColorMaterialProperty(color.withAlpha(0.04)),
        perPositionHeight: true,
      },
      properties: {
        regionId: this.definition.id,
      },
    });
    this.surfaceFillEntity.show = false;
  }

  public setData(data: UnderwaterRegionData): void {
    if (this.isDestroyed || this.viewer.isDestroyed()) return;

    this.currentVariable = data.variable;
    this.currentDepth = data.depth;

    this.pointCollection.removeAll();
    this.pointRecords = [];

    const state = OceanState.getInstance();

    for (const pt of data.points) {
      const worldPos = geoToWorld(pt.longitude, pt.latitude, pt.depth);
      const cesiumColor = state.getCesiumColorForVariable(this.currentVariable, pt.value);

      const primitive = this.pointCollection.add({
        position: worldPos,
        pixelSize: 4.5,
        color: cesiumColor,
        outlineColor: Cesium.Color.BLACK.withAlpha(0.6),
        outlineWidth: 1.0,
      });

      this.pointRecords.push({
        primitive,
        depth: pt.depth,
        temperature: pt.temperature,
        salinity: pt.salinity,
        value: pt.value,
      });
    }
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.boundaryEntity) this.boundaryEntity.show = visible;
    if (this.surfaceFillEntity) this.surfaceFillEntity.show = visible;
    this.pointCollection.show = visible;
  }

  public getIsVisible(): boolean {
    return this.isVisible;
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    const color = this.getRegionColor();

    if (this.boundaryEntity?.polyline) {
      this.boundaryEntity.polyline.width = new Cesium.ConstantProperty(active ? 3.5 : 2.2);
      this.boundaryEntity.polyline.material = new Cesium.ColorMaterialProperty(
        color.withAlpha(active ? 1.0 : 0.75)
      );
    }

    if (this.surfaceFillEntity?.polygon) {
      this.surfaceFillEntity.polygon.material = new Cesium.ColorMaterialProperty(
        color.withAlpha(active ? 0.08 : 0.03)
      );
    }
  }

  public setHovered(hovered: boolean): void {
    if (this.isHovered === hovered) return;
    this.isHovered = hovered;

    if (!this.isActive && this.surfaceFillEntity?.polygon) {
      const color = this.getRegionColor();
      this.surfaceFillEntity.polygon.material = new Cesium.ColorMaterialProperty(
        color.withAlpha(hovered ? 0.12 : 0.04)
      );
    }
  }

  public setDepth(depth: number): void {
    this.currentDepth = depth;
    // Highlight points near current depth
    for (const record of this.pointRecords) {
      const dist = Math.abs(record.depth - depth);
      if (dist < 50) {
        record.primitive.pixelSize = 6.0;
      } else {
        record.primitive.pixelSize = 4.0;
      }
    }
  }

  public reapplyColors(): void {
    const state = OceanState.getInstance();
    for (const record of this.pointRecords) {
      record.primitive.color = state.getCesiumColorForVariable(this.currentVariable, record.value);
    }
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.boundaryEntity) {
      this.viewer.entities.remove(this.boundaryEntity);
      this.boundaryEntity = null;
    }

    if (this.surfaceFillEntity) {
      this.viewer.entities.remove(this.surfaceFillEntity);
      this.surfaceFillEntity = null;
    }

    this.viewer.scene.primitives.remove(this.pointCollection);
    this.pointRecords = [];
  }
}
