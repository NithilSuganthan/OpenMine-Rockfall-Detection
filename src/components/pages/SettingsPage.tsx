import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, Cpu, Database, Globe, Key, RefreshCw, Save, ShieldAlert, Sliders, User, Wifi
} from 'lucide-react';
import { useApp } from '../../store/AppContext';

export function SettingsPage() {
  const { refreshRate, setRefreshRate, autoRotate, setAutoRotate, showZoneLabels, setShowZoneLabels } = useApp();

  const [mineName, setMineName] = useState('Shivneri Open Pit Mine');
  const [operator, setOperator] = useState('Control Room Alpha');
  const [tiltThreshold, setTiltThreshold] = useState(8.0);
  const [vibrThreshold, setVibrThreshold] = useState(4.0);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="relative w-full h-full p-4 flex flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between glass-panel p-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-display font-bold text-slate-100 tracking-wide">
              SYSTEM CONFIGURATION & THRESHOLDS
            </h1>
            <p className="text-[10px] font-mono text-slate-400">
              Operational parameters, AI engine sensitivity, telemetry frequency & notification rules
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          className="glass-panel px-4 py-2 text-[10px] font-display font-bold text-emerald-300 hover:bg-emerald-500/20 transition-all flex items-center gap-2 border border-emerald-500/40 glow-green"
        >
          <Save className="w-4 h-4 text-emerald-400" />
          {saved ? 'SETTINGS SAVED!' : 'SAVE CONFIGURATION'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Mine & Operator Profile */}
        <div className="glass-panel p-4 flex flex-col gap-3">
          <div className="text-[11px] font-display font-bold tracking-widest text-slate-200 border-b border-white/[0.08] pb-2 flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-400" />
            MINE SITE & OPERATOR IDENTITY
          </div>

          <div className="space-y-3 text-[10px] font-mono">
            <div>
              <label className="text-slate-400 block mb-1">MINE SITE NAME</label>
              <input
                type="text"
                value={mineName}
                onChange={e => setMineName(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-cyan-300 px-3 py-1.5 rounded focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="text-slate-400 block mb-1">ACTIVE OPERATOR / CONTROL ROOM ID</label>
              <input
                type="text"
                value={operator}
                onChange={e => setOperator(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 px-3 py-1.5 rounded focus:border-cyan-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-slate-400 block mb-1">LATITUDE</label>
                <input type="text" value="24.3094° N" disabled className="w-full bg-slate-900/50 border border-slate-800 text-slate-400 px-3 py-1.5 rounded" />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">LONGITUDE</label>
                <input type="text" value="73.6812° E" disabled className="w-full bg-slate-900/50 border border-slate-800 text-slate-400 px-3 py-1.5 rounded" />
              </div>
            </div>
          </div>
        </div>

        {/* AI & Alert Sensitivity Thresholds */}
        <div className="glass-panel p-4 flex flex-col gap-3">
          <div className="text-[11px] font-display font-bold tracking-widest text-slate-200 border-b border-white/[0.08] pb-2 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-purple-400" />
            AI PREDICTION THRESHOLDS
          </div>

          <div className="space-y-4 text-[10px] font-mono">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>CRITICAL TILT THRESHOLD</span>
                <span className="text-red-400 font-bold">{tiltThreshold}°</span>
              </div>
              <input
                type="range"
                min={3}
                max={15}
                step={0.5}
                value={tiltThreshold}
                onChange={e => setTiltThreshold(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>CRITICAL VIBRATION THRESHOLD</span>
                <span className="text-amber-400 font-bold">{vibrThreshold} mm/s</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={0.5}
                value={vibrThreshold}
                onChange={e => setVibrThreshold(Number(e.target.value))}
                className="w-full cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Telemetry Refresh Rate */}
        <div className="glass-panel p-4 flex flex-col gap-3">
          <div className="text-[11px] font-display font-bold tracking-widest text-slate-200 border-b border-white/[0.08] pb-2 flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-cyan-400" />
            TELEMETRY POLLING FREQUENCY
          </div>

          <div className="flex gap-2">
            {[
              { label: '500 ms (ULTRA)', value: 500 },
              { label: '1 sec (HIGH)', value: 1000 },
              { label: '2 sec (NORMAL)', value: 2000 },
              { label: '5 sec (ECO)', value: 5000 },
            ].map(item => (
              <button
                key={item.value}
                onClick={() => setRefreshRate(item.value)}
                className={`flex-1 py-2 px-2 rounded text-[9px] font-display font-bold transition-all ${
                  refreshRate === item.value
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 glow-blue'
                    : 'glass-panel-subtle text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 3D Scene Viewport Controls */}
        <div className="glass-panel p-4 flex flex-col gap-3">
          <div className="text-[11px] font-display font-bold tracking-widest text-slate-200 border-b border-white/[0.08] pb-2 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            3D DIGITAL TWIN RENDERER
          </div>

          <div className="space-y-2 text-[10px] font-mono">
            <label className="flex items-center justify-between cursor-pointer glass-panel-subtle p-2">
              <span className="text-slate-300">AUTO-ROTATE 3D CANVAS</span>
              <input
                type="checkbox"
                checked={autoRotate}
                onChange={e => setAutoRotate(e.target.checked)}
                className="w-4 h-4 text-cyan-500 rounded"
              />
            </label>

            <label className="flex items-center justify-between cursor-pointer glass-panel-subtle p-2">
              <span className="text-slate-300">SHOW RISK ZONE OVERLAY LABELS</span>
              <input
                type="checkbox"
                checked={showZoneLabels}
                onChange={e => setShowZoneLabels(e.target.checked)}
                className="w-4 h-4 text-cyan-500 rounded"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
