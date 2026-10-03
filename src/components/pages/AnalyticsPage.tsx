import { motion } from 'framer-motion';
import {
  Activity, Brain, Cpu, GitBranch, Signal, Target, Wifi, Zap,
} from 'lucide-react';
import { GlassPanel } from '../ui/GlassPanel';
import { useApp } from '../../store/AppContext';
import { ANALYTICS } from '../../data/mockData';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart,
  RadialBar, RadialBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { getRiskColor } from '../../utils/helpers';

const TOOLTIP_STYLE = {
  background: 'rgba(10,16,28,0.95)',
  border: '1px solid rgba(56,189,248,0.25)',
  borderRadius: 8,
  fontSize: 10,
  color: '#e2e8f0',
  fontFamily: 'JetBrains Mono, monospace',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export function AnalyticsPage() {
  const { sensors } = useApp();

  const online = sensors.filter(s => s.status !== 'offline').length;
  const degraded = sensors.filter(s => s.signalStrength < 60 && s.status !== 'offline').length;
  const avgRisk = Math.round(sensors.reduce((a, s) => a + s.riskScore, 0) / Math.max(1, sensors.length));

  const healthPie = [
    { name: 'Healthy', value: sensors.filter(s => s.healthScore >= 80 && s.status !== 'offline').length, color: '#22c55e' },
    { name: 'Degraded', value: degraded, color: '#f59e0b' },
    { name: 'Offline', value: sensors.filter(s => s.status === 'offline').length, color: '#64748b' },
  ];

  const commRadial = [
    { name: 'Signal', value: ANALYTICS.communication.avgSignal, fill: '#38bdf8' },
    { name: 'Throughput', value: ANALYTICS.communication.throughput, fill: '#22d3ee' },
    { name: 'Latency Score', value: Math.max(20, 100 - ANALYTICS.communication.latency), fill: '#a78bfa' },
  ];

  const failureData = ANALYTICS.failureHistory.map(f => ({
    ...f,
    barColor: f.predicted ? (f.severity === 'Major' ? '#ef4444' : '#f97316') : '#64748b',
  }));

  return (
    <motion.div className="h-full overflow-y-auto p-4 space-y-3" variants={container} initial="hidden" animate="show">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-display font-bold tracking-wide text-slate-100">Analytics & Prediction</h1>
          <p className="text-[10px] text-slate-500">Model performance · network health · failure forensics</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        <KPI icon={<Brain className="w-3.5 h-3.5" />} label="AI Accuracy" value={`${ANALYTICS.aiAccuracy.overall}%`} color="#22d3ee" sub={`${ANALYTICS.aiAccuracy.truePositives + ANALYTICS.aiAccuracy.trueNegatives} correct`} />
        <KPI icon={<Activity className="w-3.5 h-3.5" />} label="Fleet Online" value={`${online}/40`} color="#22c55e" sub={`${degraded} degraded`} />
        <KPI icon={<Target className="w-3.5 h-3.5" />} label="Avg Risk Index" value={`${avgRisk}%`} color={getRiskColor(avgRisk)} sub="all nodes" />
        <KPI icon={<Signal className="w-3.5 h-3.5" />} label="Avg Signal" value={`${ANALYTICS.communication.avgSignal}%`} color="#38bdf8" sub={`${ANALYTICS.communication.packetLoss}% packet loss`} />
        <KPI icon={<Zap className="w-3.5 h-3.5" />} label="Predictions" value={String(ANALYTICS.aiAccuracy.truePositives + ANALYTICS.aiAccuracy.trueNegatives)} color="#a78bfa" sub="last 30 days" />
      </div>

      <div className="grid grid-cols-12 gap-2.5">
        <motion.div variants={item} className="col-span-7">
          <GlassPanel className="p-3.5" glow="blue">
            <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400 mb-3">AI ACCURACY — 14 DAY ROLLING</h3>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={ANALYTICS.aiAccuracySeries}>
                <defs>
                  <linearGradient id="a-acc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#22d3ee" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(56,189,248,0.06)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="acc" domain={[88, 100]} tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis yAxisId="pred" orientation="right" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar yAxisId="pred" dataKey="predictions" fill="rgba(56,189,248,0.25)" radius={[3, 3, 0, 0]} />
                <Area yAxisId="acc" type="monotone" dataKey="accuracy" stroke="#22d3ee" strokeWidth={2} fill="url(#a-acc)" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </GlassPanel>
        </motion.div>

        <motion.div variants={item} className="col-span-5">
          <GlassPanel className="p-3.5">
            <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400 mb-3">SENSOR HEALTH</h3>
            <div className="flex items-center gap-4">
              <PieChart width={150} height={150}>
                <Pie data={healthPie} cx={75} cy={75} innerRadius={42} outerRadius={66} paddingAngle={4} dataKey="value" animationDuration={1100}>
                  {healthPie.map((d, i) => <Cell key={i} fill={d.color} stroke="rgba(7,11,18,0.8)" />)}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </PieChart>
              <div className="space-y-2">
                {healthPie.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ background: d.color, boxShadow: `0 0 6px ${d.color}` }} />
                    <span className="text-[10px] text-slate-400">{d.name}</span>
                    <span className="text-[10px] font-mono text-slate-200 ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div variants={item} className="col-span-5">
          <GlassPanel className="p-3.5">
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
              <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400">COMMUNICATION HEALTH</h3>
            </div>
            <div className="flex items-center justify-around">
              <RadialBarChart width={170} height={140} cx={85} cy={75} innerRadius={42} outerRadius={70} data={commRadial} startAngle={220} endAngle={-40}>
                <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
              </RadialBarChart>
              <div className="space-y-2">
                {commRadial.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-sm" style={{ background: d.fill }} />
                    <span className="text-[10px] text-slate-400">{d.name}</span>
                    <span className="text-[10px] font-mono text-slate-200 ml-auto">{Math.round(d.value)}%</span>
                  </div>
                ))}
                <div className="pt-1 text-[9px] font-mono text-slate-500">PACKET LOSS {ANALYTICS.communication.packetLoss}%</div>
              </div>
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div variants={item} className="col-span-7">
          <GlassPanel className="p-3.5" glow="orange">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-3.5 h-3.5 text-orange-400" />
              <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400">FAILURE PREDICTION HISTORY</h3>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={failureData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid stroke="rgba(56,189,248,0.06)" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="date" tick={{ fontSize: 9 }} width={44} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="confidence" radius={[0, 4, 4, 0]} barSize={16}>
                  {failureData.map((d, i) => <Cell key={i} fill={d.barColor} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {failureData.slice(0, 3).map(f => (
                <div key={f.date} className="px-2 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.025)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-mono text-slate-500">{f.date}</span>
                    <span className="text-[8px] font-mono" style={{ color: f.predicted ? '#4ade80' : '#94a3b8' }}>
                      {f.predicted ? 'HIT' : 'MISS'}
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-300 mt-0.5">{f.location} · {f.severity}</div>
                  <div className="text-[8px] font-mono text-slate-600 mt-0.5">
                    {f.predicted ? `T-${f.hoursAhead}h lead` : 'not predicted'}
                  </div>
                </div>
              ))}
            </div>
          </GlassPanel>
        </motion.div>

        <motion.div variants={item} className="col-span-12">
          <GlassPanel className="p-3.5">
            <div className="flex items-center gap-2 mb-3">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              <h3 className="text-[10px] font-display font-bold tracking-[0.2em] text-slate-400">WEEKLY TREND — RISK VS INCIDENTS</h3>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <ComposedChart data={ANALYTICS.weeklyTrend}>
                <CartesianGrid stroke="rgba(56,189,248,0.06)" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="incidents" fill="#fb923c" radius={[3, 3, 0, 0]} opacity={0.75} />
                <Line type="monotone" dataKey="avgRisk" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sensorHealth" stroke="#22d3ee" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
              </ComposedChart>
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
        <div className="text-[17px] font-mono font-bold leading-none" style={{ color, textShadow: `0 0 14px ${color}55` }}>
          {value}
        </div>
        <span className="text-[8.5px] text-slate-600 mt-1 inline-block">{sub}</span>
      </GlassPanel>
    </motion.div>
  );
}
