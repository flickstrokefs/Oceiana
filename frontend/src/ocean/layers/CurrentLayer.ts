import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';

interface FlowParticle {
  primitive: Cesium.PointPrimitive;
  lat: number;
  lon: number;
  depth: number;
  life: number;
  maxLife: number;
}

export class CurrentLayer {
  private viewer: Cesium.Viewer;
  private particleCollection: Cesium.PointPrimitiveCollection;
  private particles: FlowParticle[] = [];
  private removeRenderListener: (() => void) | null = null;

  private minLat = -25.0;
  private maxLat = 25.0;
  private minLon = 40.0;
  private maxLon = 100.0;
  private particleCount = 2200;

  private active = true;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.particleCollection = new Cesium.PointPrimitiveCollection();
    this.viewer.scene.primitives.add(this.particleCollection);

    this.initParticles();
    this.startAnimationLoop();
  }

  private initParticles(): void {
    for (let i = 0; i < this.particleCount; i++) {
      const lat = this.minLat + Math.random() * (this.maxLat - this.minLat);
      const lon = this.minLon + Math.random() * (this.maxLon - this.minLon);
      const depth = Math.random() * 200;

      const p = this.particleCollection.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, -depth),
        pixelSize: Math.random() * 2.2 + 1.2,
        color: new Cesium.Color(0.0, 0.95, 1.0, Math.random() * 0.7 + 0.3),
        show: this.active,
      });

      this.particles.push({
        primitive: p,
        lat,
        lon,
        depth,
        life: Math.random() * 100,
        maxLife: Math.random() * 120 + 80,
      });
    }
  }

  private startAnimationLoop(): void {
    const oceanState = OceanState.getInstance();

    const onPostRender = () => {
      if (!this.active) return;

      const snapshot = oceanState.getSnapshot();
      const speedMult = snapshot.parameters.currentSpeed;
      const dt = 0.04 * speedMult;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.life += 1;

        if (
          p.life >= p.maxLife ||
          p.lat < this.minLat ||
          p.lat > this.maxLat ||
          p.lon < this.minLon ||
          p.lon > this.maxLon
        ) {
          p.lat = this.minLat + Math.random() * (this.maxLat - this.minLat);
          p.lon = this.minLon + Math.random() * (this.maxLon - this.minLon);
          p.depth = snapshot.mode === 'underwater' ? snapshot.parameters.depth : Math.random() * 100;
          p.life = 0;
          p.maxLife = Math.random() * 120 + 80;
        }

        const field = oceanState.sampleSpatialField(p.lat, p.lon, p.depth);
        const u = field.velocity.u;
        const v = field.velocity.v;

        p.lon += u * 0.05 * dt;
        p.lat += v * 0.05 * dt;

        p.primitive.position = Cesium.Cartesian3.fromDegrees(
          p.lon,
          p.lat,
          -p.depth
        );

        const alpha = Math.sin((p.life / p.maxLife) * Math.PI) * 0.85;
        p.primitive.color = new Cesium.Color(0.0, 0.95, 1.0, alpha);
      }
    };

    this.removeRenderListener = this.viewer.scene.postRender.addEventListener(onPostRender);
  }

  public setVisible(visible: boolean): void {
    this.active = visible;
    this.particleCollection.show = visible;
  }

  public destroy(): void {
    if (this.removeRenderListener) {
      this.removeRenderListener();
    }
    if (this.particleCollection && !this.viewer.isDestroyed()) {
      this.viewer.scene.primitives.remove(this.particleCollection);
    }
  }
}
