import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';

export class SalinityLayer {
  private viewer: Cesium.Viewer;
  private imageryLayer: Cesium.ImageryLayer | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private minLat = -30.0;
  private maxLat = 30.0;
  private minLon = 35.0;
  private maxLon = 110.0;
  private resolution = 128;

  private active = false;
  private isUpdating = false;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.resolution;
    this.canvas.height = this.resolution;
    this.ctx = this.canvas.getContext('2d')!;

    this.update();
  }

  private renderCanvas(): void {
    const oceanState = OceanState.getInstance();
    const snapshot = oceanState.getSnapshot();
    const depth = snapshot.parameters.depth;

    const imgData = this.ctx.createImageData(this.resolution, this.resolution);
    const data = imgData.data;

    for (let y = 0; y < this.resolution; y++) {
      const lat = this.maxLat - (y / this.resolution) * (this.maxLat - this.minLat);

      for (let x = 0; x < this.resolution; x++) {
        const lon = this.minLon + (x / this.resolution) * (this.maxLon - this.minLon);

        const sample = oceanState.sampleSpatialField(lat, lon, depth);
        const salinity = sample.salinity;

        const norm = Math.min(1.0, Math.max(0.0, (salinity - 28.0) / 10.0));

        const r = Math.round(norm * 180 + (1.0 - norm) * 0);
        const g = Math.round((1.0 - norm) * 220 + norm * 20);
        const b = Math.round(255);

        const idx = (y * this.resolution + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 160;
      }
    }

    this.ctx.putImageData(imgData, 0, 0);
  }

  public async update(): Promise<void> {
    if (!this.active || this.isUpdating || this.viewer.isDestroyed()) return;
    this.isUpdating = true;

    try {
      this.renderCanvas();
      const dataUrl = this.canvas.toDataURL();
      const rectangle = Cesium.Rectangle.fromDegrees(
        this.minLon,
        this.minLat,
        this.maxLon,
        this.maxLat
      );

      const providerPromise = Cesium.SingleTileImageryProvider.fromUrl(dataUrl, {
        rectangle,
      });

      const newLayer = Cesium.ImageryLayer.fromProviderAsync(providerPromise);
      newLayer.alpha = 0.68;
      newLayer.show = this.active;

      const oldLayer = this.imageryLayer;
      this.imageryLayer = newLayer;
      this.viewer.imageryLayers.add(newLayer);

      if (oldLayer && !this.viewer.isDestroyed()) {
        this.viewer.imageryLayers.remove(oldLayer);
      }
    } catch (err) {
      console.warn('SalinityLayer async update error:', err);
    } finally {
      this.isUpdating = false;
    }
  }

  public setVisible(visible: boolean): void {
    this.active = visible;
    if (this.imageryLayer) {
      this.imageryLayer.show = visible;
    }
    if (visible) {
      this.update();
    }
  }

  public destroy(): void {
    if (this.imageryLayer && !this.viewer.isDestroyed()) {
      this.viewer.imageryLayers.remove(this.imageryLayer);
    }
  }
}
