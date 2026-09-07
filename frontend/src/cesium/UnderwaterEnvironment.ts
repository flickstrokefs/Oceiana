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
  private particleCount = 600; // Intentional, audited particle budget

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

      for (let i = 0; i < this.particleCount; i++) {
        const latOffset = (Math.random() - 0.5) * 8.0;
        const lonOffset = (Math.random() - 0.5) * 8.0;
        const depth = Math.random() * 3000 + 10;

        const position = Cesium.Cartesian3.fromDegrees(
          centerLon + lonOffset,
          centerLat + latOffset,
          -depth
        );

        const p = this.marineSnowCollection.add({
          position,
          pixelSize: Math.random() * 2.2 + 1.0,
          color: new Cesium.Color(0.4, 0.85, 1.0, Math.random() * 0.4 + 0.2),
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
        time += 0.012;
        for (let i = 0; i < this.marineSnowParticles.length; i++) {
          const item = this.marineSnowParticles[i];
          const driftDepth = item.baseDepth + Math.sin(time * item.speed + item.phase) * 12;
          const driftLon = item.baseLon + Math.cos(time * 0.4 + item.phase) * 0.015;

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

  /**
   * Updates lighting and atmosphere in a physically believable depth progression
   */
  public updateEnvironment(isUnderwater: boolean, depth: number): void {
    if (this.viewer.isDestroyed()) return;
    this.isUnderwater = isUnderwater;

    const globe = this.viewer.scene.globe;

    if (isUnderwater) {
      // Enable globe translucency to reveal the 3D water column and subsurface layers
      globe.translucency.enabled = true;
      globe.translucency.frontFaceAlpha = 0.70;
      globe.showGroundAtmosphere = false;
      if (this.viewer.scene.skyAtmosphere) {
        this.viewer.scene.skyAtmosphere.show = false;
      }

      // Depth lighting tiers:
      // 0 - 200m: Epipelagic (sunlight)
      // 200 - 1000m: Mesopelagic (twilight)
      // 1000 - 3000m: Bathypelagic (midnight)
      // > 3000m: Abyssal
      let r = 0.015;
      let g = 0.09;
      let b = 0.22;
      let fogDensity = 0.0001;

      if (depth <= 200) {
        const factor = depth / 200;
        r = 0.015 * (1.0 - factor * 0.3);
        g = 0.09 * (1.0 - factor * 0.4);
        b = 0.22 * (1.0 - factor * 0.4);
        fogDensity = 0.00008 + factor * 0.00006;
      } else if (depth <= 1000) {
        const factor = (depth - 200) / 800;
        r = 0.010 * (1.0 - factor * 0.6);
        g = 0.054 * (1.0 - factor * 0.7);
        b = 0.132 * (1.0 - factor * 0.6);
        fogDensity = 0.00014 + factor * 0.0001;
      } else if (depth <= 3000) {
        const factor = (depth - 1000) / 2000;
        r = 0.004 * (1.0 - factor * 0.6);
        g = 0.016 * (1.0 - factor * 0.7);
        b = 0.052 * (1.0 - factor * 0.6);
        fogDensity = 0.00024 + factor * 0.0001;
      } else {
        r = 0.0008;
        g = 0.004;
        b = 0.018;
        fogDensity = 0.00035;
      }

      this.viewer.scene.backgroundColor = new Cesium.Color(r, g, b, 1.0);
      this.viewer.scene.fog.density = fogDensity;

      if (this.marineSnowCollection) {
        this.marineSnowCollection.show = true;
        for (const p of this.marineSnowParticles) {
          p.primitive.show = true;
        }
      }
    } else {
      // Clean Surface Mode Reset
      globe.translucency.enabled = false;
      globe.showGroundAtmosphere = true;
      if (this.viewer.scene.skyAtmosphere) {
        this.viewer.scene.skyAtmosphere.show = true;
      }
      this.viewer.scene.backgroundColor = Cesium.Color.BLACK;
      this.viewer.scene.fog.density = 0.00008;

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
