import * as Cesium from 'cesium';
import type { OceanMode, UnderwaterRegionId } from '../types/ocean';
import { UnderwaterEnvironment } from './UnderwaterEnvironment';
import { localToWorld } from '../ocean/utils/underwaterCoords';

export class CameraController {
  private viewer: Cesium.Viewer;
  private underwaterEnv: UnderwaterEnvironment;

  private currentMode: OceanMode = 'surface';

  // Center on Indian Ocean / Arabian Sea analysis domain (72°E, 14.5°N)
  private targetLon = 72.0;
  private targetLat = 14.5;

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

  public setMode(mode: OceanMode, depth = 0, regionId?: UnderwaterRegionId | null): void {
    this.currentMode = mode;

    if (mode === 'surface') {
      this.underwaterEnv.updateEnvironment(false, 0);

      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(
          this.targetLon,
          this.targetLat,
          2800000
        ),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-65.0),
          roll: 0.0,
        },
        duration: 2.0,
      });
    } else {
      this.focusOnRegion(regionId ?? null, depth, 2.0);
    }
  }

  /**
   * Smoothly transitions the camera to focus directly on a single 3D region box,
   * making it fill most of the central analysis viewport.
   * If regionId is null, transitions to the 4-region domain overview perspective.
   */
  public focusOnRegion(
    regionId: UnderwaterRegionId | null,
    depth = 0,
    duration = 1.6
  ): void {
    if (this.viewer.isDestroyed()) return;
    this.underwaterEnv.updateEnvironment(true, depth);

    if (!regionId) {
      // Wide overview framing all 4 regions in the Indian Ocean domain
      this.viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(72.0, 5.0, 1350000),
        orientation: {
          heading: Cesium.Math.toRadians(0.0),
          pitch: Cesium.Math.toRadians(-40.0),
          roll: 0.0,
        },
        duration,
        complete: () => {
          this.underwaterEnv.updateEnvironment(true, depth);
        },
      });
      return;
    }

    // Local center offsets for each of the 4 independent 3D boxes
    const regionOffsets: Record<UnderwaterRegionId, { cx: number; cy: number }> = {
      'arabian-sea': { cx: -278571, cy: 192000 },
      'central-indian-ocean': { cx: 278571, cy: 192000 },
      'eastern-indian-ocean': { cx: 278571, cy: -192000 },
      'western-indian-ocean': { cx: -278571, cy: -192000 },
    };

    const coords = regionOffsets[regionId] || regionOffsets['arabian-sea'];
    // Position camera south of box center by 380km and up by 310km looking north at -38°
    const destination = localToWorld(coords.cx, coords.cy - 380000, 310000);

    this.viewer.camera.flyTo({
      destination,
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-38.0),
        roll: 0.0,
      },
      duration,
      complete: () => {
        this.underwaterEnv.updateEnvironment(true, depth);
      },
    });
  }

  public setDepth(depth: number): void {
    if (this.currentMode === 'underwater') {
      // Camera position remains fixed while depth slice moves inside the box
      this.underwaterEnv.updateEnvironment(true, depth);
    }
  }
}
