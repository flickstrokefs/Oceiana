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

  /** Render the API depth-slice grid; no client-side ocean field is generated. */
  private renderFieldToCanvas(variable: OceanVariable): boolean {
    const oceanState = OceanState.getInstance();
    const slice = oceanState.getDepthSlice();
    if (!slice || !slice.latitudes.length || !slice.longitudes.length || !slice.values.length) {
      this.ctx.clearRect(0, 0, this.resolution, this.resolution);
      return false;
    }
    const imgData = this.ctx.createImageData(this.resolution, this.resolution);
    const data = imgData.data;

    for (let y = 0; y < this.resolution; y++) {
      for (let x = 0; x < this.resolution; x++) {
        const idx = (y * this.resolution + x) * 4;
        const row = Math.min(slice.values.length - 1, Math.floor((1 - y / (this.resolution - 1)) * slice.values.length));
        const col = Math.min(slice.longitudes.length - 1, Math.floor((x / (this.resolution - 1)) * slice.longitudes.length));
        const scalar = slice.values[row]?.[col];
        if (scalar == null || !Number.isFinite(scalar)) continue;
        const color = oceanState.getCesiumColorForVariable(variable, scalar, oceanState.getVisualization().modelOpacity / 100);
        data[idx] = Math.round(color.red * 255);
        data[idx + 1] = Math.round(color.green * 255);
        data[idx + 2] = Math.round(color.blue * 255);
        data[idx + 3] = Math.round(color.alpha * 255);
      }
    }

    this.ctx.putImageData(imgData, 0, 0);
    return true;
  }

  /**
   * Synchronizes the slice with active depth and variable state
   */
  public async update(): Promise<void> {
    if (this.isUpdating || this.viewer.isDestroyed()) return;
    this.isUpdating = true;

    const snapshot = OceanState.getInstance().getSnapshot();
    const oceanState = OceanState.getInstance();
    this.activeVariable = snapshot.activeVariable;
    this.currentMode = snapshot.mode;
    this.currentDepth = snapshot.parameters.depth;

    try {
      const hasData = this.renderFieldToCanvas(this.activeVariable);
      const oldLayer = this.activeImageryLayer;

      if (oldLayer && !this.viewer.isDestroyed()) {
        this.viewer.imageryLayers.remove(oldLayer);
      }

      if (hasData && oceanState.modelLayerVisibleFor(this.activeVariable)) {
        const slice = oceanState.getDepthSlice()!;
        const rectangle = Cesium.Rectangle.fromDegrees(
          Math.min(...slice.longitudes), Math.min(...slice.latitudes),
          Math.max(...slice.longitudes), Math.max(...slice.latitudes),
        );
        this.activeImageryLayer = this.viewer.imageryLayers.addImageryProvider(
          new Cesium.SingleTileImageryProvider({ url: this.canvas.toDataURL(), rectangle }),
        );
      } else {
        this.activeImageryLayer = null;
      }

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

