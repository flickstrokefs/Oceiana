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
  private particleCount = 2000; // Intentional, high-performance particle budget

  private active = true;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.particleCollection = new Cesium.PointPrimitiveCollection();
    this.viewer.scene.primitives.add(this.particleCollection);

    this.initParticles();
    this.startAnimationLoop();
  }

  private initParticles(): void {
    const snapshot = OceanState.getInstance().getSnapshot();
    const baseDepth = snapshot.mode === 'underwater' ? snapshot.parameters.depth : 0;

    for (let i = 0; i < this.particleCount; i++) {
      const lat = this.minLat + Math.random() * (this.maxLat - this.minLat);
      const lon = this.minLon + Math.random() * (this.maxLon - this.minLon);
      const depthOffset = (Math.random() - 0.5) * 50.0;
      const depth = Math.max(0, baseDepth + depthOffset);

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
      if (!this.active || this.viewer.isDestroyed()) return;

      const snapshot = oceanState.getSnapshot();
      const speedMult = snapshot.parameters.currentSpeed;
      const dt = 0.04 * speedMult;
      const targetDepth = snapshot.mode === 'underwater' ? snapshot.parameters.depth : 0;

      for (let i = 0; i < this.particles.length; i++) {
        const p = this.particles[i];
        p.life += 1;

        if (
          p.life >= p.maxLife ||
          p.lat < this.minLat ||
          p.lat > this.maxLat ||
          p.lon < this.minLon ||
          p.lon > this.maxLon ||
          Math.abs(p.depth - targetDepth) > 60
        ) {
          p.lat = this.minLat + Math.random() * (this.maxLat - this.minLat);
          p.lon = this.minLon + Math.random() * (this.maxLon - this.minLon);
          p.depth = Math.max(0, targetDepth + (Math.random() - 0.5) * 40.0);
          p.life = 0;
          p.maxLife = Math.random() * 120 + 80;
        }

        // Evaluate physical current velocity field at the particle's actual depth
        const field = oceanState.sampleSpatialField(p.lat, p.lon, p.depth);
        const u = field.velocity.u;
        const v = field.velocity.v;
        const w = field.velocity.w;

        p.lon += u * 0.05 * dt;
        p.lat += v * 0.05 * dt;
        p.depth = Math.max(0, p.depth - w * 10.0 * dt);

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
      try {
        this.viewer.scene.primitives.remove(this.particleCollection);
      } catch (err) {
        console.warn('CurrentLayer cleanup warning:', err);
      }
    }
  }
}
