import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import {
  Activity, AlertTriangle, Brain, ChevronDown, ChevronUp, ExternalLink,
  Plane, Radio, TrendingUp, Lightbulb,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { usePrediction } from '../../hooks/usePrediction';
import { getRiskColor, formatTimeAgo, scoreToRisk, statusColors } from '../../utils/helpers';

/* ─── Top Sparkline Charts ─── */
const CHARTS = [
  { key: 'tilt', label: 'TILT (°)', unit: '°', color: '#38bdf8', warn: 8 },
  { key: 'vibration', label: 'VIBRATION (mm/s)', unit: ' mm/s', color: '#f97316', warn: 4 },
  { key: 'moisture', label: 'MOISTURE (%)', unit: ' %', color: '#a78bfa', warn: 80 },
  { key: 'risk', label: 'RISK SCORE', unit: ' / 100', color: '#ef4444', warn: 65 },
  { key: 'battery', label: 'BATTERY (%)', unit: ' %', color: '#22c55e', warn: 30 },
] as const;

type ChartKey = typeof CHARTS[number]['key'];

export function BottomPanel() {
  const { liveSeries, chartSensorId, playback, sensors, alerts, drone, zones, setCurrentPage } = useApp();
  const { prediction } = usePrediction();
  const [collapsed, setCollapsed] = useState(false);
  const heatmapRef = useRef<HTMLCanvasElement>(null);

  const data = liveSeries.length > 0 ? liveSeries : EMPTY;
  const last = data[data.length - 1];

  const openAlerts = alerts.filter(a => !a.resolved).slice(0, 4);
  const topSensor = [...sensors].filter(s => s.status !== 'offline').sort((a, b) => b.riskScore - a.riskScore)[0];

  // Draw risk heatmap on canvas
  const drawHeatmap = useCallback(() => {
    const cvs = heatmapRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    const w = cvs.width;
    const h = cvs.height;

    // Dark background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    // Draw concentric pit rings
    const cx = w * 0.5;
    const cy = h * 0.55;
    for (let i = 1; i <= 6; i++) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, i * 22, i * 16, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(56,189,248,0.15)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }

    // Draw heat spots from zones
    const heatValue = prediction ? scoreToRisk(prediction.score) : null;
    zones.forEach(zone => {
      const angle = (zone.angleStart + zone.angleEnd) / 2;
      const level = heatValue ?? zone.currentRisk;
      const r = 40 + (level / 100) * 60;
      const x = cx + Math.cos(angle) * r * 0.6;
      const y = cy + Math.sin(angle) * r * 0.4;
      const intensity = level / 100;
      const rad = 30 + intensity * 30;

      const grad = ctx.createRadialGradient(x, y, 2, x, y, rad);
      if (intensity > 0.7) {
        grad.addColorStop(0, `rgba(239, 68, 68, ${0.8 * intensity})`);
        grad.addColorStop(0.4, `rgba(249, 115, 22, ${0.5 * intensity})`);
        grad.addColorStop(0.7, `rgba(234, 179, 8, ${0.2 * intensity})`);
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      } else {
        grad.addColorStop(0, `rgba(34, 197, 94, ${0.6 * intensity})`);
        grad.addColorStop(0.5, `rgba(34, 211, 238, ${0.3 * intensity})`);
        grad.addColorStop(1, 'rgba(34, 197, 94, 0)');
      }

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    });

    // Legend gradient bar
    const lgW = 80;
    const lgH = 6;
    const lgX = 10;
    const lgY = h - 18;
    const legendGrad = ctx.createLinearGradient(lgX, lgY, lgX + lgW, lgY);
    legendGrad.addColorStop(0, '#22c55e');
    legendGrad.addColorStop(0.5, '#eab308');
    legendGrad.addColorStop(1, '#ef4444');
    ctx.fillStyle = legendGrad;
    ctx.fillRect(lgX, lgY, lgW, lgH);

    ctx.fillStyle = '#64748b';
    ctx.font = '8px monospace';
    ctx.fillText('Low', lgX, lgY - 3);
    ctx.fillText('High', lgX + lgW - 20, lgY - 3);
  }, [zones, prediction]);

  useEffect(() => {
    drawHeatmap();
  }, [drawHeatmap]);

  return (
    <motion.div
      className="shrink-0 z-30 flex flex-col"
      style={{
        background: 'rgba(8,13,22,0.92)',
        backdropFilter: 'blur(18px)',
        borderTop: '1px solid rgba(56,189,248,0.14)',
      }}
      initial={{ y: 200 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.45, delay: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as const }}
    >
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            {/* Row 1: Sparkline Telemetry Charts */}
            <div className="grid grid-cols-5 border-b border-white/[0.05]">
              {CHARTS.map((cfg, i) => {
                const value = last ? last[cfg.key] : 0;
                const over = cfg.key !== 'battery' ? value >= cfg.warn : value <= cfg.warn;
                return (
                  <div
                    key={cfg.key}
                    className={`px-3 pt-2 pb-2 min-w-0 ${i > 0 ? 'border-l border-white/[0.05]' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] font-medium text-slate-500 uppercase tracking-widest truncate">
                        {cfg.label}
                      </span>
                      <span className="flex items-center gap-1 text-[7px] font-mono text-green-400">
                        <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                        Live
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-1">
                      <span
                        className="text-[18px] font-mono font-bold tabular-nums leading-none"
                        style={{ color: over ? '#ef4444' : cfg.color, textShadow: over ? '0 0 10px rgba(239,68,68,0.5)' : undefined }}
                      >
                        {typeof value === 'number' ? value.toFixed(cfg.key === 'risk' ? 0 : cfg.key === 'battery' ? 0 : 1) : value}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {cfg.key === 'risk' ? '/ 100' : cfg.unit.trim()}
                      </span>
                    </div>
                    <div className="h-[52px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id={`lg-${cfg.key}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={over ? '#ef4444' : cfg.color} stopOpacity={0.35} />
                              <stop offset="100%" stopColor={over ? '#ef4444' : cfg.color} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <YAxis hide domain={['auto', 'auto']} />
                          <Area
                            type="monotone"
                            dataKey={cfg.key}
                            stroke={over ? '#ef4444' : cfg.color}
                            strokeWidth={1.4}
                            fill={`url(#lg-${cfg.key})`}
                            dot={false}
                            isAnimationActive
                            animationDuration={800}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Row 2: Widgets - Risk Heatmap | Alerts | Drone Status | AI Insights | Recent Events */}
            <div className="grid grid-cols-5 min-h-[140px]">
              {/* RISK HEATMAP */}
              <div className="px-3 pt-2 pb-2 min-w-0">
                <div className="text-[8.5px] font-display font-bold tracking-[0.15em] text-slate-400 mb-1.5 uppercase">
                  Risk Heatmap
                </div>
                <canvas
                  ref={heatmapRef}
                  width={200}
                  height={130}
                  className="w-full h-[110px] rounded-lg"
                  style={{ background: '#0a0e14' }}
                />
              </div>

              {/* ALERTS */}
              <div className="px-3 pt-2 pb-2 min-w-0 border-l border-white/[0.05]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8.5px] font-display font-bold tracking-[0.15em] text-slate-400 uppercase">
                    Alerts ({alerts.filter(a => !a.resolved).length})
                  </span>
                  <button
                    className="text-[8px] text-cyan-400 font-mono hover:text-cyan-300"
                    onClick={() => setCurrentPage('alerts')}
                  >
                    View All
                  </button>
                </div>
                <div className="space-y-1.5">
                  {openAlerts.map(a => (
                    <div key={a.id} className="flex items-start gap-1.5">
                      <AlertTriangle
                        className="w-3 h-3 shrink-0 mt-0.5"
                        style={{ color: a.type === 'critical' ? '#ef4444' : '#f59e0b' }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[8.5px] text-slate-300 leading-snug line-clamp-1">{a.reason.split('—')[0].trim()}</p>
                        <p className="text-[7.5px] text-slate-600 font-mono">{formatTimeAgo(a.time)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* DRONE STATUS */}
              <div className="px-3 pt-2 pb-2 min-w-0 border-l border-white/[0.05]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8.5px] font-display font-bold tracking-[0.15em] text-slate-400 uppercase">
                    Drone Status
                  </span>
                  <span className="text-[7.5px] font-mono text-green-400">Active Mission</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-cyan-400" />
                    <span className="text-[11px] font-display font-bold text-slate-100">Drone-1</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] font-mono">
                    <div>
                      <span className="text-slate-500">Area</span>
                      <div className="text-slate-200">West Wall <span className="text-red-400 text-[7px]">⚠</span></div>
                    </div>
                    <div>
                      <span className="text-slate-500">Battery</span>
                      <div className="text-slate-200">{drone.battery.toFixed(0)}%</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Coverage</span>
                      <div className="text-emerald-400">{drone.missionProgress.toFixed(0)}%</div>
                    </div>
                  </div>
                  <button
                    className="w-full mt-1 py-1.5 rounded-lg text-[8.5px] font-display font-bold tracking-wider transition-colors"
                    style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#67e8f9' }}
                    onClick={() => setCurrentPage('drone-feed')}
                  >
                    View Drone Feed
                  </button>
                </div>
              </div>

              {/* AI INSIGHTS */}
              <div className="px-3 pt-2 pb-2 min-w-0 border-l border-white/[0.05]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8.5px] font-display font-bold tracking-[0.15em] text-slate-400 uppercase">
                    AI Insights
                  </span>
                  <button className="text-[8px] text-cyan-400 font-mono hover:text-cyan-300" onClick={() => setCurrentPage('analytics')}>
                    View All
                  </button>
                </div>
                <div className="flex items-start gap-2 mb-2">
                  <Brain className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                  <div className="text-[8.5px] text-slate-300 leading-snug">
                    {prediction
                      ? `${prediction.recommendation}`
                      : 'Awaiting first ML prediction…'}
                  </div>
                </div>
                <div className="text-[8px] text-amber-400 font-bold mb-1">Recommendation:</div>
                <div className="text-[8px] text-slate-400 leading-snug flex items-start gap-1">
                  <Lightbulb className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                  {prediction ? prediction.recommendation : 'Run a prediction to receive a recommendation.'}
                </div>
              </div>

              {/* RECENT EVENTS */}
              <div className="px-3 pt-2 pb-2 min-w-0 border-l border-white/[0.05]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8.5px] font-display font-bold tracking-[0.15em] text-slate-400 uppercase">
                    Recent Events
                  </span>
                  <button className="text-[8px] text-cyan-400 font-mono hover:text-cyan-300" onClick={() => setCurrentPage('historical')}>
                    View All
                  </button>
                </div>
                <div className="space-y-1.5">
                  {[
                    { icon: <AlertTriangle className="w-3 h-3 text-red-400" />, text: 'S-23 risk changed to HIGH', time: '10:24 AM' },
                    { icon: <TrendingUp className="w-3 h-3 text-amber-400" />, text: 'Route rerouted for S-23', time: '10:23 AM' },
                    { icon: <Plane className="w-3 h-3 text-cyan-400" />, text: 'Drone-1 mission started', time: '10:20 AM' },
                    { icon: <Activity className="w-3 h-3 text-sky-400" />, text: 'Rainfall intensity increased', time: '10:15 AM' },
                  ].map((evt, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      {evt.icon}
                      <span className="text-[8.5px] text-slate-300 flex-1 truncate">{evt.text}</span>
                      <span className="text-[7.5px] font-mono text-slate-500 shrink-0">{evt.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const EMPTY: { t: number; tilt: number; vibration: number; humidity: number; moisture: number; risk: number; battery: number }[] =
  Array.from({ length: 8 }, (_, i) => ({
    t: Date.now() - (7 - i) * 2000,
    tilt: 0,
    vibration: 0,
    humidity: 0,
    moisture: 0,
    risk: 0,
    battery: 0,
  }));
