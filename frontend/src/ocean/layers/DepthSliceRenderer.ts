import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';
import type { OceanVariable, OceanMode } from '../../types/ocean';

export interface DepthSliceConfig {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
  resolution: number;
}

export class DepthSliceRenderer {
  private viewer: Cesium.Viewer;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private minLat = -30.0;
  private maxLat = 30.0;
  private minLon = 35.0;
  private maxLon = 110.0;
  private resolution = 128;

  // Surface mode imagery layer
  private surfaceImageryLayer: Cesium.ImageryLayer | null = null;

  // Underwater 3D depth slice entity (positioned at z = -depth)
  private depthSliceEntity: Cesium.Entity | null = null;
  private depthBorderEntity: Cesium.Entity | null = null;
  private depthLabelEntity: Cesium.Entity | null = null;

  private activeVariable: OceanVariable = 'temperature';
  private currentMode: OceanMode = 'surface';
  private currentDepth = 0;
  private isUpdating = false;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.resolution;
    this.canvas.height = this.resolution;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;

    this.init3DDepthSlice();
    this.update();
  }

  private init3DDepthSlice(): void {
    // 1. Horizontal 3D Depth Slice Polygon positioned in the water column at -depth
    this.depthSliceEntity = this.viewer.entities.add({
      name: 'Ocean Depth Stratum Slice',
      show: false,
      polygon: {
        hierarchy: new Cesium.ConstantProperty(
          new Cesium.PolygonHierarchy(
            Cesium.Cartesian3.fromDegreesArray([
              this.minLon, this.minLat,
              this.maxLon, this.minLat,
              this.maxLon, this.maxLat,
              this.minLon, this.maxLat,
            ])
          )
        ),
        height: new Cesium.CallbackProperty(() => -this.currentDepth, false),
        material: new Cesium.ImageMaterialProperty({
          image: new Cesium.CallbackProperty(() => this.canvas, false),
          transparent: true,
          color: new Cesium.CallbackProperty(() => {
            const alpha = this.currentMode === 'underwater' ? 0.85 : 0.0;
            return new Cesium.Color(1.0, 1.0, 1.0, alpha);
          }, false),
        }),
      },
    });

    // 2. Glowing bounding frame for spatial depth orientation
    this.depthBorderEntity = this.viewer.entities.add({
      name: 'Depth Stratum Frame',
      show: false,
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const z = -this.currentDepth;
          return Cesium.Cartesian3.fromDegreesArrayHeights([
            this.minLon, this.minLat, z,
            this.maxLon, this.minLat, z,
            this.maxLon, this.maxLat, z,
            this.minLon, this.maxLat, z,
            this.minLon, this.minLat, z,
          ]);
        }, false),
        width: 2.0,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.6),
        }),
      },
    });

    // 3. Floating depth badge at the edge of the slice
    this.depthLabelEntity = this.viewer.entities.add({
      name: 'Depth Stratum Indicator',
      show: false,
      position: new Cesium.CallbackPositionProperty(() => {
        return Cesium.Cartesian3.fromDegrees(this.maxLon, this.maxLat, -this.currentDepth);
      }, false),
      label: {
        text: new Cesium.CallbackProperty(() => {
          return `STRATUM: -${this.currentDepth}m (${this.activeVariable.toUpperCase()})`;
        }, false),
        font: '13px JetBrains Mono, monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString('#00f0ff'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10),
      },
    });
  }

  /**
   * Renders the scientific scalar field at the exact requested depth
   */
  private renderFieldToCanvas(variable: OceanVariable, depth: number): void {
    const oceanState = OceanState.getInstance();
    const imgData = this.ctx.createImageData(this.resolution, this.resolution);
    const data = imgData.data;

    for (let y = 0; y < this.resolution; y++) {
      const lat = this.maxLat - (y / this.resolution) * (this.maxLat - this.minLat);

      for (let x = 0; x < this.resolution; x++) {
        const lon = this.minLon + (x / this.resolution) * (this.maxLon - this.minLon);
        const idx = (y * this.resolution + x) * 4;

        // Sample field at physical 3D depth
        const sample = oceanState.sampleSpatialField(lat, lon, depth);

        let r = 0;
        let g = 0;
        let b = 0;
        let a = 180;

        if (variable === 'temperature') {
          const temp = sample.temperature;
          const normalized = Math.min(1.0, Math.max(0.0, (temp - 2.0) / 30.0));
          const hue = (1.0 - normalized) * 240.0;
          [r, g, b] = this.hslToRgb(hue / 360, 0.9, 0.5);
        } else if (variable === 'salinity') {
          const sal = sample.salinity;
          const norm = Math.min(1.0, Math.max(0.0, (sal - 28.0) / 10.0));
          r = Math.round(norm * 180);
          g = Math.round((1.0 - norm) * 220 + norm * 20);
          b = 255;
        } else if (variable === 'chlorophyll') {
          const chl = sample.chlorophyll;
          const norm = Math.min(1.0, Math.max(0.0, chl / 6.0));
          r = Math.round(norm * 20);
          g = Math.round(norm * 245 + (1.0 - norm) * 40);
          b = Math.round((1.0 - norm) * 200 + norm * 80);
          // Attenuate chlorophyll alpha below photic zone (>200m)
          if (depth > 200) {
            a = Math.max(40, Math.round(180 * Math.exp(-(depth - 200) / 300)));
          }
        } else {
          // Current variable magnitude
          const speed = Math.sqrt(
            sample.velocity.u * sample.velocity.u + sample.velocity.v * sample.velocity.v
          );
          const norm = Math.min(1.0, speed / 3.0);
          r = Math.round(norm * 255);
          g = Math.round(norm * 200 + (1 - norm) * 50);
          b = Math.round((1 - norm) * 255);
        }

        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = a;
      }
    }

    this.ctx.putImageData(imgData, 0, 0);
  }

  /**
   * Synchronizes the slice with active state
   */
  public async update(): Promise<void> {
    if (this.isUpdating || this.viewer.isDestroyed()) return;
    this.isUpdating = true;

    const snapshot = OceanState.getInstance().getSnapshot();
    this.activeVariable = snapshot.activeVariable;
    this.currentMode = snapshot.mode;
    this.currentDepth = snapshot.parameters.depth;

    try {
      // 1. Render scalar field evaluated at exact depth
      this.renderFieldToCanvas(this.activeVariable, this.currentDepth);

      if (this.currentMode === 'surface') {
        // Surface Mode: Show on globe surface imagery, hide 3D depth slice
        if (this.depthSliceEntity) this.depthSliceEntity.show = false;
        if (this.depthBorderEntity) this.depthBorderEntity.show = false;
        if (this.depthLabelEntity) this.depthLabelEntity.show = false;

        if (this.activeVariable !== 'current') {
          const rectangle = Cesium.Rectangle.fromDegrees(
            this.minLon,
            this.minLat,
            this.maxLon,
            this.maxLat
          );

          const providerPromise = Cesium.SingleTileImageryProvider.fromUrl(
            this.canvas.toDataURL(),
            { rectangle }
          );

          const newLayer = Cesium.ImageryLayer.fromProviderAsync(providerPromise);
          newLayer.alpha = 0.72;
          newLayer.show = true;

          const oldLayer = this.surfaceImageryLayer;
          this.surfaceImageryLayer = newLayer;
          this.viewer.imageryLayers.add(newLayer);

          if (oldLayer && !this.viewer.isDestroyed()) {
            this.viewer.imageryLayers.remove(oldLayer);
          }
        } else {
          if (this.surfaceImageryLayer && !this.viewer.isDestroyed()) {
            this.viewer.imageryLayers.remove(this.surfaceImageryLayer);
            this.surfaceImageryLayer = null;
          }
        }
      } else {
        // Underwater Mode: Remove surface imagery drape, display 3D depth slice in water column at -depth
        if (this.surfaceImageryLayer && !this.viewer.isDestroyed()) {
          this.viewer.imageryLayers.remove(this.surfaceImageryLayer);
          this.surfaceImageryLayer = null;
        }

        const isScalar = this.activeVariable !== 'current';
        if (this.depthSliceEntity) this.depthSliceEntity.show = isScalar;
        if (this.depthBorderEntity) this.depthBorderEntity.show = isScalar;
        if (this.depthLabelEntity) this.depthLabelEntity.show = isScalar;
      }
    } catch (err) {
      console.warn('DepthSliceRenderer update error:', err);
    } finally {
      this.isUpdating = false;
    }
  }

  public setVariable(variable: OceanVariable): void {
    this.activeVariable = variable;
    this.update();
  }

  public setMode(mode: OceanMode, depth: number): void {
    this.currentMode = mode;
    this.currentDepth = depth;
    this.update();
  }

  public setDepth(depth: number): void {
    this.currentDepth = depth;
    this.update();
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = this.hueToRgb(p, q, h + 1 / 3);
      g = this.hueToRgb(p, q, h);
      b = this.hueToRgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }

  private hueToRgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }

  public destroy(): void {
    if (this.surfaceImageryLayer && !this.viewer.isDestroyed()) {
      this.viewer.imageryLayers.remove(this.surfaceImageryLayer);
      this.surfaceImageryLayer = null;
    }
    if (this.depthSliceEntity && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.depthSliceEntity);
      this.depthSliceEntity = null;
    }
    if (this.depthBorderEntity && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.depthBorderEntity);
      this.depthBorderEntity = null;
    }
    if (this.depthLabelEntity && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.depthLabelEntity);
      this.depthLabelEntity = null;
    }
  }
}
