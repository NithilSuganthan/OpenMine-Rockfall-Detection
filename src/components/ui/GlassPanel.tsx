import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface GlassPanelProps {
  children: ReactNode;
  className?: string;
  glow?: 'blue' | 'cyan' | 'orange' | 'none';
  animate?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export function GlassPanel({ children, className = '', glow = 'none', animate = true, onClick, style }: GlassPanelProps) {
  const glowClass = glow !== 'none' ? `glow-${glow}` : '';

  const Component = animate ? motion.div : 'div';
  const animationProps = animate
    ? {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] as const },
      }
    : {};

  return (
    <Component
      className={`glass-panel ${glowClass} ${className}`}
      style={style}
      onClick={onClick}
      {...animationProps}
    >
      {children}
    </Component>
  );
}
