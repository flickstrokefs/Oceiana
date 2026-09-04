import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';
import type { ArgoProfile, GliderTrajectory } from '../../types/ocean';

export class ObservationLayer {
  private viewer: Cesium.Viewer;
  private entities: Cesium.Entity[] = [];
  private handler: Cesium.ScreenSpaceEventHandler | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.renderObservations();
    this.initClickHandler();
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
    const topPos = Cesium.Cartesian3.fromDegrees(
      argo.longitude,
      argo.latitude,
      0
    );
    const bottomPos = Cesium.Cartesian3.fromDegrees(
      argo.longitude,
      argo.latitude,
      -2000
    );

    const profileLine = this.viewer.entities.add({
      name: argo.name,
      polyline: {
        positions: [topPos, bottomPos],
        width: 3.5,
        material: new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.0, 0.9, 1.0, 0.85)
        ),
      },
      properties: {
        obsType: 'argo',
        data: argo,
      },
    });
    this.entities.push(profileLine);

    const beacon = this.viewer.entities.add({
      name: argo.name + ' Surface Beacon',
      position: topPos,
      point: {
        pixelSize: 12,
        color: new Cesium.Color(1.0, 0.8, 0.0, 1.0),
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: argo.stationCode,
        font: '13px JetBrains Mono, sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 3,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -12),
      },
      properties: {
        obsType: 'argo',
        data: argo,
      },
    });
    this.entities.push(beacon);

    for (const node of argo.nodes) {
      const nodePos = Cesium.Cartesian3.fromDegrees(
        argo.longitude,
        argo.latitude,
        -node.depth
      );

      const nodeEntity = this.viewer.entities.add({
        position: nodePos,
        point: {
          pixelSize: 7,
          color: new Cesium.Color(0.0, 1.0, 0.8, 0.9),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 1,
        },
        properties: {
          obsType: 'argo',
          data: argo,
          nodeData: node,
        },
      });
      this.entities.push(nodeEntity);
    }
  }

  private renderGliderTrajectory(glider: GliderTrajectory): void {
    const positions = glider.waypoints.map((wp) =>
      Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, -wp.depth)
    );

    const trajectoryLine = this.viewer.entities.add({
      name: glider.name,
      polyline: {
        positions,
        width: 3.0,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.25,
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
        -latest.depth
      );

      const headMarker = this.viewer.entities.add({
        name: glider.name + ' Active Unit',
        position: gliderPos,
        point: {
          pixelSize: 10,
          color: new Cesium.Color(1.0, 0.0, 0.6, 1.0),
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: glider.name,
          font: '12px JetBrains Mono, sans-serif',
          fillColor: new Cesium.Color(1.0, 0.4, 0.8, 1.0),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -10),
        },
        properties: {
          obsType: 'glider',
          data: glider,
        },
      });
      this.entities.push(headMarker);
    }
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
