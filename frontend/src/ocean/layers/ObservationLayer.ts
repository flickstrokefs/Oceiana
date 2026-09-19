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
  private static readonly LABEL_DISTANCE_METERS = 1_200_000;
  private viewer: Cesium.Viewer;
  private entities: Cesium.Entity[] = [];
  private gliderEntities: Cesium.Entity[] = [];
  private argoEntities: Cesium.Entity[] = [];
  private entityMeta = new Map<Cesium.Entity, ObsEntityMeta>();
  private handler: Cesium.ScreenSpaceEventHandler | null = null;
  private unsubscribeState: (() => void) | null = null;
  private highlightedId: string | null = null;
  private hoverCard: HTMLDivElement | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.renderObservations();
    this.createHoverCard();
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
    if (this.viewer.isDestroyed() || !this.viewer.entities) return;
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
            return `● ${argo.stationCode} [-${closest.depth}m: ${closest.temperature?.toFixed(1) ?? 'N/A'}°C]`;
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
        distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, ObservationLayer.LABEL_DISTANCE_METERS),
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
    if (this.viewer.isDestroyed() || !this.viewer.entities) return;
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
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, ObservationLayer.LABEL_DISTANCE_METERS),
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
      this.setOpacity('glider', snapshot.visualization.gliderOpacity / 100, snapshot.visualization.showGliders);
      this.setOpacity('argo', snapshot.visualization.argoOpacity / 100, snapshot.visualization.showArgo);
    });
  }

  private createHoverCard(): void {
    const card = document.createElement('div');
    card.className = 'instrument-hover-card';
    card.style.display = 'none';
    this.viewer.container.appendChild(card);
    this.hoverCard = card;
  }

  private static value(value: number | null | undefined, unit: string): string {
    return value == null || !Number.isFinite(value) ? 'N/A' : `${value.toFixed(2)} ${unit}`;
  }

  private showHoverCard(type: 'argo' | 'glider', data: ArgoProfile | GliderTrajectory, position: Cesium.Cartesian2): void {
    if (!this.hoverCard) return;
    const glider = type === 'glider' ? data as GliderTrajectory : null;
    const argo = type === 'argo' ? data as ArgoProfile : null;
    const latest = glider?.waypoints[glider.waypoints.length - 1];
    const latitude = argo?.latitude ?? latest?.latitude;
    const longitude = argo?.longitude ?? latest?.longitude;
    const coordinate = (value: number | undefined, positive: string, negative: string) => value == null || !Number.isFinite(value) ? 'N/A' : `${Math.abs(value).toFixed(3)}°${value >= 0 ? positive : negative}`;
    const row = (label: string, value: string) => `<div class="instrument-hover-row"><span>${label}</span><strong>${value}</strong></div>`;
    const name = argo?.stationCode ?? glider?.name ?? 'Unknown instrument';
    this.hoverCard.innerHTML = `<div class="instrument-hover-kind ${type}">${type === 'argo' ? 'ARGO FLOAT' : 'GLIDER'}</div><div class="instrument-hover-name"></div>${row('Lat', coordinate(latitude, 'N', 'S'))}${row('Lon', coordinate(longitude, 'E', 'W'))}${row('Depth', latest ? `${latest.depth.toFixed(0)} m` : 'N/A')}${row('Temperature', ObservationLayer.value(latest?.temperature, '°C'))}${row('Salinity', ObservationLayer.value(latest?.salinity, 'PSU'))}`;
    const nameElement = this.hoverCard.querySelector('.instrument-hover-name');
    if (nameElement) nameElement.textContent = name;
    this.hoverCard.style.left = `${position.x + 16}px`;
    this.hoverCard.style.top = `${position.y + 16}px`;
    this.hoverCard.style.display = 'block';
  }

  private hideHoverCard(): void { if (this.hoverCard) this.hoverCard.style.display = 'none'; }

  private setOpacity(type: 'glider' | 'argo', opacity: number, visible: boolean): void {
    const entities = type === 'glider' ? this.gliderEntities : this.argoEntities;
    const color = Cesium.Color.fromCssColorString(type === 'glider' ? '#00f0ff' : '#c79a5b').withAlpha(opacity);
    for (const entity of entities) {
      entity.show = visible;
      if (entity.point?.color) entity.point.color = new Cesium.ConstantProperty(color);
      if (entity.label?.fillColor) entity.label.fillColor = new Cesium.ConstantProperty(Cesium.Color.WHITE.withAlpha(opacity));
      if (entity.polyline?.material) entity.polyline.material = new Cesium.ColorMaterialProperty(color);
      if (entity.ellipse?.material) entity.ellipse.material = new Cesium.ColorMaterialProperty(color.withAlpha(opacity * 0.15));
    }
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
          OceanState.getInstance().setQueryPoint(data.latitude, data.longitude);
          const selection: SelectedObservation = {
            type: obsType,
            data,
          };
          // Opens Observation Profile modal via OceanState (globe stays mounted)
          OceanState.getInstance().selectObservation(selection);
          return;
        }
      }

      const ray = this.viewer.camera.getPickRay(click.position);
      const cartesian = ray && (this.viewer.scene.globe.pick(ray, this.viewer.scene) || this.viewer.camera.pickEllipsoid(click.position));
      if (cartesian) {
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        OceanState.getInstance().setQueryPoint(Cesium.Math.toDegrees(cartographic.latitude), Cesium.Math.toDegrees(cartographic.longitude));
      }
      // Empty-globe click: clear observation selection, retaining the new query point.
      OceanState.getInstance().selectObservation(null);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    this.handler.setInputAction((movement: { endPosition: Cesium.Cartesian2 }) => {
      const picked = this.viewer.scene.pick(movement.endPosition);
      const props = Cesium.defined(picked) && picked.id?.properties ? picked.id.properties : null;
      const type = props?.obsType?.getValue();
      const data = props?.data?.getValue();
      if ((type === 'argo' || type === 'glider') && data) {
        this.showHoverCard(type, data, movement.endPosition);
      } else {
        this.hideHoverCard();
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  }

  public destroy(): void {
    if (this.unsubscribeState) {
      this.unsubscribeState();
    }
    if (this.handler) {
      this.handler.destroy();
    }
    this.hoverCard?.remove();
    this.hoverCard = null;
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
