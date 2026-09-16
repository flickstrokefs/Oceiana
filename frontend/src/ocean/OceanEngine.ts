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
    this.viewer = viewer;
    this.underwaterEnv =
      new UnderwaterEnvironment(viewer);

    this.cameraController =
      new CameraController(
        viewer,
        this.underwaterEnv,
      );

    this.depthSliceRenderer =
      new DepthSliceRenderer(viewer);

    this.currentLayer =
      new CurrentLayer(viewer);

    this.obsLayer =
      new ObservationLayer(viewer);

    this.underwaterVolumeLayer =
      new UnderwaterVolumeLayer(viewer);

    this.oceanDomainLayer =
      new OceanDomainLayer(viewer);

    this.cameraController.setInitialView();

    this.bindState();
  }

  private bindState(): void {
    const oceanState =
      OceanState.getInstance();

    this.unsubscribeState =
      oceanState.subscribe((snapshot) => {
        const modeChanged =
          snapshot.mode !== this.lastMode;

        const depthChanged =
          snapshot.parameters.depth !==
          this.lastDepth;

        const varChanged =
          snapshot.activeVariable !==
          this.lastVariable;

        // ------------------------------------------------------
        // MODE / DEPTH
        // ------------------------------------------------------

        if (modeChanged || depthChanged) {
          if (modeChanged) {
            this.cameraController.setMode(
              snapshot.mode,
              snapshot.parameters.depth,
            );

            this.depthSliceRenderer.setMode(
              snapshot.mode,
              snapshot.parameters.depth,
            );

            this.oceanDomainLayer.setVisible(
              snapshot.mode === 'underwater',
            );

            this.underwaterVolumeLayer.setVisible(
              snapshot.mode === 'underwater',
            );
          } else {
            this.cameraController.setDepth(
              snapshot.parameters.depth,
            );

            this.depthSliceRenderer.setDepth(
              snapshot.parameters.depth,
            );
          }

          this.lastMode =
            snapshot.mode;

          this.lastDepth =
            snapshot.parameters.depth;
        }

        // ------------------------------------------------------
        // UNDERWATER REGION
        // ------------------------------------------------------

        if (
          snapshot.mode === 'underwater'
        ) {
          this.underwaterVolumeLayer.setRegion(
            snapshot.underwaterRegion,
          );

          this.underwaterVolumeLayer.setDepth(
            snapshot.parameters.depth,
            snapshot.activeVariable,
          );
        }

        // ------------------------------------------------------
        // VARIABLE
        // ------------------------------------------------------

        if (varChanged) {
          this.depthSliceRenderer.setVariable(
            snapshot.activeVariable,
          );

          this.currentLayer.setVisible(
            false,
          );

          this.lastVariable =
            snapshot.activeVariable;

          if (
            snapshot.mode === 'underwater'
          ) {
            this.underwaterVolumeLayer.setDepth(
              snapshot.parameters.depth,
              snapshot.activeVariable,
            );
          }
        }

        // ------------------------------------------------------
        // SHOW OBSERVATION ON GLOBE
        // ------------------------------------------------------

        if (
          snapshot.flyToObservationToken !==
          this.lastFlyToken
        ) {
          this.lastFlyToken =
            snapshot.flyToObservationToken;

          if (
            snapshot.selectedObservation
          ) {
            const focus =
              getObservationFocusCoords(
                snapshot.selectedObservation,
              );

            this.cameraController.flyToObservation(
              focus.longitude,
              focus.latitude,
            );

            this.obsLayer.applyHighlight(
              focus.id,
            );
          }
        }

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
      this.unsubscribeState = null;
    }

    this.oceanDomainLayer.destroy();
    this.underwaterVolumeLayer.destroy();

    this.depthSliceRenderer.destroy();
    this.currentLayer.destroy();
    this.obsLayer.destroy();

    this.underwaterEnv.destroy();
  }
}