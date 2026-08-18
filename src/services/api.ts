/**
 * Lehar AI — API Client Service
 * Axios client to communicate with the FastAPI backend.
 */

import axios from 'axios';
import type { 
  ChatResponse, 
  FloatSummary, 
  AnomalyAlert, 
  DashboardStats, 
  DepthMeasurement, 
  PFZAdvisory,
  SatelliteGridResponse
} from '../types';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

/** Send a chat query to the NL-to-SQL engine */
export async function sendChatQuery(query: string, mode = 'text', language = 'en'): Promise<ChatResponse> {
  const { data } = await api.post<ChatResponse>('/api/chat', { query, mode, language });
  return data;
}

/** Get all float latest positions */
export async function getFloats(): Promise<{ floats: FloatSummary[]; count: number }> {
  const { data } = await api.get('/api/floats');
  return data;
}

/** Get trajectory for a specific float */
export async function getFloatTrajectory(floatId: string): Promise<{
  float_id: string;
  trajectory: FloatSummary[];
  total_cycles: number;
}> {
  const { data } = await api.get(`/api/floats/${floatId}`);
  return data;
}

/** Search profiles near a location */
export async function getProfilesNear(lat: number, lon: number, radius = 2, limit = 50): Promise<{
  profiles: FloatSummary[];
  count: number;
}> {
  const { data } = await api.get('/api/profiles', { params: { lat, lon, radius, limit } });
  return data;
}

/** Get depth profile measurements */
export async function getDepthProfile(profileId: number): Promise<{
  profile_id: number;
  measurements: DepthMeasurement[];
  num_levels: number;
}> {
  const { data } = await api.get(`/api/profiles/${profileId}/depth`);
  return data;
}

/** Get dashboard statistics */
export async function getStats(): Promise<DashboardStats> {
  const { data } = await api.get('/api/stats');
  return data;
}

/** Get anomaly alerts */
export async function getAnomalies(limit = 20): Promise<{ anomalies: AnomalyAlert[]; count: number }> {
  const { data } = await api.get('/api/anomalies', { params: { limit } });
  return data;
}

/** Trigger an anomaly scan */
export async function triggerAnomalyScan(): Promise<{ message: string; new_count: number }> {
  const { data } = await api.post('/api/anomalies/scan');
  return data;
}

/** Get PFZ fishing advisories with multi-sensor fusion */
export async function getPFZAdvisories(region = 'arabian_sea', limit = 30): Promise<{
  region: string;
  advisories: PFZAdvisory[];
  count: number;
  fusion_sources?: string[];
}> {
  const { data } = await api.get('/api/pfz', { params: { region, limit } });
  return data;
}

/** Get continuous satellite SST & Chlorophyll-a grid for Leaflet map overlay */
export async function getSatelliteGrid(downsample = 2): Promise<SatelliteGridResponse> {
  const { data } = await api.get<SatelliteGridResponse>('/api/satellite/grid', { params: { downsample } });
  return data;
}

export default api;
