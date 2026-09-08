import type * as Cesium from 'cesium';
import { OceanState } from './OceanState';
import { CameraController } from '../cesium/CameraController';
import { UnderwaterEnvironment } from '../cesium/UnderwaterEnvironment';
import { TemperatureLayer } from './layers/TemperatureLayer';
import { SalinityLayer } from './layers/SalinityLayer';
import { CurrentLayer } from './layers/CurrentLayer';
import { ChlorophyllLayer } from './layers/ChlorophyllLayer';
import { ObservationLayer } from './layers/ObservationLayer';
import { UnderwaterDepthPointsLayer } from './layers/UnderwaterDepthPointsLayer';
import { UnderwaterVolumeLayer } from './layers/UnderwaterVolumeLayer';
import type { OceanMode, OceanVariable, UnderwaterRegionId } from '../types/ocean';

export class OceanEngine {
  private cameraController: CameraController;
  private underwaterEnv: UnderwaterEnvironment;

  private tempLayer: TemperatureLayer;
  private salinityLayer: SalinityLayer;
  private currentLayer: CurrentLayer;
  private chlLayer: ChlorophyllLayer;
  private obsLayer: ObservationLayer;
  private underwaterDepthLayer: UnderwaterDepthPointsLayer;
  private underwaterVolume: UnderwaterVolumeLayer;

  private unsubscribeState: (() => void) | null = null;
  private lastVariable: OceanVariable = 'temperature';
  private lastMode: OceanMode = 'surface';
  private lastDepth = 0;
  private lastRegion: UnderwaterRegionId | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.underwaterEnv = new UnderwaterEnvironment(viewer);
    this.cameraController = new CameraController(viewer, this.underwaterEnv);
    this.tempLayer = new TemperatureLayer(viewer);
    this.salinityLayer = new SalinityLayer(viewer);
    this.currentLayer = new CurrentLayer(viewer);
    this.chlLayer = new ChlorophyllLayer(viewer);
    this.obsLayer = new ObservationLayer(viewer);
    this.underwaterDepthLayer = new UnderwaterDepthPointsLayer(viewer);
    this.underwaterVolume = new UnderwaterVolumeLayer(viewer);

    this.cameraController.setInitialView();
    this.bindState();
  }

  private bindState(): void {
    const oceanState = OceanState.getInstance();

    this.unsubscribeState = oceanState.subscribe((snapshot) => {
      const modeChanged = snapshot.mode !== this.lastMode;
      const depthChanged = snapshot.parameters.depth !== this.lastDepth;
      const varChanged = snapshot.activeVariable !== this.lastVariable;
      const regionChanged = snapshot.underwaterRegion !== this.lastRegion;

      if (modeChanged) {
        this.cameraController.setMode(
          snapshot.mode,
          snapshot.parameters.depth,
          snapshot.underwaterRegion
        );
        this.lastMode = snapshot.mode;
      } else if (depthChanged) {
        this.cameraController.setDepth(snapshot.parameters.depth);
        this.lastDepth = snapshot.parameters.depth;
      }

      if (snapshot.mode === 'underwater') {
        // In underwater mode, hide 2D surface draped textures and global surface current particles
        this.tempLayer.setVisible(false);
        this.salinityLayer.setVisible(false);
        this.chlLayer.setVisible(false);
        this.currentLayer.setVisible(false);

        // Show 3D depth-point slice and 3D ocean volume cutaway
        this.underwaterVolume.setVisible(true);
        this.underwaterDepthLayer.setVisible(true);

        if (depthChanged || modeChanged || varChanged) {
          this.underwaterVolume.setDepth(snapshot.parameters.depth, snapshot.activeVariable);
        }

        if (regionChanged || modeChanged) {
          this.underwaterVolume.setRegion(snapshot.underwaterRegion);
          if (!modeChanged && regionChanged) {
            this.cameraController.focusOnRegion(
              snapshot.underwaterRegion,
              snapshot.parameters.depth
            );
          }
        }

        if (depthChanged || varChanged || modeChanged || regionChanged) {
          this.underwaterDepthLayer.filterByDepth(
            snapshot.parameters.depth,
            snapshot.activeVariable,
            snapshot.underwaterRegion
          );
        }
      } else {
        // In surface mode, hide 3D depth points and 3D ocean volume; restore surface drape & currents
        this.underwaterVolume.setVisible(false);
        this.underwaterDepthLayer.setVisible(false);
        this.currentLayer.setVisible(true);

        this.tempLayer.setVisible(snapshot.activeVariable === 'temperature');
        this.salinityLayer.setVisible(snapshot.activeVariable === 'salinity');
        this.chlLayer.setVisible(snapshot.activeVariable === 'chlorophyll');

        if (varChanged || depthChanged) {
          if (snapshot.activeVariable === 'temperature') this.tempLayer.update();
          if (snapshot.activeVariable === 'salinity') this.salinityLayer.update();
          if (snapshot.activeVariable === 'chlorophyll') this.chlLayer.update();
        }
      }

      this.lastVariable = snapshot.activeVariable;
      this.lastDepth = snapshot.parameters.depth;
      this.lastRegion = snapshot.underwaterRegion;
    });
  }

  public resetView(): void {
    this.cameraController.setInitialView();
  }

  public destroy(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
    this.tempLayer.destroy();
    this.salinityLayer.destroy();
    this.currentLayer.destroy();
    this.chlLayer.destroy();
    this.obsLayer.destroy();
    this.underwaterDepthLayer.destroy();
    this.underwaterVolume.destroy();
    this.underwaterEnv.destroy();
  }
}
