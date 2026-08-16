/**
 * Lehar AI — TypeScript Types
 * Shared interfaces for frontend components.
 */

export interface MapMarker {
  lat: number;
  lon: number;
  float_id: string;
  date: string;
  label?: string;
}

export interface ChartData {
  chart_type: 'depth_profile' | 'time_series' | 'bar' | 'scatter' | 'map';
  data: any[];
  x_key: string;
  y_keys: string[];
  title: string;
}

export interface HeroStat {
  label: string;
  value: string;
  unit?: string | null;
}

export interface StatItem {
  icon: string;
  label: string;
  value: string;
}

export interface ChatResponse {
  summary?: string;
  answer: string;
  hero_stat?: HeroStat | null;
  stats?: StatItem[] | null;
  reading_count?: number;
  sql: string | null;
  data: Record<string, unknown>[] | null;
  chart: ChartData | null;
  map_markers: MapMarker[] | null;
  error: string | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  summary?: string;
  hero_stat?: HeroStat | null;
  stats?: StatItem[] | null;
  reading_count?: number;
  timestamp: Date;
  language?: string;
  sql?: string | null;
  data?: Record<string, unknown>[] | null;
  chart?: ChartData | null;
  map_markers?: MapMarker[] | null;
  isLoading?: boolean;
}

export interface FloatSummary {
  profile_id?: number;
  float_id: string;
  latitude: number;
  longitude: number;
  date: string;
  max_depth: number | null;
}

export interface DepthMeasurement {
  depth: number;
  pressure: number | null;
  temperature: number | null;
  salinity: number | null;
  [key: string]: any;
}

export interface AnomalyAlert {
  id: number;
  float_id: string | null;
  latitude: number;
  longitude: number;
  date: string;
  parameter: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mhw_category?: string | null;
  description: string;
  created_at?: string;
}

export interface PFZHarbour {
  harbour: string;
  distance_km: number;
  bearing_deg: number;
  compass: string;
}

export interface PFZAdvisory {
  float_id: string;
  latitude: number;
  longitude: number;
  date: string;
  sst_celsius: number;
  mld_meters: number | null;
  pfz_rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  pfz_score: number;
  target_species: string[];
  nearest_harbour: PFZHarbour;
  advisory: string;
}

export interface DashboardStats {
  total_profiles: number;
  total_floats: number;
  coverage_area: string;
}

export type AppMode = 'chat' | 'map' | 'anomaly' | 'classroom' | 'whatsapp' | 'pipeline' | '3d';
