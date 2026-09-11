import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';
import {
  UW_DIMENSIONS,
  localToWorld,
} from '../utils/underwaterCoords';
import {
  UNDERWATER_REGIONS,
  type UnderwaterRegionId,
  type OceanVariable,
} from '../../types/ocean';
import { UnderwaterRegionBox } from './UnderwaterRegionBox';
import { fetchUnderwaterRegionData } from '../provider/UnderwaterRegionDataProvider';

export class UnderwaterVolumeLayer {
  private viewer: Cesium.Viewer;
  private boxes: UnderwaterRegionBox[] = [];
  private masterLabels: Cesium.Entity[] = [];
  private visible = false;
  private currentDepth = 0;
  private currentVariable: OceanVariable = 'temperature';
  private activeRegionId: UnderwaterRegionId | null = null;
  private hoveredRegionId: UnderwaterRegionId | null = null;
  private handler: Cesium.ScreenSpaceEventHandler | null = null;
  private isDestroyed = false;
  private querySequence = 0;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    const snapshot = OceanState.getInstance().getSnapshot();
    this.currentDepth = snapshot.parameters.depth;
    this.currentVariable = snapshot.activeVariable;
    this.activeRegionId = snapshot.underwaterRegion;

    this.initMasterVolume();
    this.initInteraction();
  }

  private initMasterVolume(): void {
    // 1. Geographic context boundary annotations for the overview mode
    this.createGeographicLabels();

    // 2. Instantiate FOUR SEPARATE 3D analysis boxes
    for (const def of UNDERWATER_REGIONS) {
      const box = new UnderwaterRegionBox(this.viewer, def);
      this.boxes.push(box);
    }

    // 3. Apply initial visibility (only active box is shown if one is selected)
    this.applyRegionVisibility();

    // 4. If a region is active, query its dataset
    if (this.activeRegionId) {
      this.fetchActiveRegionData();
    }
  }

  /**
   * Outer geographic annotations defining the Indian Ocean analytical space
   */
  private createGeographicLabels(): void {
    const hx = UW_DIMENSIONS.halfWidthX;
    const hy = UW_DIMENSIONS.halfLengthY;

    // North Header: Domain title
    const headerPos = localToWorld(0, hy + 45000, 30000);
    const headerEntity = this.viewer.entities.add({
      position: headerPos,
      label: {
        text: 'INDIAN OCEAN / ARABIAN SEA\nMODULAR 3D ANALYSIS SYSTEM',
        font: 'bold 13px JetBrains Mono, monospace',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: new Cesium.Color(0.1, 0.9, 1.0, 0.90),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 4,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });
    this.masterLabels.push(headerEntity);

    // Longitude boundary tags along South edge
    const lonTags = [
      { text: '58°E (WEST BOUND)', x: -hx, y: -hy - 25000 },
      { text: '86°E (EAST BOUND)', x: hx, y: -hy - 25000 },
    ];

    for (const tag of lonTags) {
      const tagEntity = this.viewer.entities.add({
        position: localToWorld(tag.x, tag.y, 0),
        label: {
          text: tag.text,
          font: '10px JetBrains Mono, monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: new Cesium.Color(0.0, 0.85, 1.0, 0.65),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.TOP,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      this.masterLabels.push(tagEntity);
    }

    // Latitude boundary tags along East edge
    const latTags = [
      { text: '7°N (SOUTH)', x: hx + 25000, y: -hy },
      { text: '22°N (NORTH)', x: hx + 25000, y: hy },
    ];

    for (const tag of latTags) {
      const tagEntity = this.viewer.entities.add({
        position: localToWorld(tag.x, tag.y, 0),
        label: {
          text: tag.text,
          font: '10px JetBrains Mono, monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: new Cesium.Color(0.0, 0.85, 1.0, 0.65),
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.CENTER,
          horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
      });
      this.masterLabels.push(tagEntity);
    }
  }

  /**
   * Applies the single-region isolation rule:
   * When a region is active, HIDE the other 3 regions completely and show ONLY the selected region.
   * When no region is active (overview mode), show all 4 wireframes subtly.
   */
  private applyRegionVisibility(): void {
    if (this.activeRegionId) {
      // Single full-screen analysis volume
      for (const box of this.boxes) {
        if (box.definition.id === this.activeRegionId) {
          box.setVisible(this.visible);
          box.setActive(true);
        } else {
          box.setVisible(false); // Completely hidden!
          box.setActive(false);
          box.clearData();       // Discard unused points/arrows
        }
      }
      // Hide outer context labels to keep view 100% focused on active box
      for (const l of this.masterLabels) {
        l.show = false;
      }
    } else {
      // Overview mode: show all 4 boxes as context outlines
      for (const box of this.boxes) {
        box.setVisible(this.visible);
        box.setActive(false);
        box.clearData();
      }
      for (const l of this.masterLabels) {
        l.show = this.visible;
      }
    }
  }

  /**
   * Refreshes data ONLY for the currently active region through the decoupled provider service.
   * Architecture: REGION DEFINITION -> DATA QUERY -> DATASET -> VISUALIZATION
   */
  public async fetchActiveRegionData(): Promise<void> {
    if (!this.activeRegionId || this.isDestroyed || this.viewer.isDestroyed()) return;

    const targetRegionId = this.activeRegionId;
    const targetBox = this.boxes.find((b) => b.definition.id === targetRegionId);
    if (!targetBox) return;

    const currentSeq = ++this.querySequence;

    try {
      const data = await fetchUnderwaterRegionData({
        regionId: targetRegionId,
        depth: this.currentDepth,
        variable: this.currentVariable,
      });

      // Guard against component destruction or user switching region while query was in-flight
      if (
        this.isDestroyed ||
        this.viewer.isDestroyed() ||
        this.activeRegionId !== targetRegionId ||
        currentSeq !== this.querySequence
      ) {
        return;
      }

      targetBox.setData(data);
    } catch (err) {
      console.warn(`Error fetching region data for ${targetRegionId}:`, err);
    }
  }

  /**
   * Initializes interactive mouse picking for 3D box selection and hover feedback
   */
  private initInteraction(): void {
    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    // Left click to select region box (especially useful in overview mode)
    this.handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      if (!this.visible || this.viewer.isDestroyed()) return;

      const picked = this.viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id && picked.id.properties) {
        const regId = picked.id.properties.regionId
          ? (picked.id.properties.regionId.getValue() as UnderwaterRegionId)
          : null;
        if (regId && regId !== this.activeRegionId) {
          OceanState.getInstance().setUnderwaterRegion(regId);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Mouse move for hover feedback in overview mode
    this.handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
      if (!this.visible || this.viewer.isDestroyed() || this.activeRegionId !== null) return;

      const picked = this.viewer.scene.pick(movement.endPosition);
      let newHover: UnderwaterRegionId | null = null;

      if (Cesium.defined(picked) && picked.id && picked.id.properties) {
        const regId = picked.id.properties.regionId
          ? (picked.id.properties.regionId.getValue() as UnderwaterRegionId)
          : null;
        if (regId) {
          newHover = regId;
        }
      }

      if (newHover !== this.hoveredRegionId) {
        this.hoveredRegionId = newHover;
        for (const box of this.boxes) {
          box.setHovered(box.definition.id === newHover);
        }
        if (this.viewer.canvas) {
          this.viewer.canvas.style.cursor = newHover ? 'pointer' : 'default';
        }
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  public setRegion(regionId: UnderwaterRegionId | null): void {
    if (this.activeRegionId === regionId) return;
    this.activeRegionId = regionId;

    this.applyRegionVisibility();

    if (this.activeRegionId) {
      const activeBox = this.boxes.find((b) => b.definition.id === this.activeRegionId);
      if (activeBox) {
        activeBox.setDepth(this.currentDepth);
      }
      this.fetchActiveRegionData();
    }
  }

  public setDepth(depth: number, variable?: OceanVariable): void {
    this.currentDepth = depth;
    if (variable) {
      this.currentVariable = variable;
    }

    if (this.activeRegionId) {
      const activeBox = this.boxes.find((b) => b.definition.id === this.activeRegionId);
      if (activeBox) {
        activeBox.setDepth(depth);
      }
      this.fetchActiveRegionData();
    } else {
      for (const box of this.boxes) {
        box.setDepth(depth);
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.visible = visible;
    this.applyRegionVisibility();
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }
    if (!this.viewer.isDestroyed()) {
      for (const l of this.masterLabels) {
        this.viewer.entities.remove(l);
      }
    }
    this.masterLabels = [];
    for (const box of this.boxes) {
      box.destroy();
    }
    this.boxes = [];
  }
}
