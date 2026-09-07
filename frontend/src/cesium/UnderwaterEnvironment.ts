import * as Cesium from 'cesium';

export class UnderwaterEnvironment {
  private viewer: Cesium.Viewer;
  private marineSnowCollection: Cesium.PointPrimitiveCollection | null = null;
  private marineSnowParticles: {
    primitive: Cesium.PointPrimitive;
    baseLon: number;
    baseLat: number;
    baseDepth: number;
    speed: number;
    phase: number;
  }[] = [];
  private removePostRenderListener: (() => void) | null = null;

  private isUnderwater = false;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.initNativeFog();
    this.initMarineSnowParticles();
  }

  private initNativeFog(): void {
    try {
      this.viewer.scene.fog.enabled = true;
      this.viewer.scene.fog.density = 0.00008;
      this.viewer.scene.fog.minimumBrightness = 0.02;
    } catch (err) {
      console.warn('Native fog init warning:', err);
    }
  }

  private initMarineSnowParticles(): void {
    try {
      this.marineSnowCollection = new Cesium.PointPrimitiveCollection();
      this.viewer.scene.primitives.add(this.marineSnowCollection);

      const centerLat = 12.0;
      const centerLon = 65.0;
      const particleCount = 600;

      for (let i = 0; i < particleCount; i++) {
        const latOffset = (Math.random() - 0.5) * 8.0;
        const lonOffset = (Math.random() - 0.5) * 8.0;
        const depth = Math.random() * 2500 + 10;

        const position = Cesium.Cartesian3.fromDegrees(
          centerLon + lonOffset,
          centerLat + latOffset,
          -depth
        );

        const p = this.marineSnowCollection.add({
          position,
          pixelSize: Math.random() * 2.5 + 1.0,
          color: new Cesium.Color(0.4, 0.85, 1.0, Math.random() * 0.5 + 0.2),
          show: false,
        });

        this.marineSnowParticles.push({
          primitive: p,
          baseLon: centerLon + lonOffset,
          baseLat: centerLat + latOffset,
          baseDepth: depth,
          speed: Math.random() * 0.8 + 0.2,
          phase: Math.random() * Math.PI * 2,
        });
      }

      let time = 0;
      const onPostRender = () => {
        if (!this.isUnderwater || !this.marineSnowCollection || this.viewer.isDestroyed()) return;
        time += 0.015;
        for (let i = 0; i < this.marineSnowParticles.length; i++) {
          const item = this.marineSnowParticles[i];
          const driftDepth = item.baseDepth + Math.sin(time * item.speed + item.phase) * 15;
          const driftLon = item.baseLon + Math.cos(time * 0.5 + item.phase) * 0.02;

          item.primitive.position = Cesium.Cartesian3.fromDegrees(
            driftLon,
            item.baseLat,
            -driftDepth
          );
        }
      };

      this.removePostRenderListener = this.viewer.scene.postRender.addEventListener(onPostRender);
    } catch (err) {
      console.warn('Marine snow particle init fallback:', err);
    }
  }

  public updateEnvironment(isUnderwater: boolean, depth: number): void {
    if (this.viewer.isDestroyed()) return;
    this.isUnderwater = isUnderwater;

    const globe = this.viewer.scene.globe;

    if (isUnderwater) {
      globe.translucency.enabled = true;
      globe.translucency.frontFaceAlpha = 0.75;
      globe.showGroundAtmosphere = false;
      if (this.viewer.scene.skyAtmosphere) {
        this.viewer.scene.skyAtmosphere.show = false;
      }

      const depthFactor = Math.min(1.0, depth / 2000);
      const r = 0.01 * (1.0 - depthFactor);
      const g = 0.08 * (1.0 - depthFactor * 0.7);
      const b = 0.18 * (1.0 - depthFactor * 0.6);

      this.viewer.scene.backgroundColor = new Cesium.Color(r, g, b, 1.0);
      this.viewer.scene.fog.density = 0.00015 + depthFactor * 0.0003;

      if (this.marineSnowCollection) {
        this.marineSnowCollection.show = true;
        for (const p of this.marineSnowParticles) {
          p.primitive.show = true;
        }
      }
    } else {
      globe.translucency.enabled = false;
      globe.showGroundAtmosphere = true;
      if (this.viewer.scene.skyAtmosphere) {
        this.viewer.scene.skyAtmosphere.show = true;
      }
      this.viewer.scene.backgroundColor = Cesium.Color.BLACK;
      this.viewer.scene.fog.density = 0.00008;

      if (this.marineSnowCollection) {
        this.marineSnowCollection.show = false;
      }
    }
  }

  public destroy(): void {
    if (this.removePostRenderListener) {
      this.removePostRenderListener();
    }
    if (this.marineSnowCollection && !this.viewer.isDestroyed()) {
      try {
        this.viewer.scene.primitives.remove(this.marineSnowCollection);
      } catch (err) {
        console.warn('Marine snow remove error:', err);
      }
    }
  }
}
