import type { SensorStatus } from '../../data/types';
import { statusColors } from '../../utils/helpers';

interface StatusIndicatorProps {
  status: SensorStatus;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
  label?: string;
}

export function StatusIndicator({ status, size = 'md', pulse = true, label }: StatusIndicatorProps) {
  const sizeMap = { sm: 'w-2 h-2', md: 'w-3 h-3', lg: 'w-4 h-4' };
  const color = statusColors[status];

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center">
        <div
          className={`${sizeMap[size]} rounded-full`}
          style={{ backgroundColor: color }}
        />
        {pulse && status !== 'offline' && (
          <div
            className={`absolute ${sizeMap[size]} rounded-full animate-ping`}
            style={{ backgroundColor: color, opacity: 0.4 }}
          />
        )}
      </div>
      {label && (
        <span className="text-xs font-medium" style={{ color }}>
          {label}
        </span>
      )}
    </div>
  );
}
