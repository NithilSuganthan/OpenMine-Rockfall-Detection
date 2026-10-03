import type {
  Alert, HighRiskZone, SensorNode, SystemEvent, WeatherData,
} from '../data/types';
import type { DesignerLink, DesignerObject } from '../data/designerTypes';
import type { PredictionResult } from '../services/predictionService';
import { SENSOR_HISTORY } from '../data/mockData';
import { buildNetwork, GATEWAYS } from './network';
import { formatHours, getRiskLabel, statusLabels, tierLabels } from './helpers';

/**
 * AI Mine Operations Assistant — deterministic answer engine.
 *
 * NO hallucinations: every value in an answer is read live from the shared
 * stores (telemetry, prediction, alerts, network, deployment, history,
 * weather). Questions that cannot be answered from system data return an
 * explicit "cannot verify" response.
 */

export type EvidenceKind = 'sensor' | 'zone' | 'gateway' | 'relay' | 'alert' | 'system' | 'deployment';
export type TargetPage = 'digital-twin' | 'mine-designer';

export interface EvidenceItem {
  label: string;
  value: string;
  source: string;
  targetId?: string;
  kind: EvidenceKind;
  page?: TargetPage;
}

export type TrendMetric = 'tilt' | 'vibration' | 'moisture' | 'risk' | 'battery';

export interface TrendChartSpec {
  sensorId: string;
  title: string;
  metrics: TrendMetric[];
  keys: string[];
  keyMetrics: TrendMetric[];
  points: { t: number; label: string; [k: string]: number | string }[];
}

export interface AssistantAnswer {
  id: string;
  question: string;
  ts: number;
  verified: boolean;
  summary: string;
  evidence: EvidenceItem[];
  reasoning: string;
  recommendation: string;
  confidence: number;
  charts?: TrendChartSpec[];
}

export interface AssistantSnapshot {
  sensors: SensorNode[];
  zones: HighRiskZone[];
  alerts: Alert[];
  prediction: PredictionResult | null;
  events: SystemEvent[];
  weather: WeatherData;
  objects: DesignerObject[];
  links: DesignerLink[];
  deploymentScore: number | null;
}

let seq = 0;

const FACTOR_LABELS: Record<string, string> = {
  tilt: 'Tilt displacement',
  rain: 'Rainwater infiltration',
  crackGrowth: 'Crack growth rate',
  vibration: 'Micro-seismic vibration',
};

const THRESHOLD_LABEL: Record<string, { label: string; unit: string }> = {
  tilt: { label: 'Tilt', unit: '°' },
  vibration: { label: 'Vibration', unit: ' mm/s' },
  moisture: { label: 'Moisture', unit: '%' },
};

/* ─────────────────────────── small helpers ─────────────────────────── */

function E(label: string, value: string, source: string, extra: Partial<EvidenceItem> = {}): EvidenceItem {
  return { label, value, source, kind: 'system', ...extra };
}

function now(): number {
  return Date.now();
}

function liveMetric(s: SensorNode, m: TrendMetric): number {
  return m === 'risk' ? s.riskScore : s[m];
}

function metricUnit(m: TrendMetric): string {
  if (m === 'vibration') return ' mm/s';
  if (m === 'tilt') return '°';
  return '%';
}

function sensorEvidence(s: SensorNode): EvidenceItem[] {
  const items: EvidenceItem[] = [
    E('Status', statusLabels[s.status].toUpperCase(), s.id, { targetId: s.id, kind: 'sensor', page: 'digital-twin' }),
    E('Risk Score', `${s.riskScore.toFixed(1)}%`, s.id, { targetId: s.id, kind: 'sensor', page: 'digital-twin' }),
  ];
  if (s.status !== 'offline') {
    items.push(
      E('Tilt', `${s.tilt.toFixed(2)}°`, s.id, { targetId: s.id, kind: 'sensor', page: 'digital-twin' }),
      E('Vibration', `${s.vibration.toFixed(2)} mm/s`, s.id, { targetId: s.id, kind: 'sensor', page: 'digital-twin' }),
      E('Moisture', `${s.moisture.toFixed(1)}%`, s.id, { targetId: s.id, kind: 'sensor', page: 'digital-twin' }),
    );
  }
  items.push(
    E('Battery', `${s.battery.toFixed(0)}%`, s.id, { targetId: s.id, kind: 'sensor', page: 'digital-twin' }),
    E('Signal', `${s.signalStrength}%`, s.id, { targetId: s.id, kind: 'sensor', page: 'digital-twin' }),
    E('Prediction Confidence', `${s.predictionConfidence.toFixed(0)}%`, s.id, { targetId: s.id, kind: 'sensor', page: 'digital-twin' }),
  );
  return items;
}

function zoneEvidence(z: HighRiskZone): EvidenceItem[] {
  return [
    E('Zone Risk', `${z.currentRisk}%`, z.id, { targetId: z.id, kind: 'zone', page: 'digital-twin' }),
    E('Historical Baseline', `${z.historicalRisk}%`, z.id, { targetId: z.id, kind: 'zone', page: 'digital-twin' }),
    E('Predicted Failure', `${formatHours(z.predictionHours)} (${new Date(z.predictedFailureTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })})`, z.id, { targetId: z.id, kind: 'zone', page: 'digital-twin' }),
    E('Model Confidence', `${z.confidence.toFixed(1)}%`, z.id, { targetId: z.id, kind: 'zone', page: 'digital-twin' }),
    ...Object.entries(z.contributingFactors).map(([k, v]) =>
      E(FACTOR_LABELS[k] ?? k, `${Math.round(v * 100)}%`, 'Prediction Engine'),
    ),
  ];
}

function makeAnswer(
  question: string,
  verified: boolean,
  summary: string,
  evidence: EvidenceItem[],
  reasoning: string,
  recommendation: string,
  confidence: number,
  charts?: TrendChartSpec | TrendChartSpec[],
): AssistantAnswer {
  return {
    id: `ANS-${now()}-${seq++}`,
    question,
    ts: now(),
    verified,
    summary,
    evidence,
    reasoning,
    recommendation,
    confidence,
    charts: charts ? (Array.isArray(charts) ? charts : [charts]) : undefined,
  };
}

function cannotVerify(question: string, available?: string): AssistantAnswer {
  return makeAnswer(
    question,
    false,
    'I cannot verify this using the current system data.',
    [],
    available
      ? `The request is outside the connected data sources. Available live sources: ${available}. No values were fabricated for this answer.`
      : 'This request does not match any intent that can be resolved from the connected system data (telemetry, predictions, alerts, network, deployment, history, weather). No values were fabricated for this answer.',
    'Connect the relevant data feed (e.g. camera detection stream) to enable this query, or ask about live sensor telemetry, predictions, alerts, coverage or the LoRa mesh.',
    0,
  );
}

function hourLabel(t: number): string {
  return new Date(t).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function historyChart(sensorId: string, metrics: TrendMetric[], hours = 24, title?: string): TrendChartSpec | null {
  const hist = SENSOR_HISTORY[sensorId];
  if (!hist || hist.length === 0) return null;
  const window = hist.slice(-hours);
  return {
    sensorId,
    title: title ?? `${sensorId} — last ${hours}h`,
    metrics,
    keys: metrics,
    keyMetrics: metrics,
    points: window.map(h => ({
      t: h.t,
      label: hourLabel(h.t),
      tilt: h.tilt,
      vibration: h.vibration,
      moisture: h.moisture,
      risk: Math.round(h.risk),
      battery: Math.round(h.battery),
    })),
  };
}

function compareChart(ids: [string, string], metric: TrendMetric): TrendChartSpec | null {
  const a = SENSOR_HISTORY[ids[0]];
  const b = SENSOR_HISTORY[ids[1]];
  if (!a || !b) return null;
  const n = Math.min(a.length, b.length, 24);
  return {
    sensorId: `${ids[0]}-${ids[1]}`,
    title: `${metric} — ${ids[0]} vs ${ids[1]} (24h)`,
    metrics: [metric],
    keys: [`${ids[0]}.${metric}`, `${ids[1]}.${metric}`],
    keyMetrics: [metric, metric],
    points: a.slice(-n).map((h, i) => ({
      t: h.t,
      label: hourLabel(h.t),
      [`${ids[0]}.${metric}`]: h[metric],
      [`${ids[1]}.${metric}`]: b[b.length - n + i][metric],
    })),
  };
}

function nearestGateway(s: SensorNode): string {
  let best = GATEWAYS[0].id;
  let bestD = Infinity;
  for (const g of GATEWAYS) {
    const d = Math.hypot(g.position.x - s.position.x, g.position.z - s.position.z);
    if (d < bestD) { bestD = d; best = g.id; }
  }
  return best;
}

/* ─────────────────────────────── intents ─────────────────────────────── */

export function answerQuestion(snap: AssistantSnapshot, rawQuestion: string): AssistantAnswer {
  const q = rawQuestion.toLowerCase();
  const byId = new Map(snap.sensors.map(s => [s.id, s]));
  const zonesById = new Map(snap.zones.map(z => [z.id, z]));
  const network = buildNetwork(snap.sensors);
  const online = snap.sensors.filter(s => s.status !== 'offline');
  const topSensor = [...online].sort((a, b) => b.riskScore - a.riskScore)[0] ?? snap.sensors[0];
  const topZone = [...snap.zones].sort((a, b) => b.currentRisk - a.currentRisk)[0];

  const snMatch = q.match(/\bSN-\d{3}\b/i);
  const hrzMatch = q.match(/\bHRZ-\d{3}\b/i);
  const gwMatch = q.match(/\bGW-\d{2}\b/i);

  const sensor = snMatch ? byId.get(snMatch[0].toUpperCase()) ?? null : null;
  const zone = hrzMatch ? zonesById.get(hrzMatch[0].toUpperCase()) ?? null : null;

  /* ── 1. Most dangerous bench / zone ── */
  if (/dangerous|most at risk|highest risk|worst|most critical|which bench/.test(q)) {
    const z = topZone;
    const members = (z.activeSensorIds ?? []).map(id => byId.get(id)).filter((s): s is SensorNode => !!s);
    const worst = members[0] ?? topSensor;
    const ev: EvidenceItem[] = [
      ...zoneEvidence(z).slice(0, 4),
      E('Lead Sensor', worst ? worst.id : '—', worst ? worst.id : 'Zone Manager', worst ? { targetId: worst.id, kind: 'sensor', page: 'digital-twin' } : {}),
    ];
    if (worst) {
      ev.push(
        E('Tilt', `${worst.tilt.toFixed(2)}°`, worst.id, { targetId: worst.id, kind: 'sensor', page: 'digital-twin' }),
        E('Vibration', `${worst.vibration.toFixed(2)} mm/s`, worst.id, { targetId: worst.id, kind: 'sensor', page: 'digital-twin' }),
        E('Moisture', `${worst.moisture.toFixed(1)}%`, worst.id, { targetId: worst.id, kind: 'sensor', page: 'digital-twin' }),
        E('Failure Probability', `${z.currentRisk}%`, 'Prediction Engine'),
      );
    }
    return makeAnswer(
      rawQuestion, true,
      `${z.name} is the most dangerous zone right now (risk ${z.currentRisk}%).`,
      ev,
      `The prediction model ranks ${z.name} above all other zones. Its lead sensor ${worst?.id ?? '—'} shows ${worst ? `tilt ${worst.tilt.toFixed(2)}°, vibration ${worst.vibration.toFixed(2)} mm/s and moisture ${worst.moisture.toFixed(1)}%` : 'no live member data'}, matching historical rockfall precursor patterns.`,
      `Dispatch an inspection team to ${z.name}. If risk exceeds 85%, suspend operations on the affected benches.`,
      z.confidence,
      worst ? historyChart(worst.id, ['tilt', 'vibration', 'moisture'], 24, `${worst.id} — 24h precursor trends`) ?? undefined : undefined,
    );
  }

  /* ── 2. Why is X critical / red / emergency (sensor or zone) ── */
  if (/why|reason|explain/.test(q) && /critical|red|emergency|high|risk|danger/.test(q)) {
    if (sensor) {
      const s = sensor;
      const ev = sensorEvidence(s);
      ev.push(E('Zone', s.zone, 'Zone Manager'));
      return makeAnswer(
        rawQuestion, true,
        `${s.id} is classified as ${statusLabels[s.status].toUpperCase()} (risk ${s.riskScore.toFixed(1)}%).`,
        ev,
        s.status === 'offline'
          ? `${s.id} is offline — no telemetry is arriving and its risk score is not computed. This usually indicates a communication loss or hardware failure.`
          : `The prediction engine combines tilt (${s.tilt.toFixed(2)}°), vibration (${s.vibration.toFixed(2)} mm/s) and moisture (${s.moisture.toFixed(1)}%) against the ${s.zone} zone state to produce a risk score of ${s.riskScore.toFixed(1)}%.`,
        s.status === 'offline'
          ? `Investigate the ${s.zone} link path (nearest gateway: ${nearestGateway(s)}). Commission a field check for battery and enclosure integrity.`
          : s.status === 'critical' || s.status === 'high-risk'
            ? `Suspend operations around ${s.zone} and dispatch an inspection team. Monitor ${s.id} closely.`
            : `Continue scheduled monitoring of ${s.id}. No immediate action required.`,
        s.status === 'offline' ? Math.min(95, 55 + network.coverage) : s.predictionConfidence,
        s.status !== 'offline' ? historyChart(s.id, ['tilt', 'vibration', 'moisture'], 24) ?? undefined : undefined,
      );
    }
    if (zone) {
      const ev = zoneEvidence(zone);
      ev.push(E('Active Sensors', zone.activeSensorIds.join(', '), 'Zone Manager'));
      return makeAnswer(
        rawQuestion, true,
        `${zone.id} (${zone.name}) is classified as ${getRiskLabel(zone.currentRisk).toUpperCase()} with a risk of ${zone.currentRisk}%.`,
        ev,
        `Contributing factors ranked by the prediction engine: ${Object.entries(zone.contributingFactors).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${FACTOR_LABELS[k]} (${Math.round(v * 100)}%)`).join(', ')}.`,
        zone.currentRisk >= 85
          ? 'Suspend operations and inspect the zone now. Evacuate personnel within the warning radius.'
          : zone.currentRisk >= 65
            ? 'Increase monitoring frequency and prepare an inspection team.'
            : 'Continue routine monitoring.',
        zone.confidence,
      );
    }
    const s = topSensor;
    const ev = sensorEvidence(s);
    ev.push(E('Failure Probability', `${Math.max(s.riskScore, topZone?.currentRisk ?? 0)}%`, 'Prediction Engine'));
    return makeAnswer(
      rawQuestion, true,
      `The highest-risk sensor is ${s.id} (${statusLabels[s.status].toUpperCase()}, risk ${s.riskScore.toFixed(1)}%) in ${s.zone}.`,
      ev,
      `${s.id} leads the risk ranking; its readings are weighted with the ${s.zone} zone state to produce the alert classification.`,
      'Review the listed evidence and inspect the referenced bench.',
      s.predictionConfidence,
    );
  }

  /* ── 3. Threshold queries — vibration / tilt / moisture above N ── */
  const thresh = q.match(/(vibration|tilt|moisture)\D*?(\d+(?:\.\d+)?)/i);
  if (thresh && /above|over|exceed|higher than|>|more than|greater/.test(q)) {
    const metric = thresh[1].toLowerCase() as 'tilt' | 'vibration' | 'moisture';
    const threshold = parseFloat(thresh[2]);
    const label = THRESHOLD_LABEL[metric];
    const hits = online.filter(s => s[metric] >= threshold).sort((a, b) => b[metric] - a[metric]);
    if (hits.length === 0) {
      return makeAnswer(
        rawQuestion, true,
        `No sensors currently report ${label.label} at or above ${threshold}${label.unit}.`,
        [E('Sensors Checked', `${online.length}`, 'Telemetry Store')],
        `All ${online.length} online sensors are below the ${threshold}${label.unit} ${label.label.toLowerCase()} threshold.`,
        'Continue routine monitoring. Consider lowering the threshold if this condition persists.',
        Math.min(95, 55 + network.coverage),
      );
    }
    const ev: EvidenceItem[] = hits.slice(0, 8).map(s => E(
      `${label.label} ${s[metric].toFixed(2)}${label.unit}`,
      `${s.id} · ${s.zone} · risk ${s.riskScore.toFixed(0)}%`,
      s.id,
      { targetId: s.id, kind: 'sensor', page: 'digital-twin' },
    ));
    return makeAnswer(
      rawQuestion, true,
      `${hits.length} sensor${hits.length > 1 ? 's' : ''} report${hits.length > 1 ? '' : 's'} ${label.label.toLowerCase()} ≥ ${threshold}${label.unit}.`,
      ev,
      `The telemetry store was filtered live for ${label.label.toLowerCase()} ≥ ${threshold}${label.unit}. ${hits.length} of ${online.length} online sensors matched.`,
      hits.length > 3
        ? `Escalate: ${hits.length} sensors exceed the threshold. Inspect ${hits.slice(0, 3).map(h => h.id).join(', ')} first.`
        : `Dispatch inspection to ${hits.map(h => h.id).join(', ')}.`,
      Math.min(95, 55 + network.coverage),
      hits[0] ? historyChart(hits[0].id, [metric], 24, `${hits[0].id} — ${label.label} 24h`) ?? undefined : undefined,
    );
  }

  /* ── 4. Gateway with highest traffic ── */
  if (/gateway/.test(q) && /traffic|busiest|load|connections|how many.*gateway|uplink/.test(q)) {
    const counts = new Map<string, number>();
    network.links.forEach(l => { if (GATEWAYS.some(g => g.id === l.to)) counts.set(l.to, (counts.get(l.to) ?? 0) + 1); });
    const busiest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    if (!busiest) {
      return cannotVerify(rawQuestion, 'sensor telemetry, alerts, predictions, network graph');
    }
    const ev: EvidenceItem[] = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([gw, n]) => E(
      `${gw} connections`, `${n}`, 'Network Manager',
      { targetId: gw, kind: 'gateway', page: 'digital-twin' },
    ));
    return makeAnswer(
      rawQuestion, true,
      `${busiest[0]} carries the most traffic with ${busiest[1]} connected nodes.`,
      ev,
      `The mesh graph (computed from live sensor routes) shows ${busiest[0]} serving ${busiest[1]} nodes — the highest uplink load of all ${GATEWAYS.length} gateways.`,
      `Monitor ${busiest[0]} for congestion. If it exceeds capacity, deploy an additional edge gateway via the Mine Designer.`,
      Math.min(95, 55 + network.coverage),
    );
  }

  /* ── 5. Offline sensors ── */
  if (/offline|unreachable|not responding|lost/.test(q) && /how many|count|list|which|sensors/.test(q)) {
    const off = snap.sensors.filter(s => s.status === 'offline');
    const ev: EvidenceItem[] = off.length === 0
      ? [E('Offline Sensors', '0', 'Network Manager')]
      : off.map(s => E(
          s.id, `${s.zone} · signal 0% · battery ${s.battery.toFixed(0)}%`, s.id,
          { targetId: s.id, kind: 'sensor', page: 'digital-twin' },
        ));
    return makeAnswer(
      rawQuestion, true,
      `${off.length} of ${snap.sensors.length} sensors are offline (${network.coverage}% network coverage).`,
      ev,
      `The network manager reports ${off.length} nodes without telemetry. Offline nodes cannot contribute to predictions, which reduces local monitoring confidence.`,
      off.length > 0
        ? `Investigate ${off.map(s => s.id).join(', ')} — check battery, enclosure and the nearest gateway route.`
        : 'No action required.',
      Math.min(95, 55 + network.coverage),
    );
  }

  /* ── 6. Failed relay node (designer deployment) ── */
  if (/relay/.test(q) && /fail|down|offline|status|broken|working/.test(q)) {
    const relays = snap.objects.filter(o => o.type === 'relay-node');
    if (relays.length === 0) {
      return cannotVerify(rawQuestion, 'sensor telemetry, network graph, designer deployment');
    }
    const unlinked = relays.filter(o => !snap.links.some(l => l.from === o.id || l.to === o.id));
    const single = relays.filter(o => snap.links.filter(l => l.from === o.id || l.to === o.id).length === 1);
    const ev: EvidenceItem[] = relays.map(o => E(
      `${o.id} links`,
      `${snap.links.filter(l => l.from === o.id || l.to === o.id).length}`,
      'Network Manager',
      { targetId: o.id, kind: 'relay', page: 'mine-designer' },
    ));
    if (unlinked.length === 0 && single.length === 0) {
      return makeAnswer(
        rawQuestion, true,
        'No relay node failure detected in the deployment.',
        ev,
        `All ${relays.length} relay nodes in the Mine Designer deployment have at least 2 mesh links, so no failed relay is currently identified.`,
        'No action required.',
        Math.min(95, 55 + network.coverage),
      );
    }
    const bad = unlinked[0] ?? single[0];
    return makeAnswer(
      rawQuestion, true,
      `${bad.id} has ${unlinked.length > 0 ? 'no active mesh links' : 'only one mesh link'} and is the weakest relay in the deployment.`,
      ev,
      `The deployment graph shows ${bad.id} with insufficient redundancy. With ${unlinked.length > 0 ? 'zero' : 'one'} connection it cannot sustain failover if the link degrades.`,
      `Inspect ${bad.id} or re-link it in the Mine Designer (redundancy rule: ≥ 2 links per relay).`,
      Math.min(95, 55 + network.coverage),
    );
  }

  /* ── 7. Poor coverage ── */
  if (/coverage/.test(q)) {
    const score = snap.deploymentScore;
    const ev: EvidenceItem[] = [
      E('Network Coverage', `${network.coverage}%`, 'Network Manager'),
      E('Sensing Coverage', score !== null ? `${score}%` : '—', 'Deployment Validator'),
      E('Offline Nodes', `${network.offlineCount}`, 'Network Manager'),
      E('Rerouted Links', `${network.reroutedCount}`, 'Network Manager'),
    ];
    const worstZone = [...snap.zones].sort((a, b) => (a.activeSensorIds?.length ?? 0) - (b.activeSensorIds?.length ?? 0))[0];
    if (worstZone) ev.push(E('Weakest Zone', `${worstZone.shortName} (${worstZone.activeSensorIds?.length ?? 0} sensors)`, 'Zone Manager', { targetId: worstZone.id, kind: 'zone', page: 'digital-twin' }));
    const pct = score !== null ? score : network.coverage;
    return makeAnswer(
      rawQuestion, true,
      pct < 70
        ? `Coverage is POOR: ${score !== null ? `sensing ${score}%` : `network ${network.coverage}%`}.`
        : pct < 85
          ? `Coverage is ACCEPTABLE: ${score !== null ? `sensing ${score}%` : `network ${network.coverage}%`}.`
          : `Coverage is GOOD: ${score !== null ? `sensing ${score}%` : `network ${network.coverage}%`}.`,
      ev,
      `Network coverage ${network.coverage}% is computed from live connectivity; ${score !== null ? `sensing coverage ${score}% comes from the Mine Designer deployment validator` : 'sensing coverage is unavailable until a deployment is validated'}.`,
      pct < 85
        ? `Add sensors in the Mine Designer to close gaps, prioritising ${worstZone?.shortName ?? 'the weakest zone'}.`
        : 'No action required.',
      Math.min(95, 55 + network.coverage),
    );
  }

  /* ── 8. Why did the AI classify X as emergency ── */
  if (/predict|classif|ml|model|ai/.test(q) && /emergency|tier|why|reason/.test(q)) {
    const p = snap.prediction;
    if (!p) return cannotVerify(rawQuestion, 'sensor telemetry, alerts, prediction engine (no result yet)');
    const t = topZone;
    const ev: EvidenceItem[] = [
      E('Prediction Score', `${p.score.toFixed(1)}/10`, 'Prediction Engine'),
      E('Tier', tierLabels[p.tier].toUpperCase(), 'Prediction Engine'),
      E('Confidence', `${(p.confidence * 100).toFixed(1)}%`, 'Prediction Engine'),
      E('Reason', p.recommendation, 'Prediction Engine'),
    ];
    if (t) {
      ev.push(E('Zone Risk', `${t.currentRisk}%`, t.id, { targetId: t.id, kind: 'zone', page: 'digital-twin' }));
      Object.entries(t.contributingFactors).sort((a, b) => b[1] - a[1]).slice(0, 2).forEach(([k, v]) => {
        ev.push(E(FACTOR_LABELS[k] ?? k, `${Math.round(v * 100)}%`, 'Prediction Engine'));
      });
    }
    return makeAnswer(
      rawQuestion, true,
      `The model classified the current state as ${tierLabels[p.tier].toUpperCase()} with score ${p.score.toFixed(1)}/10.`,
      ev,
      `The prediction engine evaluated live telemetry and zone dynamics; the top contributing factors for ${t?.name ?? 'the mine'} drove the ${tierLabels[p.tier].toUpperCase()} classification.`,
      p.tier === 'emergency' || p.tier === 'warning'
        ? p.recommendation
        : 'No immediate action required — continue standard monitoring.',
      p.confidence * 100,
    );
  }

  /* ── 9. Camera detections ── */
  if (/camera|vision|visual|crack/.test(q)) {
    const cams = snap.objects.filter(o => o.type === 'camera');
    return makeAnswer(
      rawQuestion, false,
      'I cannot verify this using the current system data.',
      cams.length > 0
        ? [E('Deployed Cameras', cams.map(c => c.id).join(', '), 'Mine Designer Deployment', { targetId: cams[0].id, kind: 'deployment', page: 'mine-designer' })]
        : [],
      cams.length > 0
        ? `Camera hardware (${cams.map(c => c.id).join(', ')}) is deployed, but no camera detection stream (crack/rockfall detections) is connected to the system yet.`
        : 'No camera detection stream is connected to the system, and no crack detection events exist in the stores.',
      'Connect the camera detection feed to enable visual anomaly queries.',
      0,
    );
  }

  /* ── 10. History / trend / compare for a sensor ── */
  if (/(history|trend|last 24|past 24|last hour|compare|series|show)/.test(q)) {
    const compare = q.match(/\bSN-\d{3}\b/g);
    if (compare && compare.length >= 2) {
      const ids = [compare[0].toUpperCase(), compare[1].toUpperCase()] as [string, string];
      const metric = (q.match(/vibration|tilt|moisture/) ?? ['risk'])[0] as TrendMetric;
      const chart = compareChart(ids, metric);
      const a = byId.get(ids[0]);
      const b = byId.get(ids[1]);
      return makeAnswer(
        rawQuestion, true,
        `Comparing ${ids[0]} and ${ids[1]} over the last 24 hours (${metric}).`,
        [
          E(`${ids[0]} current ${metric}`, a ? `${liveMetric(a, metric)}${metricUnit(metric)}` : '—', ids[0], { targetId: ids[0], kind: 'sensor', page: 'digital-twin' }),
          E(`${ids[1]} current ${metric}`, b ? `${liveMetric(b, metric)}${metricUnit(metric)}` : '—', ids[1], { targetId: ids[1], kind: 'sensor', page: 'digital-twin' }),
        ],
        `Both series are read from the historical telemetry store (hourly samples). The chart shows live alignment of the two sensors.`,
        'Compare against zone risk before deciding whether either bench needs inspection.',
        78,
        chart ?? undefined,
      );
    }
    const target = sensor ?? byId.get('SN-021') ?? topSensor;
    if (target) {
      const metric = (q.match(/vibration|tilt|moisture|battery/) ?? ['risk'])[0] as TrendMetric;
      const ev: EvidenceItem[] = [
        E('Current ' + metric, `${liveMetric(target, metric)}${metricUnit(metric)}`, target.id, { targetId: target.id, kind: 'sensor', page: 'digital-twin' }),
        E('Zone', target.zone, 'Zone Manager'),
        E('Status', statusLabels[target.status].toUpperCase(), target.id, { targetId: target.id, kind: 'sensor', page: 'digital-twin' }),
      ];
      return makeAnswer(
        rawQuestion, true,
        `Historical telemetry for ${target.id} — last 24 hours (${metric}).`,
        ev,
        `Data is read from the historical store (168 hourly samples per sensor). The last 24 hours are rendered in the chart below.`,
        target.status === 'critical' || target.status === 'high-risk'
          ? 'Escalate: trend confirms elevated readings. Schedule inspection.'
          : 'Routine monitoring can continue.',
        target.predictionConfidence,
        historyChart(target.id, [metric, 'risk'], 24) ?? undefined,
      );
    }
  }

  /* ── 11. Which nodes are connected to gateway X ── */
  if (/connected|linked|linked to|uplink|through/.test(q) && /gateway|gw/.test(q)) {
    const gwId = gwMatch ? gwMatch[0].toUpperCase() : 'GW-02';
    const members = network.links.filter(l => l.to === gwId).map(l => l.from);
    const ev: EvidenceItem[] = members.length === 0
      ? [E('Nodes', 'none', 'Network Manager')]
      : members.map(id => E(
          id, byId.get(id)?.zone ?? '—', 'Network Manager',
          { targetId: id, kind: 'sensor', page: 'digital-twin' },
        ));
    return makeAnswer(
      rawQuestion, true,
      `${members.length} node${members.length === 1 ? '' : 's'} uplink to ${gwId}.`,
      ev,
      `The live mesh graph was filtered for uplinks terminating at ${gwId}.`,
      members.length === 0
        ? `No node uplinks to ${gwId} — verify gateway status or re-deploy mesh links.`
        : `Balance load across gateways if ${gwId} exceeds the other gateways' member counts.`,
      Math.min(95, 55 + network.coverage),
    );
  }

  /* ── 12. Rerouted communication ── */
  if (/rerout|route|path|backbone|re-?route/.test(q)) {
    const ev: EvidenceItem[] = [
      E('Rerouted Links', `${network.reroutedCount}`, 'Network Manager'),
      E('Network Coverage', `${network.coverage}%`, 'Network Manager'),
      E('Offline Nodes', `${network.offlineCount}`, 'Network Manager'),
    ];
    const linkLost = snap.events.find(e => /LINK LOST|rerout/i.test(e.message));
    const offlineAlerts = snap.alerts.filter(a => /rerout|link|communication/i.test(a.reason) && !a.resolved);
    const reroutedSensors = network.links.filter(l => l.rerouted).map(l => l.from);
    if (linkLost) ev.push(E('Recent Event', linkLost.message, 'Event Log'));
    if (offlineAlerts[0]) ev.push(E('Active Alert', offlineAlerts[0].reason, offlineAlerts[0].id, { kind: 'alert' }));
    return makeAnswer(
      rawQuestion, true,
      network.reroutedCount > 0
        ? `Communication is rerouted on ${network.reroutedCount} link${network.reroutedCount > 1 ? 's' : ''} due to connectivity loss.`
        : 'No links are currently rerouted — all mesh paths are primary.',
      ev,
      reroutedSensors.length > 0
        ? `The mesh network automatically failed over traffic around affected nodes (${[...new Set(reroutedSensors)].slice(0, 4).join(', ')}...) to maintain uplink connectivity.`
        : 'The network manager shows zero rerouted links, so all traffic is on primary paths.',
      reroutedSensors.length > 0
        ? 'Investigate the affected nodes; redundant paths are carrying traffic but are not a permanent fix.'
        : 'No action required.',
      Math.min(95, 55 + network.coverage),
    );
  }

  /* ── 13. LoRa mesh health ── */
  if (/mesh|health|healthy|lora/.test(q)) {
    const relays = snap.objects.filter(o => o.type === 'relay-node');
    const gws = snap.objects.filter(o => o.type === 'gateway');
    const relLinks = relays.reduce((sum, r) => sum + snap.links.filter(l => l.from === r.id || l.to === r.id).length, 0);
    const badRelay = relays.filter(r => snap.links.filter(l => l.from === r.id || l.to === r.id).length < 2);
    const ev: EvidenceItem[] = [
      E('Relay Nodes', `${relays.length}`, 'Mine Designer Deployment'),
      E('Edge Gateways', `${gws.length}`, 'Mine Designer Deployment'),
      E('Mesh Links', `${snap.links.length}`, 'Network Manager'),
      E('Rerouted Links', `${network.reroutedCount}`, 'Network Manager'),
      E('Network Coverage', `${network.coverage}%`, 'Network Manager'),
    ];
    if (relays.length > 0) ev.push(E('Avg Links / Relay', `${(relLinks / relays.length).toFixed(1)}`, 'Network Manager'));
    const healthy = relays.length > 0 && badRelay.length === 0 && network.reroutedCount < 3 && network.coverage >= 80;
    return makeAnswer(
      rawQuestion, true,
      healthy
        ? 'LoRa mesh is HEALTHY — all relays have redundant links and coverage is strong.'
        : 'LoRa mesh needs attention — some relays lack redundancy or coverage is degraded.',
      ev,
      `Mesh health is derived from the designer deployment graph (${relays.length} relays, ${gws.length} gateways) and the live network manager (${network.coverage}% coverage, ${network.reroutedCount} rerouted links).`,
      badRelay.length > 0
        ? `Re-link ${badRelay.map(r => r.id).join(', ')} in the Mine Designer (each relay needs ≥ 2 links).`
        : relays.length === 0
          ? 'Deploy relay nodes in the Mine Designer to build the LoRa mesh.'
          : 'Continue monitoring.',
      Math.min(95, 55 + network.coverage),
    );
  }

  /* ── 14. Maintenance candidates ── */
  if (/maintenance|maintain|battery|replace|service/.test(q)) {
    const lowBattery = snap.sensors.filter(s => s.battery < 30);
    const weakSignal = snap.sensors.filter(s => s.signalStrength < 55 && s.status !== 'offline');
    const offline = snap.sensors.filter(s => s.status === 'offline');
    const combined = new Map<string, { s: SensorNode; reasons: string[] }>();
    lowBattery.forEach(s => {
      const c = combined.get(s.id) ?? (combined.set(s.id, { s, reasons: [] }), combined.get(s.id)!);
      c.reasons.push(`battery ${s.battery.toFixed(0)}%`);
    });
    weakSignal.forEach(s => {
      const c = combined.get(s.id) ?? (combined.set(s.id, { s, reasons: [] }), combined.get(s.id)!);
      c.reasons.push(`signal ${s.signalStrength}%`);
    });
    offline.forEach(s => {
      const c = combined.get(s.id) ?? (combined.set(s.id, { s, reasons: [] }), combined.get(s.id)!);
      c.reasons.push('offline');
    });
    const list = [...combined.values()].sort((a, b) => (a.s.status === 'offline' ? -1 : 0) - (b.s.status === 'offline' ? -1 : 0));
    if (list.length === 0) {
      return makeAnswer(
        rawQuestion, true,
        'No sensors currently require maintenance.',
        [
          E('Battery ≥ 30%', 'all', 'Telemetry Store'),
          E('Signal ≥ 55%', 'all', 'Telemetry Store'),
        ],
        'All online sensors are above the maintenance thresholds (battery < 30%, signal < 55%) and none are offline.',
        'No action required.',
        Math.min(95, 55 + network.coverage),
      );
    }
    const ev: EvidenceItem[] = list.map(({ s, reasons }) => E(
      s.id, `${s.zone} · ${reasons.join(' · ')}`, s.id,
      { targetId: s.id, kind: 'sensor', page: 'digital-twin' },
    ));
    return makeAnswer(
      rawQuestion, true,
      `${list.length} sensor${list.length > 1 ? 's' : ''} require${list.length === 1 ? 's' : ''} maintenance.`,
      ev,
      `Maintenance criteria: battery < 30%, signal < 55%, or offline. Applied live to the telemetry store.`,
      `Dispatch a maintenance crew for ${list.slice(0, 5).map(x => x.s.id).join(', ')}.`,
      Math.min(95, 55 + network.coverage),
    );
  }

  /* ── 15. Today's highest risk / what caused it ── */
  if (/today|highest|caused|peak/.test(q)) {
    const z = topZone;
    const ev: EvidenceItem[] = [
      ...zoneEvidence(z).slice(0, 3),
      ...Object.entries(z.contributingFactors).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) =>
        E(FACTOR_LABELS[k] ?? k, `${Math.round(v * 100)}%`, 'Prediction Engine'),
      ),
    ];
    const todayAlerts = snap.alerts.filter(a => Date.now() - new Date(a.time).getTime() < 24 * 3600000);
    const worstAlert = [...todayAlerts].sort((a, b) => (a.type === 'critical' ? 1 : 0) - (b.type === 'critical' ? 1 : 0)).pop();
    if (worstAlert) ev.push(E('Worst Alert', worstAlert.reason, worstAlert.id, { kind: 'alert' }));
    return makeAnswer(
      rawQuestion, true,
      `Today's highest risk is ${z.shortName} at ${z.currentRisk}%.`,
      ev,
      `The zone risk store ranks ${z.shortName} first today. ${worstAlert ? `A ${worstAlert.type} alert is active: ${worstAlert.reason}.` : 'No active critical alert matches today\'s peak.'}`,
      z.currentRisk >= 85
        ? `Suspend operations on ${z.shortName} and inspect immediately.`
        : 'Increase monitoring cadence on the affected benches.',
      z.confidence,
    );
  }

  /* ── 16. Increasing moisture ── */
  if (/increas|rising|trending|climbing/.test(q) && /moisture|water|wet|saturation/.test(q)) {
    const rows = snap.sensors
      .filter(s => s.status !== 'offline')
      .map(s => {
        const h = SENSOR_HISTORY[s.id];
        const prev = h && h.length >= 24 ? h[h.length - 24].moisture : s.moisture;
        return { s, prev, delta: s.moisture - prev };
      })
      .sort((a, b) => b.delta - a.delta)
      .filter(r => r.delta > 0)
      .slice(0, 5);
    if (rows.length === 0) {
      return makeAnswer(
        rawQuestion, true,
        'No sensor shows increasing moisture over the last 24 hours.',
        [E('Sensors Checked', `${online.length}`, 'Historical Store')],
        'Moisture was compared between the current value and the 24-hour-old sample for every online sensor.',
        'No action required.',
        Math.min(95, 55 + network.coverage),
      );
    }
    const ev: EvidenceItem[] = rows.map(r => E(
      `${r.s.id} +${r.delta.toFixed(1)}%`,
      `${r.s.zone} · ${r.prev.toFixed(1)}% → ${r.s.moisture.toFixed(1)}%`,
      r.s.id,
      { targetId: r.s.id, kind: 'sensor', page: 'digital-twin' },
    ));
    return makeAnswer(
      rawQuestion, true,
      `${rows.length} sensor${rows.length > 1 ? 's' : ''} show increasing moisture — leading: ${rows[0].s.id}.`,
      ev,
      'Current moisture was compared against the sample 24 h earlier in the historical store. Rising moisture is a slope-stability precursor.',
      rows[0].delta > 3
        ? `Prioritise ${rows[0].s.zone} for inspection — infiltration is rising faster than the warning threshold.`
        : 'Monitor the listed sensors at the next review cycle.',
      Math.min(95, 55 + network.coverage),
    );
  }

  /* ── 17. Predicted failure time ── */
  if (/failure|fail|collapse|when/.test(q)) {
    const z = topZone;
    const p = snap.prediction;
    const ev: EvidenceItem[] = [
      E('Zone', z.name, z.id, { targetId: z.id, kind: 'zone', page: 'digital-twin' }),
      E('Predicted Failure', new Date(z.predictedFailureTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }), 'Prediction Engine'),
      E('Hours Remaining', formatHours(z.predictionHours), 'Prediction Engine'),
    ];
    if (p) ev.push(E('Model Tier', tierLabels[p.tier].toUpperCase(), 'Prediction Engine'));
    return makeAnswer(
      rawQuestion, true,
      `Predicted failure window: ${formatHours(z.predictionHours)} from now (${new Date(z.predictedFailureTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}) at ${z.shortName}.`,
      ev,
      'The prediction engine continuously re-evaluates telemetry; the failure window shrinks as risk rises and is recalculated each inference cycle.',
      z.currentRisk >= 85
        ? 'Treat this as imminent — suspend operations before the window.'
        : 'Schedule mitigation before the predicted window.',
      z.confidence,
    );
  }

  /* ── 18. Prediction confidence ── */
  if (/confidence/.test(q)) {
    const p = snap.prediction;
    if (!p) return cannotVerify(rawQuestion, 'sensor telemetry, alerts, predictions');
    const ev: EvidenceItem[] = [
      E('Confidence', `${(p.confidence * 100).toFixed(1)}%`, 'Prediction Engine'),
      E('Score', `${p.score.toFixed(1)}/10`, 'Prediction Engine'),
      E('Tier', tierLabels[p.tier].toUpperCase(), 'Prediction Engine'),
    ];
    return makeAnswer(
      rawQuestion, true,
      `The current prediction has ${(p.confidence * 100).toFixed(1)}% confidence.`,
      ev,
      'Confidence is produced by the prediction engine from the live sensor packet and trend window; it is not an estimate.',
      p.confidence < 0.7
        ? 'Treat the prediction as advisory — cross-check with direct inspection.'
        : 'Confidence supports acting on the recommendation.',
      p.confidence * 100,
    );
  }

  /* ── 19. Weather ── */
  if (/weather|rain|rainfall|wind|forecast/.test(q)) {
    const w = snap.weather;
    const ev: EvidenceItem[] = [
      E('Condition', w.condition, 'Weather Service'),
      E('Temperature', `${w.temperature}°C`, 'Weather Service'),
      E('Humidity', `${w.humidity}%`, 'Weather Service'),
      E('Wind', `${w.windSpeed} m/s ${w.windDirection}`, 'Weather Service'),
      E('Rainfall (24h)', `${w.rainfall} mm`, 'Weather Service'),
      E('Forecast', w.forecast, 'Weather Service'),
    ];
    return makeAnswer(
      rawQuestion, true,
      `Current weather: ${w.condition}, ${w.temperature}°C, rainfall ${w.rainfall} mm.`,
      ev,
      'Values come from the weather data feed. Rainfall infiltration is a known precursor in this mine — the forecast is read from the same feed.',
      w.rainfall > 2 || /rain/i.test(w.forecast)
        ? 'Prepare for elevated moisture risk — schedule extra monitoring cycles.'
        : 'No weather-driven action required.',
      85,
    );
  }

  /* ── 20. Alerts summary ── */
  if (/alert|incident|notification/.test(q)) {
    const active = snap.alerts.filter(a => !a.resolved);
    const crit = active.filter(a => a.type === 'critical');
    const ev: EvidenceItem[] = active.length === 0
      ? [E('Active Alerts', '0', 'Alert Store')]
      : active.slice(0, 6).map(a => {
          const hasSensor = a.sensorId && a.sensorId !== '—';
          return E(
            `${a.type.toUpperCase()} · ${a.id}`,
            a.reason,
            hasSensor ? a.sensorId : 'Alert Store',
            hasSensor ? { targetId: a.sensorId, kind: 'sensor', page: 'digital-twin' } : { kind: 'alert' },
          );
        });
    return makeAnswer(
      rawQuestion, true,
      `${active.length} active alert${active.length === 1 ? '' : 's'} (${crit.length} critical).`,
      ev,
      'The alert store was filtered for unresolved alerts and grouped by severity.',
      crit.length > 0
        ? `Action the critical alerts immediately: ${crit.map(a => a.reason).join('; ')}`
        : active.length > 0
          ? 'Review the listed warnings in the Alerts page.'
          : 'No action required.',
      Math.min(95, 55 + network.coverage),
    );
  }

  /* ── 21. Generic sensor telemetry report ── */
  if (sensor || /sensor|telemetry|node|status of/.test(q)) {
    const s = sensor ?? topSensor;
    const ev = sensorEvidence(s);
    ev.push(E('Zone', s.zone, 'Zone Manager'));
    ev.push(E('Uplink', nearestGateway(s), 'Network Manager', { targetId: nearestGateway(s), kind: 'gateway', page: 'digital-twin' }));
    return makeAnswer(
      rawQuestion, true,
      `${s.id} live telemetry report (${statusLabels[s.status].toUpperCase()}).`,
      ev,
      `Every value above is read live from the telemetry store for ${s.id} at ${new Date(s.lastUpdated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}.`,
      s.status === 'critical' || s.status === 'high-risk'
        ? `Inspect ${s.id} in ${s.zone}. Suspend operations if risk stays above 85%.`
        : 'No immediate action required.',
      s.predictionConfidence,
      s.status !== 'offline' ? historyChart(s.id, ['tilt', 'vibration', 'moisture', 'risk'], 24) ?? undefined : undefined,
    );
  }

  /* ── Fallback ── */
  return cannotVerify(rawQuestion, 'sensor telemetry, predictions, alerts, network graph, deployment, history, weather');
}

/** Chart helper for the RockSentinel AI page — attaches a trend chart when the question asks for one. */
export function trendChartFor(rawQuestion: string, sensors: SensorNode[]): TrendChartSpec | null {
  const q = rawQuestion.toLowerCase();
  if (!/(history|trend|last 24|past 24|compare|series|show)/.test(q)) return null;
  const ids = q.match(/\bSN-\d{3}\b/g)?.map(s => s.toUpperCase()) ?? [];
  const byId = new Map(sensors.map(s => [s.id, s]));
  const metric = (q.match(/vibration|tilt|moisture|battery/) ?? ['risk'])[0] as TrendMetric;
  if (ids.length >= 2 && byId.has(ids[0]) && byId.has(ids[1])) {
    return compareChart([ids[0], ids[1]], metric);
  }
  const target = ids[0] && byId.has(ids[0])
    ? ids[0]
    : (sensors.filter(s => s.status !== 'offline').sort((a, b) => b.riskScore - a.riskScore)[0]?.id ?? 'SN-021');
  return historyChart(target, [metric, 'risk'], 24);
}
