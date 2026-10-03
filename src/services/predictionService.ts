import type { LiveSample, RiskTier, SensorNode } from '../data/types';

/** Backend ML endpoint — the only place the backend URL is known. */
export const PREDICTION_API_URL = 'http://127.0.0.1:8000/api/predict';

/** 12-field gateway sensor packet (schema matches backend PredictRequest). */
export interface SensorPacket {
  rainfall_24h_mm: number;
  temperature_c: number;
  soil_moisture_pct: number;
  pore_pressure_kpa: number;
  tilt_rate_deg_hr: number;
  displacement_rate_mm_hr: number;
  strain_microstrain: number;
  vibration_rms_g: number;
  dominant_frequency_hz: number;
  crack_width_mm: number;
  neighbour_consensus: number;
  blast_window: number;
}

/** 24x5 LSTM trend window: displacement_mm, tilt_deg, crack_width_mm, pore_pressure_kpa, rainfall_mm. */
export type TrendWindow = number[][];

/** Backend PredictResponse shape. */
export interface PredictionResult {
  score: number;
  tier: RiskTier;
  confidence: number;
  recommendation: string;
}

/**
 * POST /api/predict — consolidated RockSentinel ML inference.
 * Loading/API failures surface as rejected promises (callers map to UI state).
 */
export async function predict(
  sensorPacket: SensorPacket,
  trendWindow: TrendWindow,
  image?: string,
): Promise<PredictionResult> {
  const res = await fetch(PREDICTION_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sensor_packet: sensorPacket,
      trend_window: trendWindow,
      ...(image ? { image } : {}),
    }),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && body.detail) detail = String(body.detail);
    } catch {
      /* keep HTTP status message */
    }
    throw new Error(detail);
  }
  const data = (await res.json()) as Partial<PredictionResult>;
  if (typeof data.score !== 'number' || !data.tier || typeof data.confidence !== 'number' || !data.recommendation) {
    throw new Error('Malformed prediction response');
  }
  return data as PredictionResult;
}

/** Map live sensor state onto the ML packet schema (12 fields). */
export function buildSensorPacket(sensors: SensorNode[]): SensorPacket {
  const online = sensors.filter(s => s.status !== 'offline');
  const avg = (f: (s: SensorNode) => number) =>
    online.length ? online.reduce((sum, s) => sum + f(s), 0) / online.length : 0;
  const tilt = avg(s => s.tilt);
  const vibration = avg(s => s.vibration);
  const humidity = avg(s => s.humidity);
  const moisture = avg(s => s.moisture);
  return {
    rainfall_24h_mm: +Math.max(0, (humidity - 35) * 0.9).toFixed(1),
    temperature_c: +avg(s => s.temperature).toFixed(1),
    soil_moisture_pct: +moisture.toFixed(1),
    pore_pressure_kpa: +(40 + moisture * 0.5).toFixed(1),
    tilt_rate_deg_hr: +tilt.toFixed(3),
    displacement_rate_mm_hr: +(tilt * 0.06).toFixed(3),
    strain_microstrain: +(120 + tilt * 18).toFixed(1),
    vibration_rms_g: +vibration.toFixed(3),
    dominant_frequency_hz: +(8 + (vibration % 8)).toFixed(1),
    crack_width_mm: +(0.3 + tilt * 0.05).toFixed(2),
    neighbour_consensus: +(0.7 + Math.random() * 0.25).toFixed(2),
    blast_window: 0,
  };
}

/** Build the 24x5 LSTM trend window from the live series (feature order per the ML package). */
export function buildTrendWindow(series: LiveSample[]): TrendWindow {
  const last = series[series.length - 1];
  const base: LiveSample[] = Array.from({ length: 24 }, (_, i) => series[Math.max(0, series.length - 24 + i)] ?? last ?? { t: 0, tilt: 0.5, vibration: 0.3, humidity: 50, moisture: 50, risk: 10, battery: 90 });
  return base.map(s => [
    +(s.tilt * 0.06).toFixed(3),
    +s.tilt.toFixed(3),
    +(s.tilt * 0.08).toFixed(3),
    +(40 + s.moisture * 0.5).toFixed(1),
    +Math.max(0, (s.humidity - 35) * 0.9).toFixed(1),
  ]);
}

/** Shared latest-prediction cache so every usePrediction() consumer sees one value. */
let latest: PredictionResult | null = null;
const listeners = new Set<() => void>();

export function getLatestPrediction(): PredictionResult | null {
  return latest;
}

export function setLatestPrediction(p: PredictionResult | null): void {
  latest = p;
  listeners.forEach(l => l());
}

export function subscribeLatestPrediction(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
