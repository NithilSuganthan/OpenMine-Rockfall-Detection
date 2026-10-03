import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, Layers } from 'lucide-react';
import { MineScene } from '../three/MineScene';
import { useApp } from '../../store/AppContext';
import { usePrediction } from '../../hooks/usePrediction';
import { riskColorGradient, scoreToRisk } from '../../utils/helpers';

const LEGEND = [
  { label: 'CRITICAL', min: 85, color: '#ef4444' },
  { label: 'HIGH', min: 65, color: '#f97316' },
  { label: 'WARNING', min: 45, color: '#eab308' },
  { label: 'SAFE', min: 0, color: '#22c55e' },
];

export function RiskHeatmapPage() {
  const { heatmapVisible, toggleHeatmap, zones, selectZone, setCurrentPage } = useApp();
  const { prediction } = usePrediction();
  const heatRisk = prediction ? scoreToRisk(prediction.score) : null;

  useEffect(() => {
    if (!heatmapVisible) toggleHeatmap();
  }, []);

  return (
    <div className="relative w-full h-full">
      <MineScene />

      <motion.div
        className="absolute top-4 left-4 z-20"
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="glass-panel px-4 py-3 glow-orange hud-corners">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-orange-400" />
            <h2 className="text-[10px] font-display font-bold tracking-[0.22em] text-slate-200">
              RISK HEATMAP LAYER
            </h2>
            <span className="text-[8px] font-mono text-orange-400 animate-pulse font-bold">● INTERPOLATING</span>
          </div>
          <p className="text-[9.5px] text-slate-500 leading-relaxed max-w-[280px]">
            AI-interpolated geological stability matrix — fracture density, tension, and
            hydrology-weighted index over 62 m pit envelope.
          </p>
        </div>
      </motion.div>

      <motion.div
        className="absolute top-4 right-4 z-20"
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
      >
        <div className="glass-panel px-4 py-3">
          <div className="text-[8px] font-display font-bold tracking-[0.25em] text-slate-500 mb-2">
            SEVERITY INDEX
          </div>
          <div className="space-y-1.5">
            {LEGEND.map(l => (
              <div key={l.label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-[3px]" style={{ background: l.color, boxShadow: `0 0 8px ${l.color}` }} />
                <span className="text-[9.5px] font-mono text-slate-400">{l.label} &gt; {l.min}%</span>
              </div>
            ))}
          </div>
          <button
            className="mt-3 w-full py-1.5 rounded-lg text-[9px] font-display font-bold tracking-widest transition-colors"
            style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.4)', color: '#fb923c' }}
            onClick={toggleHeatmap}
          >
            {heatmapVisible ? 'HIDE LAYER' : 'SHOW LAYER'}
          </button>
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-4 left-4 right-4 z-20 grid grid-cols-4 gap-3"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {zones.map((zone, i) => {
          const color = riskColorGradient(heatRisk ?? zone.currentRisk);
          return (
            <motion.button
              key={zone.id}
              className="glass-panel px-3.5 py-3 text-left transition-transform hover:scale-[1.02]"
              style={{ borderLeft: `2px solid ${color}`, boxShadow: `0 0 18px ${color}1c` }}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 + i * 0.08 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                selectZone(zone.id);
                setCurrentPage('digital-twin');
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-display font-bold tracking-wide text-slate-200 truncate mr-2">
                  {zone.shortName}
                </span>
                <span className="flex items-center gap-1 text-[12px] font-mono font-bold" style={{ color }}>
                  <Flame className="w-3 h-3" />
                  {heatRisk ?? zone.currentRisk}%
                </span>
              </div>
              <div className="h-[5px] rounded-full w-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                  initial={{ width: 0 }}
                  animate={{ width: `${heatRisk ?? zone.currentRisk}%` }}
                  transition={{ duration: 1, delay: 0.7 + i * 0.1 }}
                />
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-[8px] font-mono text-slate-500">
                <span>TILT {Math.round(zone.contributingFactors.tilt * 100)}%</span>
                <span>RAIN {Math.round(zone.contributingFactors.rain * 100)}%</span>
                <span>CRACK {Math.round(zone.contributingFactors.crackGrowth * 100)}%</span>
                <span>VIB {Math.round(zone.contributingFactors.vibration * 100)}%</span>
              </div>
            </motion.button>
          );
        })}
      </motion.div>
    </div>
  );
}
