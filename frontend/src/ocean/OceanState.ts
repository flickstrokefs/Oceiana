import type {
  OceanParameters,
  OceanMode,
  OceanVariable,
  ArielPage,
  OceanStateSnapshot,
  SelectedObservation,
  SpatialFieldValue,
  UnderwaterRegionId,
  UnderwaterRegion,
  GliderTrajectory,
  ArgoProfile,
  QueryPoint,
  VisualizationSettings,
  DataLoadStatus,
} from '../types/ocean';
import { UNDERWATER_REGIONS } from '../types/ocean';
import type { OceanDataProvider } from './provider/OceanDataProvider';
import { EmptyOceanProvider } from './provider/EmptyOceanProvider';
import * as Cesium from 'cesium';
import type { ColorRange } from './color/colorTypes';
import {
  DEFAULT_COLOR_RANGES,
  loadStoredRanges,
  saveStoredRanges,
  getColorForValue,
  cesiumColorFromHex,
  buildPaletteRanges,
  mapValueForScale,
} from './color/colorRangeUtils';
import {
  fetchDepthSlice,
  fetchOceanCurrents,
  fetchOceanProfile,
  fetchOceanTimeseries,
  sliceHasValues,
  type OceanSliceResponse,
  type OceanCurrentVector,
  type OceanPointSample,
  type OceanTimeSeriesPoint,
} from '../services/oceanService';

export type OceanStateListener = (snapshot: OceanStateSnapshot) => void;

export class OceanState {
  private static instance: OceanState;

  private parameters: OceanParameters = {
    temperature: 28.0,
    salinity: 35.5,
    currentSpeed: 1.2,
    depth: 0,
    chlorophyll: 1.2,
  };

  private mode: OceanMode = 'surface';
  private activeVariable: OceanVariable = 'temperature';
  private activePage: ArielPage = '3d-ocean';
  private underwaterRegion: UnderwaterRegionId | null = null;
  private selectedOceanDomain:
  'indian-ocean' | 'southern-ocean' | null = null;
  private selectedObservation: SelectedObservation | null = null;
  private observationModalOpen = false;
  private flyToObservationToken = 0;
  private flyToLocationRequest: {
    latitude: number;
    longitude: number;
    altitude?: number;
    heading?: number;
    pitch?: number;
    duration?: number;
    token: number;
  } | null = null;
  private flyToLocationToken = 0;
  private time: Date = new Date();
  private gliders: GliderTrajectory[] = [];
  private argoProfiles: ArgoProfile[] = [];

  // A profile is meaningful only after the user selects a location on the globe.
  // Do not seed this with a demo coordinate.
  private queryPoint: QueryPoint | null = null;
  private visualization: VisualizationSettings = {
    palette: 'Turbo',
    minVal: 0,
    maxVal: 30,
    autoRange: true,
    scaleType: 'linear',
    modelOpacity: 70,
    gliderOpacity: 100,
    argoOpacity: 80,
    verticalExaggeration: 5,
    isosurfaceEnabled: true,
    isosurfaceVariable: 'temperature',
    isosurfaceValue: 20,
    showArgo: true,
    showGliders: true,
    showModelTemperature: true,
    showModelSalinity: false,
    showModelCurrents: true,
    showModelChlorophyll: false,
  };

  private depthSlice: OceanSliceResponse | null = null;
  private currentVectors: OceanCurrentVector[] = [];
  private pointSample: OceanPointSample | null = null;
  private timeseriesPoints: OceanTimeSeriesPoint[] = [];
  private timeseriesIndex = 0;

  private fieldStatus: DataLoadStatus = 'idle';
  private fieldError: string | null = null;
  private currentsStatus: DataLoadStatus = 'idle';
  private currentsError: string | null = null;
  private profileStatus: DataLoadStatus = 'idle';
  private profileError: string | null = null;
  private timeseriesStatus: DataLoadStatus = 'idle';
  private timeseriesError: string | null = null;

  private fieldRequestId = 0;
  private currentsRequestId = 0;
  private profileRequestId = 0;
  private timeseriesRequestId = 0;

  private provider: OceanDataProvider;
  private listeners: Set<OceanStateListener> = new Set();
  private colorRanges: Record<OceanVariable, ColorRange[]> = loadStoredRanges();

  private constructor(provider?: OceanDataProvider) {
    this.provider = provider || new EmptyOceanProvider();
  }

  public static getInstance(): OceanState {
    if (!OceanState.instance) {
      OceanState.instance = new OceanState();
    }
    return OceanState.instance;
  }

  public setProvider(provider: OceanDataProvider): void {
    this.provider = provider;
    this.notify();
  }

  public getProvider(): OceanDataProvider {
    return this.provider;
  }

  public setGliders(gliders: GliderTrajectory[]): void {
    this.gliders = gliders;
    this.notify();
  }

  public getGliders(): GliderTrajectory[] {
    return this.gliders;
  }

  public setArgoProfiles(profiles: ArgoProfile[]): void {
    this.argoProfiles = profiles;
    this.notify();
  }

  public getArgoProfiles(): ArgoProfile[] {
    return this.argoProfiles;
  }

private meshResolution: 7 | 9 | 12 = 9;

public setMeshResolution(resolution: 7 | 9 | 12): void {
  if (this.meshResolution === resolution) return;

  this.meshResolution = resolution;
  this.notify();
}

public getMeshResolution(): 7 | 9 | 12 {
  return this.meshResolution;
}

public getColorRanges(variable: OceanVariable = this.activeVariable): ColorRange[] {
  return (this.colorRanges[variable] || []).map((r) => ({ ...r }));
}

public setColorRanges(variable: OceanVariable, ranges: ColorRange[]): void {
  this.colorRanges[variable] = ranges.map((r) => ({ ...r }));
  saveStoredRanges(this.colorRanges);
  this.notify();
}

public getCesiumColorForActiveVariable(value: number, alpha = 1): Cesium.Color {
  return this.getCesiumColorForVariable(this.activeVariable, value, alpha);
}
public getSnapshot(): OceanStateSnapshot {
return {
  parameters: { ...this.parameters },
  mode: this.mode,
  activeVariable: this.activeVariable,
  activePage: this.activePage,
  underwaterRegion: this.underwaterRegion,
  selectedObservation: this.selectedObservation,
  observationModalOpen: this.observationModalOpen,
  flyToObservationToken: this.flyToObservationToken,
  time: new Date(this.time),
  selectedOceanDomain: this.selectedOceanDomain,
  gliders: [...this.gliders],
  argoProfiles: [...this.argoProfiles],
  colorRanges: {
    temperature: this.getColorRanges('temperature'),
    salinity: this.getColorRanges('salinity'),
    current: this.getColorRanges('current'),
    chlorophyll: this.getColorRanges('chlorophyll'),
  },
  queryPoint: this.queryPoint ? { ...this.queryPoint } : null,
  visualization: { ...this.visualization },
  fieldStatus: this.fieldStatus,
  fieldError: this.fieldError,
  currentsStatus: this.currentsStatus,
  currentsError: this.currentsError,
  profileStatus: this.profileStatus,
  profileError: this.profileError,
  timeseriesStatus: this.timeseriesStatus,
  timeseriesError: this.timeseriesError,
};
}

  public setTime(time: Date): void {
    if (this.time.getTime() === time.getTime()) return;
    this.time = new Date(time);
    this.notify();
  }

  public getTime(): Date {
    return new Date(this.time);
  }

  public setQueryPoint(latitude: number, longitude: number): void {
    if (this.queryPoint?.latitude === latitude && this.queryPoint.longitude === longitude) {
      return;
    }
    this.queryPoint = { latitude, longitude };
    this.notify();
  }

  public getQueryPoint(): QueryPoint | null {
    return this.queryPoint ? { ...this.queryPoint } : null;
  }

  public getDepthSlice(): OceanSliceResponse | null {
    return this.depthSlice;
  }

  public getCurrentVectors(): OceanCurrentVector[] {
    return this.currentVectors;
  }

  public getPointSample(): OceanPointSample | null {
    return this.pointSample;
  }

  public getTimeseriesPoints(): OceanTimeSeriesPoint[] {
    return this.timeseriesPoints;
  }

  public getTimeseriesIndex(): number {
    return this.timeseriesIndex;
  }

  public setTimeseriesIndex(index: number): void {
    if (!this.timeseriesPoints.length) return;
    const next = Math.max(0, Math.min(this.timeseriesPoints.length - 1, index));
    if (next === this.timeseriesIndex) return;
    this.timeseriesIndex = next;
    const ts = this.timeseriesPoints[next]?.timestamp;
    if (ts) {
      const parsed = new Date(ts);
      if (!Number.isNaN(parsed.getTime())) {
        this.time = parsed;
      }
    }
    this.notify();
  }

  public updateVisualization(partial: Partial<VisualizationSettings>): void {
    let changed = false;
    for (const key of Object.keys(partial) as (keyof VisualizationSettings)[]) {
      if (partial[key] !== undefined && this.visualization[key] !== partial[key]) {
        (this.visualization as unknown as Record<string, unknown>)[key] = partial[key] as never;
        changed = true;
      }
    }
    if (!changed) return;

    if (
      partial.palette !== undefined ||
      partial.minVal !== undefined ||
      partial.maxVal !== undefined
    ) {
      this.applyPaletteRanges();
    }
    this.notify();
  }

  public getVisualization(): VisualizationSettings {
    return { ...this.visualization };
  }

  private applyPaletteRanges(): void {
    const { palette, minVal, maxVal } = this.visualization;
    this.colorRanges[this.activeVariable] = buildPaletteRanges(
      this.activeVariable,
      palette,
      minVal,
      maxVal,
    );
  }

  public getCesiumColorForVariable(variable: OceanVariable, value: number, alpha = 1): Cesium.Color {
    if (!Number.isFinite(value)) {
      return Cesium.Color.TRANSPARENT;
    }
    const mapped = mapValueForScale(
      value,
      this.visualization.minVal,
      this.visualization.maxVal,
      this.visualization.scaleType,
    );
    const ranges = this.colorRanges[variable] || DEFAULT_COLOR_RANGES[variable] || [];
    return cesiumColorFromHex(getColorForValue(mapped, ranges), alpha);
  }

  private isoTimeParam(): string | null {
    return Number.isNaN(this.time.getTime()) ? null : this.time.toISOString();
  }

  public async refreshDepthSlice(): Promise<void> {
    const requestId = ++this.fieldRequestId;
    this.fieldStatus = 'loading';
    this.fieldError = null;
    this.notify();
    try {
      const slice = await fetchDepthSlice({
        parameter: this.activeVariable,
        depth: this.parameters.depth,
        time: this.isoTimeParam(),
      });
      if (requestId !== this.fieldRequestId) return;
      this.depthSlice = slice;
      if (this.visualization.autoRange && Number.isFinite(slice.min_val) && Number.isFinite(slice.max_val)) {
        this.visualization.minVal = slice.min_val;
        this.visualization.maxVal = slice.max_val === slice.min_val ? slice.min_val + 1 : slice.max_val;
        this.applyPaletteRanges();
      }
      this.fieldStatus = sliceHasValues(slice) ? 'ready' : 'empty';
    } catch (err) {
      if (requestId !== this.fieldRequestId) return;
      this.depthSlice = null;
      this.fieldStatus = 'error';
      this.fieldError = err instanceof Error ? err.message : 'Failed to load depth slice';
    }
    this.notify();
  }

  public async refreshCurrents(): Promise<void> {
    const requestId = ++this.currentsRequestId;
    this.currentsStatus = 'loading';
    this.currentsError = null;
    this.notify();
    try {
      const payload = await fetchOceanCurrents({
        depth: this.parameters.depth,
        time: this.isoTimeParam(),
      });
      if (requestId !== this.currentsRequestId) return;
      this.currentVectors = payload.vectors || [];
      this.currentsStatus = this.currentVectors.length > 0 ? 'ready' : 'empty';
    } catch (err) {
      if (requestId !== this.currentsRequestId) return;
      this.currentVectors = [];
      this.currentsStatus = 'error';
      this.currentsError = err instanceof Error ? err.message : 'Failed to load currents';
    }
    this.notify();
  }

  public async refreshPointSample(): Promise<void> {
    if (!this.queryPoint) {
      this.pointSample = null;
      this.profileStatus = 'idle';
      this.profileError = null;
      this.notify();
      return;
    }
    const requestId = ++this.profileRequestId;
    this.profileStatus = 'loading';
    this.profileError = null;
    this.notify();
    try {
      const sample = await fetchOceanProfile({
        lat: this.queryPoint.latitude,
        lon: this.queryPoint.longitude,
        depth: this.parameters.depth,
      });
      if (requestId !== this.profileRequestId) return;
      this.pointSample = sample;
      this.profileStatus = 'ready';
    } catch (err) {
      if (requestId !== this.profileRequestId) return;
      this.pointSample = null;
      this.profileStatus = 'error';
      this.profileError = err instanceof Error ? err.message : 'Failed to load profile';
    }
    this.notify();
  }

  public async refreshTimeseries(): Promise<void> {
    if (!this.queryPoint) {
      this.timeseriesPoints = [];
      this.timeseriesIndex = 0;
      this.timeseriesStatus = 'idle';
      this.timeseriesError = null;
      this.notify();
      return;
    }
    const requestId = ++this.timeseriesRequestId;
    this.timeseriesStatus = 'loading';
    this.timeseriesError = null;
    this.notify();
    try {
      const payload = await fetchOceanTimeseries({
        parameter: this.activeVariable,
        lat: this.queryPoint.latitude,
        lon: this.queryPoint.longitude,
        depth: this.parameters.depth,
      });
      if (requestId !== this.timeseriesRequestId) return;
      this.timeseriesPoints = payload.points || [];
      if (this.timeseriesPoints.length === 0) {
        this.timeseriesStatus = 'empty';
        this.timeseriesIndex = 0;
      } else {
        this.timeseriesStatus = 'ready';
        if (this.timeseriesIndex >= this.timeseriesPoints.length) {
          this.timeseriesIndex = this.timeseriesPoints.length - 1;
        }
        const ts = this.timeseriesPoints[this.timeseriesIndex]?.timestamp;
        if (ts) {
          const parsed = new Date(ts);
          if (!Number.isNaN(parsed.getTime())) this.time = parsed;
        }
      }
    } catch (err) {
      if (requestId !== this.timeseriesRequestId) return;
      this.timeseriesPoints = [];
      this.timeseriesStatus = 'error';
      this.timeseriesError = err instanceof Error ? err.message : 'Failed to load timeseries';
    }
    this.notify();
  }

  public modelLayerVisibleFor(variable: OceanVariable): boolean {
    if (variable === 'temperature') return this.visualization.showModelTemperature;
    if (variable === 'salinity') return this.visualization.showModelSalinity;
    if (variable === 'chlorophyll') return this.visualization.showModelChlorophyll;
    if (variable === 'current') return this.visualization.showModelCurrents;
    return true;
  }
  public setActivePage(page: ArielPage): void {
    if (page === 'obs-profile') {
      // If no observation is selected, default to the first real glider
      if (!this.selectedObservation) {
        const candidateGliders =
          this.gliders.length > 0
            ? this.gliders
            : this.provider.getGliderTrajectories();
        if (candidateGliders.length > 0) {
          this.selectedObservation = { type: 'glider', data: candidateGliders[0] };
        }
      }
      this.observationModalOpen = true;
      this.notify();
      return;
    }
    if (this.activePage !== page) {
      this.activePage = page;
      this.notify();
    }
  }

  public getActivePage(): ArielPage {
    return this.activePage;
  }


  public updateParameters(partial: Partial<OceanParameters>): void {
    let changed = false;
    for (const key of Object.keys(partial) as (keyof OceanParameters)[]) {
      if (partial[key] !== undefined && this.parameters[key] !== partial[key]) {
        this.parameters[key] = partial[key]!;
        changed = true;
      }
    }
    if (changed) {
      this.notify();
    }
  }

  public setMode(mode: OceanMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.notify();
    }
  }

  public setActiveVariable(variable: OceanVariable): void {
    if (this.activeVariable !== variable) {
      this.activeVariable = variable;
      this.notify();
    }
  }

  public setUnderwaterRegion(
  region: UnderwaterRegionId | null,
): void {
  if (this.underwaterRegion === region) {
    return;
  }

  this.underwaterRegion = region;

  if (region === 'southern-ocean') {
    this.selectedOceanDomain = 'southern-ocean';
  } else if (region) {
    this.selectedOceanDomain = 'indian-ocean';
  }

  this.notify();
}

  public setOceanDomain(
  domain: 'indian-ocean' | 'southern-ocean' | null,
): void {
  this.selectedOceanDomain = domain;

  if (domain === 'indian-ocean') {
    this.underwaterRegion = 'indian-ocean';
  }

  if (domain === 'southern-ocean') {
    this.underwaterRegion = 'southern-ocean';
  }

  this.notify();
}

public getSelectedOceanDomain():
  'indian-ocean' | 'southern-ocean' | null {
  return this.selectedOceanDomain;
}

  public getUnderwaterRegion(): UnderwaterRegionId | null {
    return this.underwaterRegion;
  }

  public getActiveRegion(): UnderwaterRegion | null {
    if (!this.underwaterRegion) return null;
    return (
      UNDERWATER_REGIONS.find((r) => r.id === this.underwaterRegion) || null
    );
  }

  public getNextRegion(currentId?: UnderwaterRegionId | null): UnderwaterRegion {
    const targetId = currentId ?? this.underwaterRegion ?? UNDERWATER_REGIONS[0].id;
    const currentIndex = UNDERWATER_REGIONS.findIndex((r) => r.id === targetId);
    const nextIndex = (currentIndex + 1) % UNDERWATER_REGIONS.length;
    return UNDERWATER_REGIONS[nextIndex];
  }

  public getPrevRegion(currentId?: UnderwaterRegionId | null): UnderwaterRegion {
    const targetId = currentId ?? this.underwaterRegion ?? UNDERWATER_REGIONS[0].id;
    const currentIndex = UNDERWATER_REGIONS.findIndex((r) => r.id === targetId);
    const prevIndex = (currentIndex - 1 + UNDERWATER_REGIONS.length) % UNDERWATER_REGIONS.length;
    return UNDERWATER_REGIONS[prevIndex];
  }

  public setDepth(depth: number): void {
    this.updateParameters({ depth });
  }

  /**
   * Select an in-situ observation (Argo / Glider).
   * Non-null selection opens the Observation Profile modal over the 3D Ocean.
   * Null clears selection and closes the modal.
   */
  public selectObservation(obs: SelectedObservation | null): void {
    this.selectedObservation = obs;
    this.observationModalOpen = obs !== null;
    this.notify();
  }

  public setObservationModalOpen(open: boolean): void {
    if (this.observationModalOpen === open) return;
    this.observationModalOpen = open;
    this.notify();
  }

  public closeObservationModal(): void {
    if (!this.observationModalOpen) return;
    this.observationModalOpen = false;
    this.notify();
  }

  /**
   * Show on Globe: keep selection + highlight, close/minimize modal,
   * and request OceanEngine to fly the existing Cesium camera.
   * Does NOT recreate the viewer or reset ocean visualization state.
   */
  public requestShowOnGlobe(): void {
    if (!this.selectedObservation) return;
    this.observationModalOpen = false;
    this.flyToObservationToken += 1;
    this.notify();
  }

  public requestFlyToLocation(
    latitude: number,
    longitude: number,
    altitude?: number,
    heading?: number,
    pitch?: number,
    duration?: number
  ): void {
    this.flyToLocationToken += 1;
    this.flyToLocationRequest = {
      latitude,
      longitude,
      altitude,
      heading,
      pitch,
      duration,
      token: this.flyToLocationToken,
    };
    this.notify();
  }

  public getFlyToLocationRequest() {
    return this.flyToLocationRequest;
  }

  public requestResetCamera(): void {
    this.requestFlyToLocation(14.0, 75.0, 4200000, 0, -72, 2.0);
  }

  public subscribe(listener: OceanStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  public sampleSpatialField(lat: number, lon: number, depth: number): SpatialFieldValue {
    return this.provider.sampleField(lat, lon, depth, this.time, this.parameters);
  }

  private notify(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snapshot));
  }
}
