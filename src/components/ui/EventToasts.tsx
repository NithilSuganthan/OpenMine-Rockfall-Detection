import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, Radio, XOctagon } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import type { SystemEvent } from '../../data/types';

const ICONS = {
  info: Info,
  warning: AlertTriangle,
  critical: XOctagon,
  success: CheckCircle2,
};

const STYLES = {
  info: { border: 'rgba(56,189,248,0.4)', color: '#38bdf8', bg: 'rgba(14,30,52,0.85)' },
  warning: { border: 'rgba(251,191,36,0.45)', color: '#fbbf24', bg: 'rgba(40,32,10,0.85)' },
  critical: { border: 'rgba(239,68,68,0.5)', color: '#ef4444', bg: 'rgba(45,12,18,0.9)' },
  success: { border: 'rgba(34,197,94,0.45)', color: '#22c55e', bg: 'rgba(10,38,24,0.85)' },
};

export function EventToasts() {
  const { events } = useApp();
  const [visible, setVisible] = useState<SystemEvent[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    events.forEach(ev => {
      if (!visible.some(v => v.id === ev.id)) {
        setVisible(prev => [...prev.slice(-3), ev]);
        timers.current[ev.id] = setTimeout(() => {
          setVisible(prev => prev.filter(v => v.id !== ev.id));
          delete timers.current[ev.id];
        }, 5200);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="fixed bottom-20 left-4 z-[70] flex flex-col gap-2 w-[340px] pointer-events-none">
      <AnimatePresence>
        {visible.map(ev => {
          const Icon = ICONS[ev.severity];
          const s = STYLES[ev.severity];
          return (
            <motion.div
              key={ev.id}
              initial={{ opacity: 0, x: -60, scale: 0.92 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -80, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              className="glass-panel px-3 py-2.5 flex items-start gap-2.5"
              style={{ borderColor: s.border, background: s.bg }}
            >
              <span className="mt-0.5">
                <Icon className="w-4 h-4" style={{ color: s.color }} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-display font-bold tracking-[0.16em]" style={{ color: s.color }}>
                    {ev.severity.toUpperCase()}
                  </span>
                  <span className="text-[9px] text-slate-500 font-mono">
                    {new Date(ev.at).toLocaleTimeString([], { hour12: false })}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-200 leading-snug mt-0.5">{ev.message}</p>
              </div>
              <Radio className="w-3 h-3 text-slate-600 mt-1 animate-pulse" />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
