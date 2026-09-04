import type * as Cesium from 'cesium';
import { OceanState } from './OceanState';
import { CameraController } from '../cesium/CameraController';
import { UnderwaterEnvironment } from '../cesium/UnderwaterEnvironment';
import { TemperatureLayer } from './layers/TemperatureLayer';
import { SalinityLayer } from './layers/SalinityLayer';
import { CurrentLayer } from './layers/CurrentLayer';
import { ChlorophyllLayer } from './layers/ChlorophyllLayer';
import { ObservationLayer } from './layers/ObservationLayer';
import type { OceanMode, OceanVariable } from '../types/ocean';

export class OceanEngine {
  private cameraController: CameraController;
  private underwaterEnv: UnderwaterEnvironment;

  private tempLayer: TemperatureLayer;
  private salinityLayer: SalinityLayer;
  private currentLayer: CurrentLayer;
  private chlLayer: ChlorophyllLayer;
  private obsLayer: ObservationLayer;

  private unsubscribeState: (() => void) | null = null;
  private lastVariable: OceanVariable = 'temperature';
  private lastMode: OceanMode = 'surface';
  private lastDepth = 0;

  constructor(viewer: Cesium.Viewer) {
    this.underwaterEnv = new UnderwaterEnvironment(viewer);
    this.cameraController = new CameraController(viewer, this.underwaterEnv);

    this.tempLayer = new TemperatureLayer(viewer);
    this.salinityLayer = new SalinityLayer(viewer);
    this.currentLayer = new CurrentLayer(viewer);
    this.chlLayer = new ChlorophyllLayer(viewer);
    this.obsLayer = new ObservationLayer(viewer);

    this.cameraController.setInitialView();
    this.bindState();
  }

  private bindState(): void {
    const oceanState = OceanState.getInstance();

    this.unsubscribeState = oceanState.subscribe((snapshot) => {
      if (
        snapshot.mode !== this.lastMode ||
        snapshot.parameters.depth !== this.lastDepth
      ) {
        if (snapshot.mode !== this.lastMode) {
          this.cameraController.setMode(snapshot.mode, snapshot.parameters.depth);
        } else {
          this.cameraController.setDepth(snapshot.parameters.depth);
        }
        this.lastMode = snapshot.mode;
        this.lastDepth = snapshot.parameters.depth;
      }

      if (snapshot.activeVariable !== this.lastVariable) {
        this.tempLayer.setVisible(snapshot.activeVariable === 'temperature');
        this.salinityLayer.setVisible(snapshot.activeVariable === 'salinity');
        this.chlLayer.setVisible(snapshot.activeVariable === 'chlorophyll');
        this.lastVariable = snapshot.activeVariable;
      }

      this.tempLayer.update();
      this.salinityLayer.update();
      this.chlLayer.update();
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
    this.underwaterEnv.destroy();
  }
}
