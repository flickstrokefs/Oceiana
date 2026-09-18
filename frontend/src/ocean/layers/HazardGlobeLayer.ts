import * as Cesium from 'cesium';
import type { HazardRegionResult, HazardGridData } from '../../types/hazard';

export interface SectorCentroidInfo {
  name: string;
  lat: number;
  lon: number;
  latMin: number;
  latMax: number;
  lonMin: number;
  lonMax: number;
}

export const SUB_BASIN_COORDINATES: Record<string, SectorCentroidInfo> = {
  north_arabian_sea: {
    name: 'North Arabian Sea',
    lat: 21.25,
    lon: 65.0,
    latMin: 17.0,
    latMax: 25.5,
    lonMin: 58.0,
    lonMax: 72.0,
  },
  central_bay_of_bengal: {
    name: 'Central Bay of Bengal',
    lat: 15.75,
    lon: 87.5,
    latMin: 11.0,
    latMax: 20.5,
    lonMin: 82.0,
    lonMax: 93.0,
  },
  'lakshadweep_&_malabar_margin': {
    name: 'Lakshadweep & Malabar Margin',
    lat: 11.25,
    lon: 73.25,
    latMin: 8.0,
    latMax: 14.5,
    lonMin: 70.0,
    lonMax: 76.5,
  },
  andaman_sea_basin: {
    name: 'Andaman Sea Basin',
    lat: 11.75,
    lon: 93.25,
    latMin: 8.5,
    latMax: 15.0,
    lonMin: 91.5,
    lonMax: 95.0,
  },
  southern_ocean_polar_convergence: {
    name: 'Southern Ocean Polar Convergence',
    lat: -57.5,
    lon: 70.0,
    latMin: -65.0,
    latMax: -50.0,
    lonMin: 55.0,
    lonMax: 85.0,
  },
};

export class HazardGlobeLayer {
  private viewer: Cesium.Viewer;
  private entities: Cesium.Entity[] = [];
  private gridImageryLayer: Cesium.ImageryLayer | null = null;
  private clickHandler: Cesium.ScreenSpaceEventHandler | null = null;
  private onSelectSectorCallback: ((sector: HazardRegionResult) => void) | null = null;

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
      if (Cesium.defined(picked) && picked.id && picked.id._hazardSectorData) {
        const sectorData = picked.id._hazardSectorData as HazardRegionResult;
        if (this.onSelectSectorCallback) {
          this.onSelectSectorCallback(sectorData);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  }

  public setOnSelectSector(cb: (sector: HazardRegionResult) => void): void {
    this.onSelectSectorCallback = cb;
  }

  public flyToBasin(basinName: string): void {
    if (this.viewer.isDestroyed()) return;

    const lower = basinName.toLowerCase();
    let destLon = 76.0;
    let destLat = 4.0;
    let altitude = 8000000;
    let pitch = -75;

    if (lower.includes('arabian')) {
      destLon = 66.5;
      destLat = 16.0;
      altitude = 3300000;
      pitch = -68;
    } else if (lower.includes('bengal') || lower.includes('bay')) {
      destLon = 87.5;
      destLat = 15.0;
      altitude = 3300000;
      pitch = -68;
    } else if (lower.includes('southern')) {
      destLon = 70.0;
      destLat = -53.0;
      altitude = 4800000;
      pitch = -60;
    }

    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(destLon, destLat, altitude),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(pitch),
        roll: 0.0,
      },
      duration: 1.8,
    });
  }

  public flyToSector(lat: number, lon: number, altitude = 1400000): void {
    if (this.viewer.isDestroyed()) return;
    this.viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, altitude),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-60.0),
        roll: 0.0,
      },
      duration: 1.6,
    });
  }

  public renderSectors(
    regions: HazardRegionResult[],
    selectedSectorId?: string | null
  ): void {
    this.clearSectorEntities();
    if (this.viewer.isDestroyed()) return;

    for (const r of regions) {
      const secKey = r.region_id || r.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const coords = SUB_BASIN_COORDINATES[secKey] || this.estimateCoordsFromRegion(r);
      if (!coords) continue;

      const isSelected = selectedSectorId === (r.region_id || r.name);
      const isCritical = r.risk_level === 'CRITICAL';
      const isHigh = r.risk_level === 'HIGH';
      const isModerate = r.risk_level === 'MODERATE';

      let hexColor = '#06b6d4'; // Low / normal cyan
      if (isCritical) hexColor = '#ef4444'; // Red
      else if (isHigh) hexColor = '#f59e0b'; // Orange
      else if (isModerate) hexColor = '#eab308'; // Amber

      const color = Cesium.Color.fromCssColorString(hexColor);
      const exceedArea = r.area_exceeded_km2 ?? 0;

      // 1. Sector Centroid Beacon Point
      const beaconEntity = this.viewer.entities.add({
        name: `Hazard Sector: ${r.name}`,
        position: Cesium.Cartesian3.fromDegrees(coords.lon, coords.lat, 8000),
        point: {
          pixelSize: isSelected ? 18 : 14,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: `${r.name}\n[${r.risk_level}] Peak: ${r.max_value ?? '--'}${r.area_exceeded_km2 ? ` | Exceeded: ${r.area_exceeded_km2.toLocaleString()} km²` : ''}`,
          font: 'bold 11px "JetBrains Mono", sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: color,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 4,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -18),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15000000),
        },
      });

      // Attach data for click picking
      (beaconEntity as unknown as { _hazardSectorData: HazardRegionResult })._hazardSectorData = r;
      this.entities.push(beaconEntity);

      // 2. Glowing Boundary Rectangle for the sub-basin sector
      const rectEntity = this.viewer.entities.add({
        name: `${r.name} Boundary`,
        rectangle: {
          coordinates: Cesium.Rectangle.fromDegrees(
            coords.lonMin,
            coords.latMin,
            coords.lonMax,
            coords.latMax
          ),
          material: color.withAlpha(exceedArea > 0 ? (isSelected ? 0.28 : 0.16) : 0.06),
          outline: true,
          outlineColor: color.withAlpha(isSelected ? 0.95 : 0.65),
          outlineWidth: isSelected ? 3 : 1.5,
          height: 1000,
        },
      });
      (rectEntity as unknown as { _hazardSectorData: HazardRegionResult })._hazardSectorData = r;
      this.entities.push(rectEntity);
    }
  }

  private estimateCoordsFromRegion(r: HazardRegionResult): SectorCentroidInfo | null {
    const name = r.name.toLowerCase();
    if (name.includes('arabian')) {
      return { name: r.name, lat: 18.0, lon: 65.0, latMin: 12.0, latMax: 24.0, lonMin: 58.0, lonMax: 72.0 };
    }
    if (name.includes('bengal')) {
      return { name: r.name, lat: 15.0, lon: 88.0, latMin: 10.0, latMax: 21.0, lonMin: 81.0, lonMax: 93.0 };
    }
    if (name.includes('southern')) {
      return { name: r.name, lat: -55.0, lon: 70.0, latMin: -65.0, latMax: -48.0, lonMin: 55.0, lonMax: 85.0 };
    }
    return null;
  }

  public renderHazardGrid(
    gridData: HazardGridData,
    opacity = 0.75,
    threshold?: number | null
  ): void {
    if (this.viewer.isDestroyed()) return;

    // Remove existing imagery layer
    if (this.gridImageryLayer) {
      this.viewer.imageryLayers.remove(this.gridImageryLayer);
      this.gridImageryLayer = null;
    }

    if (!gridData.latitudes.length || !gridData.longitudes.length || !gridData.values.length) {
      return;
    }

    const minLat = Math.min(...gridData.latitudes);
    const maxLat = Math.max(...gridData.latitudes);
    const minLon = Math.min(...gridData.longitudes);
    const maxLon = Math.max(...gridData.longitudes);

    // Render Canvas texture with smooth interpolation
    const canvas = document.createElement('canvas');
    const cols = gridData.longitudes.length;
    const rows = gridData.latitudes.length;
    canvas.width = Math.max(128, cols * 4);
    canvas.height = Math.max(128, rows * 4);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Temporary offscreen canvas for raw values
    const rawCanvas = document.createElement('canvas');
    rawCanvas.width = cols;
    rawCanvas.height = rows;
    const rawCtx = rawCanvas.getContext('2d');
    if (!rawCtx) return;

    const imgData = rawCtx.createImageData(cols, rows);
    const minVal = gridData.min_value;
    const maxVal = gridData.max_value;
    const range = maxVal - minVal || 1.0;
    const activeThresh = threshold ?? gridData.threshold ?? null;

    const isLatAscending = gridData.latitudes[gridData.latitudes.length - 1] > gridData.latitudes[0];

    for (let r = 0; r < rows; r++) {
      const dataRowIdx = isLatAscending ? rows - 1 - r : r;
      for (let c = 0; c < cols; c++) {
        const val = gridData.values[dataRowIdx]?.[c];
        const pixelIdx = (r * cols + c) * 4;

        if (val === null || val === undefined || isNaN(val)) {
          imgData.data[pixelIdx + 3] = 0;
          continue;
        }

        const norm = Math.max(0, Math.min(1, (val - minVal) / range));
        const isExceed = activeThresh !== null && val >= activeThresh;

        // Scientific Turbo-style RGBA
        const [red, green, blue] = this.getTurboColor(norm);

        imgData.data[pixelIdx] = red;
        imgData.data[pixelIdx + 1] = green;
        imgData.data[pixelIdx + 2] = blue;
        // High opacity for exceedance hotspots, translucent for background ocean
        imgData.data[pixelIdx + 3] = isExceed ? 245 : 160;
      }
    }

    rawCtx.putImageData(imgData, 0, 0);

    // Smooth upscale to canvas using high-quality bicubic smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(rawCanvas, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/png');

    const provider = new Cesium.SingleTileImageryProvider({
      url: dataUrl,
      rectangle: Cesium.Rectangle.fromDegrees(minLon, minLat, maxLon, maxLat),
    });

    const layer = this.viewer.imageryLayers.addImageryProvider(provider);
    layer.alpha = Math.max(0.1, Math.min(1.0, opacity));
    this.gridImageryLayer = layer;
  }

  public setGridOpacity(opacity: number): void {
    if (this.gridImageryLayer) {
      this.gridImageryLayer.alpha = Math.max(0.05, Math.min(1.0, opacity));
    }
  }

  private getTurboColor(t: number): [number, number, number] {
    const c = Math.max(0, Math.min(1, t));
    let r = 0, g = 0, b = 0;
    if (c < 0.25) {
      const f = c / 0.25;
      r = Math.round(30 * (1 - f));
      g = Math.round(80 * f + 20);
      b = Math.round(150 + 105 * f);
    } else if (c < 0.5) {
      const f = (c - 0.25) / 0.25;
      r = Math.round(20 * (1 - f));
      g = Math.round(100 + 120 * f);
      b = Math.round(255 * (1 - f * 0.7));
    } else if (c < 0.75) {
      const f = (c - 0.5) / 0.25;
      r = Math.round(255 * f);
      g = Math.round(220 + 35 * (1 - f));
      b = Math.round(75 * (1 - f));
    } else {
      const f = (c - 0.75) / 0.25;
      r = Math.round(255);
      g = Math.round(220 * (1 - f));
      b = Math.round(20 * (1 - f));
    }
    return [r, g, b];
  }

  private clearSectorEntities(): void {
    for (const e of this.entities) {
      if (!this.viewer.isDestroyed()) {
        this.viewer.entities.remove(e);
      }
    }
    this.entities = [];
  }

  public destroy(): void {
    this.clearSectorEntities();
    if (this.gridImageryLayer && !this.viewer.isDestroyed()) {
      this.viewer.imageryLayers.remove(this.gridImageryLayer);
      this.gridImageryLayer = null;
    }
    if (this.clickHandler) {
      this.clickHandler.destroy();
      this.clickHandler = null;
    }
  }
}
