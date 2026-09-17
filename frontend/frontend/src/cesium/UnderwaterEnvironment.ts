import * as Cesium from 'cesium';

export class UnderwaterEnvironment {
  private viewer: Cesium.Viewer;
  private marineSnowCollection: Cesium.PointPrimitiveCollection | null = null;
  private marineSnowParticles: {
    primitive: Cesium.PointPrimitive;
    baseLon: number;
    baseLat: number;
    baseAlt: number;
    speed: number;
    phase: number;
  }[] = [];
  private removePostRenderListener: (() => void) | null = null;

  private isUnderwater = false;
  private particleCount = 400; // Subtle, non-distracting atmospheric particle count

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.initNativeAtmosphere();
    this.initMarineSnowParticles();
  }

  private initNativeAtmosphere(): void {
    try {
      this.viewer.scene.fog.enabled = true;
      this.viewer.scene.fog.density = 0.00004;
      this.viewer.scene.fog.minimumBrightness = 0.8;
      this.viewer.scene.globe.showGroundAtmosphere = true;
      this.viewer.scene.globe.translucency.enabled = false;
    } catch (err) {
      console.warn('Atmosphere init warning:', err);
    }
  }

  private initMarineSnowParticles(): void {
    try {
      this.marineSnowCollection = new Cesium.PointPrimitiveCollection();
      this.viewer.scene.primitives.add(this.marineSnowCollection);

      // Centered over Arabian Sea / Indian Ocean
      const centerLat = 13.0;
      const centerLon = 66.0;

      for (let i = 0; i < this.particleCount; i++) {
        const latOffset = (Math.random() - 0.5) * 22.0;
        const lonOffset = (Math.random() - 0.5) * 28.0;
        const alt = Math.random() * 60000 + 10000; // Hovering above ocean surface

        const position = Cesium.Cartesian3.fromDegrees(
          centerLon + lonOffset,
          centerLat + latOffset,
          alt
        );

        const p = this.marineSnowCollection.add({
          position,
          pixelSize: Math.random() * 2.0 + 1.2,
          color: new Cesium.Color(0.2, 0.8, 1.0, Math.random() * 0.4 + 0.15),
          show: false,
        });

        this.marineSnowParticles.push({
          primitive: p,
          baseLon: centerLon + lonOffset,
          baseLat: centerLat + latOffset,
          baseAlt: alt,
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
          const driftAlt = item.baseAlt + Math.sin(time * item.speed + item.phase) * 3000;
          const driftLon = item.baseLon + Math.cos(time * 0.3 + item.phase) * 0.04;

          item.primitive.position = Cesium.Cartesian3.fromDegrees(
            driftLon,
            item.baseLat,
            driftAlt
          );
        }
      };

      this.removePostRenderListener = this.viewer.scene.postRender.addEventListener(onPostRender);
    } catch (err) {
      console.warn('Marine snow particle init fallback:', err);
    }
  }

  /**
   * Updates environment parameters without compromising globe visibility
   */
  public updateEnvironment(isUnderwater: boolean, _depth: number): void {
    if (this.viewer.isDestroyed()) return;
    this.isUnderwater = isUnderwater;

    const globe = this.viewer.scene.globe;
    // Always keep globe fully solid and opaque
    globe.translucency.enabled = false;
    globe.showGroundAtmosphere = true;

    if (this.viewer.scene.skyAtmosphere) {
      this.viewer.scene.skyAtmosphere.show = true;
    }

    if (isUnderwater) {
      // Subtle ocean analysis atmosphere
      this.viewer.scene.backgroundColor = Cesium.Color.BLACK;
      this.viewer.scene.fog.density = 0.00006;

      if (this.marineSnowCollection) {
        this.marineSnowCollection.show = true;
        for (const p of this.marineSnowParticles) {
          p.primitive.show = true;
        }
      }
    } else {
      // Surface Mode Reset
      this.viewer.scene.backgroundColor = Cesium.Color.BLACK;
      this.viewer.scene.fog.density = 0.00004;

      if (this.marineSnowCollection) {
        this.marineSnowCollection.show = false;
        for (const p of this.marineSnowParticles) {
          p.primitive.show = false;
        }
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

