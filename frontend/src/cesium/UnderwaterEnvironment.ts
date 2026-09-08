import * as Cesium from 'cesium';
import { UW_DIMENSIONS, localToWorld } from '../ocean/utils/underwaterCoords';

export class UnderwaterEnvironment {
  private viewer: Cesium.Viewer;
  private marineSnowCollection: Cesium.PointPrimitiveCollection | null = null;
  private marineSnowParticles: {
    primitive: Cesium.PointPrimitive;
    baseX: number;
    baseY: number;
    baseZ: number;
    currentZ: number;
    speed: number;
    sinkRate: number;
    phase: number;
    driftRadius: number;
  }[] = [];
  private removePostRenderListener: (() => void) | null = null;

  private isUnderwater = false;

  // Stored initial surface scene state for exact restoration
  private initialGlobeShow: boolean;
  private initialSkyBoxShow: boolean | undefined;
  private initialSkyAtmosphereShow: boolean | undefined;
  private initialBackgroundColor: Cesium.Color;
  private initialFogEnabled: boolean;
  private initialFogDensity: number;
  private initialShowGroundAtmosphere: boolean;
  private initialGlobeTranslucencyEnabled: boolean;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;

    // Capture initial viewer state
    const scene = this.viewer.scene;
    this.initialGlobeShow = scene.globe.show;
    this.initialSkyBoxShow = scene.skyBox ? scene.skyBox.show : undefined;
    this.initialSkyAtmosphereShow = scene.skyAtmosphere ? scene.skyAtmosphere.show : undefined;
    this.initialBackgroundColor = scene.backgroundColor
      ? scene.backgroundColor.clone()
      : Cesium.Color.fromCssColorString('#020617');
    this.initialFogEnabled = scene.fog.enabled;
    this.initialFogDensity = scene.fog.density;
    this.initialShowGroundAtmosphere = scene.globe.showGroundAtmosphere;
    this.initialGlobeTranslucencyEnabled = scene.globe.translucency.enabled;

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

      const hx = UW_DIMENSIONS.halfWidthX;
      const hy = UW_DIMENSIONS.halfLengthY;
      const hz = UW_DIMENSIONS.totalDepthZ;

      // Stratified depth zones:
      // 1. Photic/Epipelagic zone (0 - 300m): Dense, buoyant planktonic aggregate
      // 2. Mesopelagic/Twilight zone (300 - 1000m): Moderate density, steady descent
      // 3. Bathypelagic/Abyssal zone (1000 - 2000m): Sparser, quiescent detritus flakes
      const strataConfigs = [
        {
          name: 'photic',
          clusterCount: 10,
          particlesPerCluster: 24,
          zMin: -0.15 * hz,
          zMax: 0,
          color: [0.65, 0.88, 0.98],
          opacityRange: [0.07, 0.22],
          sinkRange: [4, 12],
          driftRange: [4000, 13000],
          sizeRange: [1.2, 2.8],
        },
        {
          name: 'mesopelagic',
          clusterCount: 8,
          particlesPerCluster: 22,
          zMin: -0.50 * hz,
          zMax: -0.15 * hz,
          color: [0.50, 0.74, 0.90],
          opacityRange: [0.05, 0.16],
          sinkRange: [8, 18],
          driftRange: [2500, 7000],
          sizeRange: [1.0, 2.2],
        },
        {
          name: 'abyssal',
          clusterCount: 5,
          particlesPerCluster: 20,
          zMin: -hz,
          zMax: -0.50 * hz,
          color: [0.35, 0.58, 0.78],
          opacityRange: [0.04, 0.11],
          sinkRange: [12, 24],
          driftRange: [1200, 4000],
          sizeRange: [1.0, 1.8],
        },
      ];

      for (const stratum of strataConfigs) {
        for (let c = 0; c < stratum.clusterCount; c++) {
          const clusterCenterX = (Math.random() - 0.5) * 2.0 * (hx * 0.92);
          const clusterCenterY = (Math.random() - 0.5) * 2.0 * (hy * 0.92);
          const clusterCenterZ = stratum.zMin + Math.random() * (stratum.zMax - stratum.zMin);

          for (let pIdx = 0; pIdx < stratum.particlesPerCluster; pIdx++) {
            const offsetX = (Math.random() - 0.5) * 110000;
            const offsetY = (Math.random() - 0.5) * 85000;
            const offsetZ = (Math.random() - 0.5) * 35000;

            const baseX = clusterCenterX + offsetX;
            const baseY = clusterCenterY + offsetY;
            const baseZ = Math.max(-hz, Math.min(0, clusterCenterZ + offsetZ));

            const worldPos = localToWorld(baseX, baseY, baseZ);

            const [minSize, maxSize] = stratum.sizeRange;
            const pixelSize = minSize + Math.random() * (maxSize - minSize);

            const [minOp, maxOp] = stratum.opacityRange;
            const opacity = minOp + Math.random() * (maxOp - minOp);

            const [r, g, b] = stratum.color;
            const p = this.marineSnowCollection.add({
              position: worldPos,
              pixelSize,
              color: new Cesium.Color(r, g, b, opacity),
              show: false,
            });

            const [minSink, maxSink] = stratum.sinkRange;
            const [minDrift, maxDrift] = stratum.driftRange;

            this.marineSnowParticles.push({
              primitive: p,
              baseX,
              baseY,
              baseZ,
              currentZ: baseZ,
              speed: Math.random() * 0.35 + 0.12,
              sinkRate: minSink + Math.random() * (maxSink - minSink),
              phase: Math.random() * Math.PI * 2,
              driftRadius: minDrift + Math.random() * (maxDrift - minDrift),
            });
          }
        }
      }

      let time = 0;
      const onPostRender = () => {
        if (!this.isUnderwater || !this.marineSnowCollection || this.viewer.isDestroyed()) return;
        time += 0.0016; // Slower, tranquil organic fluid settling

        for (let i = 0; i < this.marineSnowParticles.length; i++) {
          const item = this.marineSnowParticles[i];

          // Gentle vertical settling
          item.currentZ -= item.sinkRate;
          if (item.currentZ < -hz) {
            item.currentZ = 2000; // loop back near surface
          }

          // Gentle horizontal sway
          const driftX = item.baseX + Math.sin(time * item.speed + item.phase) * item.driftRadius;
          const driftY = item.baseY + Math.cos(time * item.speed * 0.7 + item.phase) * (item.driftRadius * 0.6);

          item.primitive.position = localToWorld(driftX, driftY, item.currentZ);
        }
      };

      this.removePostRenderListener = this.viewer.scene.postRender.addEventListener(onPostRender);
    } catch (err) {
      console.warn('Marine snow particle init fallback:', err);
    }
  }

  /**
   * Clamps and normalizes depth within supported analysis range (0 to 2000m).
   */
  private getDepthFactor(depth: number): number {
    return Cesium.Math.clamp(depth / 2000.0, 0.0, 1.0);
  }

  /**
   * Evaluates depth-graded ambient background color representing light attenuation.
   * 0m: Deep teal-blue (#022338)
   * ~600m: Dark blue/navy (#021222)
   * 2000m: Near-black navy (#01060f)
   */
  private getDepthBackground(depth: number): Cesium.Color {
    const factor = this.getDepthFactor(depth);
    const surfaceTeal = new Cesium.Color(0.012, 0.095, 0.165, 1.0); // 0m: Deep teal-blue
    const midNavy = new Cesium.Color(0.005, 0.040, 0.085, 1.0);     // 600m: Dark navy
    const abyssalNavy = new Cesium.Color(0.001, 0.010, 0.025, 1.0); // 2000m: Near-black navy

    const result = new Cesium.Color();
    if (factor < 0.3) {
      const subFactor = factor / 0.3;
      Cesium.Color.lerp(surfaceTeal, midNavy, subFactor, result);
    } else {
      const subFactor = (factor - 0.3) / 0.7;
      Cesium.Color.lerp(midNavy, abyssalNavy, subFactor, result);
    }
    return result;
  }

  /**
   * Evaluates subtle native fog density based on depth.
   */
  private getDepthFogDensity(depth: number): number {
    const factor = this.getDepthFactor(depth);
    return 0.00010 + factor * 0.00018;
  }

  public updateEnvironment(isUnderwater: boolean, depth: number): void {
    if (this.viewer.isDestroyed()) return;
    this.isUnderwater = isUnderwater;

    const scene = this.viewer.scene;
    const globe = scene.globe;

    if (isUnderwater) {
      // 1. Completely hide real Earth globe (no continents, coastlines, terrain, or Earth imagery)
      globe.show = false;

      // 2. Completely disable space skybox & sky atmosphere
      if (scene.skyBox) {
        scene.skyBox.show = false;
      }
      if (scene.skyAtmosphere) {
        scene.skyAtmosphere.show = false;
      }

      // 3. Apply depth-graded abstract ocean volume background
      scene.backgroundColor = this.getDepthBackground(depth);

      // 4. Set calibrated underwater atmospheric fog
      scene.fog.enabled = true;
      scene.fog.density = this.getDepthFogDensity(depth);

      // 5. Display subtle ambient marine snow particles
      if (this.marineSnowCollection) {
        this.marineSnowCollection.show = true;
        for (let i = 0; i < this.marineSnowParticles.length; i++) {
          this.marineSnowParticles[i].primitive.show = true;
        }
      }
    } else {
      // 1. Restore real Earth globe and surface attributes
      globe.show = this.initialGlobeShow;
      globe.translucency.enabled = this.initialGlobeTranslucencyEnabled;
      globe.showGroundAtmosphere = this.initialShowGroundAtmosphere;

      // 2. Restore space skybox & sky atmosphere
      if (scene.skyBox && this.initialSkyBoxShow !== undefined) {
        scene.skyBox.show = this.initialSkyBoxShow;
      }
      if (scene.skyAtmosphere && this.initialSkyAtmosphereShow !== undefined) {
        scene.skyAtmosphere.show = this.initialSkyAtmosphereShow;
      }

      // 3. Restore surface background color and fog
      scene.backgroundColor = this.initialBackgroundColor;
      scene.fog.enabled = this.initialFogEnabled;
      scene.fog.density = this.initialFogDensity;

      // 4. Hide atmospheric marine snow particles
      if (this.marineSnowCollection) {
        this.marineSnowCollection.show = false;
        for (let i = 0; i < this.marineSnowParticles.length; i++) {
          this.marineSnowParticles[i].primitive.show = false;
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

