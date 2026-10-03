import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity, Battery, Brain, ChevronDown, ChevronUp, Clock, Cpu, Droplets, Gauge, HeartPulse, Link2,
  MapPin, MoveUpRight, Plane, Radio, Signal, Thermometer, TrendingDown,
  TrendingUp, Wind, X, XCircle, Wifi, Eye,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { usePrediction } from '../../hooks/usePrediction';
import { StatusIndicator } from '../ui/StatusIndicator';
import { RiskMeter } from '../ui/RiskMeter';
import { AIConfidenceRing } from '../ui/AIConfidenceRing';
import { PredictionTimeline } from '../ui/PredictionTimeline';
import { RiskBar } from '../ui/RiskBar';
import { formatHours, formatTimeAgo, getRiskColor, getRiskLabel, scoreToRisk, statusColors, statusLabels, tierColors, tierHours } from '../../utils/helpers';
import type { HighRiskZone, SensorNode } from '../../data/types';

export function RightPanel() {
  const { selectionType, selectedSensor, selectedZone, clearSelection, selectSensor, sensors, zones, alerts, setCurrentPage } = useApp();
  const { prediction, error } = usePrediction();

  // Auto-select the highest risk sensor for the default view
  const topSensor = [...sensors].filter(s => s.status !== 'offline').sort((a, b) => b.riskScore - a.riskScore)[0];
  const displaySensor = selectedSensor ?? topSensor;

  return (
    <aside
      className="w-[300px] shrink-0 z-40 flex flex-col min-h-0"
      style={{
        background: 'rgba(9,14,24,0.88)',
        backdropFilter: 'blur(18px)',
        borderLeft: '1px solid rgba(56,189,248,0.12)',
      }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={selectionType === 'sensor' ? selectedSensor?.id : selectionType === 'zone' ? selectedZone?.id : 'default'}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2 }}
          >
            {selectionType === 'zone' && selectedZone ? (
              <ZoneDetails zone={selectedZone} onSelectSensor={selectSensor} onClose={clearSelection} />
            ) : selectionType === 'drone' ? (
              <DroneDetails onClose={clearSelection} />
            ) : (
              <SensorDetails sensor={displaySensor} isAutoSelected={!selectedSensor} onClose={clearSelection} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Communication Route */}
      {displaySensor && (
        <div className="border-t border-white/[0.06] px-3 py-2.5">
          <CollapsibleSection title="COMMUNICATION ROUTE" defaultOpen={true}>
            <div className="flex items-center gap-2 mt-1.5">
              {[displaySensor.id, 'S-17', 'G-02'].map((hop, i) => (
                <span key={hop} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-cyan-500/70 text-[9px]">→</span>}
                  <span
                    className="px-2 py-0.5 rounded text-[9px] font-mono"
                    style={{
                      background: i === 0 ? 'rgba(34,211,238,0.15)' : 'rgba(56,189,248,0.08)',
                      border: `1px solid ${i === 0 ? 'rgba(34,211,238,0.4)' : 'rgba(56,189,248,0.2)'}`,
                      color: i === 0 ? '#22d3ee' : '#7dd3fc',
                    }}
                  >
                    {hop}
                  </span>
                </span>
              ))}
            </div>
            <button
              className="w-full mt-2 py-1.5 rounded-lg text-[8.5px] font-display font-bold tracking-wider text-center"
              style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)', color: '#67e8f9' }}
            >
              View on Map
            </button>
          </CollapsibleSection>
        </div>
      )}

      {/* AI Prediction */}
      {displaySensor && (
        <div className="border-t border-white/[0.06] px-3 py-2.5">
          <CollapsibleSection title="AI PREDICTION" defaultOpen={true}>
            <div className="flex items-center gap-4 mt-2">
              <div className="space-y-1.5 flex-1">
                <PredictionRow
                  label="Failure Probability"
                  value={`${prediction ? Math.round(scoreToRisk(prediction.score)) : Math.round(displaySensor.riskScore)}%`}
                  color={prediction ? tierColors[prediction.tier] : getRiskColor(displaySensor.riskScore)}
                />
                <PredictionRow
                  label="Confidence"
                  value={`${prediction ? Math.round(prediction.confidence * 100) : displaySensor.predictionConfidence.toFixed(0)}%`}
                  color="#38bdf8"
                />
                <PredictionRow
                  label="Predicted Failure Time"
                  value={prediction ? formatHours(tierHours[prediction.tier]) : displaySensor.riskScore > 65 ? '14h' : '42h'}
                  color="#64748b"
                />
              </div>
              <div className="relative w-[70px] h-[70px] shrink-0">
                <svg viewBox="0 0 80 80" className="w-full h-full">
                  <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                  <circle
                    cx="40" cy="40" r="34" fill="none"
                    stroke={getRiskColor(prediction ? prediction.confidence * 100 : displaySensor.predictionConfidence)}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${(prediction ? prediction.confidence * 100 : displaySensor.predictionConfidence) * 2.136} 213.6`}
                    transform="rotate(-90 40 40)"
                  />
                  <text x="40" y="37" textAnchor="middle" className="text-[14px] font-mono font-bold" fill={getRiskColor(prediction ? prediction.confidence * 100 : displaySensor.predictionConfidence)}>
                    {(prediction ? prediction.confidence * 100 : displaySensor.predictionConfidence).toFixed(0)}%
                  </text>
                  <text x="40" y="50" textAnchor="middle" className="text-[6px] font-mono" fill="#64748b">
                    Confidence
                  </text>
                </svg>
                <div className="text-center mt-0.5">
                  <span className="text-[7px] font-mono text-red-400">Increasing Risk</span>
                </div>
              </div>
            </div>
            {error && (
              <div className="mt-1.5 text-[8px] font-mono text-amber-400/90 flex items-center gap-1">
                <Wifi className="w-3 h-3 shrink-0" />
                Prediction service unavailable — showing last known result
              </div>
            )}
          </CollapsibleSection>
        </div>
      )}

      {/* Recent Events (bottom of right panel) */}
      <div className="border-t border-white/[0.06] px-3 py-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[8.5px] font-display font-bold tracking-[0.15em] text-slate-500 uppercase">Recent Events</span>
          <button className="text-[8px] text-cyan-400 font-mono hover:text-cyan-300" onClick={() => setCurrentPage('historical')}>
            View All
          </button>
        </div>
        <div className="space-y-1.5">
          {alerts.filter(a => !a.resolved).slice(0, 3).map(a => (
            <div key={a.id} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: a.type === 'critical' ? '#ef4444' : '#f59e0b', boxShadow: `0 0 4px ${a.type === 'critical' ? '#ef4444' : '#f59e0b'}` }} />
              <span className="text-[8.5px] text-slate-300 flex-1 truncate">{a.reason.split('—')[0].trim()}</span>
              <span className="text-[7.5px] font-mono text-slate-500 shrink-0">{formatTimeAgo(a.time)}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/* ─── Sensor Details ─── */
function SensorDetails({ sensor, isAutoSelected, onClose }: { sensor: SensorNode; isAutoSelected: boolean; onClose: () => void }) {
  if (!sensor) return null;
  const offline = sensor.status === 'offline';
  const color = offline ? '#64748b' : statusColors[sensor.status];

  return (
    <div>
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <span className="text-[8px] font-mono text-slate-500 tracking-wider">SELECTED SENSOR</span>
        </div>
        <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
      </div>

      <div className="px-3 py-2.5">
        {/* Sensor ID + Status */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[18px] font-display font-bold text-slate-100">{sensor.id}</span>
          <span
            className="px-2 py-0.5 rounded text-[8px] font-display font-bold tracking-wider"
            style={{
              background: `${color}1a`,
              border: `1px solid ${color}50`,
              color: color,
            }}
          >
            {statusLabels[sensor.status].toUpperCase()}
          </span>
          <span className="flex items-center gap-1 text-[8px] font-mono text-green-400 ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ boxShadow: '0 0 4px #22c55e' }} />
            Online
          </span>
        </div>

        {/* Location Info */}
        <div className="space-y-1 mb-3 text-[9.5px] font-mono">
          <InfoRow label="Location" value={`Bench ${sensor.bench + 1} - ${sensor.zone}`} />
          <InfoRow label="Coordinates" value="24.309° N, 73.681° E" />
          <InfoRow label="Elevation" value="412 m" />
        </div>

        {/* LIVE SENSOR DATA */}
        <CollapsibleSection title="LIVE SENSOR DATA" defaultOpen={true}>
          <div className="space-y-1.5 mt-1.5">
            <SensorDataRow icon={<MoveUpRight className="w-3.5 h-3.5" />} label="Tilt" value={`${sensor.tilt.toFixed(2)}°`} warn={sensor.tilt > 5} trending="up" />
            <SensorDataRow icon={<Activity className="w-3.5 h-3.5" />} label="Vibration" value={`${sensor.vibration.toFixed(1)} mm/s`} warn={sensor.vibration > 4} trending="up" />
            <SensorDataRow icon={<Droplets className="w-3.5 h-3.5" />} label="Moisture" value={`${sensor.moisture.toFixed(1)} %`} />
            <SensorDataRow icon={<Thermometer className="w-3.5 h-3.5" />} label="Temperature" value={`${sensor.temperature.toFixed(1)}°C`} />
            <SensorDataRow icon={<Wind className="w-3.5 h-3.5" />} label="Humidity" value={`${sensor.humidity.toFixed(0)} %`} />
            <SensorDataRow icon={<Battery className="w-3.5 h-3.5" />} label="Battery" value={`${sensor.battery.toFixed(0)} %`} warn={sensor.battery < 30} />
            <SensorDataRow icon={<Signal className="w-3.5 h-3.5" />} label="Signal Strength" value={`-${100 - sensor.signalStrength} dBm`} signal />
            <SensorDataRow icon={<Clock className="w-3.5 h-3.5" />} label="Last Updated" value={formatTimeAgo(sensor.lastUpdated)} />
          </div>
        </CollapsibleSection>
      </div>
    </div>
  );
}

/* ─── Zone Details ─── */
function ZoneDetails({ zone, onSelectSensor, onClose }: { zone: HighRiskZone; onSelectSensor: (id: string | null) => void; onClose: () => void }) {
  const color = getRiskColor(zone.currentRisk);
  const factorEntries = Object.entries(zone.contributingFactors).map(([k, v]) => ({
    label: { tilt: 'Tilt', rain: 'Rainfall', crackGrowth: 'Crack Growth', vibration: 'Vibration' }[k] ?? k,
    value: Math.round(v * 100),
  }));

  return (
    <div>
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-white/[0.05]">
        <span className="text-[8px] font-mono text-slate-500 tracking-wider">SELECTED ZONE</span>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 text-slate-500">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="px-3 py-2.5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-display font-bold text-slate-100">{zone.name}</span>
        </div>
        <div className="flex justify-center">
          <RiskMeter value={zone.currentRisk} size={130} label={`${getRiskLabel(zone.currentRisk).toUpperCase()} SLOPE`} />
        </div>
        <div className="space-y-2">
          <RiskBar label="Current Risk" value={zone.currentRisk} />
          <RiskBar label="Historical Baseline" value={zone.historicalRisk} />
        </div>
        <div>
          <span className="text-[8.5px] font-display font-bold tracking-[0.15em] text-slate-500 uppercase">Contributing Factors</span>
          <div className="space-y-2 mt-2">
            {factorEntries.map((f, i) => (
              <div key={f.label} className="flex items-center gap-2">
                <span className="w-[70px] text-[9px] text-slate-400">{f.label}</span>
                <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: getRiskColor(f.value), boxShadow: `0 0 6px ${getRiskColor(f.value)}` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${f.value}%` }}
                    transition={{ duration: 0.8, delay: i * 0.08 }}
                  />
                </div>
                <span className="w-6 text-right text-[9px] font-mono font-bold" style={{ color: getRiskColor(f.value) }}>
                  {f.value}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <span className="text-[8.5px] font-display font-bold tracking-[0.15em] text-slate-500 uppercase">Active Sensors</span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {zone.activeSensorIds.map(id => (
              <button
                key={id}
                onClick={() => onSelectSensor(id)}
                className="px-2 py-0.5 rounded text-[8.5px] font-mono transition-all hover:scale-105"
                style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', color: '#7dd3fc' }}
              >
                {id}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Drone Details ─── */
function DroneDetails({ onClose }: { onClose: () => void }) {
  const { drone } = useApp();
  return (
    <div>
      <div className="px-3 py-2.5 flex items-center justify-between border-b border-white/[0.05]">
        <span className="text-[8px] font-mono text-slate-500 tracking-wider">DRONE TELEMETRY</span>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 text-slate-500">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="px-3 py-2.5 space-y-3">
        <span className="text-[16px] font-display font-bold text-slate-100">{drone.name}</span>
        <div className="flex justify-center">
          <RiskMeter value={drone.battery} size={120} label="BATTERY" />
        </div>
        <RiskBar label="Mission Progress" value={drone.missionProgress} gradient={false} />
        <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono">
          <div className="glass-panel-subtle p-1.5"><span className="text-slate-500 block">Altitude</span><span className="text-slate-200">{drone.altitude}m</span></div>
          <div className="glass-panel-subtle p-1.5"><span className="text-slate-500 block">Speed</span><span className="text-slate-200">{drone.speed} m/s</span></div>
          <div className="glass-panel-subtle p-1.5"><span className="text-slate-500 block">Coverage</span><span className="text-slate-200">{drone.coverageArea}</span></div>
          <div className="glass-panel-subtle p-1.5"><span className="text-slate-500 block">Status</span><span className="text-cyan-300">{drone.status.toUpperCase()}</span></div>
        </div>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */
function CollapsibleSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div>
      <button className="flex items-center justify-between w-full" onClick={() => setOpen(!open)}>
        <span className="text-[8.5px] font-display font-bold tracking-[0.15em] text-slate-500 uppercase">{title}</span>
        {open ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
      </button>
      {open && children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 text-right">{value}</span>
    </div>
  );
}

function SensorDataRow({ icon, label, value, warn, trending, signal }: {
  icon: React.ReactNode; label: string; value: string; warn?: boolean; trending?: 'up' | 'down'; signal?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="text-slate-500">{icon}</span>
      <span className="text-[9px] text-slate-400 flex-1">{label}</span>
      <span className={`text-[10px] font-mono font-bold tabular-nums ${warn ? 'text-red-400' : 'text-slate-200'}`}>
        {value}
      </span>
      {trending === 'up' && <TrendingUp className="w-3 h-3 text-red-400" />}
      {trending === 'down' && <TrendingDown className="w-3 h-3 text-green-400" />}
      {signal && (
        <div className="flex items-center gap-px">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-[3px] rounded-sm" style={{ height: i * 3, background: i <= 3 ? '#22c55e' : '#334155' }} />
          ))}
        </div>
      )}
    </div>
  );
}

function PredictionRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[8.5px] text-slate-400">{label}</span>
      <span className="text-[10px] font-mono font-bold" style={{ color }}>{value}</span>
    </div>
  );
}
