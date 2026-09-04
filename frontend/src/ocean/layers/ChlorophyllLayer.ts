import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';

export class ChlorophyllLayer {
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

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.resolution;
    this.canvas.height = this.resolution;
    this.ctx = this.canvas.getContext('2d')!;

    this.renderCanvas();
    this.attachImageryLayer();
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
        const chl = sample.chlorophyll;

        const norm = Math.min(1.0, Math.max(0.0, chl / 6.0));

        let r = Math.round(norm * 20);
        let g = Math.round(norm * 245 + (1.0 - norm) * 40);
        let b = Math.round((1.0 - norm) * 200 + norm * 80);

        const idx = (y * this.resolution + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 165;
      }
    }

    this.ctx.putImageData(imgData, 0, 0);
  }

  private attachImageryLayer(): void {
    try {
      if (this.imageryLayer) {
        this.viewer.imageryLayers.remove(this.imageryLayer);
      }

      const provider = new Cesium.SingleTileImageryProvider({
        url: this.canvas.toDataURL(),
        rectangle: Cesium.Rectangle.fromDegrees(
          this.minLon,
          this.minLat,
          this.maxLon,
          this.maxLat
        ),
        tileWidth: this.resolution,
        tileHeight: this.resolution,
      });

      this.imageryLayer = this.viewer.imageryLayers.addImageryProvider(provider);
      this.imageryLayer.alpha = 0.70;
      this.imageryLayer.show = this.active;
    } catch (err) {
      console.warn('ChlorophyllLayer attach exception:', err);
    }
  }

  public update(): void {
    if (!this.active) return;
    this.renderCanvas();
    try {
      const provider = new Cesium.SingleTileImageryProvider({
        url: this.canvas.toDataURL(),
        rectangle: Cesium.Rectangle.fromDegrees(
          this.minLon,
          this.minLat,
          this.maxLon,
          this.maxLat
        ),
        tileWidth: this.resolution,
        tileHeight: this.resolution,
      });
      const oldLayer = this.imageryLayer;
      this.imageryLayer = this.viewer.imageryLayers.addImageryProvider(provider);
      this.imageryLayer.alpha = 0.70;
      this.imageryLayer.show = this.active;
      if (oldLayer) {
        this.viewer.imageryLayers.remove(oldLayer);
      }
    } catch (err) {
      console.warn('ChlorophyllLayer update exception:', err);
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
