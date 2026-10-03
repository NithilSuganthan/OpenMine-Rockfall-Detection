import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, BellRing, CheckCircle2, Radio, Siren, X } from 'lucide-react';
import { useApp } from '../../store/AppContext';

const CHECKLIST = [
  'Severing automated haulage operations in high-risk zones',
  'Broadcasting evacuation siren to benches 1–4',
  'Notifying emergency response team — 2 min ETA',
  'Diverting drones for thermal inspection of failure plane',
  'Locking access gates — West Haul Road & East Bench',
  'Streaming incident feed to control room main display',
];

export function EmergencyModal() {
  const { emergencyOpen, setEmergencyOpen } = useApp();
  const [armed, setArmed] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(0);

  useEffect(() => {
    if (!emergencyOpen) {
      setArmed(false);
      setVisibleSteps(0);
      return;
    }
    setVisibleSteps(0);
    const iv = setInterval(() => {
      setVisibleSteps(v => (v < CHECKLIST.length ? v + 1 : v));
    }, 450);
    return () => clearInterval(iv);
  }, [emergencyOpen]);

  return (
    <AnimatePresence>
      {emergencyOpen && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{ background: 'radial-gradient(ellipse at center, rgba(60,6,10,0.55) 0%, rgba(5,8,14,0.92) 70%)', backdropFilter: 'blur(6px)' }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(239,68,68,0.03) 3px, rgba(239,68,68,0.03) 4px)' }} />

          <motion.div
            className="relative w-[520px] max-w-full"
            initial={{ scale: 0.9, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          >
            <div className="absolute -inset-1 rounded-2xl pointer-events-none" style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.5), rgba(239,68,68,0.05), rgba(239,68,68,0.5))',
              filter: 'blur(18px)',
              opacity: armed ? 0.9 : 0.5,
            }} />

            <div className="relative glass-panel overflow-hidden rounded-2xl" style={{ borderColor: 'rgba(239,68,68,0.5)', background: 'rgba(26,8,12,0.92)' }}>
              <div className="absolute top-0 left-0 right-0 h-[3px]"
                style={{ background: 'linear-gradient(90deg, transparent, #ef4444, transparent)', animation: 'glow-pulse 1.4s ease-in-out infinite' }} />

              <div className="px-6 py-5 flex items-center justify-between border-b border-red-500/20">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)' }}
                    animate={{ boxShadow: armed ? '0 0 30px rgba(239,68,68,0.6)' : '0 0 12px rgba(239,68,68,0.2)' }}
                  >
                    <Siren className="w-6 h-6 text-red-400" style={{ animation: 'blink 1s step-end infinite' }} />
                  </motion.div>
                  <div>
                    <h2 className="text-lg font-display font-bold tracking-[0.15em] text-red-400" style={{ textShadow: '0 0 16px rgba(239,68,68,0.5)' }}>
                      EMERGENCY PROTOCOL
                    </h2>
                    <p className="text-[10px] font-mono text-slate-500">SITE-WIDE ROCKFALL RESPONSE · {new Date().toLocaleTimeString([], { hour12: false })}</p>
                  </div>
                </div>
                <button onClick={() => setEmergencyOpen(false)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-slate-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.08)', border: `1px solid ${armed ? 'rgba(239,68,68,0.7)' : 'rgba(239,68,68,0.3)'}` }}>
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-bold text-red-300 tracking-wide">
                      {armed ? 'PROTOCOL ACTIVE — EVACUATION UNDERWAY' : 'SYSTEM ARMED & MONITORING'}
                    </span>
                  </div>
                  <span className="flex items-center gap-1.5 text-[9px] font-mono">
                    <Radio className="w-3 h-3 text-red-400 animate-pulse" />
                    <span className="text-red-400">REC</span>
                  </span>
                </div>

                <div className="space-y-2">
                  {CHECKLIST.map((step, i) => (
                    <motion.div
                      key={step}
                      className="flex items-start gap-2.5 px-3 py-2 rounded-lg"
                      style={{ background: i < visibleSteps ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                      initial={{ opacity: 0, x: -14 }}
                      animate={{ opacity: i < visibleSteps ? 1 : 0.35, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      {i < visibleSteps
                        ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400 mt-0.5" />
                        : <BellRing className="w-3.5 h-3.5 text-slate-600 mt-0.5" />}
                      <span className="text-[11px]" style={{ color: i < visibleSteps ? '#a7f3d0' : '#64748b' }}>
                        {step}
                      </span>
                      {i < visibleSteps && <span className="ml-auto text-[8px] font-mono text-green-500">DONE</span>}
                    </motion.div>
                  ))}
                </div>

                <motion.button
                  className="w-full py-3.5 rounded-xl text-sm font-display font-bold tracking-[0.2em] uppercase"
                  style={{
                    background: armed ? 'linear-gradient(135deg,#dc2626,#b91c1c)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${armed ? '#f87171' : 'rgba(239,68,68,0.5)'}`,
                    color: armed ? '#fff' : '#f87171',
                    boxShadow: armed ? '0 0 30px rgba(239,68,68,0.5)' : 'none',
                  }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setArmed(v => !v)}
                >
                  {armed ? '◼ ABORT & RETURN TO STANDBY' : '▶ ACTIVATE PROTOCOL'}
                </motion.button>

                <p className="text-center text-[8px] font-mono text-slate-600 tracking-widest">
                  SIMULATION MODE · NO ACTUAL SITE SYSTEMS CONNECTED
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
