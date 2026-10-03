import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Radio, Siren, Waypoints } from 'lucide-react';
import { useDesigner } from '../../store/designerStore';
import { blindSpots, communicationHealth, computeCoverage } from '../../utils/designerValidation';
import { SENSING_TYPES } from '../../data/designerCatalog';

/**
 * Live deployment metrics — recomputed instantly on every edit (place,
 * move, rotate, duplicate, delete, link). All values derive from the
 * designer scene only; nothing is simulated.
 */
export function DeploymentMetrics() {
  const objects = useDesigner(s => s.objects);
  const links = useDesigner(s => s.links);

  const metrics = useMemo(() => {
    const coverage = computeCoverage(objects);
    const comm = communicationHealth(objects, links);
    const spots = blindSpots(objects);
    const poles = objects.filter(o => o.type === 'monitoring-pole').length;
    const sensors = objects.filter(o => SENSING_TYPES.includes(o.type)).length;
    const relays = objects.filter(o => o.type === 'relay-node').length;
    const gateways = objects.filter(o => o.type === 'gateway').length;
    // Expected prediction confidence: coverage + comm health → 0–95%
    const confidence = Math.round(Math.min(95, 30 + coverage * 0.4 + comm.pct * 0.3));
    return { coverage, comm, spots, poles, sensors, relays, gateways, confidence };
  }, [objects, links]);

  const coverageColor = metrics.coverage >= 85 ? '#22c55e' : metrics.coverage >= 60 ? '#f59e0b' : '#ef4444';
  const commColor = metrics.comm.pct >= 95 ? '#22c55e' : metrics.comm.pct >= 70 ? '#f59e0b' : '#ef4444';

  return (
    <motion.div
      className="absolute top-4 left-1/2 -translate-x-1/2 z-20"
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7 }}
    >
      <div
        className="glass-panel px-3.5 py-2 flex items-center gap-4"
        style={{ borderColor: 'rgba(56,189,248,0.22)' }}
      >
        <Metric label="COVERAGE" value={`${metrics.coverage}%`} color={coverageColor} />
        <Divider />
        <Metric label="POLES" value={String(metrics.poles)} icon={<Siren className="w-2.5 h-2.5 text-cyan-400" />} />
        <Metric label="SENSORS" value={String(metrics.sensors)} />
        <Metric label="RELAYS" value={String(metrics.relays)} icon={<Waypoints className="w-2.5 h-2.5 text-violet-400" />} />
        <Metric label="GATEWAYS" value={String(metrics.gateways)} icon={<Radio className="w-2.5 h-2.5 text-cyan-400" />} />
        <Divider />
        <Metric
          label="COMM HEALTH"
          value={`${metrics.comm.pct}%`}
          color={commColor}
          sub={metrics.comm.total > 0 ? `${metrics.comm.reachable}/${metrics.comm.total} NODES` : undefined}
        />
        <Metric label="BLIND SPOTS" value={String(metrics.spots.length)} color={metrics.spots.length > 0 ? '#f59e0b' : '#22c55e'} />
        <Metric label="EXP. PRED. CONF." value={`${metrics.confidence}%`} color="#38bdf8" />
      </div>
    </motion.div>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-white/[0.07]" />;
}

function Metric({ label, value, color, sub, icon }: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[44px]">
      <div className="flex items-center gap-1">
        {icon}
        <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: color ?? '#dbe4f0' }}>
          {value}
        </span>
      </div>
      <span className="text-[6.5px] font-mono tracking-[0.18em] text-slate-500">{label}</span>
      {sub && <span className="text-[6px] font-mono text-slate-600 -mt-0.5">{sub}</span>}
    </div>
  );
}
