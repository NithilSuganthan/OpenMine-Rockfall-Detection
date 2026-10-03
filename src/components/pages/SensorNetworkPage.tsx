import { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, Network, Radio, RefreshCw, Search, Wifi, WifiOff } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { StatusIndicator } from '../ui/StatusIndicator';
import { buildNetwork, GATEWAYS } from '../../utils/network';
import { PIT, benchOuterRadius } from '../../data/types';
import { statusColors, statusLabels } from '../../utils/helpers';

const VW = 820;
const VH = 560;
const SCALE = 5.5;
const CX = VW / 2;
const CY = VH / 2;

function px(x: number) { return CX + x * SCALE; }
function py(z: number) { return CY + z * SCALE; }

export function SensorNetworkPage() {
  const { sensors, selectSensor, events } = useApp();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState({ x: 0, y: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);

  const graph = useMemo(() => buildNetwork(sensors), [sensors]);

  const byId = useMemo(() => new Map(sensors.map(s => [s.id, s])), [sensors]);

  const filtered = useMemo(() => sensors.filter(s => {
    const okQ = s.id.toLowerCase().includes(query.toLowerCase()) || s.zone.toLowerCase().includes(query.toLowerCase());
    const okF = statusFilter === 'all' || s.status === statusFilter;
    return okQ && okF;
  }), [sensors, query, statusFilter]);

  const recentEvent = events[events.length - 1];

  const showTip = (id: string, e: React.MouseEvent) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      setTipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    setHoverId(id);
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-display font-bold tracking-wide text-slate-100">Sensor Network</h1>
          <p className="text-[10px] text-slate-500">Mesh topology · live routing · automatic failover</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search node / zone…"
              className="glass-panel-subtle pl-8 pr-3 py-1.5 text-[11px] text-slate-200 placeholder:text-slate-600 w-44 focus:outline-none"
              style={{ borderColor: 'rgba(56,189,248,0.25)' }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="glass-panel-subtle px-2.5 py-1.5 text-[11px] text-slate-300 bg-transparent focus:outline-none cursor-pointer"
          >
            <option value="all">All Status</option>
            {Object.keys(statusLabels).map(k => <option key={k} value={k}>{statusLabels[k as keyof typeof statusLabels]}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2.5">
        <Stat icon={<Network className="w-3.5 h-3.5" />} label="Total Nodes" value={String(sensors.length)} color="#38bdf8" />
        <Stat icon={<Wifi className="w-3.5 h-3.5" />} label="Online" value={String(sensors.length - graph.offlineCount)} color="#22c55e" />
        <Stat icon={<WifiOff className="w-3.5 h-3.5" />} label="Offline" value={String(graph.offlineCount)} color="#64748b" />
        <Stat icon={<Radio className="w-3.5 h-3.5" />} label="Gateways" value={String(GATEWAYS.length)} color="#22d3ee" />
        <Stat icon={<GitBranch className="w-3.5 h-3.5" />} label="Rerouted Links" value={String(graph.reroutedCount)} color="#f97316" />
        <Stat icon={<RefreshCw className="w-3.5 h-3.5" />} label="Coverage" value={`${graph.coverage}%`} color="#a78bfa" />
      </div>

      <div className="glass-panel p-3 glow-blue" ref={wrapRef}>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <Network className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] font-display font-bold tracking-[0.22em] text-slate-300">MESH TOPOLOGY</span>
          </div>
          <div className="flex items-center gap-3 text-[8px] font-mono text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400" /> LINK</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> REROUTE</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-500" /> OFFLINE</span>
          </div>
        </div>

        <div className="relative w-full h-[420px] rounded-xl overflow-hidden grid-bg" style={{ background: 'rgba(5,9,15,0.6)' }}>
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full h-full">
            {Array.from({ length: PIT.BENCHES + 1 }, (_, i) => (
              <circle key={i} cx={CX} cy={CY} r={benchOuterRadius(i) * SCALE} fill="none" stroke="rgba(56,189,248,0.07)" strokeDasharray="3 5" />
            ))}

            {graph.links.map((link, i) => {
              const a = byId.get(link.from);
              const b = byId.get(link.to);
              if (!a || !b) return null;
              return (
                <line
                  key={`${link.from}-${link.to}-${i}`}
                  x1={px(a.position.x)} y1={py(a.position.z)}
                  x2={px(b.position.x)} y2={py(b.position.z)}
                  stroke={link.rerouted ? '#f97316' : '#38bdf8'}
                  strokeOpacity={link.rerouted ? 0.55 : 0.14}
                  strokeWidth={link.rerouted ? 1.6 : 1}
                  strokeDasharray={link.rerouted ? '7 5' : undefined}
                  style={link.rerouted ? { animation: 'dash-flow 1.1s linear infinite' } : undefined}
                  className={link.rerouted ? '' : 'network-flicker'}
                />
              );
            })}

            {GATEWAYS.map(g => (
              <g key={g.id}>
                <rect x={px(g.position.x) - 7} y={py(g.position.z) - 7} width={14} height={14} rx={3}
                  fill="rgba(34,211,238,0.12)" stroke="#22d3ee" strokeWidth={1.2} />
                <text x={px(g.position.x)} y={py(g.position.z) + 3.2} fill="#22d3ee" fontSize={7.5} textAnchor="middle" fontWeight={700}>
                  {g.id}
                </text>
                <circle cx={px(g.position.x)} cy={py(g.position.z)} r={12} fill="none" stroke="#22d3ee" strokeOpacity={0.25}>
                  <animate attributeName="r" values="10;20;10" dur="3.5s" repeatCount="indefinite" />
                  <animate attributeName="stroke-opacity" values="0.3;0;0.3" dur="3.5s" repeatCount="indefinite" />
                </circle>
              </g>
            ))}

            {sensors.map(s => {
              const x = px(s.position.x);
              const y = py(s.position.z);
              const color = statusColors[s.status];
              const offline = s.status === 'offline';
              return (
                <g key={s.id}
                  className="cursor-pointer"
                  onClick={() => selectSensor(s.id)}
                  onMouseMove={(e) => showTip(s.id, e)}
                  onMouseLeave={() => setHoverId(null)}>
                  {!offline && (
                    <circle cx={x} cy={y} r={5} fill={color} opacity={0.22}>
                      <animate attributeName="r" values="4;13;4" dur="3s" begin={`${s.angle * 0.6}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.3;0;0.3" dur="3s" begin={`${s.angle * 0.6}s`} repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle cx={x} cy={y} r={offline ? 4.5 : 5.5}
                    fill={offline ? 'rgba(100,116,139,0.25)' : color}
                    stroke={offline ? '#64748b' : color}
                    strokeWidth={1.2}
                    opacity={offline ? 0.8 : 0.95}
                    style={!offline ? { filter: `drop-shadow(0 0 4px ${color})` } : undefined} />
                  {offline && (
                    <g stroke="#94a3b8" strokeWidth={1.4}>
                      <line x1={x - 2.4} y1={y - 2.4} x2={x + 2.4} y2={y + 2.4} />
                      <line x1={x + 2.4} y1={y - 2.4} x2={x - 2.4} y2={y + 2.4} />
                    </g>
                  )}
                  <text x={x} y={y - 9} fill={offline ? '#64748b' : '#cbd5e1'} fontSize={7} textAnchor="middle" fontFamily="JetBrains Mono, monospace">
                    {s.id}
                  </text>
                </g>
              );
            })}
          </svg>

          {hoverId && (() => {
            const s = byId.get(hoverId);
            if (!s) return null;
            return (
              <div
                className="absolute z-30 pointer-events-none glass-panel px-2.5 py-1.5"
                style={{ left: tipPos.x + 14, top: tipPos.y + 10, borderColor: `${statusColors[s.status]}66` }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColors[s.status] }} />
                  <span className="text-[10px] font-bold font-mono text-slate-100">{s.id}</span>
                  <span className="text-[8.5px] text-slate-400">{s.zone}</span>
                </div>
                <div className="text-[8.5px] font-mono text-slate-400 mt-0.5">
                  RISK <span style={{ color: statusColors[s.status] }}>{s.riskScore.toFixed(0)}%</span>
                  · BAT {s.battery.toFixed(0)}% · SIG {s.signalStrength}%
                </div>
              </div>
            );
          })()}

          {recentEvent && (
            <div className="absolute bottom-2 left-2 flex items-center gap-2 text-[8.5px] font-mono px-2.5 py-1 rounded-md"
              style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)' }}>
              <RefreshCw className="w-3 h-3 text-orange-400 animate-spin" />
              <span className="text-orange-300">{recentEvent.message}</span>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel p-3 overflow-hidden">
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-[10px] font-display font-bold tracking-[0.22em] text-slate-300">
            NODE INVENTORY ({filtered.length})
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['ID', 'Zone', 'Status', 'Battery', 'Signal', 'Tilt', 'Risk', 'Bench', 'Route'].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-[9px] font-mono font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((s, i) => (
                <motion.tr
                  key={s.id}
                  className="border-b border-white/[0.02] hover:bg-white/[0.03] cursor-pointer transition-colors"
                  onClick={() => selectSensor(s.id)}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.5) }}
                >
                  <td className="py-2 px-2 font-mono font-bold text-slate-200">{s.id}</td>
                  <td className="py-2 px-2 text-slate-400">{s.zone}</td>
                  <td className="py-2 px-2"><StatusIndicator status={s.status} size="sm" label={statusLabels[s.status]} /></td>
                  <td className="py-2 px-2 font-mono text-slate-400">{s.battery.toFixed(0)}%</td>
                  <td className="py-2 px-2 font-mono text-slate-400">{s.signalStrength}%</td>
                  <td className={`py-2 px-2 font-mono ${s.tilt > 8 ? 'text-red-400' : 'text-slate-400'}`}>{s.tilt.toFixed(2)}°</td>
                  <td className="py-2 px-2 font-mono font-bold" style={{ color: statusColors[s.status] }}>{s.riskScore.toFixed(0)}%</td>
                  <td className="py-2 px-2 font-mono text-slate-500">B{s.bench + 1}</td>
                  <td className="py-2 px-2 font-mono text-[10px] text-cyan-400/80">
                    {s.status === 'offline' ? '—' : `${s.id} → GW-0${(s.zoneIndex + 1) % 4 + 1}`}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="glass-panel px-3 py-2.5 flex items-center gap-2.5">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}14`, border: `1px solid ${color}35` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <div className="text-[15px] font-mono font-bold leading-none" style={{ color }}>{value}</div>
        <div className="text-[8px] text-slate-500 uppercase tracking-widest mt-1">{label}</div>
      </div>
    </div>
  );
}
