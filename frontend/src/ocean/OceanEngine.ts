import type * as Cesium from 'cesium';

import { OceanState } from './OceanState';

import { CameraController } from '../cesium/CameraController';
import { UnderwaterEnvironment } from '../cesium/UnderwaterEnvironment';
import { DepthSliceRenderer } from './layers/DepthSliceRenderer';
import { CurrentLayer } from './layers/CurrentLayer';
import { ObservationLayer } from './layers/ObservationLayer';
import { UnderwaterVolumeLayer } from './layers/UnderwaterVolumeLayer';
import { OceanDomainLayer } from './layers/OceanDomainLayer';

import { getObservationFocusCoords } from '../services/observationService';

import type {
  OceanMode,
  OceanVariable,
} from '../types/ocean';

export class OceanEngine {
  private viewer: Cesium.Viewer;
  private cameraController: CameraController;
  private underwaterEnv: UnderwaterEnvironment;
  private depthSliceRenderer: DepthSliceRenderer;
  private currentLayer: CurrentLayer;
  private obsLayer: ObservationLayer;

  private underwaterVolumeLayer: UnderwaterVolumeLayer;
  private oceanDomainLayer: OceanDomainLayer;

  private unsubscribeState: (() => void) | null = null;

  private lastVariable: OceanVariable = 'temperature';
  private lastMode: OceanMode = 'surface';
  private lastDepth = 0;
  private lastFlyToken = 0;

  constructor(viewer: Cesium.Viewer) {
    this.underwaterEnv = new UnderwaterEnvironment(viewer);
    this.cameraController = new CameraController(viewer, this.underwaterEnv);
    this.depthSliceRenderer = new DepthSliceRenderer(viewer);
    this.currentLayer = new CurrentLayer(viewer);
    this.obsLayer = new ObservationLayer(viewer);

    this.cameraController.setInitialView();

    this.bindState();
  }

  private bindState(): void {
    const oceanState = OceanState.getInstance();

    this.unsubscribeState = oceanState.subscribe((snapshot) => {
      const modeChanged = snapshot.mode !== this.lastMode;
      const depthChanged = snapshot.parameters.depth !== this.lastDepth;
      const varChanged = snapshot.activeVariable !== this.lastVariable;

      if (modeChanged || depthChanged) {
        if (modeChanged) {
          this.cameraController.setMode(snapshot.mode, snapshot.parameters.depth);
          this.depthSliceRenderer.setMode(snapshot.mode, snapshot.parameters.depth);
        } else {
          this.cameraController.setDepth(snapshot.parameters.depth);
          this.depthSliceRenderer.setDepth(snapshot.parameters.depth);
        }
        this.lastMode = snapshot.mode;
        this.lastDepth = snapshot.parameters.depth;
      }

      if (varChanged) {
        this.depthSliceRenderer.setVariable(snapshot.activeVariable);
        this.currentLayer.setVisible(true);
        this.lastVariable = snapshot.activeVariable;
      }

      // Trigger update on depth slice renderer
      this.depthSliceRenderer.update();
    });
  }

  public resetView(): void {
    this.cameraController.resetCamera();
  }

  public destroy(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
      this.unsubscribeState = null;
    }
    this.depthSliceRenderer.destroy();
    this.currentLayer.destroy();
    this.obsLayer.destroy();

    this.underwaterEnv.destroy();
  }
}