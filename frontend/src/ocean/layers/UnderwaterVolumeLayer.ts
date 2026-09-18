import * as Cesium from 'cesium';

import { OceanState } from '../OceanState';

import {
  UNDERWATER_REGIONS,
  type UnderwaterRegionId,
  type OceanDomainId,
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

  private activeDomainId:
    OceanDomainId | null = 'indian-ocean';

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

    this.activeDomainId =
      snapshot.selectedOceanDomain ?? (snapshot.underwaterRegion === 'southern-ocean' ? 'southern-ocean' : 'indian-ocean');

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

    const domain =
      this.activeDomainId ??
      (this.activeRegionId === 'southern-ocean'
        ? 'southern-ocean'
        : 'indian-ocean');

    if (domain === 'southern-ocean') {
      for (const box of this.boxes) {
        const isSO = box.definition.id === 'southern-ocean';
        box.setVisible(isSO);
        box.setActive(isSO);
      }
      return;
    }

    /*
     * INDIAN OCEAN DOMAIN
     *
     * When Indian Ocean is selected, ALL of Indian Ocean basin
     * and ALL its constituent marginal seas (Arabian Sea, Bay of Bengal,
     * Andaman Sea, Laccadive Sea, Java Sea) are rendered in 3D grids and meshes.
     */
    const indianOceanIds = new Set<string>([
      'indian-ocean',
      'arabian-sea',
      'bay-of-bengal',
      'andaman-sea',
      'laccadive-sea',
      'java-sea',
    ]);

    for (const box of this.boxes) {
      const isIndian = indianOceanIds.has(box.definition.id);

      if (!isIndian) {
        box.setVisible(false);
        box.setActive(false);
        continue;
      }

      // Render grid and mesh for all Indian Ocean water bodies
      box.setVisible(true);

      // If a specific sub-sea is selected, focus/activate it;
      // if 'indian-ocean' or null is selected, all Indian Ocean bodies are active!
      const isActive =
        !this.activeRegionId ||
        this.activeRegionId === 'indian-ocean' ||
        box.definition.id === this.activeRegionId;

      box.setActive(isActive);
    }
  }

  public async fetchActiveRegionData(): Promise<void> {
    if (
      this.isDestroyed ||
      this.viewer.isDestroyed() ||
      !this.visible
    ) {
      return;
    }

    const currentSequence =
      ++this.querySequence;

    const visibleBoxes = this.boxes.filter(
      (box) => box.getIsVisible(),
    );

    if (visibleBoxes.length === 0) {
      return;
    }

    await Promise.all(
      visibleBoxes.map(async (box) => {
        try {
          const data =
            await fetchUnderwaterRegionData({
              regionId:
                box.definition.id,

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

          box.setData(data);
        } catch (error) {
          console.error(
            `Failed to load underwater region data for ${box.definition.id}:`,
            error,
          );
        }
      }),
    );
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

  public setDomainAndRegion(
    domainId: OceanDomainId | null,
    regionId: UnderwaterRegionId | null,
  ): void {
    if (
      this.activeDomainId === domainId &&
      this.activeRegionId === regionId
    ) {
      return;
    }

    this.activeDomainId = domainId;
    this.activeRegionId = regionId;

    this.applyRegionVisibility();

    if (this.visible) {
      void this.fetchActiveRegionData();
    }
  }

  public setRegion(
    regionId: UnderwaterRegionId | null,
  ): void {
    const domain: OceanDomainId =
      regionId === 'southern-ocean'
        ? 'southern-ocean'
        : 'indian-ocean';

    this.setDomainAndRegion(domain, regionId);
  }

  public setDomain(
    domainId: OceanDomainId | null,
  ): void {
    const region: UnderwaterRegionId | null =
      domainId === 'southern-ocean'
        ? 'southern-ocean'
        : (this.activeRegionId && this.activeRegionId !== 'southern-ocean' ? this.activeRegionId : 'indian-ocean');

    this.setDomainAndRegion(domainId, region);
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

    if (this.visible) {
      void this.fetchActiveRegionData();
    }
  }

  public setVisible(
    visible: boolean,
  ): void {
    this.visible = visible;

    this.applyRegionVisibility();

    if (visible) {
      void this.fetchActiveRegionData();
    }
  }

  public reapplyColors(): void {
    if (this.isDestroyed) {
      return;
    }

    for (const box of this.boxes) {
      box.reapplyColors();
    }
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