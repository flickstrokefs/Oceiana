import * as Cesium from 'cesium';
import type { PFZCoordinate } from '../../types/fishery';

export class FisheryGlobeLayer {
  private viewer: Cesium.Viewer;
  private entities: Cesium.Entity[] = [];
  private clickHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private onSelectPFZCallback: ((pfz: PFZCoordinate) => void) | null = null;

  constructor(viewer: Cesium.Viewer) {
    this.viewer = viewer;
    this.initInteractionHandler();
  }

  private initInteractionHandler(): void {
    if (this.viewer.isDestroyed()) return;
    this.clickHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);

    this.clickHandler.setInputAction((movement: { position: Cesium.Cartesian2 }) => {
      if (this.viewer.isDestroyed()) return;
      const picked = this.viewer.scene.pick(movement.position);
      if (Cesium.defined(picked) && picked.id && picked.id._pfzData) {
        const pfz = picked.id._pfzData as PFZCoordinate;
        if (this.onSelectPFZCallback) {
          this.onSelectPFZCallback(pfz);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  public setOnSelectPFZ(cb: (pfz: PFZCoordinate) => void): void {
    this.onSelectPFZCallback = cb;
  }

  public flyToBasin(basinName: string): void {
    if (this.viewer.isDestroyed()) return;
    const lower = basinName.toLowerCase();
    let destLon = 73.0;
    let destLat = 15.0;
    let altitude = 3200000;

    if (lower.includes('bengal') || lower.includes('east')) {
      destLon = 86.5;
      destLat = 14.0;
    } else if (lower.includes('southern')) {
      destLon = 70.0;
      destLat = -52.0;
      altitude = 4800000;
    }

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(destLon, destLat, altitude),
      orientation: {
        heading: 0.0,
        pitch: Cesium.Math.toRadians(-65.0),
        roll: 0.0,
      },
      duration: 1.6,
    });
  }

  public flyToPFZ(lat: number, lon: number, altitude = 850000): void {
    if (this.viewer.isDestroyed()) return;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
      orientation: {
        heading: 0.0,
        pitch: Cesium.Math.toRadians(-55.0),
        roll: 0.0,
      },
      duration: 1.5,
    });
  }

  public renderPFZs(
    points: PFZCoordinate[],
    selectedId?: string | null
  ): void {
    this.clearEntities();
    if (this.viewer.isDestroyed()) return;

    for (const p of points) {
      const isSelected = selectedId === p.id;
      const isOfficial = p.is_official !== false;
      const hexColor = isOfficial ? '#10b981' : '#06b6d4'; // Emerald for Official INCOIS, Cyan for Derived
      const color = Cesium.Color.fromCssColorString(hexColor);

      // Centroid Beacon Point
      const beacon = this.viewer.entities.add({
        name: p.zone_name || `PFZ: ${p.sector || p.id}`,
        position: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, 6000),
        point: {
          pixelSize: isSelected ? 16 : 11,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: isSelected ? 3 : 1.5,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${p.zone_name || p.sector || 'PFZ'}\nSST: ${p.sst ?? '--'}°C | Chl: ${p.chlorophyll ?? '--'} mg/m³`,
          font: 'bold 10px "JetBrains Mono", sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 3,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -14),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
        },
      });

      (beacon as unknown as { _pfzData: PFZCoordinate })._pfzData = p;
      this.entities.push(beacon);

      // Concentric Radar Circle
      const circle = this.viewer.entities.add({
        name: `${p.id} Fishing Ground Envelope`,
        position: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, 500),
        ellipse: {
          semiMinorAxis: isSelected ? 45000 : 30000,
          semiMajorAxis: isSelected ? 45000 : 30000,
          material: color.withAlpha(isSelected ? 0.35 : 0.15),
          outline: true,
          outlineColor: color.withAlpha(0.8),
          outlineWidth: 2,
        },
      });
      (circle as unknown as { _pfzData: PFZCoordinate })._pfzData = p;
      this.entities.push(circle);
    }
  }

  public clearEntities(): void {
    for (const e of this.entities) {
      if (!this.viewer.isDestroyed()) {
        this.viewer.entities.remove(e);
      }
    }
    this.entities = [];
  }

  public destroy(): void {
    this.clearEntities();
    if (this.clickHandler) {
      this.clickHandler.destroy();
      this.clickHandler = null;
    }
  }
}
