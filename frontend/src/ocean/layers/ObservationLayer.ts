import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';
import type { ArgoProfile, GliderTrajectory } from '../../types/ocean';

export class ObservationLayer {
  private viewer: Cesium.Viewer;
  private entities: Cesium.Entity[] = [];
  private handler: Cesium.ScreenSpaceEventHandler | null = null;
  private unsubscribeState: (() => void) | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.renderObservations();
    this.initClickHandler();
    this.bindDepthObservationState();
  }

  private renderObservations(): void {
    const oceanState = OceanState.getInstance();
    const provider = oceanState.getProvider();

    const argoProfiles = provider.getArgoProfiles();
    for (const argo of argoProfiles) {
      this.renderArgoProfile(argo);
    }

    const gliders = provider.getGliderTrajectories();
    for (const glider of gliders) {
      this.renderGliderTrajectory(glider);
    }
  }

  private renderArgoProfile(argo: ArgoProfile): void {
    const pos = Cesium.Cartesian3.fromDegrees(argo.longitude, argo.latitude, 2000);

    // 1. Surface Beacon Pin
    const beacon = this.viewer.entities.add({
      name: argo.name,
      position: pos,
      point: {
        pixelSize: 13,
        color: new Cesium.Color(1.0, 0.8, 0.0, 1.0),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: new Cesium.CallbackProperty(() => {
          const snapshot = OceanState.getInstance().getSnapshot();
          const depth = snapshot.parameters.depth;
          const isUnderwater = snapshot.mode === 'underwater';

          // Find closest CTD reading
          let closest = argo.nodes[0];
          let minDiff = Math.abs(closest.depth - depth);
          for (const node of argo.nodes) {
            const diff = Math.abs(node.depth - depth);
            if (diff < minDiff) {
              minDiff = diff;
              closest = node;
            }
          }

          if (isUnderwater) {
            return `${argo.stationCode}\n[-${closest.depth}m: ${closest.temperature.toFixed(1)}°C | ${closest.salinity.toFixed(1)} PSU]`;
          }
          return `${argo.stationCode} (ARGO)`;
        }, false),
        font: 'bold 11px "JetBrains Mono", monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -14),
      },
      properties: {
        obsType: 'argo',
        data: argo,
      },
    });
    this.entities.push(beacon);

    // 2. Pulsing Radio Range Ring
    const rangeRing = this.viewer.entities.add({
      name: argo.name + ' Telemetry Ring',
      position: pos,
      ellipse: {
        semiMinorAxis: 45000.0,
        semiMajorAxis: 45000.0,
        material: new Cesium.ColorMaterialProperty(
          new Cesium.Color(1.0, 0.8, 0.0, 0.12)
        ),
        outline: true,
        outlineColor: new Cesium.Color(1.0, 0.8, 0.0, 0.5),
        outlineWidth: 1.5,
      },
    });
    this.entities.push(rangeRing);
  }

  private renderGliderTrajectory(glider: GliderTrajectory): void {
    const surfacePositions = glider.waypoints.map((wp) =>
      Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, 2000)
    );

    // Mission Track Polyline on ocean surface
    const trajectoryLine = this.viewer.entities.add({
      name: glider.name + ' Mission Track',
      polyline: {
        positions: surfacePositions,
        width: 3.0,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: new Cesium.Color(1.0, 0.3, 0.8, 0.9),
        }),
      },
      properties: {
        obsType: 'glider',
        data: glider,
      },
    });
    this.entities.push(trajectoryLine);

    if (glider.waypoints.length > 0) {
      const latest = glider.waypoints[glider.waypoints.length - 1];
      const gliderPos = Cesium.Cartesian3.fromDegrees(
        latest.longitude,
        latest.latitude,
        3000
      );

      const headMarker = this.viewer.entities.add({
        name: glider.name + ' Active Unit',
        position: gliderPos,
        point: {
          pixelSize: 12,
          color: new Cesium.Color(1.0, 0.0, 0.6, 1.0),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: `${glider.name}\n[ACTIVE SURVEY // ${glider.waypoints.length} WAYPOINTS]`,
          font: 'bold 11px "JetBrains Mono", monospace',
          fillColor: new Cesium.Color(1.0, 0.4, 0.8, 1.0),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
        },
        properties: {
          obsType: 'glider',
          data: glider,
        },
      });
      this.entities.push(headMarker);
    }
  }

  private bindDepthObservationState(): void {
    const oceanState = OceanState.getInstance();
    this.unsubscribeState = oceanState.subscribe(() => {
      // Re-trigger label properties on depth update
    });
  }

  private initClickHandler(): void {
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const pickedObject = this.viewer.scene.pick(click.position);

      if (Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.properties) {
        const props = pickedObject.id.properties;
        const obsType = props.obsType ? props.obsType.getValue() : null;
        const data = props.data ? props.data.getValue() : null;

        if (obsType && data) {
          OceanState.getInstance().selectObservation({
            type: obsType,
            data,
          });
          return;
        }
      }

      OceanState.getInstance().selectObservation(null);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  public destroy(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
    if (this.handler) {
      this.handler.destroy();
    }
    for (const e of this.entities) {
      if (!this.viewer.isDestroyed()) {
        this.viewer.entities.remove(e);
      }
    }
    this.entities = [];
  }
}

