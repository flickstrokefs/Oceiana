import type * as Cesium from 'cesium';
import { OceanState } from './OceanState';
import { CameraController } from '../cesium/CameraController';
import { UnderwaterEnvironment } from '../cesium/UnderwaterEnvironment';
import { DepthSliceRenderer } from './layers/DepthSliceRenderer';
import { CurrentLayer } from './layers/CurrentLayer';
import { ObservationLayer } from './layers/ObservationLayer';
import { getObservationFocusCoords } from '../services/observationService';
import type { OceanMode, OceanVariable, UnderwaterRegionId } from '../types/ocean';

export class OceanEngine {
  private viewer: Cesium.Viewer;
  private cameraController: CameraController;
  private underwaterEnv: UnderwaterEnvironment;
  private depthSliceRenderer: DepthSliceRenderer;
  private currentLayer: CurrentLayer;
  private obsLayer: ObservationLayer;

  private unsubscribeState: (() => void) | null = null;
  private lastVariable: OceanVariable = 'temperature';
  private lastMode: OceanMode = 'surface';
  private lastDepth = 0;
  private lastFlyToken = 0;
  private lastLocationFlyToken = 0;
  private lastRegion: UnderwaterRegionId | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
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
      const regionChanged = snapshot.underwaterRegion !== this.lastRegion;

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

      if (regionChanged && snapshot.underwaterRegion) {
        this.lastRegion = snapshot.underwaterRegion;
        this.cameraController.flyToRegion(snapshot.underwaterRegion);
      }

      // Show on Globe — fly existing camera; do not recreate Cesium / reset layers
      if (snapshot.flyToObservationToken !== this.lastFlyToken) {
        this.lastFlyToken = snapshot.flyToObservationToken;
        if (snapshot.selectedObservation) {
          const focus = getObservationFocusCoords(snapshot.selectedObservation);
          this.cameraController.flyToObservation(focus.longitude, focus.latitude);
          this.obsLayer.applyHighlight(focus.id);
        }
      }

      // Universal Location / Region / Coordinate Fly-To
      if (snapshot.flyToLocationRequest && snapshot.flyToLocationRequest.token !== this.lastLocationFlyToken) {
        this.lastLocationFlyToken = snapshot.flyToLocationRequest.token;
        this.cameraController.flyTo({
          latitude: snapshot.flyToLocationRequest.latitude,
          longitude: snapshot.flyToLocationRequest.longitude,
          altitude: snapshot.flyToLocationRequest.altitude,
          heading: snapshot.flyToLocationRequest.heading,
          pitch: snapshot.flyToLocationRequest.pitch,
          duration: snapshot.flyToLocationRequest.duration || 2.0,
        });
      }

      // Trigger update on depth slice renderer
      this.depthSliceRenderer.update();
    });
  }

  public getCameraController(): CameraController {
    return this.cameraController;
  }

  public getViewer(): Cesium.Viewer {
    return this.viewer;
  }

  public resetView(): void {
    this.cameraController.resetCamera();
  }

  public destroy(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
    this.depthSliceRenderer.destroy();
    this.currentLayer.destroy();
    this.obsLayer.destroy();
    this.cameraController.destroy();
    this.underwaterEnv.destroy();
  }
}
