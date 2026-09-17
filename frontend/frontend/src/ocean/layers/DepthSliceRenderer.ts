import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';
import type { OceanVariable, OceanMode } from '../../types/ocean';

export class DepthSliceRenderer {
  private viewer: Cesium.Viewer;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // Ocean Analysis Boundary (Indian Ocean / Arabian Sea / Bay of Bengal)
  private minLat = -25.0;
  private maxLat = 28.0;
  private minLon = 38.0;
  private maxLon = 105.0;
  private resolution = 160;

  // Active Imagery Layer
  private activeImageryLayer: Cesium.ImageryLayer | null = null;

  // Underwater Depth-Analysis Frame & HUD Entities
  private stratumFrameEntity: Cesium.Entity | null = null;
  private stratumLabelEntity: Cesium.Entity | null = null;

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

    this.initStratumOverlayEntities();
    this.update();
  }

  private initStratumOverlayEntities(): void {
    // 1. Glowing boundary frame defining the ocean analysis area
    this.stratumFrameEntity = this.viewer.entities.add({
      name: 'Depth Stratum Frame',
      show: false,
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          this.minLon, this.minLat, 3000,
          this.maxLon, this.minLat, 3000,
          this.maxLon, this.maxLat, 3000,
          this.minLon, this.maxLat, 3000,
          this.minLon, this.minLat, 3000,
        ]),
        width: 2.5,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: Cesium.Color.fromCssColorString('#00f0ff').withAlpha(0.75),
        }),
      },
    });

    // 2. Corner HUD Datum Badge
    this.stratumLabelEntity = this.viewer.entities.add({
      name: 'Stratum HUD Indicator',
      show: false,
      position: Cesium.Cartesian3.fromDegrees(this.maxLon - 2.0, this.maxLat - 1.0, 5000),
      label: {
        text: new Cesium.CallbackProperty(() => {
          let layerType = 'EPIPELAGIC (SURFACE)';
          if (this.currentDepth > 1000) layerType = 'BATHYPELAGIC (ABYSSAL)';
          else if (this.currentDepth > 200) layerType = 'MESOPELAGIC (THERMOCLINE)';
          else if (this.currentDepth > 0) layerType = 'PHOTIC STRATUM';

          return `DEPTH SLICE: -${this.currentDepth}m // ${layerType}\nVARIABLE: ${this.activeVariable.toUpperCase()}`;
        }, false),
        font: 'bold 12px "JetBrains Mono", monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString('#00f0ff'),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 4,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        horizontalOrigin: Cesium.HorizontalOrigin.RIGHT,
        pixelOffset: new Cesium.Cartesian2(-10, 10),
      },
    });
  }

  /**
   * Scientific Colormapping & Spatial Field Generation evaluated at depth
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

        // Sample exact scientific field at (lat, lon, depth)
        const sample = oceanState.sampleSpatialField(lat, lon, depth);

        let r = 0;
        let g = 0;
        let b = 0;
        let a = 185;

        let scalar = sample.temperature;
        if (variable === 'salinity') {
          scalar = sample.salinity;
        } else if (variable === 'chlorophyll') {
          scalar = sample.chlorophyll;
        } else if (variable === 'oxygen') {
          scalar = sample.oxygen ?? 5.0;
        } else if (variable === 'current') {
          scalar = Math.sqrt(
            sample.velocity.u * sample.velocity.u + sample.velocity.v * sample.velocity.v
          );
        }

        const cesiumColor = oceanState.getCesiumColorForVariable(variable, scalar);
        r = Math.round(cesiumColor.red * 255);
        g = Math.round(cesiumColor.green * 255);
        b = Math.round(cesiumColor.blue * 255);

        if (variable === 'chlorophyll' && depth > 200) {
          a = Math.max(25, Math.round(185 * Math.exp(-(depth - 200) / 250)));
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
   * Synchronizes the slice with active depth and variable state
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

// 2. Hide the generated depth-slice imagery.
// The globe remains visible without the large colored analysis rectangle.
      const oldLayer = this.activeImageryLayer;

      if (oldLayer && !this.viewer.isDestroyed()) {
        this.viewer.imageryLayers.remove(oldLayer);
      }

      this.activeImageryLayer = null;

      // 3. Underwater Mode: Show Glowing Stratum Boundary & HUD Badge
      const isUnderwaterAnalysis = this.currentMode === 'underwater';
      if (this.stratumFrameEntity) {
        this.stratumFrameEntity.show = isUnderwaterAnalysis;
      }
      if (this.stratumLabelEntity) {
        this.stratumLabelEntity.show = isUnderwaterAnalysis;
      }
    } catch (err) {
      console.warn('DepthSliceRenderer update warning:', err);
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

  public destroy(): void {
    if (this.activeImageryLayer && !this.viewer.isDestroyed()) {
      this.viewer.imageryLayers.remove(this.activeImageryLayer);
      this.activeImageryLayer = null;
    }
    if (this.stratumFrameEntity && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.stratumFrameEntity);
      this.stratumFrameEntity = null;
    }
    if (this.stratumLabelEntity && !this.viewer.isDestroyed()) {
      this.viewer.entities.remove(this.stratumLabelEntity);
      this.stratumLabelEntity = null;
    }
  }
}

