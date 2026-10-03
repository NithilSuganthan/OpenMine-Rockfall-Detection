import type {
  Alert, DroneInfo, FactorSet, HighRiskZone, HourSample, SensorNode, WeatherData,
} from './types';
import { PIT, benchMidRadius, benchY } from './types';
import { mulberry32, riskFromScore } from '../utils/helpers';

const rng = mulberry32(20260806);

const ZONE_NAMES = ['North Slope', 'East Bench', 'South Terrace', 'West Haul Road', 'Central Pit', 'Upper Terrace'];

function makeZone(angleStart: number, angleEnd: number, levels: [number, number]) {
  const mid = (angleStart + angleEnd) / 2;
  const midLevel = (levels[0] + levels[1]) / 2;
  const radius = benchMidRadius(midLevel);
  return { angleStart, angleEnd, levels, mid, midLevel, radius };
}

const ZONE_DEFS = [
  { ...makeZone(-2.2, -1.05, [1, 3]), id: 'HRZ-001', name: 'North Slope — Section A', shortName: 'North Slope', risk: 84, base: 0.55 },
  { ...makeZone(-0.55, 0.6, [2, 4]), id: 'HRZ-002', name: 'East Bench — Lower Level', shortName: 'East Bench', risk: 91, base: 0.8 },
  { ...makeZone(1.0, 2.1, [0, 2]), id: 'HRZ-003', name: 'South Terrace — Overhang', shortName: 'South Terrace', risk: 71, base: 0.4 },
  { ...makeZone(2.65, 3.75, [1, 3]), id: 'HRZ-004', name: 'West Haul Road — Embankment', shortName: 'West Haul Road', risk: 63, base: 0.3 },
];

function zoneIndexFor(angle: number, bench: number): number {
  const a = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  for (let i = 0; i < ZONE_DEFS.length; i++) {
    const z = ZONE_DEFS[i];
    const a0 = ((z.angleStart % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const a1 = ((z.angleEnd % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const inArc = a0 < a1 ? a >= a0 && a <= a1 : a >= a0 || a <= a1;
    if (inArc && bench >= z.levels[0] && bench <= z.levels[1]) return i;
  }
  return -1;
}

export function buildSensors(): SensorNode[] {
  const sensors: SensorNode[] = [];
  let idx = 0;
  const total = PIT.BENCH_COUNTS.reduce((a, b) => a + b, 0) + PIT.FLOOR_COUNT;

  for (let bench = 0; bench < PIT.BENCHES; bench++) {
    const count = PIT.BENCH_COUNTS[bench];
    const radius = benchMidRadius(bench);
    for (let j = 0; j < count; j++) {
      const angle = (j / count) * Math.PI * 2 + (bench % 2) * 0.12 + (rng() - 0.5) * 0.16;
      placeSensor(sensors, idx, total, angle, bench, radius, 0.35 + rng() * 0.5);
      idx++;
    }
  }
  for (let j = 0; j < PIT.FLOOR_COUNT; j++) {
    const angle = rng() * Math.PI * 2;
    placeSensor(sensors, idx, total, angle, PIT.BENCHES, 3 + rng() * 3.2, 0.4 + rng() * 0.5);
    idx++;
  }
  return sensors;
}

function placeSensor(
  sensors: SensorNode[],
  idx: number,
  total: number,
  angle: number,
  bench: number,
  radius: number,
  yOffset: number,
) {
  const id = `SN-${String(idx + 1).padStart(3, '0')}`;
  const zoneIndex = zoneIndexFor(angle, bench);
  const zoneName = zoneIndex >= 0 ? ZONE_NAMES[zoneIndex] : ZONE_NAMES[(zoneIndex + ZONE_NAMES.length) % ZONE_NAMES.length];

  let statusBase: SensorNode['status'] = 'safe';
  let riskScore = 5 + rng() * 25;
  if (zoneIndex === 1 && rng() > 0.35) {
    statusBase = rng() > 0.45 ? 'critical' : 'high-risk';
    riskScore = 80 + rng() * 14;
  } else if (zoneIndex === 0 && rng() > 0.5) {
    statusBase = 'high-risk';
    riskScore = 62 + rng() * 14;
  } else if (zoneIndex === 2 && rng() > 0.65) {
    statusBase = 'warning';
    riskScore = 48 + rng() * 12;
  } else if (zoneIndex === 3 && rng() > 0.7) {
    statusBase = 'warning';
    riskScore = 45 + rng() * 12;
  } else if (rng() > 0.78) {
    statusBase = 'warning';
    riskScore = 42 + rng() * 10;
  }

  const tilt = statusBase === 'critical' ? 9 + rng() * 6 : statusBase === 'high-risk' ? 5 + rng() * 4 : statusBase === 'warning' ? 3 + rng() * 3 : 0.4 + rng() * 2;
  const vibration = statusBase === 'critical' ? 4 + rng() * 4 : statusBase === 'high-risk' ? 2.4 + rng() * 2 : 0.5 + rng() * 1.6;
  const moisture = 35 + rng() * 35 + zoneIndex * 4;

  sensors.push({
    id,
    name: `GeoTilt ${String(idx + 1).padStart(3, '0')}`,
    zone: zoneName,
    zoneIndex,
    status: statusBase,
    position: {
      x: Math.cos(angle) * radius,
      y: benchY(bench) + yOffset,
      z: Math.sin(angle) * radius,
    },
    angle,
    bench,
    location: `${zoneName} — Bench ${bench + 1} / Level ${Math.floor(idx / 6) + 1}`,
    battery: Math.floor(88 + rng() * 12),
    signalStrength: Math.floor(72 + rng() * 26),
    tilt: +tilt.toFixed(2),
    vibration: +vibration.toFixed(2),
    moisture: +moisture.toFixed(1),
    temperature: +(22 + rng() * 9).toFixed(1),
    humidity: +(52 + rng() * 24).toFixed(1),
    lastUpdated: new Date(Date.now() - Math.floor(rng() * 40000)).toISOString(),
    healthScore: Math.floor(72 + rng() * 26),
    communicationRoute: [],
    predictionConfidence: +(65 + rng() * 30).toFixed(1),
    riskScore: +riskScore.toFixed(1),
    historicalRisk: Math.max(0, riskScore - 8 - rng() * 12),
  });
}

export const SENSOR_SEED: SensorNode[] = buildSensors();

export function applyOfflineState(sensors: SensorNode[]): SensorNode[] {
  const offlineIdx = [13, 27];
  return sensors.map((s, i) => {
    const isOffline = offlineIdx.includes(i);
    if (!isOffline) return s;
    return {
      ...s,
      status: 'offline' as const,
      riskScore: 0,
      signalStrength: 0,
      battery: 2,
      tilt: 0,
      vibration: 0,
      moisture: Math.max(10, s.moisture),
      predictionConfidence: 0,
      healthScore: 0,
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    };
  });
}

export const SENSORS: SensorNode[] = applyOfflineState(SENSOR_SEED);

export function buildZones(sensors: SensorNode[]): HighRiskZone[] {
  const factors: FactorSet[] = [
    { tilt: 0.78, rain: 0.9, crackGrowth: 0.66, vibration: 0.72 },
    { tilt: 0.94, rain: 0.71, crackGrowth: 0.87, vibration: 0.6 },
    { tilt: 0.56, rain: 0.85, crackGrowth: 0.71, vibration: 0.43 },
    { tilt: 0.44, rain: 0.68, crackGrowth: 0.52, vibration: 0.79 },
  ];
  const hours: [number, number, number, number] = [26, 9, 46, 72];
  const confidence: [number, number, number, number] = [81.2, 88.4, 66.9, 58.7];

  return ZONE_DEFS.map((z, i) => {
    const members = sensors
      .filter(s => s.zoneIndex === i && s.status !== 'offline')
      .sort((a, b) => b.riskScore - a.riskScore);
    const avg = members.length
      ? members.reduce((sum, s) => sum + s.riskScore, 0) / members.length
      : z.risk;
    const currentRisk = Math.min(99, Math.max(30, Math.round(avg * 0.85 + z.risk * 0.15)));
    return {
      id: z.id,
      name: z.name,
      shortName: z.shortName,
      currentRisk,
      historicalRisk: Math.max(18, currentRisk - 14 - i * 4),
      predictedFailureTime: new Date(Date.now() + hours[i] * 3600000).toISOString(),
      predictionHours: hours[i],
      confidence: confidence[i],
      activeSensorIds: members.slice(0, 6).map(m => m.id),
      position: {
        x: Math.cos(z.mid) * z.radius * 0.85,
        y: benchY(z.midLevel) + 2,
        z: Math.sin(z.mid) * z.radius * 0.85,
      },
      radius: 11,
      angleStart: z.angleStart,
      angleEnd: z.angleEnd,
      levels: z.levels,
      contributingFactors: factors[i],
    };
  });
}

export const HIGH_RISK_ZONES: HighRiskZone[] = buildZones(SENSORS);

export function buildHourHistory(sensor: SensorNode): HourSample[] {
  const samples: HourSample[] = [];
  const base = sensor.riskScore > 0 ? sensor.riskScore : 15;
  const now = Date.now();
  for (let i = 0; i < 168; i++) {
    const t = now - (167 - i) * 3600000;
    const dayWave = Math.sin((i / 24) * Math.PI * 2) * 6;
    const trend = (i / 167) * (sensor.riskScore - base * 0.6) * 0.8;
    const noise = (rng() - 0.5) * 8;
    const risk = Math.max(2, Math.min(99, base * 0.55 + dayWave + trend + noise + sensor.bench * 1.5));
    const riskT = risk / 100;
    samples.push({
      t,
      tilt: +(riskT * 13 + (rng() - 0.5) * 1.2).toFixed(2),
      vibration: +(riskT * 7 + (rng() - 0.5) * 0.8).toFixed(2),
      humidity: +(58 + Math.sin(i / 9) * 10 + (rng() - 0.5) * 4).toFixed(1),
      moisture: +(38 + riskT * 45 + Math.sin(i / 14) * 6 + (rng() - 0.5) * 4).toFixed(1),
      risk: +risk.toFixed(1),
      battery: +(Math.max(2, 96 - i * 0.55)).toFixed(1),
    });
  }
  return samples;
}

export const SENSOR_HISTORY: Record<string, HourSample[]> = Object.fromEntries(
  SENSORS.map(s => [s.id, buildHourHistory(s)]),
);

export const WEATHER: WeatherData = {
  temperature: 27.4,
  humidity: 68,
  windSpeed: 12.6,
  windDirection: 'NNE',
  rainfall: 2.4,
  visibility: 8.5,
  condition: 'Partly Cloudy',
  forecast: 'Heavy rain expected in ~6h',
};

export const DRONE_SEED: DroneInfo = {
  id: 'DRN-001',
  name: 'Sentinel Hawk',
  status: 'active',
  battery: 76,
  altitude: 120,
  speed: 15.4,
  coverageArea: '2.4 km²',
  missionStatus: 'Thermal + LiDAR sweep — Pass 3/5',
  latestScan: new Date().toISOString(),
  missionProgress: 58,
  position: { x: 0, y: 30, z: 0 },
  angle: 0.4,
};

export const SEED_ALERTS: Alert[] = [
  {
    id: 'ALT-001',
    time: new Date(Date.now() - 3600000 * 3.4).toISOString(),
    type: 'critical',
    location: 'East Bench — Lower Level',
    sensorId: 'SN-014',
    reason: 'Tilt angle exceeded 12° threshold — immediate rockfall risk detected',
    confidence: 92.3,
    acknowledgedBy: null,
    resolved: false,
  },
  {
    id: 'ALT-002',
    time: new Date(Date.now() - 3600000 * 5.2).toISOString(),
    type: 'critical',
    location: 'North Slope — Section A',
    sensorId: 'SN-004',
    reason: 'Vibration anomaly — 340% above baseline, correlates with micro-seismic activity',
    confidence: 87.8,
    acknowledgedBy: null,
    resolved: false,
  },
  {
    id: 'ALT-003',
    time: new Date(Date.now() - 3600000 * 8.9).toISOString(),
    type: 'warning',
    location: 'South Terrace — Overhang',
    sensorId: 'SN-019',
    reason: 'Moisture saturation at 89% — slope stability decreasing',
    confidence: 74.5,
    acknowledgedBy: 'Dr. Sarah Chen',
    resolved: false,
  },
  {
    id: 'ALT-004',
    time: new Date(Date.now() - 3600000 * 27).toISOString(),
    type: 'warning',
    location: 'West Haul Road — Embankment',
    sensorId: 'SN-028',
    reason: 'Communication link degraded — rerouting through mesh network',
    confidence: 68.2,
    acknowledgedBy: 'James Morrison',
    resolved: true,
  },
  {
    id: 'ALT-005',
    time: new Date(Date.now() - 3600000 * 41).toISOString(),
    type: 'critical',
    location: 'North Slope — Section A',
    sensorId: 'SN-006',
    reason: 'Crack growth rate accelerating — 2.3mm/hr measured over 6 hours',
    confidence: 91.0,
    acknowledgedBy: 'Dr. Sarah Chen',
    resolved: true,
  },
];

export const ANALYTICS = {
  dailyRisk: Array.from({ length: 30 }, (_, i) => ({
    day: `Aug ${i + 1}`,
    north: Math.round(40 + Math.sin(i / 4.2) * 14 + i * 0.55),
    east: Math.round(35 + Math.sin(i / 3.1) * 16 + i * 0.8),
    south: Math.round(30 + Math.cos(i / 5.1) * 10 + i * 0.3),
    west: Math.round(28 + Math.sin(i / 2.7) * 8 + i * 0.25),
  })),
  weeklyTrend: Array.from({ length: 12 }, (_, i) => ({
    week: `W${i + 1}`,
    avgRisk: Math.round(38 + Math.sin(i / 1.9) * 9 + i * 0.9),
    incidents: Math.round(1 + Math.abs(Math.sin(i / 2.2)) * 3),
    sensorHealth: Math.round(92 - i * 0.4 + Math.sin(i / 2) * 2),
  })),
  aiAccuracySeries: Array.from({ length: 14 }, (_, i) => ({
    day: `D${i + 1}`,
    accuracy: +(93.4 + Math.sin(i / 3.3) * 1.4 + i * 0.11).toFixed(1),
    predictions: Math.round(18 + Math.sin(i / 2.1) * 6 + i * 0.9),
  })),
  communication: {
    avgSignal: 78.4,
    packetLoss: 1.2,
    latency: 42,
    throughput: 88.6,
  },
  aiAccuracy: {
    overall: 94.7,
    truePositives: 23,
    falsePositives: 2,
    trueNegatives: 156,
    falseNegatives: 1,
  },
  failureHistory: [
    { date: 'Jul 15', location: 'North Slope', predicted: true, severity: 'Major', confidence: 89, hoursAhead: 38 },
    { date: 'Jul 02', location: 'East Bench', predicted: true, severity: 'Minor', confidence: 76, hoursAhead: 12 },
    { date: 'Jun 18', location: 'South Terrace', predicted: false, severity: 'Minor', confidence: 0, hoursAhead: 0 },
    { date: 'May 28', location: 'West Road', predicted: true, severity: 'Major', confidence: 92, hoursAhead: 51 },
    { date: 'May 10', location: 'Central Pit', predicted: true, severity: 'Moderate', confidence: 84, hoursAhead: 22 },
    { date: 'Apr 21', location: 'North Slope', predicted: true, severity: 'Moderate', confidence: 79, hoursAhead: 33 },
  ],
  zoneComparison: [
    { zone: 'East Bench', value: 91 },
    { zone: 'North Slope', value: 84 },
    { zone: 'South Terrace', value: 71 },
    { zone: 'West Haul Rd', value: 63 },
  ],
};

export function riskStatusOf(score: number): SensorNode['status'] {
  return riskFromScore(score);
}
