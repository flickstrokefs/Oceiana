export type ProvenanceType = 'REAL' | 'MODEL' | 'DERIVED' | 'OFFICIAL' | 'SIMULATED';

export interface ProvenanceMetadata {
  provenance: ProvenanceType;
  source: string;
  dataset: string;
  timestamp: string;
  valid_from?: string | null;
  valid_to?: string | null;
  processing_level?: string | null;
  resolution?: string | null;
  region?: string | null;
  details?: Record<string, unknown>;
}

export interface HazardRegionResult {
  name: string;
  region_id: string;
  area_exceeded_km2: number;
  total_area_km2: number;
  exceedance_pct: number;
  max_value: number;
  threshold: number;
  unit: string;
  risk_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  status: string;
  source: string;
  provenance: ProvenanceType;
  timestamp: string;
}

export interface HazardGridData {
  variable: string;
  region: string;
  unit: string;
  threshold?: number | null;
  latitudes: number[];
  longitudes: number[];
  values: (number | null)[][];
  mask: boolean[][];
  min_value: number;
  max_value: number;
  exceeded_area_km2: number;
  total_area_km2: number;
  exceeded_pct: number;
  provenance: ProvenanceType;
  provenance_meta: ProvenanceMetadata;
}

export interface HazardAnalysisRequest {
  variable: string;
  threshold: number;
  region?: string;
  time_range?: string;
}

export interface HazardAnalysisResponse {
  variable: string;
  threshold: number;
  region: string;
  unit: string;
  max_value: number;
  total_area_exceeded_km2: number;
  provenance: ProvenanceType;
  timestamp: string;
  regions: HazardRegionResult[];
  provenance_meta: ProvenanceMetadata;
}

export interface HazardLayer {
  id: string;
  name: string;
  unit: string;
  default_threshold: number;
  step: number;
  source: string;
  dataset: string;
  provenance: ProvenanceType;
  description: string;
}
