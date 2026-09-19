import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';
import type { OceanCurrentVector } from '../../services/oceanService';

interface FlowParticle { primitive: Cesium.PointPrimitive; lat: number; lon: number; vector: OceanCurrentVector; life: number; maxLife: number; }

/** Particle animation seeded exclusively from /api/ocean/currents vectors. */
export class CurrentLayer {
  private particleCollection: Cesium.PointPrimitiveCollection;
  private particles: FlowParticle[] = [];
  private removeRenderListener: (() => void) | null = null;
  private active = false;

  private viewer: Cesium.Viewer;
  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.particleCollection = new Cesium.PointPrimitiveCollection();
    viewer.scene.primitives.add(this.particleCollection);
    this.startAnimationLoop();
  }

  public setVectors(vectors: OceanCurrentVector[]): void {
    this.particleCollection.removeAll();
    this.particles = [];
    const stride = Math.max(1, Math.ceil(vectors.length / 800));
    for (let i = 0; i < vectors.length; i += stride) {
      const vector = vectors[i];
      const primitive = this.particleCollection.add({
        position: Cesium.Cartesian3.fromDegrees(vector.longitude, vector.latitude, 4000), pixelSize: 2.4,
        color: OceanState.getInstance().getCesiumColorForVariable('current', vector.speed, 0.8), show: this.active,
      });
      this.particles.push({ primitive, lat: vector.latitude, lon: vector.longitude, vector, life: Math.random() * 100, maxLife: 100 + Math.random() * 100 });
    }
  }

  private startAnimationLoop(): void {
    this.removeRenderListener = this.viewer.scene.postRender.addEventListener(() => {
      if (!this.active || this.viewer.isDestroyed()) return;
      for (const particle of this.particles) {
        particle.life += 1;
        if (particle.life >= particle.maxLife) {
          // Restart at its measured vector location; randomness is animation lifetime only.
          particle.lat = particle.vector.latitude;
          particle.lon = particle.vector.longitude;
          particle.life = 0;
          particle.maxLife = 100 + Math.random() * 100;
        }
        // Measured u/v components drive particle movement; scaling is visual only.
        particle.lon += particle.vector.u * 0.001;
        particle.lat += particle.vector.v * 0.001;
        particle.primitive.position = Cesium.Cartesian3.fromDegrees(particle.lon, particle.lat, 4000);
        particle.primitive.color = OceanState.getInstance().getCesiumColorForVariable('current', particle.vector.speed, Math.sin((particle.life / particle.maxLife) * Math.PI) * 0.85);
      }
    });
  }

  public setVisible(visible: boolean): void { this.active = visible; this.particleCollection.show = visible; }
  public destroy(): void { this.removeRenderListener?.(); if (!this.viewer.isDestroyed()) this.viewer.scene.primitives.remove(this.particleCollection); }
}
