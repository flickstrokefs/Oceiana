import * as Cesium from 'cesium';

import { OceanState } from '../OceanState';
import {
  UNDERWATER_REGIONS,
  type UnderwaterRegionId,
  type OceanDomainId,
  type OceanVariable,
  type UnderwaterRegionData,
} from '../../types/ocean';
import { UnderwaterRegionPolygon } from './UnderwaterRegionPolygon';
import { UnderwaterFieldMesh } from './UnderwaterFieldMesh';
import {
  fetchUnderwaterRegionData,
} from '../provider/UnderwaterRegionDataProvider';

export class UnderwaterVolumeLayer {
  private viewer: Cesium.Viewer;

  private boxes: UnderwaterRegionPolygon[] = [];

  private visible = false;

  private currentDepth = 0;

  private currentVariable: OceanVariable = 'temperature';

  private activeDomainId: OceanDomainId | null = 'indian-ocean';

  private activeRegionId: UnderwaterRegionId | null = null;

  private hoveredRegionId: UnderwaterRegionId | null = null;

  private handler: Cesium.ScreenSpaceEventHandler | null = null;

  private isDestroyed = false;

  // Single scientific 3D mesh architecture
  private activeMesh: UnderwaterFieldMesh | null = null;
  private activeSectorId: UnderwaterRegionId | null = null;
  private activeSectorData: UnderwaterRegionData | null = null;
  private abortController: AbortController | null = null;
  private depthDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;

    const snapshot = OceanState.getInstance().getSnapshot();

    this.currentDepth = snapshot.parameters.depth;
    this.currentVariable = snapshot.activeVariable;
    this.activeDomainId =
      snapshot.selectedOceanDomain ??
      (snapshot.underwaterRegion === 'southern-ocean' ? 'southern-ocean' : 'indian-ocean');
    this.activeRegionId = snapshot.underwaterRegion;

    this.createRegionBoxes();
    this.initInteraction();
  }

  public getActiveMeshCount(): number {
    return this.activeMesh ? 1 : 0;
  }

  private createRegionBoxes(): void {
    for (const definition of UNDERWATER_REGIONS) {
      const box = new UnderwaterRegionPolygon(this.viewer, definition);
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

    if (
      this.activeDomainId === 'southern-ocean' ||
      this.activeRegionId === 'southern-ocean'
    ) {
      for (const box of this.boxes) {
        const isSO = box.definition.id === 'southern-ocean';
        box.setVisible(isSO);
        box.setActive(isSO && box.definition.id === this.activeRegionId);
      }
      return;
    }

    // In Indian Ocean / Arabian Sea mode:
    // Show lightweight boundaries for marginal seas and sectors (no Southern Ocean)
    for (const box of this.boxes) {
      if (box.definition.id === 'southern-ocean') {
        box.setVisible(false);
        box.setActive(false);
        continue;
      }
      box.setVisible(true);
      box.setActive(box.definition.id === this.activeRegionId);
    }
  }

  private destroyActiveMesh(): void {
    if (this.activeMesh) {
      this.activeMesh.destroy();
      this.activeMesh = null;
    }
    this.activeSectorId = null;
    this.activeSectorData = null;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  public async loadSectorMesh(regionId: UnderwaterRegionId | null): Promise<void> {
    if (this.isDestroyed || this.viewer.isDestroyed() || !this.visible) {
      this.destroyActiveMesh();
      return;
    }

    if (!regionId) {
      this.destroyActiveMesh();
      return;
    }

    // If same sector and mesh is already populated, update depth / colors locally
    if (this.activeSectorId === regionId && this.activeMesh && this.activeSectorData) {
      this.activeMesh.setDepth(this.currentDepth);
      return;
    }

    // Destroy previous mesh immediately before creating/requesting new one
    this.destroyActiveMesh();

    const definition = UNDERWATER_REGIONS.find((r) => r.id === regionId);
    if (!definition) {
      return;
    }

    const controller = new AbortController();
    this.abortController = controller;
    this.activeSectorId = regionId;

    try {
      const data = await fetchUnderwaterRegionData(
        {
          regionId,
          depth: this.currentDepth,
          variable: this.currentVariable,
        },
        controller.signal
      );

      if (
        this.isDestroyed ||
        this.viewer.isDestroyed() ||
        !this.visible ||
        controller.signal.aborted ||
        this.activeSectorId !== regionId
      ) {
        return;
      }

      this.activeSectorData = data;

      // Ensure any previous mesh is removed
      if (this.activeMesh) {
        this.activeMesh.destroy();
      }

      // Create exactly ONE scientific 3D mesh
      const mesh = new UnderwaterFieldMesh(this.viewer, definition);
      mesh.setVisible(this.visible);
      mesh.setActive(true);
      const exaggeration = OceanState.getInstance().getSnapshot().visualization.verticalExaggeration;
      mesh.setVerticalExaggeration(exaggeration);
      mesh.setData(data);
      mesh.setDepth(this.currentDepth);

      this.activeMesh = mesh;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      console.error(`Failed to load scientific mesh for sector ${regionId}:`, err);
    }
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

    if (this.visible && regionId) {
      void this.loadSectorMesh(regionId);
    } else if (!regionId) {
      this.destroyActiveMesh();
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
        : null;

    this.setDomainAndRegion(domainId, region);
  }

  public setDepth(
    depth: number,
    variable: OceanVariable = this.currentVariable,
  ): void {
    this.currentDepth = depth;
    const varChanged = this.currentVariable !== variable;
    this.currentVariable = variable;

    for (const box of this.boxes) {
      box.setDepth(depth);
    }

    if (!this.visible || !this.activeRegionId) {
      return;
    }

    // If activeMesh and activeSectorData already exist for this sector:
    // Update locally without network requests!
    if (this.activeMesh && this.activeSectorData && this.activeSectorId === this.activeRegionId) {
      this.activeMesh.setDepth(depth);
      if (varChanged) {
        this.activeMesh.reapplyColors();
      }
      return;
    }

    // If data is genuinely not available locally, debounce network request
    if (this.depthDebounceTimer) {
      clearTimeout(this.depthDebounceTimer);
    }
    this.depthDebounceTimer = setTimeout(() => {
      if (this.visible && this.activeRegionId && !this.isDestroyed) {
        void this.loadSectorMesh(this.activeRegionId);
      }
    }, 200);
  }

  public setVisible(
    visible: boolean,
  ): void {
    this.visible = visible;
    this.applyRegionVisibility();

    if (visible) {
      if (this.activeRegionId) {
        void this.loadSectorMesh(this.activeRegionId);
      }
    } else {
      // Exiting underwater mode: destroy scientific mesh completely
      this.destroyActiveMesh();
    }
  }

  public setVerticalExaggeration(scale: number): void {
    if (this.activeMesh) {
      this.activeMesh.setVerticalExaggeration(scale);
    }
  }

  public reapplyColors(): void {
    if (this.isDestroyed) {
      return;
    }

    for (const box of this.boxes) {
      box.reapplyColors();
    }

    if (this.activeMesh) {
      this.activeMesh.reapplyColors();
    }
  }

  private initInteraction(): void {
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        if (this.isDestroyed || !this.visible) {
          return;
        }

        const picked = this.viewer.scene.pick(movement.position);

        if (!Cesium.defined(picked) || !picked.id) {
          return;
        }

        const entity = picked.id as Cesium.Entity;
        const regionId = entity.properties?.regionId?.getValue(
          Cesium.JulianDate.now(),
        ) as UnderwaterRegionId | undefined;

        if (!regionId) {
          return;
        }

        OceanState.getInstance().setUnderwaterRegion(regionId);
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK,
    );

    this.handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (this.isDestroyed || !this.visible) {
          return;
        }

        const picked = this.viewer.scene.pick(movement.endPosition);
        let hovered: UnderwaterRegionId | null = null;

        if (Cesium.defined(picked) && picked.id) {
          const entity = picked.id as Cesium.Entity;
          hovered =
            (entity.properties?.regionId?.getValue(
              Cesium.JulianDate.now(),
            ) as UnderwaterRegionId | undefined) ?? null;
        }

        if (hovered !== this.hoveredRegionId) {
          this.hoveredRegionId = hovered;
          for (const box of this.boxes) {
            box.setHovered(box.definition.id === hovered);
          }
        }
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE,
    );
  }

  public destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    this.isDestroyed = true;

    if (this.depthDebounceTimer) {
      clearTimeout(this.depthDebounceTimer);
      this.depthDebounceTimer = null;
    }

    this.destroyActiveMesh();

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