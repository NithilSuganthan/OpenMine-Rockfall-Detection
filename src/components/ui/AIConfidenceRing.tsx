import { motion } from 'framer-motion';
import { getRiskColor } from '../../utils/helpers';

interface AIConfidenceRingProps {
  confidence: number;
  size?: number;
  factors?: { label: string; value: number; trend: 'up' | 'down' | 'stable' }[];
}

export function AIConfidenceRing({ confidence, size = 140, factors }: AIConfidenceRingProps) {
  const radius = (size - 20) / 2;
  const innerRadius = radius - 12;
  const circumference = 2 * Math.PI * radius;
  const innerCircumference = 2 * Math.PI * innerRadius;

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Outer track */}
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={4}
          />
          {/* Outer ring - confidence */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none"
            stroke="var(--color-accent-cyan)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - (confidence / 100) * circumference }}
            transition={{ duration: 2, ease: 'easeOut' }}
            style={{ filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.5))' }}
          />
          {/* Inner track */}
          <circle
            cx={size / 2} cy={size / 2} r={innerRadius}
            fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={3}
          />
          {/* Inner ring - AI accuracy */}
          <motion.circle
            cx={size / 2} cy={size / 2} r={innerRadius}
            fill="none"
            stroke="var(--color-accent-blue)"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={innerCircumference}
            initial={{ strokeDashoffset: innerCircumference }}
            animate={{ strokeDashoffset: innerCircumference - (confidence * 0.95 / 100) * innerCircumference }}
            transition={{ duration: 2, delay: 0.3, ease: 'easeOut' }}
            style={{ filter: 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.4))' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-1">
            AI
          </span>
          <motion.span
            className="text-xl font-bold font-mono text-[var(--color-accent-cyan)]"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, type: 'spring' }}
          >
            {confidence.toFixed(1)}%
          </motion.span>
          <span className="text-[9px] text-[var(--color-text-muted)]">confidence</span>
        </div>
      </div>

      {/* Contributing Factors */}
      {factors && (
        <div className="w-full space-y-2">
          {factors.map((factor, i) => (
            <motion.div
              key={factor.label}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
            >
              <span className="text-xs text-[var(--color-text-secondary)] w-24 truncate">
                {factor.label}
              </span>
              <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: getRiskColor(factor.value) }}
                  initial={{ width: 0 }}
                  animate={{ width: `${factor.value}%` }}
                  transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                />
              </div>
              <span className="text-xs font-mono w-8 text-right" style={{ color: getRiskColor(factor.value) }}>
                {factor.value}%
              </span>
              <span className="text-xs">
                {factor.trend === 'up' ? '↑' : factor.trend === 'down' ? '↓' : '→'}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
