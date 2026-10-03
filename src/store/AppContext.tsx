import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  Alert, DroneInfo, HighRiskZone, LiveSample, PageId, PlaybackState, Prediction,
  RiskTier, SelectionType, SensorNode, SensorStatus, SystemEvent,
} from '../data/types';
import { DRONE_SEED, HIGH_RISK_ZONES, SENSOR_HISTORY, SENSORS, SEED_ALERTS } from '../data/mockData';
import { buildSensorPacket, buildTrendWindow, predict, setLatestPrediction } from '../services/predictionService';
import { connectRealtime } from '../services/realtime';
import { clamp, riskFromScore } from '../utils/helpers';

interface AppState {
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;

  sensors: SensorNode[];
  zones: HighRiskZone[];
  alerts: Alert[];
  drone: DroneInfo;
  events: SystemEvent[];

  selectionType: SelectionType;
  selectedSensor: SensorNode | null;
  selectedZone: HighRiskZone | null;
  selectSensor: (id: string | null) => void;
  selectZone: (id: string | null) => void;
  selectDrone: () => void;
  clearSelection: () => void;

  chartSensorId: string;
  liveSeries: LiveSample[];

  prediction: Prediction | null;
  predictions: Prediction[];
  mlOnline: boolean;
  requestPrediction: () => Promise<void>;

  heatmapVisible: boolean;
  toggleHeatmap: () => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  droneMode: boolean;
  toggleDroneMode: () => void;

  playback: PlaybackState;
  setPlayback: (p: Partial<PlaybackState>) => void;
  displaySensor: (sensor: SensorNode) => SensorNode;
  displaySensors: SensorNode[];

  connection: 'online' | 'degraded' | 'offline';
  cloudSync: boolean;
  aiStatus: 'ANALYZING' | 'PROCESSING' | 'IDLE' | 'WARNING';
  aiActivity: number;

  ackAlert: (id: string) => void;
  resolveAlert: (id: string) => void;

  emergencyOpen: boolean;
  setEmergencyOpen: (open: boolean) => void;

  refreshRate: number;
  setRefreshRate: (ms: number) => void;
  autoRotate: boolean;
  setAutoRotate: (v: boolean) => void;
  showZoneLabels: boolean;
  setShowZoneLabels: (v: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

const PERMANENT_OFFLINE = new Set(['SN-014', 'SN-028']);

const TIER_RISK: Record<RiskTier, number> = { normal: 22, watch: 52, warning: 76, emergency: 93 };
const TIER_HOURS: Record<RiskTier, number> = { normal: 48, watch: 12, warning: 3, emergency: 0.5 };
const TIER_ALERT: Record<RiskTier, Alert['type']> = { normal: 'info', watch: 'info', warning: 'warning', emergency: 'critical' };

function sensorStatus(score: number): SensorStatus {
  return riskFromScore(score);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentPage, setCurrentPage] = useState<PageId>('digital-twin');

  const [sensors, setSensors] = useState<SensorNode[]>(SENSORS);
  const [zones, setZones] = useState<HighRiskZone[]>(HIGH_RISK_ZONES);
  const [alerts, setAlerts] = useState<Alert[]>(SEED_ALERTS);
  const [drone, setDrone] = useState<DroneInfo>(DRONE_SEED);
  const [events, setEvents] = useState<SystemEvent[]>([]);

  const [selectionType, setSelectionType] = useState<SelectionType>(null);
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const [heatmapVisible, setHeatmapVisible] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [droneMode, setDroneMode] = useState(false);

  const [playback, setPlaybackState] = useState<PlaybackState>({ enabled: false, position: 0, playing: false });
  const [connection, setConnection] = useState<'online' | 'degraded' | 'offline'>('online');
  const [cloudSync, setCloudSync] = useState(true);
  const [aiStatus, setAiStatus] = useState<'ANALYZING' | 'PROCESSING' | 'IDLE' | 'WARNING'>('ANALYZING');
  const [aiActivity, setAiActivity] = useState(0);

  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [refreshRate, setRefreshRate] = useState(2000);
  const [autoRotate, setAutoRotate] = useState(false);
  const [showZoneLabels, setShowZoneLabels] = useState(true);

  const [liveSeries, setLiveSeries] = useState<LiveSample[]>([]);
  const [chartSensorId, setChartSensorId] = useState('SN-015');

  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [mlOnline, setMlOnline] = useState(false);

  const tickRef = useRef(0);
  const sensorsRef = useRef(sensors);
  const zonesRef = useRef(zones);
  const liveSeriesRef = useRef(liveSeries);
  const swapRef = useRef<{ sensorId: string | null; until: number }>({ sensorId: null, until: 0 });
  const alertGuardRef = useRef<Set<string>>(new Set());

  useEffect(() => { sensorsRef.current = sensors; }, [sensors]);
  useEffect(() => { zonesRef.current = zones; }, [zones]);
  useEffect(() => { liveSeriesRef.current = liveSeries; }, [liveSeries]);

  const notify = useCallback((message: string, severity: SystemEvent['severity']) => {
    setEvents(prev => {
      const next = [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, message, severity, at: Date.now() }];
      return next.slice(-5);
    });
  }, []);

  const pushAlert = useCallback((alert: Omit<Alert, 'id' | 'time'>, id?: string) => {
    setAlerts(prev => [
      { ...alert, id: id ?? `ALT-${Date.now()}`, time: new Date().toISOString() },
      ...prev.slice(0, 9),
    ]);
  }, []);

  const simTick = useCallback(() => {
    tickRef.current += 1;
    const now = Date.now();
    const tick = tickRef.current;
    const currentSensors = sensorsRef.current;
    const currentZones = zonesRef.current;

    let restoredSensorId: string | null = null;

    const nextSensors: SensorNode[] = currentSensors.map(s => {
      if (PERMANENT_OFFLINE.has(s.id) || (swapRef.current.sensorId === s.id && tick < swapRef.current.until)) {
        return { ...s, status: 'offline', signalStrength: 0, battery: Math.max(0, s.battery - 0.1) };
      }
      if (s.status === 'offline' && !PERMANENT_OFFLINE.has(s.id)) {
        restoredSensorId = s.id;
        return { ...s, status: 'safe', battery: 64, signalStrength: 82, riskScore: 14, lastUpdated: new Date(now).toISOString() };
      }
      const z = s.zoneIndex >= 0 ? currentZones[s.zoneIndex] : null;
      const drift = z ? z.currentRisk / 100 : 0.2;
      const tilt = clamp(s.tilt + (Math.random() - 0.5) * 0.55 + drift * 0.16, 0, 22);
      const vibration = clamp(s.vibration + (Math.random() - 0.5) * 0.3 + drift * 0.06, 0, 11);
      const moisture = clamp(s.moisture + (Math.random() - 0.5) * 1.5 + (z ? 0.28 : 0.05), 5, 98);
      const riskScore = clamp(
        tilt * 3.0 + vibration * 4.6 + moisture * 0.3 + (z ? z.currentRisk * 0.2 : 6) + (Math.random() - 0.5) * 3,
        0.5, 99.5,
      );
      return {
        ...s,
        status: sensorStatus(riskScore),
        tilt: +tilt.toFixed(2),
        vibration: +vibration.toFixed(2),
        moisture: +moisture.toFixed(1),
        temperature: +(s.temperature + (Math.random() - 0.5) * 0.4).toFixed(1),
        humidity: +clamp(s.humidity + (Math.random() - 0.5) * 1.2, 30, 95).toFixed(1),
        battery: clamp(s.battery - 0.02, 1, 100),
        signalStrength: Math.round(clamp(s.signalStrength + (Math.random() - 0.5) * 3, 40, 99)),
        riskScore: +riskScore.toFixed(1),
        lastUpdated: new Date(now).toISOString(),
        predictionConfidence: clamp(s.predictionConfidence + (Math.random() - 0.5) * 0.8, 55, 99),
      };
    });
    setSensors(nextSensors);

    if (restoredSensorId) {
      notify(`${restoredSensorId} back online — primary route re-established`, 'success');
      swapRef.current = { sensorId: null, until: 0 };
    }

    const nextZones: HighRiskZone[] = currentZones.map((zone, zi) => {
      const members = nextSensors.filter(s => s.zoneIndex === zi && s.status !== 'offline');
      const avg = members.length ? members.reduce((sum, s) => sum + s.riskScore, 0) / members.length : zone.currentRisk;
      const risk = Math.min(99, Math.max(25, Math.round(avg * 0.7 + zone.currentRisk * 0.3)));
      return {
        ...zone,
        currentRisk: risk,
        confidence: clamp(zone.confidence + (Math.random() - 0.5) * 0.6, 40, 99),
        predictionHours: Math.max(0.2, zone.predictionHours - 2 / 3600),
        predictedFailureTime: new Date(now + Math.max(0, zone.predictionHours - 2 / 3600) * 3600000).toISOString(),
        historicalRisk: Math.min(Math.max(10, risk - 6), 99),
        activeSensorIds: members.slice(0, 6).map(m => m.id),
      };
    });
    setZones(nextZones);
    zonesRef.current = nextZones;

    nextZones.forEach(zone => {
      if (zone.currentRisk >= 86 && !alertGuardRef.current.has(zone.id)) {
        alertGuardRef.current.add(zone.id);
        const factorNames: Record<string, string> = {
          tilt: 'Tilt displacement accelerating',
          rain: 'Rainwater infiltration saturating fractures',
          crackGrowth: 'Crack growth rate above critical threshold',
          vibration: 'Micro-seismic vibration spike',
        };
        const top = (Object.entries(zone.contributingFactors).sort((a, b) => b[1] - a[1])[0])[0];
        notify(`${zone.shortName.toUpperCase()} — CRITICAL RISK ESCALATION`, 'critical');
        pushAlert({
          type: 'critical',
          location: zone.name,
          sensorId: zone.activeSensorIds[0] ?? '—',
          reason: `${factorNames[top]} — elevated rockfall probability`,
          confidence: Math.round(zone.confidence * 10) / 10,
          acknowledgedBy: null,
          resolved: false,
        });
      } else if (zone.currentRisk < 75) {
        alertGuardRef.current.delete(zone.id);
      }
    });

    if (tick % Math.max(4, Math.round(30000 / refreshRate)) === 0) {
      const pool = nextSensors.filter(s => !PERMANENT_OFFLINE.has(s.id) && s.status !== 'offline');
      if (pool.length > 0) {
        const victim = pool[Math.floor(Math.random() * pool.length)];
        swapRef.current = { sensorId: victim.id, until: tick + Math.max(4, Math.round(12000 / refreshRate)) };
        notify(`LINK LOST — ${victim.id} unreachable, mesh rerouting in progress`, 'warning');
        pushAlert({
          type: 'warning',
          location: victim.zone,
          sensorId: victim.id,
          reason: 'Communication link lost — traffic rerouted through alternate mesh paths',
          confidence: 91.4,
          acknowledgedBy: null,
          resolved: false,
        });
      }
    }

    setDrone(prev => {
      const status: DroneInfo['status'] = prev.battery < 15 ? 'returning' : prev.battery < 8 ? 'charging' : 'active';
      const angle = prev.angle + 0.02;
      return {
        ...prev,
        status,
        battery: clamp(prev.battery - 0.35, 4, 100),
        altitude: Math.round(118 + Math.sin(now / 3000) * 6),
        speed: +(14 + Math.sin(now / 2500) * 2.2).toFixed(1),
        missionProgress: status === 'charging' ? prev.missionProgress : Math.min(100, prev.missionProgress + 0.5),
        position: { x: Math.cos(angle) * 30, y: 30 + Math.sin(now / 2200) * 2.5, z: Math.sin(angle) * 30 },
        angle,
      };
    });

    if (tick % 6 === 0) {
      setCloudSync(false);
      setAiStatus('PROCESSING');
      setTimeout(() => { setCloudSync(true); setAiStatus('ANALYZING'); }, 900);
    }
    setAiActivity(prev => clamp(prev + (Math.random() - 0.5) * 18, 25, 98));

    if (tick % 45 === 0) {
      setConnection('degraded');
      setTimeout(() => setConnection('online'), 2500);
      notify('Uplink degraded — operating on redundant backbone', 'warning');
    }
  }, [notify, pushAlert, refreshRate]);

  useEffect(() => {
    const iv = setInterval(simTick, refreshRate);
    return () => clearInterval(iv);
  }, [simTick, refreshRate]);

  const chartSensor = useMemo(() => {
    const sel = sensors.find(s => s.id === selectedSensorId);
    if (sel) return sel;
    const top = [...sensors].filter(s => s.status !== 'offline').sort((a, b) => b.riskScore - a.riskScore)[0];
    return top ?? sensors[0];
  }, [sensors, selectedSensorId]);

  useEffect(() => {
    if (!chartSensor) return;
    setChartSensorId(chartSensor.id);
    setLiveSeries(prev => [
      ...prev,
      {
        t: Date.now(),
        tilt: chartSensor.tilt,
        vibration: chartSensor.vibration,
        humidity: chartSensor.humidity,
        moisture: chartSensor.moisture,
        risk: chartSensor.riskScore,
        battery: chartSensor.battery,
      },
    ].slice(-48));
  }, [chartSensor]);

  const setPlayback = useCallback((p: Partial<PlaybackState>) => {
    setPlaybackState(prev => ({ ...prev, ...p }));
  }, []);

  const applyPrediction = useCallback((p: Prediction) => {
    setPrediction(p);
    setPredictions(prev => (prev.length > 0 && prev[0].at === p.at ? prev : [p, ...prev].slice(0, 200)));
    setMlOnline(true);
    setLatestPrediction(p);

    const risk = clamp(TIER_RISK[p.tier] + Math.round((Math.random() - 0.5) * 6), 25, 99);
    const hours = TIER_HOURS[p.tier];
    const now = Date.now();
    const target = [...zonesRef.current].sort((a, b) => b.currentRisk - a.currentRisk)[0];
    if (target) {
      setZones(prev => prev.map(z =>
        z.id === target.id
          ? {
              ...z,
              currentRisk: risk,
              confidence: clamp(Math.round(p.confidence * 1000) / 10, 40, 99),
              predictionHours: hours,
              predictedFailureTime: new Date(now + hours * 3600000).toISOString(),
              historicalRisk: z.currentRisk,
              contributingFactors: { ...z.contributingFactors, tilt: Math.min(99, Math.round(risk * 0.9)) },
            }
          : z,
      ));
      setSensors(prev => prev.map(s =>
        target.activeSensorIds.includes(s.id)
          ? { ...s, riskScore: risk, predictionConfidence: Math.round(p.confidence * 100) }
          : s,
      ));
      if (p.tier !== 'normal') {
        pushAlert({
          type: TIER_ALERT[p.tier],
          location: target.name,
          sensorId: target.activeSensorIds[0] ?? '—',
          reason: p.recommendation,
          confidence: Math.round(p.confidence * 1000) / 10,
          acknowledgedBy: null,
          resolved: false,
        });
      }
    }
    notify(
      `ML PREDICTION ${p.tier.toUpperCase()} — score ${p.score.toFixed(1)}/10`,
      p.tier === 'emergency' ? 'critical' : p.tier === 'warning' ? 'warning' : 'info',
    );
  }, [notify, pushAlert]);

  const requestPrediction = useCallback(async () => {
    setAiStatus('PROCESSING');
    try {
      const result = await predict(
        buildSensorPacket(sensorsRef.current),
        buildTrendWindow(liveSeriesRef.current),
      );
      applyPrediction({ ...result, at: new Date().toISOString() });
      setAiStatus('ANALYZING');
    } catch (err) {
      setMlOnline(false);
      setAiStatus('WARNING');
      notify(`ML inference unavailable — ${err instanceof Error ? err.message : 'backend offline'}`, 'warning');
    }
  }, [applyPrediction, notify]);

  useEffect(() => {
    return connectRealtime(msg => {
      if (msg.type === 'prediction') applyPrediction(msg.data as Prediction);
    });
  }, [applyPrediction]);

  useEffect(() => {
    const iv = setInterval(() => { void requestPrediction(); }, 30000);
    return () => clearInterval(iv);
  }, [requestPrediction]);

  useEffect(() => {
    if (!playback.playing) return;
    const iv = setInterval(() => {
      setPlaybackState(prev => {
        if (!prev.playing) return prev;
        const position = prev.position + 0.16;
        return { ...prev, position: position >= 100 ? 0 : position };
      });
    }, 60);
    return () => clearInterval(iv);
  }, [playback.playing]);

  const displaySensor = useCallback((sensor: SensorNode): SensorNode => {
    if (!playback.enabled) return sensor;
    const history = SENSOR_HISTORY[sensor.id];
    if (!history || history.length === 0) return sensor;
    const idx = Math.max(0, Math.min(history.length - 1, Math.floor((playback.position / 100) * (history.length - 1))));
    const h = history[idx];
    return {
      ...sensor,
      status: sensor.status === 'offline' ? 'offline' : riskFromScore(h.risk),
      riskScore: h.risk,
      tilt: h.tilt,
      vibration: h.vibration,
      humidity: h.humidity,
      moisture: h.moisture,
      battery: h.battery,
      lastUpdated: new Date(h.t).toISOString(),
    };
  }, [playback.enabled, playback.position]);

  const displaySensors = useMemo(() => sensors.map(displaySensor), [sensors, displaySensor]);

  const selectedSensor = useMemo(
    () => sensors.find(s => s.id === selectedSensorId) ?? null,
    [sensors, selectedSensorId],
  );
  const selectedZone = useMemo(
    () => zones.find(z => z.id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  );

  const selectSensor = useCallback((id: string | null) => {
    setSelectedSensorId(id);
    setSelectedZoneId(null);
    setSelectionType(id ? 'sensor' : null);
  }, []);

  const selectZone = useCallback((id: string | null) => {
    setSelectedZoneId(id);
    setSelectedSensorId(null);
    setSelectionType(id ? 'zone' : null);
  }, []);

  const selectDrone = useCallback(() => {
    setSelectionType('drone');
    setSelectedSensorId(null);
    setSelectedZoneId(null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionType(null);
    setSelectedSensorId(null);
    setSelectedZoneId(null);
  }, []);

  const ackAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => (a.id === id ? { ...a, acknowledgedBy: 'OPS CONSOLE' } : a)));
    notify(`Alert ${id} acknowledged by OPS CONSOLE`, 'info');
  }, [notify]);

  const resolveAlert = useCallback((id: string) => {
    setAlerts(prev => prev.map(a => (a.id === id ? { ...a, resolved: true } : a)));
    notify(`Alert ${id} resolved — zone cleared`, 'success');
  }, [notify]);

  const value: AppState = {
    currentPage,
    setCurrentPage,
    sensors,
    zones,
    alerts,
    drone,
    events,
    selectionType,
    selectedSensor,
    selectedZone,
    selectSensor,
    selectZone,
    selectDrone,
    clearSelection,
    chartSensorId,
    liveSeries,
    prediction,
    predictions,
    mlOnline,
    requestPrediction,
    heatmapVisible,
    toggleHeatmap: () => setHeatmapVisible(v => !v),
    sidebarCollapsed,
    toggleSidebar: () => setSidebarCollapsed(v => !v),
    droneMode,
    toggleDroneMode: () => setDroneMode(v => !v),
    playback,
    setPlayback,
    displaySensor,
    displaySensors,
    connection,
    cloudSync,
    aiStatus,
    aiActivity,
    ackAlert,
    resolveAlert,
    emergencyOpen,
    setEmergencyOpen,
    refreshRate,
    setRefreshRate,
    autoRotate,
    setAutoRotate,
    showZoneLabels,
    setShowZoneLabels,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
