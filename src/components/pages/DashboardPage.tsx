import { motion } from 'framer-motion';
import {
  Activity, AlertTriangle, Brain, Shield, Zap, ArrowUpRight, Radio,
} from 'lucide-react';
import { GlassPanel } from '../ui/GlassPanel';
import { RiskMeter } from '../ui/RiskMeter';
import { AIConfidenceRing } from '../ui/AIConfidenceRing';
import { useApp } from '../../store/AppContext';
import { usePrediction } from '../../hooks/usePrediction';
import { ANALYTICS } from '../../data/mockData';
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getRiskColor, statusColors, STATUS_ORDER, riskColorGradient, scoreToRisk, tierColors } from '../../utils/helpers';
import type { RiskTier, SensorStatus } from '../../data/types';

const TIER_LEVEL: Record<RiskTier, number> = { normal: 22, watch: 52, warning: 76, emergency: 93 };

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

const TOOLTIP_STYLE = {
  background: 'rgba(10,16,28,0.95)',
  border: '1px solid rgba(56,189,248,0.25)',
  borderRadius: 8,
  fontSize: 10,
  color: '#e2e8f0',
  fontFamily: 'JetBrains Mono, monospace',
};

export function DashboardPage() {
  const { sensors, zones, alerts, setCurrentPage, selectZone, selectSensor, aiActivity } = useApp();
  const { prediction } = usePrediction();

  const counts = STATUS_ORDER.reduce<Record<SensorStatus, number>>((acc, s) => {
    acc[s] = sensors.filter(x => x.status === s).length;
    return acc;
  }, { safe: 0, warning: 0, 'high-risk': 0, critical: 0, offline: 0 });

  const overallRisk = prediction ? scoreToRisk(prediction.score) : Math.max(...zones.map(z => z.currentRisk), 0);
  const overallRiskColor = prediction ? tierColors[prediction.tier] : getRiskColor(overallRisk);
  const unresolved = alerts.filter(a => !a.resolved).length;
  const criticalOpen = alerts.filter(a => a.type === 'critical' && !a.resolved).length;

  const pieData = STATUS_ORDER.filter(s => s !== 'offline').map(s => ({
    name: s.replace('-', ' '),
    value: counts[s],
    color: statusColors[s],
  }));

  return (
    <motion.div className="h-full overflow-y-auto p-4 space-y-3" variants={container} initial="hidden" animate="show">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-display font-bold tracking-wide text-slate-100">Mission Overview</h1>
          <p className="text-[10px] text-slate-500">Site-wide rockfall risk · {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-mono text-slate-500">
          <Radio className="w-3 h-3 text-green-400 animate-pulse" />
          TELEMETRY STREAM · 2s CYCLE
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        <KPI icon={<Shield className="w-4 h-4" />} label="Peak Zone Risk" value={`${overallRisk}%`} color={overallRiskColor} sub={prediction ? prediction.tier.toUpperCase() : zones.sort((a, b) => b.currentRisk - a.currentRisk)[0]?.shortName} />
        <KPI icon={<Activity className="w-4 h-4" />} label="Active Sensors" value={`${40 - counts.offline}/40`} color="#38bdf8" sub={`${counts.offline} offline`} />
        <KPI icon={<AlertTriangle className="w-4 h-4" />} label="Open Alerts" value={String(unresolved)} color={criticalOpen > 0 ? '#ef4444' : '#f59e0b'} sub={`${criticalOpen} critical`} />
        <KPI icon={<Brain className="w-4 h-4" />} label="AI Engine Load" value={`${aiActivity.toFixed(0)}%`} color="#22d3ee" sub="neural inference" />
        <KPI icon={<Zap className="w-4 h-4" />} label="AI Accuracy" value={`${ANALYTICS.aiAccuracy.overall}%`} color="#a78bfa" sub="30-day window" />
      </div>

      <div className="grid grid-cols-12 gap-2.5">
        <motion.div variants={item} className="col-span-3">
          <GlassPanel className="p-3.5 h-full" glow="blue">
            <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400 mb-3">SYSTEM RISK INDEX</h3>
            <div className="flex justify-center mb-3"><RiskMeter value={overallRisk} size={150} /></div>            <div className="space-y-1.5">
              {zones.map(z => (
                <button key={z.id} className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors" onClick={() => { selectZone(z.id); setCurrentPage('digital-twin'); }}>
                  <span className="text-[10px] text-slate-400 truncate mr-2">{z.shortName}</span>
                  <span className="text-[10px] font-mono font-bold" style={{ color: getRiskColor(z.currentRisk) }}>
                    {z.currentRisk}% <ArrowUpRight className="w-3 h-3 inline" style={{ color: getRiskColor(z.currentRisk) }} />
                  </span>
                </button>
              ))}
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div variants={item} className="col-span-3">
          <GlassPanel className="p-3.5 h-full">
            <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400 mb-3">SENSOR FLEET STATUS</h3>
            <div className="flex justify-center mb-3">
              <PieChart width={150} height={150}>
                <Pie data={pieData} cx={75} cy={75} innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value" animationDuration={1100}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="rgba(7,11,18,0.8)" />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: d.color, boxShadow: `0 0 5px ${d.color}` }} />
                  <span className="text-[9px] text-slate-400 capitalize">{d.name}</span>
                  <span className="text-[9px] font-mono text-slate-300 ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div variants={item} className="col-span-3">
          <GlassPanel className="p-3.5 h-full" glow="cyan">
            <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400 mb-3">AI PREDICTION ENGINE</h3>
            <div className="flex justify-center">
              <AIConfidenceRing
                confidence={prediction ? Math.round(prediction.confidence * 100) : ANALYTICS.aiAccuracy.overall}
                size={140}
                factors={[
                  { label: 'Risk Score', value: prediction ? Math.round(scoreToRisk(prediction.score)) : 89, trend: 'up' },
                  { label: 'Confidence', value: prediction ? Math.round(prediction.confidence * 100) : 82, trend: 'up' },
                  { label: 'Tier', value: prediction ? TIER_LEVEL[prediction.tier] : 76, trend: 'stable' },
                  { label: 'Models Active', value: 91, trend: 'up' },
                ]}
              />
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div variants={item} className="col-span-3">
          <GlassPanel className="p-3.5 h-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400">LIVE ALERTS</h3>
              <button className="text-[9px] text-cyan-400 hover:text-cyan-300 font-mono" onClick={() => setCurrentPage('alerts')}>VIEW ALL →</button>
            </div>
            <div className="space-y-1.5">
              {alerts.filter(a => !a.resolved).slice(0, 4).map(a => (
                <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${a.type === 'critical' ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.2)'}` }}>
                  <span className="w-1.5 h-1.5 rounded-full mt-1 shrink-0 animate-pulse" style={{ background: a.type === 'critical' ? '#ef4444' : '#f59e0b', boxShadow: `0 0 8px ${a.type === 'critical' ? '#ef4444' : '#f59e0b'}` }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[9.5px] text-slate-300 leading-snug line-clamp-2">{a.reason}</p>
                    <p className="text-[8px] text-slate-600 font-mono mt-0.5">{a.location}</p>
                  </div>
                </div>
              ))}
              {alerts.filter(a => !a.resolved).length === 0 && <p className="text-[10px] text-slate-600">All clear — no open alerts.</p>}
            </div>
            <button
              className="mt-3 w-full py-1.5 rounded-lg text-[9px] font-display font-bold tracking-widest transition-colors"
              style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#67e8f9' }}
              onClick={() => setCurrentPage('drone-feed')}
            >
              LAUNCH DRONE INSPECTION →
            </button>
          </GlassPanel>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <motion.div variants={item}>
          <GlassPanel className="p-3.5">
            <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400 mb-3">DAILY RISK BY ZONE — 30 DAYS</h3>
            <ResponsiveContainer width="100%" height={190}>
              <AreaChart data={ANALYTICS.dailyRisk}>
                <defs>
                  <linearGradient id="d-north" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} /><stop offset="100%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                  <linearGradient id="d-east" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f97316" stopOpacity={0.25} /><stop offset="100%" stopColor="#f97316" stopOpacity={0} /></linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fontSize: 8 }} interval={4} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8 }} domain={[0, 100]} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Area type="monotone" dataKey="east" stroke="#f97316" strokeWidth={1.5} fill="url(#d-east)" dot={false} />
                <Area type="monotone" dataKey="north" stroke="#ef4444" strokeWidth={1.5} fill="url(#d-north)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </GlassPanel>
        </motion.div>

        <motion.div variants={item}>
          <GlassPanel className="p-3.5">
            <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400 mb-3">WEEKLY PERFORMANCE</h3>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={ANALYTICS.weeklyTrend}>
                <XAxis dataKey="week" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="avgRisk" fill="#f97316" radius={[3, 3, 0, 0]} opacity={0.85} />
                <Bar dataKey="sensorHealth" fill="#22d3ee" radius={[3, 3, 0, 0]} opacity={0.55} />
              </BarChart>
            </ResponsiveContainer>
          </GlassPanel>
        </motion.div>
      </div>
    </motion.div>
  );
}

function KPI({ icon, label, value, color, sub }: { icon: React.ReactNode; label: string; value: string; color: string; sub: string }) {
  return (
    <motion.div variants={item}>
      <GlassPanel className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg" style={{ background: `${color}14`, border: `1px solid ${color}35` }}>
            <span style={{ color }}>{icon}</span>
          </div>
          <span className="text-[8.5px] text-slate-500 uppercase tracking-widest">{label}</span>
        </div>
        <div className="text-[19px] font-mono font-bold leading-none" style={{ color, textShadow: `0 0 14px ${color}66` }}>
          {value}
        </div>
        <span className="text-[8.5px] text-slate-600 mt-1 inline-block">{sub}</span>
      </GlassPanel>
    </motion.div>
  );
}
