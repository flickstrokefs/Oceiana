import * as Cesium from 'cesium';
import { OceanState } from '../OceanState';
import type { ArgoProfile, GliderTrajectory, SelectedObservation } from '../../types/ocean';
import { fetchGliders } from '../../services/gliderService';
import { fetchArgoProfiles } from '../../services/argoService';

type ObsEntityMeta = {
  obsId: string;
  obsType: 'argo' | 'glider';
  role: 'marker' | 'ring' | 'track';
};

export class ObservationLayer {
  private viewer: Cesium.Viewer;
  private entities: Cesium.Entity[] = [];
  private gliderEntities: Cesium.Entity[] = [];
  private argoEntities: Cesium.Entity[] = [];
  private entityMeta = new Map<Cesium.Entity, ObsEntityMeta>();
  private handler: Cesium.ScreenSpaceEventHandler | null = null;
  private unsubscribeState: (() => void) | null = null;
  private highlightedId: string | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.renderObservations();
    this.initClickHandler();
    this.bindDepthObservationState();
  }

  private renderObservations(): void {
    void this.loadRealArgoProfiles();
    void this.loadRealGliders();
  }

  private async loadRealArgoProfiles(): Promise<void> {
    try {
      const argoProfiles = await fetchArgoProfiles();
      OceanState.getInstance().setArgoProfiles(argoProfiles);
      this.clearArgoEntities();
      for (const argo of argoProfiles) {
        this.renderArgoProfile(argo);
      }
      if (this.highlightedId) {
        this.applyHighlight(this.highlightedId);
      }
    } catch (err) {
      console.warn('[ObservationLayer] Could not fetch real Argo profiles from backend:', err);
      // Fallback to provider
      const provider = OceanState.getInstance().getProvider();
      for (const argo of provider.getArgoProfiles()) {
        this.renderArgoProfile(argo);
      }
    }
  }

  private clearArgoEntities(): void {
    for (const e of this.argoEntities) {
      if (!this.viewer.isDestroyed()) {
        this.viewer.entities.remove(e);
      }
      this.entityMeta.delete(e);
      const idx = this.entities.indexOf(e);
      if (idx !== -1) {
        this.entities.splice(idx, 1);
      }
    }
    this.argoEntities = [];
  }

  private async loadRealGliders(): Promise<void> {
    try {
      const gliders = await fetchGliders();
      OceanState.getInstance().setGliders(gliders);
      this.clearGliderEntities();
      for (const glider of gliders) {
        this.renderGliderTrajectory(glider);
      }
      if (this.highlightedId) {
        this.applyHighlight(this.highlightedId);
      }
    } catch (err) {
      console.warn('[ObservationLayer] Could not fetch real gliders from backend:', err);
    }
  }

  private clearGliderEntities(): void {
    for (const e of this.gliderEntities) {
      if (!this.viewer.isDestroyed()) {
        this.viewer.entities.remove(e);
      }
      this.entityMeta.delete(e);
      const idx = this.entities.indexOf(e);
      if (idx !== -1) {
        this.entities.splice(idx, 1);
      }
    }
    this.gliderEntities = [];
  }

  private renderArgoProfile(argo: ArgoProfile): void {
    const pos = Cesium.Cartesian3.fromDegrees(argo.longitude, argo.latitude, 2000);

    // 1. Surface Beacon Pin - Restrained 8px solid technical dot
    const beacon = this.viewer.entities.add({
      id: `obs-argo-marker-${argo.id}`,
      name: argo.name,
      position: pos,
      point: {
        pixelSize: 8,
        color: Cesium.Color.fromCssColorString('#c79a5b'), // Restrained instrument amber
        outlineColor: Cesium.Color.fromCssColorString('#1b1e22'),
        outlineWidth: 1.5,
      },
      label: {
        text: new Cesium.CallbackProperty(() => {
          const snapshot = OceanState.getInstance().getSnapshot();
          const depth = snapshot.parameters.depth;
          const isUnderwater = snapshot.mode === 'underwater';

          if (!argo.nodes || argo.nodes.length === 0) {
            return `● ${argo.stationCode}`;
          }

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
            return `● ${argo.stationCode} [-${closest.depth}m: ${closest.temperature.toFixed(1)}°C]`;
          }
          return `● ${argo.stationCode}`;
        }, false),
        font: '500 10px "IBM Plex Sans", -apple-system, sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.fromCssColorString('#c7cbd1'),
        outlineColor: Cesium.Color.fromCssColorString('#1b1e22'),
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -10),
      },
      properties: {
        obsType: 'argo',
        obsId: argo.id,
        data: argo,
      },
    });
    this.entities.push(beacon);
    this.argoEntities.push(beacon);
    this.entityMeta.set(beacon, { obsId: argo.id, obsType: 'argo', role: 'marker' });

    // 2. Subtle Coverage Ring
    const rangeRing = this.viewer.entities.add({
      id: `obs-argo-ring-${argo.id}`,
      name: argo.name + ' Range',
      position: pos,
      ellipse: {
        semiMinorAxis: 40000.0,
        semiMajorAxis: 40000.0,
        material: new Cesium.ColorMaterialProperty(
          new Cesium.Color(0.2, 0.25, 0.3, 0.04)
        ),
        outline: true,
        outlineColor: new Cesium.Color(0.35, 0.4, 0.45, 0.25),
        outlineWidth: 1.0,
      },
      properties: {
        obsType: 'argo',
        obsId: argo.id,
        data: argo,
      },
    });
    this.entities.push(rangeRing);
    this.argoEntities.push(rangeRing);
    this.entityMeta.set(rangeRing, { obsId: argo.id, obsType: 'argo', role: 'ring' });
  }

  private renderGliderTrajectory(glider: GliderTrajectory): void {
    const surfacePositions = glider.waypoints.map((wp) =>
      Cesium.Cartesian3.fromDegrees(wp.longitude, wp.latitude, 2000)
    );

    // Mission Track Polyline on ocean surface
    const trajectoryLine = this.viewer.entities.add({
      id: `obs-glider-track-${glider.id}`,
      name: glider.name + ' Mission Track',
      polyline: {
        positions: surfacePositions,
        width: 3.0,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.3,
          color: new Cesium.Color(0.12, 0.78, 0.59, 0.9), // solid teal (ARIEL), not magenta
        }),
      },
      properties: {
        obsType: 'glider',
        obsId: glider.id,
        data: glider,
      },
    });
    this.entities.push(trajectoryLine);
    this.gliderEntities.push(trajectoryLine);
    this.entityMeta.set(trajectoryLine, {
      obsId: glider.id,
      obsType: 'glider',
      role: 'track',
    });

    if (glider.waypoints.length > 0) {
      const latest = glider.waypoints[glider.waypoints.length - 1];
      const gliderPos = Cesium.Cartesian3.fromDegrees(
        latest.longitude,
        latest.latitude,
        3000
      );

      const headMarker = this.viewer.entities.add({
        id: `obs-glider-marker-${glider.id}`,
        name: glider.name + ' Active Unit',
        position: gliderPos,
        point: {
          pixelSize: 10,
          color: Cesium.Color.fromCssColorString('#00f0ff'), // Vibrant ARIEL cyan/teal
          outlineColor: Cesium.Color.fromCssColorString('#020b1c'),
          outlineWidth: 2.0,
        },
        label: {
          text: `● ${glider.name}`,
          font: '600 11px "IBM Plex Sans", -apple-system, sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.fromCssColorString('#e2e8f0'),
          outlineColor: Cesium.Color.fromCssColorString('#020617'),
          outlineWidth: 2.5,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
        },
        properties: {
          obsType: 'glider',
          obsId: glider.id,
          data: glider,
        },
      });
      this.entities.push(headMarker);
      this.gliderEntities.push(headMarker);
      this.entityMeta.set(headMarker, {
        obsId: glider.id,
        obsType: 'glider',
        role: 'marker',
      });

      // Operational range beacon ring
      const gliderRing = this.viewer.entities.add({
        id: `obs-glider-ring-${glider.id}`,
        name: glider.name + ' Range',
        position: gliderPos,
        ellipse: {
          semiMinorAxis: 40000.0,
          semiMajorAxis: 40000.0,
          material: new Cesium.ColorMaterialProperty(
            new Cesium.Color(0.0, 0.94, 1.0, 0.06)
          ),
          outline: true,
          outlineColor: new Cesium.Color(0.0, 0.94, 1.0, 0.5),
          outlineWidth: 1.5,
        },
        properties: {
          obsType: 'glider',
          obsId: glider.id,
          data: glider,
        },
      });
      this.entities.push(gliderRing);
      this.gliderEntities.push(gliderRing);
      this.entityMeta.set(gliderRing, {
        obsId: glider.id,
        obsType: 'glider',
        role: 'ring',
      });
    }
  }

  private bindDepthObservationState(): void {
    const oceanState = OceanState.getInstance();
    this.unsubscribeState = oceanState.subscribe((snapshot) => {
      const selectedId = snapshot.selectedObservation?.data.id ?? null;
      if (selectedId !== this.highlightedId) {
        this.applyHighlight(selectedId);
      }
    });
  }

  /**
   * Visually emphasize the selected Argo / Glider marker (+ track when glider).
   * Called from OceanState selection and Show on Globe.
   */
  public applyHighlight(obsId: string | null): void {
    this.highlightedId = obsId;

    for (const entity of this.entities) {
      const meta = this.entityMeta.get(entity);
      if (!meta) continue;
      const isSelected = obsId !== null && meta.obsId === obsId;

      if (meta.role === 'marker' && entity.point) {
        entity.point.pixelSize = new Cesium.ConstantProperty(isSelected ? 11 : 8);
        entity.point.outlineWidth = new Cesium.ConstantProperty(isSelected ? 2.5 : 1.5);
        entity.point.outlineColor = new Cesium.ConstantProperty(
          isSelected
            ? Cesium.Color.fromCssColorString('#5b8fc7') // Restrained selection blue
            : Cesium.Color.fromCssColorString('#1b1e22')
        );
      }

      if (meta.role === 'track' && entity.polyline) {
        entity.polyline.width = new Cesium.ConstantProperty(isSelected ? 4.0 : 2.0);
      }

      if (meta.role === 'ring' && entity.ellipse) {
        entity.ellipse.semiMajorAxis = new Cesium.ConstantProperty(isSelected ? 50000 : 40000);
        entity.ellipse.semiMinorAxis = new Cesium.ConstantProperty(isSelected ? 50000 : 40000);
      }
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
          const selection: SelectedObservation = {
            type: obsType,
            data,
          };
          // Opens Observation Profile modal via OceanState (globe stays mounted)
          OceanState.getInstance().selectObservation(selection);
          return;
        }
      }

      // Empty-globe click: clear selection + close modal
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
    this.clearGliderEntities();
    this.clearArgoEntities();
    for (const e of this.entities) {
      if (!this.viewer.isDestroyed()) {
        this.viewer.entities.remove(e);
      }
    }
    this.entities = [];
    this.entityMeta.clear();
  }
}
