import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, BrainCircuit, Cloud, CloudRain, Siren, Sparkles, User, Wifi,
} from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { usePrediction } from '../../hooks/usePrediction';
import { WEATHER } from '../../data/mockData';
import { tierColors } from '../../utils/helpers';

export function TopBar() {
  const { connection, aiStatus, emergencyOpen, setEmergencyOpen, alerts, requestPrediction } = useApp();
  const { prediction } = usePrediction();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const criticalAlerts = alerts.filter(a => a.type === 'critical' && !a.resolved).length;

  return (
    <motion.header
      className="h-[48px] shrink-0 flex items-center justify-between px-3 relative z-50"
      style={{
        background: 'rgba(8,13,22,0.92)',
        backdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(56,189,248,0.14)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
      }}
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] as const }}
    >
      {/* Left: Logo + Brand */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2">
          <div className="relative">
            <div className="w-8 h-8 rounded-[10px] flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(34,211,238,0.9), rgba(37,99,235,0.9))', boxShadow: '0 0 18px rgba(34,211,238,0.45)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 L22 7 V17 L12 22 L2 17 V7 Z" stroke="white" strokeWidth="1.6" fill="rgba(255,255,255,0.12)" />
                <circle cx="12" cy="12" r="2.6" fill="white" />
              </svg>
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-400 animate-ping" style={{ boxShadow: '0 0 8px #22c55e' }} />
          </div>
          <div className="leading-none">
            <div className="text-[13px] font-bold tracking-wide font-display">
              ROCK SENTINEL AI
            </div>
            <div className="text-[7.5px] text-cyan-400/80 font-mono tracking-[0.28em] uppercase mt-0.5">
              Digital Twin Platform
            </div>
          </div>
        </div>

        <div className="w-px h-7 bg-white/10 mx-1" />

        {/* Info Cells */}
        <InfoCell label="Mine Name" value="Shivneri Open Pit Mine" />
        <div className="w-px h-7 bg-white/[0.06]" />
        <InfoCell label="Date & Time" value={`${now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} | ${now.toLocaleTimeString('en-US', { hour12: false })}`} />
        <div className="w-px h-7 bg-white/[0.06]" />
        <div className="flex items-center gap-2 px-2.5">
          <span className="text-[8px] font-mono text-slate-500 tracking-wider">Weather</span>
          <CloudRain className="w-3.5 h-3.5 text-sky-400" />
          <span className="text-[11px] font-mono text-slate-200">{WEATHER.temperature.toFixed(0)}°C</span>
          <span className="text-[9px] text-slate-400">| Rainy</span>
        </div>
        <div className="w-px h-7 bg-white/[0.06]" />
        <div className="flex items-center gap-2 px-2.5">
          <span className="text-[8px] font-mono text-slate-500 tracking-wider">Connection</span>
          <span className="text-[11px] font-mono font-bold text-green-400">ONLINE</span>
        </div>
        <div className="w-px h-7 bg-white/[0.06]" />
        <div className="flex items-center gap-2 px-2.5">
          <span className="text-[8px] font-mono text-slate-500 tracking-wider">AI Engine</span>
          <BrainCircuit className="w-3.5 h-3.5 text-green-400" />
          <span className="text-[11px] font-mono font-bold text-green-400">ACTIVE</span>
          {prediction && (
            <span className="ml-1 text-[9px] font-mono font-bold uppercase tracking-wider"
              style={{ color: tierColors[prediction.tier] }}>
              {prediction.tier} · {prediction.score.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Right: ML Prediction + Emergency + Operator */}
      <div className="flex items-center gap-3">
        <motion.button
          className="relative flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[10px] font-display font-bold tracking-[0.14em] uppercase"
          style={{
            background: 'rgba(34,211,238,0.12)',
            border: '1px solid rgba(34,211,238,0.4)',
            color: '#67e8f9',
          }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => void requestPrediction()}
        >
          <Sparkles className="w-3.5 h-3.5" />
          RUN PREDICTION
        </motion.button>
        <motion.button
          className="relative flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-[10px] font-display font-bold tracking-[0.14em] uppercase"
          style={{
            background: 'rgba(239,68,68,0.2)',
            border: '1px solid rgba(239,68,68,0.5)',
            color: '#f87171',
            boxShadow: '0 0 20px rgba(239,68,68,0.3)',
          }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => setEmergencyOpen(true)}
        >
          {criticalAlerts > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center animate-pulse">
              {criticalAlerts}
            </span>
          )}
          <Siren className="w-3.5 h-3.5 animate-blink" />
          EMERGENCY
        </motion.button>

        <div className="w-px h-7 bg-white/[0.06]" />

        <div className="flex items-center gap-2 px-2">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <div className="leading-none">
            <span className="text-[8px] font-mono text-slate-500 tracking-wider">Operator</span>
            <div className="text-[10px] text-slate-300">Control Room</div>
          </div>
        </div>
      </div>
    </motion.header>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-2.5">
      <span className="text-[8px] font-mono text-slate-500 tracking-wider">{label}</span>
      <span className="text-[11px] font-mono text-slate-200">{value}</span>
    </div>
  );
}
