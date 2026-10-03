import { motion } from 'framer-motion';
import { AlarmClock, ShieldAlert } from 'lucide-react';
import { formatHours } from '../../utils/helpers';

interface PredictionTimelineProps {
  hoursUntil: number;
  confidence: number;
  maxHours?: number;
  label?: string;
}

export function PredictionTimeline({ hoursUntil, confidence, maxHours = 96, label = 'PREDICTED FAILURE' }: PredictionTimelineProps) {
  const W = 260;
  const H = 54;
  const markerX = Math.max(14, Math.min(W - 14, (hoursUntil / maxHours) * (W - 28) + 14));
  const bandW = Math.max(10, Math.min(30, (confidence / 100) * 26));

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-[9px] font-display font-bold tracking-[0.18em] text-slate-400">
          <AlarmClock className="w-3 h-3" />
          {label}
        </span>
        <span className="text-[10px] font-mono text-orange-400 font-semibold">
          T-{formatHours(hoursUntil)}
        </span>
      </div>

      <div className="relative h-[52px] w-full overflow-hidden rounded-lg border border-white/[0.06] bg-[#0a101b]">
        <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="ptl-horizon" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="55%" stopColor="#eab308" />
              <stop offset="80%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
          <rect x={0} y={0} width={W} height={H} rx={6} fill="url(#ptl-horizon)" opacity={0.08} />

          <rect x={14} y={30} width={W - 28} height={5} rx={2.5} fill="url(#ptl-horizon)" opacity={0.85} />

          {[0.25, 0.5, 0.75].map(t => (
            <line
              key={t}
              x1={14 + (W - 28) * t}
              x2={14 + (W - 28) * t}
              y1={26}
              y2={40}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth={0.8}
            />
          ))}

          <text x={14} y={16} fill="#5f7188" fontSize={7}>NOW</text>
          <text x={W - 14} y={16} fill="#5f7188" fontSize={7} textAnchor="end">+{maxHours}h</text>

          <rect
            x={markerX - bandW}
            y={12}
            width={bandW * 2}
            height={H - 24}
            rx={3}
            fill="rgba(239,68,68,0.14)"
            stroke="rgba(239,68,68,0.4)"
            strokeWidth={0.8}
          />
          <line
            x1={markerX}
            x2={markerX}
            y1={10}
            y2={H - 10}
            stroke="#ef4444"
            strokeWidth={1.4}
            strokeDasharray="3 3"
          />
          <circle cx={markerX} cy={30} r={4} fill="#ef4444">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <text x={markerX} y={H - 2} fill="#ef4444" fontSize={7} textAnchor="middle" fontWeight={700}>
            FAILURE
          </text>
        </svg>
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: 'inset 0 0 18px rgba(0,0,0,0.5)' }} />
      </div>

      <motion.div
        className="mt-1.5 flex items-center gap-1.5 text-[9px] text-slate-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        <ShieldAlert className="w-3 h-3 text-red-400" />
        AI confidence on window: <span className="font-mono text-red-400 font-bold">{confidence.toFixed(1)}%</span>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> MONITOR
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> WARN
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> EVAC
        </span>
      </motion.div>
    </div>
  );
}
