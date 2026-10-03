import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Bell, CheckCircle2, Clock, ShieldAlert, Siren, UserCheck } from 'lucide-react';
import { GlassPanel } from '../ui/GlassPanel';
import { useApp } from '../../store/AppContext';
import { formatTimeAgo } from '../../utils/helpers';
import type { Alert } from '../../data/types';

type Filter = 'all' | 'critical' | 'warning' | 'info' | 'open' | 'resolved';

const TYPE_META: Record<Alert['type'], { color: string; icon: React.ReactNode; label: string }> = {
  critical: { color: '#ef4444', icon: <Siren className="w-3.5 h-3.5" />, label: 'CRITICAL' },
  warning: { color: '#f59e0b', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'WARNING' },
  info: { color: '#38bdf8', icon: <Bell className="w-3.5 h-3.5" />, label: 'INFO' },
};

export function AlertsPage() {
  const { alerts, ackAlert, resolveAlert } = useApp();
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => alerts.filter(a => {
    if (filter === 'all') return true;
    if (filter === 'open') return !a.resolved;
    if (filter === 'resolved') return a.resolved;
    return a.type === filter;
  }), [alerts, filter]);

  const stats = useMemo(() => ({
    total: alerts.length,
    critical: alerts.filter(a => a.type === 'critical' && !a.resolved).length,
    warnings: alerts.filter(a => a.type === 'warning' && !a.resolved).length,
    open: alerts.filter(a => !a.resolved).length,
    resolved: alerts.filter(a => a.resolved).length,
  }), [alerts]);

  return (
    <div className="h-full overflow-y-auto p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-display font-bold tracking-wide text-slate-100">Alert Center</h1>
          <p className="text-[10px] text-slate-500">Real-time event timeline · auto-acknowledgement workflow</p>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2.5">
        <Stat label="Total Events" value={stats.total} icon={<Bell className="w-3.5 h-3.5" />} color="#38bdf8" />
        <Stat label="Critical" value={stats.critical} icon={<Siren className="w-3.5 h-3.5" />} color="#ef4444" pulse />
        <Stat label="Warnings" value={stats.warnings} icon={<AlertTriangle className="w-3.5 h-3.5" />} color="#f59e0b" />
        <Stat label="Open" value={stats.open} icon={<Clock className="w-3.5 h-3.5" />} color="#fb923c" />
        <Stat label="Resolved" value={stats.resolved} icon={<CheckCircle2 className="w-3.5 h-3.5" />} color="#22c55e" />
      </div>

      <div className="flex items-center gap-1.5">
        {(['all', 'critical', 'warning', 'open', 'resolved'] as Filter[]).map(f => (
          <button
            key={f}
            className="px-3 py-1.5 rounded-lg text-[10px] font-display font-bold tracking-widest uppercase transition-all"
            style={filter === f
              ? { background: 'rgba(34,211,238,0.14)', border: '1px solid rgba(34,211,238,0.4)', color: '#67e8f9' }
              : { background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: '#64748b' }}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="relative pl-5">
        <div className="absolute left-[7px] top-2 bottom-2 w-px" style={{ background: 'linear-gradient(180deg, rgba(239,68,68,0.4), rgba(56,189,248,0.1))' }} />
        <div className="space-y-2.5">
          <AnimatePresence>
            {filtered.map((alert, i) => {
              const meta = TYPE_META[alert.type];
              const open = !alert.resolved;
              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4) }}
                >
                  <GlassPanel
                    className={`px-3.5 py-3 ml-4 ${open ? '' : 'opacity-55'}`}
                    style={{ borderLeft: `2px solid ${meta.color}`, boxShadow: open && alert.type === 'critical' ? `0 0 20px ${meta.color}22` : undefined }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative mt-0.5 shrink-0">
                        <div className="absolute -left-[26px] top-1.5 w-2 h-2 rounded-full" style={{ background: open ? meta.color : '#475569', boxShadow: open ? `0 0 10px ${meta.color}` : 'none' }} />
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${meta.color}16`, border: `1px solid ${meta.color}40`, color: meta.color }}>
                          {meta.icon}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[9px] font-display font-bold tracking-[0.18em]" style={{ color: meta.color }}>{meta.label}</span>
                          <span className="text-[9px] font-mono text-slate-500">{alert.id}</span>
                          <span className="text-[9px] font-mono text-slate-600">{formatTimeAgo(alert.time)}</span>
                          {open && <span className="text-[8px] font-mono text-slate-500 animate-pulse">● ACTIVE</span>}
                          {alert.resolved && <span className="text-[8px] font-mono text-green-500">✓ RESOLVED</span>}
                        </div>
                        <p className="text-[11px] text-slate-200 leading-snug">{alert.reason}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-[9px] font-mono text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> {alert.location}</span>
                          <span>NODE {alert.sensorId}</span>
                          <span style={{ color: meta.color }}>CONF {alert.confidence.toFixed(1)}%</span>
                          {alert.acknowledgedBy && (
                            <span className="flex items-center gap-1 text-green-400"><UserCheck className="w-3 h-3" /> {alert.acknowledgedBy}</span>
                          )}
                        </div>
                      </div>
                      {open && (
                        <div className="flex flex-col gap-1.5 shrink-0">
                          {!alert.acknowledgedBy && (
                            <button
                              className="px-2.5 py-1 rounded-md text-[9px] font-display font-bold tracking-widest transition-all hover:scale-105"
                              style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.35)', color: '#7dd3fc' }}
                              onClick={() => ackAlert(alert.id)}
                            >
                              ACK
                            </button>
                          )}
                          <button
                            className="px-2.5 py-1 rounded-md text-[9px] font-display font-bold tracking-widest transition-all hover:scale-105"
                            style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}
                            onClick={() => resolveAlert(alert.id)}
                          >
                            RESOLVE
                          </button>
                        </div>
                      )}
                    </div>
                  </GlassPanel>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon, color, pulse }: { label: string; value: number; icon: React.ReactNode; color: string; pulse?: boolean }) {
  return (
    <GlassPanel className="p-2.5 flex items-center gap-2.5">
      <div className="relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}14`, border: `1px solid ${color}35` }}>
        <span style={{ color }}>{icon}</span>
        {pulse && value > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />}
      </div>
      <div>
        <div className="text-[15px] font-mono font-bold leading-none" style={{ color }}>{value}</div>
        <div className="text-[8px] text-slate-500 uppercase tracking-widest mt-1">{label}</div>
      </div>
    </GlassPanel>
  );
}
