import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';

export class TemperatureLayer {
  private viewer: Cesium.Viewer;
  private imageryLayer: Cesium.ImageryLayer | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  private minLat = -30.0;
  private maxLat = 30.0;
  private minLon = 35.0;
  private maxLon = 110.0;
  private resolution = 128;

  private active = true;

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
        const temp = sample.temperature;

        const normalized = Math.min(1.0, Math.max(0.0, (temp - 4.0) / 28.0));
        const hue = (1.0 - normalized) * 240.0;

        const [r, g, b] = this.hslToRgb(hue / 360, 0.9, 0.5);

        const idx = (y * this.resolution + x) * 4;
        data[idx] = r;
        data[idx + 1] = g;
        data[idx + 2] = b;
        data[idx + 3] = 160;
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
      this.imageryLayer.alpha = 0.72;
      this.imageryLayer.show = this.active;
    } catch (err) {
      console.warn('TemperatureLayer attach exception:', err);
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
      this.imageryLayer.alpha = 0.72;
      this.imageryLayer.show = this.active;
      if (oldLayer) {
        this.viewer.imageryLayers.remove(oldLayer);
      }
    } catch (err) {
      console.warn('TemperatureLayer update exception:', err);
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
    if (this.imageryLayer && !this.viewer.isDestroyed()) {
      this.viewer.imageryLayers.remove(this.imageryLayer);
    }
  }
}
