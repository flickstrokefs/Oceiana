import * as Cesium from 'cesium';

import {
  UW_BOUNDS,
  UW_DIMENSIONS,
  geoToWorld,
} from '../utils/underwaterCoords';

import { OceanState } from '../OceanState';

import {
  OCEAN_REGIONS,
  type UnderwaterRegionDefinition,
  type UnderwaterRegionData,
  type OceanVariable,
} from '../../types/ocean';

interface PointRecord {
  primitive: Cesium.PointPrimitive;
  depth: number;
  temperature: number;
  salinity: number;
  value: number;
}

function isPointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
  let inside = false;
  const n = poly.length;
  let j = n - 1;
  for (let i = 0; i < n; i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
    j = i;
  }
  return inside;
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

  // 2D geographic grid clipped to actual IHO boundary
  private gridPolylines: Cesium.PolylineCollection | null = null;

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
    this.initClipped2DGrid();
  }

  public getRegionColor(): Cesium.Color {
    // ARIEL Scientific Sunset / Artistic Oceanography palette
    switch (this.definition.id) {
      case 'arabian-sea':
        return Cesium.Color.fromCssColorString('#0284c7'); // Scientific ocean blue
      case 'bay-of-bengal':
        return Cesium.Color.fromCssColorString('#2563eb'); // Deep marine blue
      case 'andaman-sea':
        return Cesium.Color.fromCssColorString('#0d9488'); // Artistic seafoam teal
      case 'laccadive-sea':
        return Cesium.Color.fromCssColorString('#059669'); // Muted sage emerald
      case 'java-sea':
        return Cesium.Color.fromCssColorString('#d97706'); // Warm scientific amber
      case 'southern-ocean':
        return Cesium.Color.fromCssColorString('#0284c7'); // Antarctic ice blue
      case 'indian-ocean':
      default:
        return Cesium.Color.fromCssColorString('#c2410c'); // Coral scientific accent
    }
  }

  private initBoundaryEntities(): void {
    if (this.definition.footprint.length < 3) return;

    const positions = this.definition.footprint.map(([lon, lat]) =>
      geoToWorld(lon, lat, 20)
    );
    positions.push(positions[0]);

    const color = this.getRegionColor();

    // Prominent IHO Boundary Polyline (actual irregular coastline & maritime boundary)
    this.boundaryEntity = this.viewer.entities.add({
      polyline: {
        positions,
        width: 2.8,
        arcType: Cesium.ArcType.NONE,
        material: new Cesium.ColorMaterialProperty(color.withAlpha(0.9)),
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

  /**
   * Generates a scientific 2D geographic grid clipped strictly to the actual IHO polygon.
   * Uses scanline edge-intersection clipping: no grid lines ever appear outside the water body.
   */
  private initClipped2DGrid(): void {
    const footprint = this.definition.footprint;
    if (footprint.length < 3) return;

    const regionCfg = OCEAN_REGIONS[this.definition.id];
    const nx = regionCfg?.grid.x ?? 40;
    const ny = regionCfg?.grid.y ?? 40;

    const minLon = this.definition.west;
    const maxLon = this.definition.east;
    const minLat = this.definition.south;
    const maxLat = this.definition.north;

    const dLon = (maxLon - minLon) / nx;
    const dLat = (maxLat - minLat) / ny;

    this.gridPolylines = new Cesium.PolylineCollection();
    this.viewer.scene.primitives.add(this.gridPolylines);

    const baseColor = this.getRegionColor();
    // Warm scientific grid material
    const gridMaterial = Cesium.Material.fromType('Color', {
      color: baseColor.withAlpha(0.32),
    });

    const segments: [[number, number], [number, number]][] = [];

    // 1. Vertical meridian grid lines (Longitude)
    for (let ix = 1; ix < nx; ix++) {
      const lon = minLon + ix * dLon;
      const yIntersects: number[] = [];

      for (let i = 0; i < footprint.length - 1; i++) {
        const x1 = footprint[i][0];
        const y1 = footprint[i][1];
        const x2 = footprint[i + 1][0];
        const y2 = footprint[i + 1][1];

        if ((x1 <= lon && x2 >= lon) || (x2 <= lon && x1 >= lon)) {
          if (x1 !== x2) {
            const y = y1 + ((lon - x1) * (y2 - y1)) / (x2 - x1);
            yIntersects.push(y);
          }
        }
      }

      yIntersects.sort((a, b) => a - b);
      for (let k = 0; k < yIntersects.length - 1; k += 2) {
        const y0 = yIntersects[k];
        const y1 = yIntersects[k + 1];
        if (isPointInPolygon(lon, (y0 + y1) / 2, footprint)) {
          segments.push([
            [lon, y0],
            [lon, y1],
          ]);
        }
      }
    }

    // 2. Horizontal parallel grid lines (Latitude)
    for (let iy = 1; iy < ny; iy++) {
      const lat = minLat + iy * dLat;
      const xIntersects: number[] = [];

      for (let i = 0; i < footprint.length - 1; i++) {
        const x1 = footprint[i][0];
        const y1 = footprint[i][1];
        const x2 = footprint[i + 1][0];
        const y2 = footprint[i + 1][1];

        if ((y1 <= lat && y2 >= lat) || (y2 <= lat && y1 >= lat)) {
          if (y1 !== y2) {
            const x = x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1);
            xIntersects.push(x);
          }
        }
      }

      xIntersects.sort((a, b) => a - b);
      for (let k = 0; k < xIntersects.length - 1; k += 2) {
        const x0 = xIntersects[k];
        const x1 = xIntersects[k + 1];
        if (isPointInPolygon((x0 + x1) / 2, lat, footprint)) {
          segments.push([
            [x0, lat],
            [x1, lat],
          ]);
        }
      }
    }

    // Add clipped segments to the Cesium PolylineCollection
    for (const seg of segments) {
      const p1 = geoToWorld(seg[0][0], seg[0][1], 15);
      const p2 = geoToWorld(seg[1][0], seg[1][1], 15);

      this.gridPolylines.add({
        positions: [p1, p2],
        width: 1.1,
        material: gridMaterial,
      });
    }

    this.gridPolylines.show = false;
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
    if (this.gridPolylines) this.gridPolylines.show = visible;
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

    if (this.boundaryEntity && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.boundaryEntity);
      this.boundaryEntity = null;
    }

    if (this.surfaceFillEntity && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.surfaceFillEntity);
      this.surfaceFillEntity = null;
    }

    if (this.gridPolylines && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.gridPolylines);
      this.gridPolylines = null;
    }

    if (!this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.pointCollection);
    }
    this.pointRecords = [];
  }
}
