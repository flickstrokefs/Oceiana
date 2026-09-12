import type {
  OceanParameters,
  OceanMode,
  OceanVariable,
  OceanStateSnapshot,
  SelectedObservation,
  SpatialFieldValue,
  UnderwaterRegionId,
  UnderwaterRegion,
} from '../types/ocean';
import { UNDERWATER_REGIONS } from '../types/ocean';
import type { OceanDataProvider } from './provider/OceanDataProvider';
import { MockOceanProvider } from './provider/MockOceanProvider';

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
  private underwaterRegion: UnderwaterRegionId | null = null;
  private selectedObservation: SelectedObservation | null = null;
  private observationModalOpen = false;
  private flyToObservationToken = 0;
  private time: Date = new Date();

  private provider: OceanDataProvider;
  private listeners: Set<OceanStateListener> = new Set();

  private constructor(provider?: OceanDataProvider) {
    this.provider = provider || new MockOceanProvider();
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

  public getSnapshot(): OceanStateSnapshot {
    return {
      parameters: { ...this.parameters },
      mode: this.mode,
      activeVariable: this.activeVariable,
      underwaterRegion: this.underwaterRegion,
      selectedObservation: this.selectedObservation,
      observationModalOpen: this.observationModalOpen,
      flyToObservationToken: this.flyToObservationToken,
      time: new Date(this.time),
    };
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

  public setUnderwaterRegion(region: UnderwaterRegionId | null): void {
    if (this.underwaterRegion !== region) {
      this.underwaterRegion = region;
      this.notify();
    }
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
