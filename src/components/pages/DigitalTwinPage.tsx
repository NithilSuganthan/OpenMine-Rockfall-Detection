import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Box, Crosshair, Eye, EyeOff, Layers, Maximize2,
  Plane, Target, X,
} from 'lucide-react';
import { MineScene } from '../three/MineScene';
import { PlaybackBar } from '../ui/PlaybackBar';
import { useApp } from '../../store/AppContext';
import { usePrediction } from '../../hooks/usePrediction';
import { statusColors, getRiskColor, getRiskLabel, scoreToRisk, tierColors, tierLabels } from '../../utils/helpers';

export function DigitalTwinPage() {
  const {
    heatmapVisible, toggleHeatmap, droneMode, toggleDroneMode,
    playback, clearSelection, sensors, zones, selectedSensor,
  } = useApp();
  const { prediction } = usePrediction();

  const online = sensors.filter(s => s.status !== 'offline').length;
  const maxZone = [...zones].sort((a, b) => b.currentRisk - a.currentRisk)[0];
  const overallRisk = prediction ? scoreToRisk(prediction.score) : maxZone?.currentRisk ?? 0;
  const riskLabel = prediction ? tierLabels[prediction.tier].toUpperCase() : getRiskLabel(overallRisk).toUpperCase();
  const riskColor = prediction ? tierColors[prediction.tier] : getRiskColor(overallRisk);

  return (
    <div className="relative w-full h-full">
      <MineScene />

      {/* OVERALL RISK LEVEL - Top Left Overlay */}
      <motion.div
        className="absolute top-4 left-4 z-20"
        initial={{ opacity: 0, x: -18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div
          className="glass-panel px-4 py-3 hud-corners"
          style={{ borderColor: overallRisk >= 65 ? 'rgba(249,115,22,0.4)' : 'rgba(56,189,248,0.25)' }}
        >
          <div className="text-[8px] font-display font-bold tracking-[0.25em] text-slate-400 uppercase mb-1">
            Overall Risk Level
          </div>
          <div
            className="text-[28px] font-display font-bold leading-none mb-1"
            style={{
              color: riskColor,
              textShadow: `0 0 20px ${riskColor}66`,
            }}
          >
            {riskLabel}
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3 h-3" style={{ color: riskColor }} />
            <span className="text-[10px] font-mono text-slate-300">
              Risk Score <span className="font-bold text-slate-100">{overallRisk}</span> / 100
            </span>
          </div>
        </div>
      </motion.div>

      {/* Map Controls - Left Side */}
      <motion.div
        className="absolute top-[140px] left-4 z-20 flex flex-col gap-1.5"
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.45 }}
      >
        <MapControlBtn icon={<Box className="w-3.5 h-3.5" />} label="3D" active />
        <div className="text-[8px] text-slate-500 text-center font-mono">2D</div>
        <div className="w-px h-2 bg-white/10 mx-auto" />
        <MapControlBtn icon={<Target className="w-3.5 h-3.5" />} label="" />
        <MapControlBtn icon={<Crosshair className="w-3.5 h-3.5" />} label="" onClick={clearSelection} />
      </motion.div>

      {/* Controls - Right Side */}
      <motion.div
        className="absolute top-4 right-4 z-20 flex flex-col gap-1.5"
        initial={{ opacity: 0, x: 18 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.45 }}
      >
        <ControlButton
          icon={heatmapVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          label="Risk Heatmap"
          active={heatmapVisible}
          onClick={toggleHeatmap}
        />
        <ControlButton
          icon={<Plane className="w-3.5 h-3.5" />}
          label="Drone Overlay"
          active={droneMode}
          onClick={toggleDroneMode}
        />
        <ControlButton
          icon={<Maximize2 className="w-3.5 h-3.5" />}
          label="Fullscreen"
          onClick={() => document.documentElement.requestFullscreen?.()}
        />
      </motion.div>

      {/* Selected Sensor Popup on Map */}
      {selectedSensor && (
        <SensorPopup sensor={selectedSensor} onClose={clearSelection} />
      )}

      {/* Bottom Legend */}
      <motion.div
        className="absolute bottom-4 left-4 z-20 flex items-center gap-2"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
      >
        {(['safe', 'warning', 'high-risk', 'critical', 'offline'] as const).map(s => (
          <div key={s} className="flex items-center gap-1.5 px-2 py-1 rounded-md"
            style={{ background: 'rgba(13,20,34,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="w-2 h-2 rounded-full" style={{ background: statusColors[s], boxShadow: `0 0 6px ${statusColors[s]}` }} />
            <span className="text-[8px] font-mono text-slate-400 capitalize">{s.replace('-', ' ')}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md"
          style={{ background: 'rgba(13,20,34,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="w-4 h-0 border-t border-cyan-400" />
          <span className="text-[8px] font-mono text-slate-400">Active Link</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md"
          style={{ background: 'rgba(13,20,34,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <span className="w-4 h-0 border-t border-dashed border-amber-400" />
          <span className="text-[8px] font-mono text-slate-400">Rerouted Link</span>
        </div>
      </motion.div>

      {/* Bottom Center: Playback Bar */}
      <div className="absolute bottom-4 right-4 z-20">
        <PlaybackBar />
      </div>
    </div>
  );
}

/* ─── Sensor Popup (floating card on the 3D map) ─── */
function SensorPopup({ sensor, onClose }: { sensor: any; onClose: () => void }) {
  const riskColor = getRiskColor(sensor.riskScore);
  const riskLabel = getRiskLabel(sensor.riskScore);

  return (
    <motion.div
      className="absolute z-30 glass-panel p-3"
      style={{
        top: '35%',
        left: '52%',
        borderColor: `${riskColor}50`,
        minWidth: 180,
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[8px] text-slate-500 font-mono">Node ID: {sensor.id}</div>
          <div className="text-[10px] font-bold" style={{ color: riskColor }}>{riskLabel} Risk</div>
        </div>
        <button onClick={onClose} className="w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 text-slate-400">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-1 text-[9px] font-mono">
        <div className="flex justify-between">
          <span className="text-slate-400">Risk Score:</span>
          <span className="font-bold" style={{ color: riskColor }}>{Math.round(sensor.riskScore)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Trend:</span>
          <span className="font-bold text-red-400">Increasing ↗</span>
        </div>
      </div>
      <button
        className="w-full mt-2 py-1.5 rounded-lg text-[9px] font-display font-bold tracking-wider text-center"
        style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.35)', color: '#67e8f9' }}
      >
        View Details
      </button>
    </motion.div>
  );
}

function ControlButton({ icon, label, active, onClick, pulse }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void; pulse?: boolean;
}) {
  return (
    <motion.button
      className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 group relative"
      style={{
        background: active ? 'rgba(34,211,238,0.14)' : 'rgba(13,20,34,0.75)',
        border: `1px solid ${active ? 'rgba(34,211,238,0.5)' : 'rgba(56,189,248,0.2)'}`,
        color: active ? '#22d3ee' : '#94a3b8',
        boxShadow: active ? '0 0 12px rgba(34,211,238,0.2)' : 'none',
        backdropFilter: 'blur(10px)',
      }}
      onClick={onClick}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.93 }}
    >
      {icon}
      <div className="absolute right-11 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
        <div className="glass-panel px-2 py-0.5 whitespace-nowrap">
          <span className="text-[8px] text-slate-200">{label}</span>
        </div>
      </div>
    </motion.button>
  );
}

function MapControlBtn({ icon, label, active, onClick }: {
  icon: React.ReactNode; label?: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
      style={{
        background: active ? 'rgba(34,211,238,0.15)' : 'rgba(13,20,34,0.7)',
        border: `1px solid ${active ? 'rgba(34,211,238,0.4)' : 'rgba(255,255,255,0.08)'}`,
        color: active ? '#22d3ee' : '#94a3b8',
      }}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
