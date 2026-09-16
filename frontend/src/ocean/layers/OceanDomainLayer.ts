import * as Cesium from 'cesium';

import { OceanState } from '../OceanState';
import {
  OCEAN_DOMAINS,
  type OceanDomainId,
} from '../../types/ocean';

import { geoToWorld } from '../utils/underwaterCoords';

export class OceanDomainLayer {
  private viewer: Cesium.Viewer;

  private entities: Cesium.Entity[] = [];

  private handler:
    Cesium.ScreenSpaceEventHandler | null = null;

  private visible = false;
  private destroyed = false;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;

    this.createDomainBorders();
    this.initInteraction();
  }

  private createDomainBorders(): void {
    for (const domain of OCEAN_DOMAINS) {
      const positions = domain.footprint.map(
        ([longitude, latitude]) =>
          geoToWorld(longitude, latitude, 0),
      );

      positions.push(positions[0]);

      const border =
        this.viewer.entities.add({
          polyline: {
            positions,
            width: 3,
            arcType: Cesium.ArcType.NONE,

            material:
              new Cesium.ColorMaterialProperty(
                new Cesium.Color(
                  0.0,
                  0.85,
                  1.0,
                  0.9,
                ),
              ),
          },

          properties: {
            oceanDomain: domain.id,
          },
        });

      border.show = false;

      this.entities.push(border);
    }
  }

  private initInteraction(): void {
    this.handler =
      new Cesium.ScreenSpaceEventHandler(
        this.viewer.scene.canvas,
      );

    this.handler.setInputAction(
      (click: {
        position: Cesium.Cartesian2;
      }) => {
        if (
          !this.visible ||
          this.destroyed ||
          this.viewer.isDestroyed()
        ) {
          return;
        }

        const picked =
          this.viewer.scene.pick(
            click.position,
          );

        if (
          !Cesium.defined(picked) ||
          !picked.id ||
          !picked.id.properties
        ) {
          return;
        }

        const property =
          picked.id.properties.oceanDomain;

        if (!property) {
          return;
        }

        const domain =
          property.getValue() as OceanDomainId;

        if (!domain) return;

        OceanState
          .getInstance()
          .setOceanDomain(domain);
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    );
  }

  public setVisible(
    visible: boolean,
  ): void {
    this.visible = visible;

    for (const entity of this.entities) {
      entity.show = visible;
    }
  }

  public destroy(): void {
    if (this.destroyed) return;

    this.destroyed = true;

    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }

    for (const entity of this.entities) {
      this.viewer.entities.remove(entity);
    }

    this.entities = [];
  }
}