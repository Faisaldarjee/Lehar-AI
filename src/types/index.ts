/**
 * Lehar AI — TypeScript Types
 * Shared interfaces for frontend components and multi-sensor satellite fusion & Lehar Guardian.
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

export interface DetectedLanguage {
  code: string;
  label: string;
  script?: string;
  tts_locale: string;
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
  query_route?: 'sql_data' | 'ocean_science_rag' | 'species_advisory' | 'hybrid' | 'error' | null;
  species_detected?: string | null;
  knowledge_sources?: string[] | null;
  detected_language?: DetectedLanguage | null;
  data_sources?: string[];
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
  detected_language?: DetectedLanguage | null;
  sql?: string | null;
  data?: Record<string, unknown>[] | null;
  chart?: ChartData | null;
  map_markers?: MapMarker[] | null;
  query_route?: 'sql_data' | 'ocean_science_rag' | 'species_advisory' | 'hybrid' | 'error' | null;
  species_detected?: string | null;
  knowledge_sources?: string[] | null;
  data_sources?: string[];
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
  satellite_sst?: number | null;
  chlorophyll_mg_m3?: number | null;
  chlorophyll_gradient?: number | null;
  mld_meters: number | null;
  pfz_rating: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  pfz_score: number;
  data_confidence?: string;
  data_sources?: string[];
  target_species: string[];
  nearest_harbour: PFZHarbour;
  advisory: string;
}

export interface SatelliteGridPoint {
  lat: number;
  lon: number;
  sst: number;
  chlorophyll: number;
  gradient: number;
  thermal_front: boolean;
  chlorophyll_front: boolean;
  pfz_potential: 'Excellent' | 'Good' | 'Moderate' | 'Low';
}

export interface SatelliteGridResponse {
  metadata: {
    source: string;
    coverage: string;
    grid_resolution_deg: number;
    total_points: number;
    served_points?: number;
    generated_at: string;
    datasets: string[];
  };
  points: SatelliteGridPoint[];
}

export interface GuardianRecipient {
  id: number;
  name: string;
  phone_last4: string;
  home_sector: string;
  harbour: string;
}

export interface GuardianLocation {
  latitude: number;
  longitude: number;
  distance_km: number;
  home_harbour: string;
}

export interface GuardianAlert {
  id: string;
  type: 'safety' | 'opportunity';
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  message: string;
  recipient: GuardianRecipient;
  location: GuardianLocation;
  metrics: Record<string, any>;
  data_sources: string[];
  timestamp: string;
}

export interface GuardianStatusResponse {
  status: string;
  monitored_pfz_zones: number;
  monitored_anomaly_signals: number;
  registered_fishermen_count: number;
  active_safety_alerts: number;
  active_opportunity_alerts: number;
  total_active_alerts: number;
  last_scan_utc: string;
  alerts: GuardianAlert[];
}

export interface DashboardStats {
  total_profiles: number;
  total_floats: number;
  total_anomalies?: number;
  satellite_points?: number;
  coverage_area: string;
}

export type AppMode = 'chat' | 'map' | 'anomaly' | 'classroom' | 'whatsapp' | 'pipeline' | '3d';
