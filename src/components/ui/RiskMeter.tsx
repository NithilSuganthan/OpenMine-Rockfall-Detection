import { motion } from 'framer-motion';
import { getRiskColor } from '../../utils/helpers';

interface RiskMeterProps {
  value: number;
  size?: number;
  label?: string;
  showValue?: boolean;
}

export function RiskMeter({ value, size = 120, label, showValue = true }: RiskMeterProps) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;
  const color = getRiskColor(value);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={6}
          />
          {/* Value ring */}
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            style={{
              filter: `drop-shadow(0 0 6px ${color}80)`,
            }}
          />
        </svg>
        {/* Center text */}
        {showValue && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-2xl font-bold font-mono"
              style={{ color }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {value.toFixed(0)}
            </motion.span>
            <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              Risk
            </span>
          </div>
        )}
        {/* Glow effect */}
        <div
          className="absolute inset-2 rounded-full opacity-10"
          style={{
            background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
          }}
        />
      </div>
      {label && (
        <span className="text-xs text-[var(--color-text-secondary)] font-medium">
          {label}
        </span>
      )}
    </div>
  );
}
