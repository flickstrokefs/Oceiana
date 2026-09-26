import type { ProvenanceMetadata, ProvenanceType } from './hazard';

export interface RecommendedFishingZone {
  id: string;
  name: string;
  region: string;
  status: string;
  rating: 'EXCELLENT' | 'VERY_GOOD' | 'GOOD' | 'FAVOURABLE' | 'MODERATE' | 'POOR';
  chlorophyll_mean: number;
  sst_mean: number;
  front_strength: number;
  current_speed: number;
  wave_height: number;
  score: number;
  confidence: number;
  is_official: boolean;
  sector?: string | null;
  landing_center?: string | null;
  distance_km?: number | null;
  bearing_deg?: number | null;
  source: string;
  provenance: ProvenanceType;
  valid_until: string;
}

export interface FisheryConditions {
  chlorophyll_range: string;
  sst_range: string;
  current_state: string;
  wave_state: string;
  pfz_count: number;
  mean_productivity_score: number;
  summary_text: string;
}

export interface FisheryGridData {
  variable: string;
  region: string;
  unit: string;
  latitudes: number[];
  longitudes: number[];
  values: (number | null)[][];
  mask: boolean[][];
  min_value: number;
  max_value: number;
  provenance: ProvenanceType;
  provenance_meta: ProvenanceMetadata;
}

export interface PFZCoordinate {
  id: string;
  latitude: number;
  longitude: number;
  zone_name: string;
  confidence: number;
  chlorophyll: number;
  sst: number;
  front_strength: number;
  current_speed?: number | null;
  wave_height?: number | null;
  score?: number | null;
  is_official: boolean;
  sector?: string | null;
  landing_center?: string | null;
  source: string;
  provenance: ProvenanceType;
  valid_time: string;
}

export interface PFZResponse {
  region: string;
  timestamp: string;
  count: number;
  points: PFZCoordinate[];
  provenance: ProvenanceType;
  provenance_meta: ProvenanceMetadata;
}

export interface FisheryAdvisoryResponse {
  region: string;
  variable: string;
  time_range: string;
  generated_date: string;
  issued_date?: string;
  valid_until: string;
  provenance: ProvenanceType;
  recommended_zones: RecommendedFishingZone[];
  conditions: FisheryConditions;
  provenance_meta: ProvenanceMetadata;
}
