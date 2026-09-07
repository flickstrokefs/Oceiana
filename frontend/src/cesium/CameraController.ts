import * as Cesium from 'cesium';
import type { OceanMode } from '../types/ocean';
import { UnderwaterEnvironment } from './UnderwaterEnvironment';

export class CameraController {
  private viewer: Cesium.Viewer;
  private underwaterEnv: UnderwaterEnvironment;

  private currentMode: OceanMode = 'surface';

  // Center on Indian Ocean / Arabian Sea
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
        4500000
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-75.0),
        roll: 0.0,
      },
    });
  }

  /**
   * Transitions camera between surface orbit and underwater depth inspection
   */
  public setMode(mode: OceanMode, depth = 0): void {
    this.currentMode = mode;

    if (mode === 'surface') {
      // Re-enable surface collision detection
      this.viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
      this.underwaterEnv.updateEnvironment(false, 0);

      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          this.targetLon,
          this.targetLat,
          2200000
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-65.0),
          roll: 0.0,
        },
        duration: 2.0,
      });
    } else {
      // Disable collision detection to allow subterranean water column orbit
      this.viewer.scene.screenSpaceCameraController.enableCollisionDetection = false;
      this.underwaterEnv.updateEnvironment(true, depth);

      // Camera altitude is a viewing vantage point relative to the depth stratum
      const cameraAltitude = -Math.max(50, depth * 0.7 + 600);

      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          this.targetLon - 1.5,
          this.targetLat - 1.5,
          cameraAltitude
        ),
        orientation: {
          heading: Cesium.Math.toRadians(25.0),
          pitch: Cesium.Math.toRadians(-22.0), // Perspective viewing the horizontal depth slice
          roll: 0.0,
        },
        duration: 2.2,
      });
    }
  }

  /**
   * Adjusts camera altitude when scientific depth slider moves
   */
  public setDepth(depth: number): void {
    if (this.currentMode === 'underwater') {
      this.underwaterEnv.updateEnvironment(true, depth);

      const cameraPos = this.viewer.camera.positionCartographic;
      const targetLon = Cesium.Math.toDegrees(cameraPos.longitude);
      const targetLat = Cesium.Math.toDegrees(cameraPos.latitude);

      const cameraAltitude = -Math.max(50, depth * 0.7 + 600);

      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          targetLon,
          targetLat,
          cameraAltitude
        ),
        orientation: {
          heading: this.viewer.camera.heading,
          pitch: this.viewer.camera.pitch,
          roll: this.viewer.camera.roll,
        },
        duration: 1.2,
      });
    }
  }
}
