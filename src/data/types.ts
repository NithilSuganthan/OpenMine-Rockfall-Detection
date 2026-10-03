export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export type SensorStatus = 'safe' | 'warning' | 'high-risk' | 'critical' | 'offline';

export interface SensorNode {
  id: string;
  name: string;
  zone: string;
  zoneIndex: number;
  status: SensorStatus;
  position: Vector3;
  angle: number;
  bench: number;
  location: string;
  battery: number;
  signalStrength: number;
  tilt: number;
  vibration: number;
  moisture: number;
  temperature: number;
  humidity: number;
  lastUpdated: string;
  healthScore: number;
  communicationRoute: string[];
  predictionConfidence: number;
  riskScore: number;
  historicalRisk: number;
}

export interface FactorSet {
  tilt: number;
  rain: number;
  crackGrowth: number;
  vibration: number;
}

export interface HighRiskZone {
  id: string;
  name: string;
  shortName: string;
  currentRisk: number;
  historicalRisk: number;
  predictedFailureTime: string;
  predictionHours: number;
  confidence: number;
  activeSensorIds: string[];
  position: Vector3;
  radius: number;
  angleStart: number;
  angleEnd: number;
  levels: [number, number];
  contributingFactors: FactorSet;
}

export interface CommunicationLink {
  from: string;
  to: string;
  strength: number;
  active: boolean;
  rerouted: boolean;
}

export interface Alert {
  id: string;
  time: string;
  type: 'critical' | 'warning' | 'info';
  location: string;
  sensorId: string;
  reason: string;
  confidence: number;
  acknowledgedBy: string | null;
  resolved: boolean;
}

export type DroneStatus = 'active' | 'idle' | 'returning' | 'charging';

export interface DroneInfo {
  id: string;
  name: string;
  status: DroneStatus;
  battery: number;
  altitude: number;
  speed: number;
  coverageArea: string;
  missionStatus: string;
  latestScan: string;
  missionProgress: number;
  position: Vector3;
  angle: number;
}

export interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  windDirection: string;
  rainfall: number;
  visibility: number;
  condition: string;
  forecast: string;
}

export interface HourSample {
  t: number;
  tilt: number;
  vibration: number;
  humidity: number;
  moisture: number;
  risk: number;
  battery: number;
}

export type EventSeverity = 'info' | 'warning' | 'critical' | 'success';

export interface SystemEvent {
  id: string;
  message: string;
  severity: EventSeverity;
  at: number;
}

export type RiskTier = 'normal' | 'watch' | 'warning' | 'emergency';

export interface Prediction {
  score: number;
  tier: RiskTier;
  confidence: number;
  recommendation: string;
  at: string;
}

export type PageId =
  | 'dashboard'
  | 'digital-twin'
  | 'mine-designer'
  | 'rock-sentinel-ai'
  | 'sensor-network'
  | 'risk-heatmap'
  | 'analytics'
  | 'alerts'
  | 'drone-feed'
  | 'historical'
  | 'settings';

export type SelectionType = 'sensor' | 'zone' | 'drone' | null;

export interface PlaybackState {
  enabled: boolean;
  position: number;
  playing: boolean;
}

export interface LiveSample {
  t: number;
  tilt: number;
  vibration: number;
  humidity: number;
  moisture: number;
  risk: number;
  battery: number;
}

export const PIT = {
  R: 62,
  BENCH_W: 7,
  WALL_W: 2.2,
  STEP_H: 3,
  BENCHES: 6,
  DEPTH: 18,
  BENCH_COUNTS: [6, 7, 7, 6, 6, 5],
  FLOOR_COUNT: 3,
} as const;

export function benchMidRadius(bench: number): number {
  return PIT.R - bench * (PIT.BENCH_W + PIT.WALL_W) - (PIT.BENCH_W + PIT.WALL_W) / 2;
}

export function benchY(bench: number): number {
  return -bench * PIT.STEP_H;
}

export function benchOuterRadius(bench: number): number {
  return PIT.R - bench * (PIT.BENCH_W + PIT.WALL_W);
}
