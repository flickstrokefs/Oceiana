import type {
  OceanParameters,
  OceanMode,
  OceanVariable,
  OceanStateSnapshot,
  ArgoProfile,
  GliderTrajectory,
  SpatialFieldValue,
} from '../types/ocean';
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
  private selectedObservation: {
    type: 'argo' | 'glider';
    data: ArgoProfile | GliderTrajectory;
  } | null = null;
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
      selectedObservation: this.selectedObservation,
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

  public setDepth(depth: number): void {
    this.updateParameters({ depth });
  }

  public selectObservation(
    obs: { type: 'argo' | 'glider'; data: ArgoProfile | GliderTrajectory } | null
  ): void {
    this.selectedObservation = obs;
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
