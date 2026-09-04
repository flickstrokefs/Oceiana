import * as Cesium from 'cesium';
import type { OceanMode } from '../types/ocean';
import { UnderwaterEnvironment } from './UnderwaterEnvironment';

export class CameraController {
  private viewer: Cesium.Viewer;
  private underwaterEnv: UnderwaterEnvironment;

  private currentMode: OceanMode = 'surface';

  // Center on Indian Ocean / Arabian Sea
  private targetLon = 65.0;
  private targetLat = 10.0;

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

  public setMode(mode: OceanMode, depth = 0): void {
    this.currentMode = mode;

    if (mode === 'surface') {
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
        duration: 2.2,
      });
    } else {
      const targetAltitude = -Math.max(10, depth);
      this.underwaterEnv.updateEnvironment(true, depth);

      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          this.targetLon,
          this.targetLat,
          targetAltitude
        ),
        orientation: {
          heading: Cesium.Math.toRadians(15.0),
          pitch: Cesium.Math.toRadians(-12.0),
          roll: 0.0,
        },
        duration: 2.5,
        complete: () => {
          this.underwaterEnv.updateEnvironment(true, depth);
        },
      });
    }
  }

  public setDepth(depth: number): void {
    if (this.currentMode === 'underwater') {
      this.underwaterEnv.updateEnvironment(true, depth);

      const cameraPos = this.viewer.camera.positionCartographic;
      const targetLon = Cesium.Math.toDegrees(cameraPos.longitude);
      const targetLat = Cesium.Math.toDegrees(cameraPos.latitude);

      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          targetLon,
          targetLat,
          -Math.max(10, depth)
        ),
        orientation: {
          heading: this.viewer.camera.heading,
          pitch: this.viewer.camera.pitch,
          roll: this.viewer.camera.roll,
        },
        duration: 1.5,
      });
    }
  }
}
