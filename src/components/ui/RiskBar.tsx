import { motion } from 'framer-motion';
import { getRiskColor } from '../../utils/helpers';

interface RiskBarProps {
  value: number;
  label?: string;
  height?: number;
  marker?: boolean;
  gradient?: boolean;
}

export function RiskBar({ value, label, height = 8, marker = true, gradient = true }: RiskBarProps) {
  const color = getRiskColor(value);

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest">{label}</span>
          <span className="text-[10px] font-mono font-bold" style={{ color }}>{value.toFixed(0)}%</span>
        </div>
      )}
      <div
        className="relative w-full rounded-full overflow-hidden"
        style={{ height, background: gradient
          ? 'linear-gradient(90deg, #22c55e 0%, #eab308 45%, #f97316 65%, #ef4444 85%, #dc2626 100%)'
          : 'rgba(255,255,255,0.07)' }}
      >
        {!gradient && (
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
            initial={{ width: 0 }}
            animate={{ width: `${value}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        )}
        {marker && (
          <motion.div
            className="absolute top-1/2 -translate-y-1/2 w-[3px] h-[170%] rounded-full bg-white"
            style={{ left: `calc(${value}% - 1.5px)`, boxShadow: `0 0 10px ${color}` }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          />
        )}
      </div>
    </div>
  );
}
