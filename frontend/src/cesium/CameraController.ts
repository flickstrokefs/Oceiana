import * as Cesium from 'cesium';
import type { OceanMode } from '../types/ocean';
import { UnderwaterEnvironment } from './UnderwaterEnvironment';

export class CameraController {
  private viewer: Cesium.Viewer;
  private underwaterEnv: UnderwaterEnvironment;

  private currentMode: OceanMode = 'surface';

  // Geographic focus: Indian Ocean / Arabian Sea
  private targetLon = 68.0;
  private targetLat = 13.0;

  constructor(viewer: Cesium.Viewer, underwaterEnv: UnderwaterEnvironment) {
    this.viewer = viewer;
    this.underwaterEnv = underwaterEnv;
  }

  public setInitialView(): void {
    this.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        this.targetLon,
        this.targetLat,
        3800000 // Orbital overview altitude
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-72.0),
        roll: 0.0,
      },
    });
  }

  /**
   * Transitions camera between surface overview and focused ocean-analysis perspective
   * RULE: Never place the camera inside the Earth's solid ellipsoid.
   */
  public setMode(mode: OceanMode, depth = 0): void {
    this.currentMode = mode;
    this.underwaterEnv.updateEnvironment(mode === 'underwater', depth);

    if (mode === 'surface') {
      // Surface Overview: High orbital vantage point showing geographic region
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          this.targetLon,
          this.targetLat,
          3600000
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-70.0),
          roll: 0.0,
        },
        duration: 1.8,
      });
    } else {
      // Underwater / Depth-Analysis View: Closer, angled analytical perspective over ocean basin
      // Altitude is 1,400,000m (well above Earth surface) with tilted perspective
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          this.targetLon - 2.0,
          this.targetLat - 2.0,
          1450000
        ),
        orientation: {
          heading: Cesium.Math.toRadians(12.0),
          pitch: Cesium.Math.toRadians(-48.0), // Oblique perspective showing ocean depth slice & geography
          roll: 0.0,
        },
        duration: 1.8,
      });
    }
  }

  /**
   * Depth changes control the scientific data slice filter.
   * Camera remains in stable analytical position above the Earth.
   */
  public setDepth(depth: number): void {
    if (this.currentMode === 'underwater') {
      this.underwaterEnv.updateEnvironment(true, depth);
    }
  }

  /**
   * Fly existing Cesium camera to an observation (Show on Globe).
   * Does NOT recreate the viewer or reset ocean layers / exaggeration / time.
   *
   * INTEGRATION: When the full underwater 3D structure mesh is ready,
   * optionally offset altitude / pitch here to frame the structure + marker.
   */
  public flyToObservation(longitude: number, latitude: number, duration = 1.6): void {
    const altitude = this.currentMode === 'underwater' ? 420000 : 900000;

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(longitude, latitude - 1.2, altitude),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(this.currentMode === 'underwater' ? -42.0 : -55.0),
        roll: 0.0,
      },
      duration,
    });
  }
}
