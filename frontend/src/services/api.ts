export * from './agriSnapService';
import { saveScanForSync } from './offlineStore';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface Sector {
  id: number;
  farm_id: number;
  name: string;
  crop: string;
  area_hectares: number;
  health_status: 'healthy' | 'watch' | 'alert';
  target_moisture_min: number;
  target_moisture_max: number;
  created_at: string;
  updated_at: string;
}

export interface Farm {
  id: number;
  farmer_id: number;
  name: string;
  area_hectares: number;
  location_desc: string | null;
  created_at: string;
  sectors: Sector[];
}

export interface SensorReading {
  id: number;
  sector_id: number;
  moisture_pct: number;
  temp_c: number;
  ph: number;
  nitrogen_ppm: number;
  phosphorus_ppm: number;
  potassium_ppm: number;
  is_simulated: boolean;
  sim_seed: string;
  recorded_at: string;
}

export interface IrrigationRecommendation {
  decision: 'irrigate' | 'skip' | 'delay';
  reason_plain: string;
  rule_code: string;
  duration_minutes: number;
  moisture_at_decision: number;
  is_simulated: boolean;
  sensor_stale: boolean;
}

export interface IrrigationLog {
  id: number;
  sector_id: number;
  decision: string;
  reason_plain: string;
  rule_code: string;
  duration_minutes: number;
  moisture_at_decision: number;
  is_simulated: boolean;
  triggered_at: string;
}

export interface Listing {
  id: number;
  farmer_id: number;
  crop: string;
  quantity_kg: number;
  asking_price_per_kg: number;
  unit: string;
  district: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Offer {
  id: number;
  listing_id: number;
  buyer_farmer_id: number;
  offered_price_per_kg: number;
  quantity_kg: number;
  status: string;
  message: string | null;
  created_at: string;
}

export interface MarketPriceRef {
  id: number;
  crop: string;
  min_price_per_kg: number;
  max_price_per_kg: number;
  avg_price_per_kg: number;
  source_note: string;
  reference_date: string;
  is_simulated: boolean;
}

export interface OutbreakCluster {
  id: number;
  crop: string;
  disease_label: string;
  district: string;
  report_count: number;
  severity_level: string;
  window_start: string;
  window_end: string;
  detected_at: string;
}

export interface IrrigationSchedule {
  id: number;
  farm_id: number;
  schedule_date: string;
  sector_plan: Record<string, any>;
  is_simulated: boolean;
  created_at: string;
}

export interface AgriSnapLog {
  id: number;
  farmer_id: number | null;
  model_version: string;
  crop_input: string;
  predicted_label: string;
  confidence: number;
  was_unclear: boolean;
  latitude: number | null;
  longitude: number | null;
  scanned_at: string;
  sync_status?: 'pending' | 'synced';
  local_id?: string;
}

export interface HealthStatus {
  status: string;
  app: string;
  version: string;
  env: string;
  db: string;
}

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch(`${BASE_URL}/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  return res.json();
}

export async function fetchFarm(farmId: number = 1): Promise<Farm> {
  const res = await fetch(`${BASE_URL}/farms/${farmId}`);
  if (!res.ok) throw new Error(`Failed to load farm details: ${res.status}`);
  return res.json();
}

export async function fetchLatestSensor(sectorId: number): Promise<SensorReading> {
  const res = await fetch(`${BASE_URL}/sensors/sector/${sectorId}/latest`);
  if (!res.ok) throw new Error(`Failed to load latest sensor reading: ${res.status}`);
  return res.json();
}

export async function fetchSensorHistory(sectorId: number, limit: number = 20): Promise<SensorReading[]> {
  const res = await fetch(`${BASE_URL}/sensors/sector/${sectorId}/history?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to load sensor history: ${res.status}`);
  return res.json();
}

export async function triggerSensorSimulation(sectorId: number): Promise<SensorReading> {
  const res = await fetch(`${BASE_URL}/sensors/simulate/${sectorId}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to trigger sensor simulation: ${res.status}`);
  return res.json();
}

export async function fetchIrrigationRecommendation(sectorId: number, rainChance: number = 0.1): Promise<IrrigationRecommendation> {
  const res = await fetch(`${BASE_URL}/irrigation/recommend/${sectorId}?rain_chance=${rainChance}`);
  if (!res.ok) throw new Error(`Failed to fetch recommendation: ${res.status}`);
  return res.json();
}

export async function executeSimulatedIrrigation(sectorId: number): Promise<IrrigationLog> {
  const res = await fetch(`${BASE_URL}/irrigation/execute/${sectorId}`, { method: 'POST' });
  if (!res.ok) throw new Error(`Failed to execute simulated irrigation: ${res.status}`);
  return res.json();
}

export async function fetchIrrigationLogs(sectorId: number): Promise<IrrigationLog[]> {
  const res = await fetch(`${BASE_URL}/irrigation/logs/${sectorId}`);
  if (!res.ok) throw new Error(`Failed to fetch irrigation logs: ${res.status}`);
  return res.json();
}

export async function fetchListings(crop?: string, district?: string): Promise<Listing[]> {
  const params = new URLSearchParams();
  if (crop) params.append('crop', crop);
  if (district) params.append('district', district);
  const url = `${BASE_URL}/marketplace/listings${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch marketplace listings: ${res.status}`);
  return res.json();
}

export async function createListing(payload: {
  farmer_id: number;
  crop: string;
  quantity_kg: number;
  asking_price_per_kg: number;
  unit?: string;
  district: string;
  description?: string;
}): Promise<Listing> {
  const res = await fetch(`${BASE_URL}/marketplace/listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to create listing: ${res.status}`);
  return res.json();
}

export async function fetchListingOffers(listingId: number): Promise<Offer[]> {
  const res = await fetch(`${BASE_URL}/marketplace/listings/${listingId}/offers`);
  if (!res.ok) throw new Error(`Failed to fetch offers for listing: ${res.status}`);
  return res.json();
}

export async function createOffer(payload: {
  listing_id: number;
  buyer_farmer_id: number;
  offered_price_per_kg: number;
  quantity_kg: number;
  message?: string;
}): Promise<Offer> {
  const res = await fetch(`${BASE_URL}/marketplace/offers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Failed to submit offer: ${res.status}`);
  return res.json();
}

export async function fetchMarketPrices(crop?: string): Promise<MarketPriceRef[]> {
  const url = crop ? `${BASE_URL}/marketplace/prices?crop=${encodeURIComponent(crop)}` : `${BASE_URL}/marketplace/prices`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch market prices: ${res.status}`);
  return res.json();
}

export async function fetchCommunityOutbreaks(district?: string): Promise<OutbreakCluster[]> {
  const url = district
    ? `${BASE_URL}/community/outbreaks?district=${encodeURIComponent(district)}`
    : `${BASE_URL}/community/outbreaks`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch farmer report clusters: ${res.status}`);
  return res.json();
}

export async function fetchIrrigationSchedules(farmId: number = 1): Promise<IrrigationSchedule[]> {
  const res = await fetch(`${BASE_URL}/irrigation/schedules/${farmId}`);
  if (!res.ok) throw new Error(`Failed to fetch irrigation schedules: ${res.status}`);
  return res.json();
}

export async function fetchAgriSnapHistory(farmerId: number = 1): Promise<AgriSnapLog[]> {
  const res = await fetch(`${BASE_URL}/agrisnap/history/${farmerId}`);
  if (!res.ok) throw new Error(`Failed to fetch scan history: ${res.status}`);
  return res.json();
}

export interface AgriSnapLogInput {
  farmer_id?: number;
  model_version: string;
  crop_input: string;
  predicted_label: string;
  confidence: number;
  was_unclear: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export async function logAgriSnapScan(payload: AgriSnapLogInput): Promise<AgriSnapLog> {
  const body = {
      farmer_id: payload.farmer_id ?? 1,
      model_version: payload.model_version,
      crop_input: payload.crop_input,
      predicted_label: payload.predicted_label,
      confidence: payload.confidence,
      was_unclear: payload.was_unclear,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
    };
  const url = `${BASE_URL}/agrisnap/log`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to log scan metadata: ${res.status}`);
    return { ...(await res.json()), sync_status: 'synced' };
  } catch (error) {
    if (!(error instanceof TypeError)) throw error;
    const local = await saveScanForSync(body, url);
    return {
      id: -Date.now(),
      farmer_id: body.farmer_id,
      model_version: body.model_version,
      crop_input: body.crop_input,
      predicted_label: body.predicted_label,
      confidence: body.confidence,
      was_unclear: body.was_unclear,
      latitude: body.latitude,
      longitude: body.longitude,
      scanned_at: local.scanned_at,
      sync_status: 'pending',
      local_id: local.localId,
    };
  }
}

