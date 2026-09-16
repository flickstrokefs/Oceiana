import * as Cesium from 'cesium';

import { OceanState } from '../OceanState';

import {
  UNDERWATER_REGIONS,
  type UnderwaterRegionId,
  type OceanVariable,
} from '../../types/ocean';

import { UnderwaterRegionPolygon } from './UnderwaterRegionPolygon';

import {
  fetchUnderwaterRegionData,
} from '../provider/UnderwaterRegionDataProvider';

export class UnderwaterVolumeLayer {
  private viewer: Cesium.Viewer;

  private boxes: UnderwaterRegionPolygon[] = [];

  private visible = false;

  private currentDepth = 0;

  private currentVariable: OceanVariable =
    'temperature';

  private activeRegionId:
    UnderwaterRegionId | null = null;

  private hoveredRegionId:
    UnderwaterRegionId | null = null;

  private handler:
    Cesium.ScreenSpaceEventHandler | null = null;

  private isDestroyed = false;

  private querySequence = 0;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;

    const snapshot =
      OceanState.getInstance().getSnapshot();

    this.currentDepth =
      snapshot.parameters.depth;

    this.currentVariable =
      snapshot.activeVariable;

    this.activeRegionId =
      snapshot.underwaterRegion;

    this.createRegionBoxes();

    this.initInteraction();
  }

  private createRegionBoxes(): void {
    for (
      const definition of UNDERWATER_REGIONS
    ) {
      const box =
        new UnderwaterRegionPolygon(
          this.viewer,
          definition,
        );

      box.setVisible(false);
      box.setActive(false);

      this.boxes.push(box);
    }

    this.applyRegionVisibility();
  }

  private applyRegionVisibility(): void {
    if (!this.visible) {
      for (const box of this.boxes) {
        box.setVisible(false);
        box.setActive(false);
      }

      return;
    }

    /*
     * Nothing selected:
     * hide all water-body boxes.
     *
     * OceanDomainLayer handles the
     * Indian Ocean / Southern Ocean
     * parent boundaries.
     */
    if (!this.activeRegionId) {
      for (const box of this.boxes) {
        box.setVisible(false);
        box.setActive(false);
      }

      return;
    }

    /*
     * Show ONLY the selected water body.
     */
    for (const box of this.boxes) {
      const isActive =
        box.definition.id ===
        this.activeRegionId;

      box.setVisible(isActive);
      box.setActive(isActive);
    }
  }

  public async fetchActiveRegionData(): Promise<void> {
    if (
      !this.activeRegionId ||
      this.isDestroyed ||
      this.viewer.isDestroyed()
    ) {
      return;
    }

    const targetRegionId =
      this.activeRegionId;

    const targetBox =
      this.boxes.find(
        (box) =>
          box.definition.id ===
          targetRegionId,
      );

    if (!targetBox) {
      return;
    }

    const currentSequence =
      ++this.querySequence;

    try {
      const data =
        await fetchUnderwaterRegionData({
          regionId:
            targetRegionId,

          depth:
            this.currentDepth,

          variable:
            this.currentVariable,
        });

      if (
        this.isDestroyed ||
        currentSequence !==
          this.querySequence
      ) {
        return;
      }

      targetBox.setData(data);
    } catch (error) {
      console.error(
        'Failed to load underwater region data:',
        error,
      );
    }
  }

  private initInteraction(): void {
    this.handler =
      new Cesium.ScreenSpaceEventHandler(
        this.viewer.scene.canvas,
      );

    this.handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (
          this.isDestroyed ||
          !this.visible
        ) {
          return;
        }

        const picked =
          this.viewer.scene.pick(
            movement.position,
          );

        if (
          !Cesium.defined(picked) ||
          !picked.id
        ) {
          return;
        }

        const entity =
          picked.id as Cesium.Entity;

        const regionId =
          entity.properties
            ?.regionId
            ?.getValue(
              Cesium.JulianDate.now(),
            ) as
            | UnderwaterRegionId
            | undefined;

        if (!regionId) {
          return;
        }

        OceanState
          .getInstance()
          .setUnderwaterRegion(
            regionId,
          );
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    );

    this.handler.setInputAction(
      (
        movement: Cesium.ScreenSpaceEventHandler.MotionEvent,
      ) => {
        if (
          this.isDestroyed ||
          !this.visible
        ) {
          return;
        }

        const picked =
          this.viewer.scene.pick(
            movement.endPosition,
          );

        let hovered:
          UnderwaterRegionId | null =
            null;

        if (
          Cesium.defined(picked) &&
          picked.id
        ) {
          const entity =
            picked.id as Cesium.Entity;

          hovered =
            entity.properties
              ?.regionId
              ?.getValue(
                Cesium.JulianDate.now(),
              ) as
              | UnderwaterRegionId
              | undefined
              ?? null;
        }

        if (
          hovered !==
          this.hoveredRegionId
        ) {
          this.hoveredRegionId =
            hovered;

          for (
            const box of this.boxes
          ) {
            box.setHovered(
              box.definition.id ===
                hovered,
            );
          }
        }
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE,
    );
  }

  public setRegion(
    regionId:
      UnderwaterRegionId | null,
  ): void {
    if (
      this.activeRegionId ===
      regionId
    ) {
      return;
    }

    this.activeRegionId =
      regionId;

    this.applyRegionVisibility();

    if (regionId) {
      void this.fetchActiveRegionData();
    }
  }

  public setDepth(
    depth: number,
    variable: OceanVariable =
      this.currentVariable,
  ): void {
    this.currentDepth = depth;
    this.currentVariable = variable;

    for (const box of this.boxes) {
      box.setDepth(depth);
    }

    if (this.activeRegionId) {
      void this.fetchActiveRegionData();
    }
  }

  public setVisible(
    visible: boolean,
  ): void {
    this.visible = visible;

    this.applyRegionVisibility();
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    this.querySequence++;

    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }

    for (const box of this.boxes) {
      box.destroy();
    }

    this.boxes = [];
  }
}