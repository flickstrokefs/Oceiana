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
  private activePage: ArielPage = '3d-ocean';
  private underwaterRegion: UnderwaterRegionId | null = null;
  private selectedOceanDomain:
  'indian-ocean' | 'southern-ocean' | null = null;
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


private meshResolution: 7 | 9 | 12 = 9;

public setMeshResolution(resolution: 7 | 9 | 12): void {
  if (this.meshResolution === resolution) return;

  this.meshResolution = resolution;
  this.notify();
}

public getMeshResolution(): 7 | 9 | 12 {
  return this.meshResolution;
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
};
}

  public setActivePage(page: ArielPage): void {
    if (page === 'obs-profile') {
      // If no observation is selected, default to the first glider
      if (!this.selectedObservation) {
        const gliders = this.provider.getGliderTrajectories();
        if (gliders.length > 0) {
          this.selectedObservation = { type: 'glider', data: gliders[0] };
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
    this.underwaterRegion = null;
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
