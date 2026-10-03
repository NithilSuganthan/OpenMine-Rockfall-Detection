import type { RiskTier, SensorStatus } from '../data/types';

/** Prediction tier → node/marker color (safe → green, watch → yellow, warning → orange, emergency → red). */
export const tierColors: Record<RiskTier, string> = {
  normal: '#22c55e',
  watch: '#eab308',
  warning: '#f97316',
  emergency: '#ef4444',
};

export const tierLabels: Record<RiskTier, string> = {
  normal: 'Safe',
  watch: 'Watch',
  warning: 'Warning',
  emergency: 'Emergency',
};

/** Prediction tier → estimated hours to failure (shown in prediction cards). */
export const tierHours: Record<RiskTier, number> = {
  normal: 48,
  watch: 12,
  warning: 3,
  emergency: 0.5,
};

/** Prediction score (0-10) mapped to the UI risk scale (0-100). */
export function scoreToRisk(score: number): number {
  return clamp(score * 10, 0, 100);
}

export const statusColors: Record<SensorStatus, string> = {
  safe: '#22c55e',
  warning: '#eab308',
  'high-risk': '#f97316',
  critical: '#ef4444',
  offline: '#64748b',
};

export const statusLabels: Record<SensorStatus, string> = {
  safe: 'Safe',
  warning: 'Warning',
  'high-risk': 'High Risk',
  critical: 'Critical',
  offline: 'Offline',
};

export const statusBgClasses: Record<SensorStatus, string> = {
  safe: 'bg-green-500/20 text-green-400 border-green-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'high-risk': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  offline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

export const STATUS_ORDER: SensorStatus[] = ['safe', 'warning', 'high-risk', 'critical', 'offline'];

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function riskFromScore(score: number): SensorStatus {
  if (score <= 0) return 'offline';
  if (score >= 85) return 'critical';
  if (score >= 65) return 'high-risk';
  if (score >= 45) return 'warning';
  return 'safe';
}

export function getRiskColor(risk: number): string {
  if (risk >= 85) return '#ef4444';
  if (risk >= 65) return '#f97316';
  if (risk >= 45) return '#eab308';
  return '#22c55e';
}

export function getRiskLabel(risk: number): string {
  if (risk >= 85) return 'Critical';
  if (risk >= 65) return 'High';
  if (risk >= 45) return 'Moderate';
  return 'Low';
}

export function riskColorGradient(score: number): string {
  const stops: [number, [number, number, number]][] = [
    [0, [34, 197, 94]],
    [45, [234, 179, 8]],
    [65, [249, 115, 22]],
    [85, [239, 68, 68]],
    [100, [220, 38, 38]],
  ];
  const v = clamp(score, 0, 100);
  let i = 0;
  while (i < stops.length - 2 && v > stops[i + 1][0]) i++;
  const [a, ca] = stops[i];
  const [b, cb] = stops[i + 1];
  const t = clamp((v - a) / Math.max(0.001, b - a), 0, 1);
  const r = Math.round(lerp(ca[0], cb[0], t));
  const g = Math.round(lerp(ca[1], cb[1], t));
  const bl = Math.round(lerp(ca[2], cb[2], t));
  return `rgb(${r},${g},${bl})`;
}

export function formatTimeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatClock(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatHours(hours: number): string {
  if (hours <= 0) return 'Imminent';
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  if (d > 0) return `${d}d ${h}h`;
  return `${h}h ${Math.round((hours % 1) * 60)}m`;
}
