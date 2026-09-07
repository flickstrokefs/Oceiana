import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';
import type { ArgoProfile, GliderTrajectory } from '../../types/ocean';

export class ObservationLayer {
  private viewer: Cesium.Viewer;
  private entities: Cesium.Entity[] = [];
  private nodeEntities: { entity: Cesium.Entity; depth: number }[] = [];
  private handler: Cesium.ScreenSpaceEventHandler | null = null;
  private unsubscribeState: (() => void) | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.renderObservations();
    this.initClickHandler();
    this.bindDepthHighlight();
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
    // Top surface position (z = 0)
    const topPos = Cesium.Cartesian3.fromDegrees(
      argo.longitude,
      argo.latitude,
      0
    );
    // Deepest profile point (z = -2000)
    const bottomPos = Cesium.Cartesian3.fromDegrees(
      argo.longitude,
      argo.latitude,
      -2000
    );

    // 1. Vertical CTD sounding line spanning entire water column
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

    // 2. Surface GPS telemetry beacon
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
        font: '13px JetBrains Mono, monospace',
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

    // 3. Discrete CTD Sensor depth nodes at their exact physical depths
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
      this.nodeEntities.push({ entity: nodeEntity, depth: node.depth });
    }
  }

  private renderGliderTrajectory(glider: GliderTrajectory): void {
    const positions = glider.waypoints.map((wp) =>
      Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, -wp.depth)
    );

    // True 3D Sawtooth dive trajectory in the water column
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
          font: '12px JetBrains Mono, monospace',
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

  /**
   * Visually highlights sensor nodes intersecting with the active scientific depth
   */
  private bindDepthHighlight(): void {
    const oceanState = OceanState.getInstance();
    this.unsubscribeState = oceanState.subscribe((snapshot) => {
      const activeDepth = snapshot.parameters.depth;
      const isUnderwater = snapshot.mode === 'underwater';

      for (const item of this.nodeEntities) {
        if (!item.entity.point) continue;

        const isNearActiveDepth = isUnderwater && Math.abs(item.depth - activeDepth) <= 50;

        if (isNearActiveDepth) {
          item.entity.point.pixelSize = new Cesium.ConstantProperty(12);
          item.entity.point.color = new Cesium.ConstantProperty(
            new Cesium.Color(1.0, 0.9, 0.0, 1.0) // Glowing amber highlight
          );
          item.entity.point.outlineWidth = new Cesium.ConstantProperty(2);
          item.entity.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE);
        } else {
          item.entity.point.pixelSize = new Cesium.ConstantProperty(7);
          item.entity.point.color = new Cesium.ConstantProperty(
            new Cesium.Color(0.0, 1.0, 0.8, 0.9)
          );
          item.entity.point.outlineWidth = new Cesium.ConstantProperty(1);
          item.entity.point.outlineColor = new Cesium.ConstantProperty(Cesium.Color.BLACK);
        }
      }
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
    this.nodeEntities = [];
  }
}
