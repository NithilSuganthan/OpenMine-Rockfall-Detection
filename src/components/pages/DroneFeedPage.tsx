import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Battery, Camera, Compass, Crosshair, Eye, EyeOff, Film, Maximize2,
  Navigation, Plane, Play, Power, RefreshCw, ShieldAlert, Wifi, Zap
} from 'lucide-react';
import { useApp } from '../../store/AppContext';

export function DroneFeedPage() {
  const { drone, selectDrone } = useApp();
  const [thermalMode, setThermalMode] = useState(false);
  const [lidarMode, setLidarMode] = useState(false);
  const [recording, setRecording] = useState(true);
  const [pitch, setPitch] = useState(4.2);
  const [roll, setRoll] = useState(-1.8);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    selectDrone();
  }, [selectDrone]);

  // Simulate hud movement
  useEffect(() => {
    const iv = setInterval(() => {
      setPitch(p => +(p + (Math.random() - 0.5) * 0.4).toFixed(1));
      setRoll(r => +(r + (Math.random() - 0.5) * 0.5).toFixed(1));
    }, 400);
    return () => clearInterval(iv);
  }, []);

  // Draw simulated drone camera view canvas
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let frame = 0;

    const render = () => {
      frame++;
      const w = cvs.width;
      const h = cvs.height;

      // Fill background (Dark pit camera feed or Thermal)
      if (thermalMode) {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 40, w / 2, h / 2, w / 1.2);
        grad.addColorStop(0, '#f97316');
        grad.addColorStop(0.3, '#7c3aed');
        grad.addColorStop(0.7, '#1e1b4b');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
      } else {
        const grad = ctx.createRadialGradient(w / 2, h / 2, 50, w / 2, h / 2, w / 1.1);
        grad.addColorStop(0, '#1e293b');
        grad.addColorStop(0.5, '#0f172a');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
      }
      ctx.fillRect(0, 0, w, h);

      // Draw contour pit rings
      ctx.lineWidth = lidarMode ? 2 : 1;
      ctx.strokeStyle = lidarMode ? '#22d3ee' : thermalMode ? '#fb923c' : '#334155';

      for (let i = 1; i <= 6; i++) {
        ctx.beginPath();
        const rx = w / 2 + Math.sin(frame * 0.01 + i) * 10;
        const ry = h / 2 + Math.cos(frame * 0.01 + i) * 5;
        const r = i * 45;
        ctx.ellipse(rx, ry, r * 1.6, r, (roll * Math.PI) / 180, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw high risk hot-spot
      const spotX = w / 2 + 120 + Math.sin(frame * 0.02) * 5;
      const spotY = h / 2 - 40 + Math.cos(frame * 0.02) * 5;
      const spotGrad = ctx.createRadialGradient(spotX, spotY, 5, spotX, spotY, 60);
      spotGrad.addColorStop(0, 'rgba(239, 68, 68, 0.85)');
      spotGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.4)');
      spotGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = spotGrad;
      ctx.beginPath();
      ctx.arc(spotX, spotY, 60, 0, Math.PI * 2);
      ctx.fill();

      // Bounding box target on S-23 area
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(spotX - 35, spotY - 35, 70, 70);
      ctx.fillStyle = '#ef4444';
      ctx.font = '10px monospace';
      ctx.fillText('TARGET: S-23 [CRITICAL DISPLACEMENT]', spotX - 70, spotY - 42);

      // Scanning sweep line
      const sweepY = (frame * 3) % h;
      ctx.strokeStyle = lidarMode ? 'rgba(34, 211, 238, 0.6)' : 'rgba(56, 189, 248, 0.25)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, sweepY);
      ctx.lineTo(w, sweepY);
      ctx.stroke();

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [thermalMode, lidarMode, roll]);

  return (
    <div className="relative w-full h-full p-4 flex gap-4 overflow-hidden">
      {/* Main Camera Feed Center */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="glass-panel relative flex-1 min-h-0 overflow-hidden flex flex-col justify-between p-4 border border-cyan-500/20 glow-blue">
          {/* Canvas Video Surface */}
          <canvas
            ref={canvasRef}
            width={1280}
            height={720}
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          />

          {/* Top HUD Overlay */}
          <div className="relative z-10 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-3">
              <div className="glass-panel px-3 py-1.5 flex items-center gap-2 border border-red-500/40">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-mono font-bold tracking-widest text-red-400">
                  LIVE FEED — {drone.name} [{drone.id}]
                </span>
              </div>
              {recording && (
                <div className="glass-panel px-2.5 py-1 flex items-center gap-1.5">
                  <Film className="w-3 h-3 text-red-400 animate-pulse" />
                  <span className="text-[9px] font-mono text-slate-300">REC 00:14:38</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="glass-panel px-3 py-1.5 text-[10px] font-mono text-cyan-300">
                ALT: <span className="font-bold">{drone.altitude}m</span>
              </div>
              <div className="glass-panel px-3 py-1.5 text-[10px] font-mono text-cyan-300">
                SPD: <span className="font-bold">{drone.speed} m/s</span>
              </div>
              <div className="glass-panel px-3 py-1.5 text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <Battery className="w-3.5 h-3.5" />
                <span>{drone.battery.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Crosshair Center Graphics */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <div className="relative w-48 h-48 border border-cyan-400/30 rounded-full flex items-center justify-center">
              <div className="w-32 h-32 border border-cyan-400/20 rounded-full border-dashed animate-spin" style={{ animationDuration: '20s' }} />
              <div className="absolute w-full h-[1px] bg-cyan-400/40" />
              <div className="absolute h-full w-[1px] bg-cyan-400/40" />
              <Crosshair className="w-6 h-6 text-cyan-400 opacity-80" />
              <span className="absolute bottom-2 text-[8px] font-mono text-cyan-300">
                PITCH: {pitch}° | ROLL: {roll}°
              </span>
            </div>
          </div>

          {/* Bottom HUD Controls */}
          <div className="relative z-10 flex items-center justify-between pointer-events-auto">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setThermalMode(!thermalMode)}
                className={`px-3 py-1.5 rounded-lg text-[9.5px] font-display font-bold tracking-wider transition-all flex items-center gap-1.5 ${
                  thermalMode ? 'bg-orange-500/30 border border-orange-400 text-orange-300 glow-orange' : 'glass-panel text-slate-300 hover:text-white'
                }`}
              >
                <Zap className="w-3 h-3" />
                {thermalMode ? 'THERMAL ON' : 'THERMAL OFF'}
              </button>

              <button
                onClick={() => setLidarMode(!lidarMode)}
                className={`px-3 py-1.5 rounded-lg text-[9.5px] font-display font-bold tracking-wider transition-all flex items-center gap-1.5 ${
                  lidarMode ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-300 glow-blue' : 'glass-panel text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="w-3 h-3" />
                {lidarMode ? 'LiDAR SCAN ON' : 'LiDAR SCAN OFF'}
              </button>

              <button
                onClick={() => setRecording(!recording)}
                className="glass-panel px-3 py-1.5 text-[9.5px] font-display font-bold text-slate-300 hover:text-white flex items-center gap-1.5"
              >
                <Camera className="w-3 h-3 text-red-400" />
                SNAP FRAME
              </button>
            </div>

            <div className="glass-panel px-3 py-1.5 text-[9px] font-mono text-slate-400 flex items-center gap-3">
              <span>LAT: 24.3094° N</span>
              <span>LON: 73.6812° E</span>
              <span>HDG: 042° NE</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Drone Telemetry & Mission Control Panel */}
      <div className="w-80 flex flex-col gap-3 shrink-0">
        <div className="glass-panel p-3.5 space-y-3">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <span className="text-[10px] font-display font-bold tracking-widest text-slate-300 flex items-center gap-1.5">
              <Plane className="w-4 h-4 text-cyan-400" />
              FLIGHT TELEMETRY
            </span>
            <span className="px-2 py-0.5 rounded text-[8px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              MISSION ACTIVE
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
            <div className="glass-panel-subtle p-2">
              <div className="text-[8px] text-slate-400 mb-0.5">MISSION TARGET</div>
              <div className="font-bold text-cyan-300">West Wall (S-23)</div>
            </div>
            <div className="glass-panel-subtle p-2">
              <div className="text-[8px] text-slate-400 mb-0.5">COVERAGE</div>
              <div className="font-bold text-slate-200">{drone.coverageArea}</div>
            </div>
            <div className="glass-panel-subtle p-2">
              <div className="text-[8px] text-slate-400 mb-0.5">PROGRESS</div>
              <div className="font-bold text-emerald-400">{drone.missionProgress.toFixed(0)}%</div>
            </div>
            <div className="glass-panel-subtle p-2">
              <div className="text-[8px] text-slate-400 mb-0.5">UPLINK LATENCY</div>
              <div className="font-bold text-slate-200">18 ms</div>
            </div>
          </div>

          {/* Mission Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[8.5px] font-mono text-slate-400">
              <span>SCAN PASS 3/5</span>
              <span>{drone.missionProgress.toFixed(0)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                style={{ width: `${drone.missionProgress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Action Commands */}
        <div className="glass-panel p-3.5 space-y-2.5 flex-1">
          <div className="text-[10px] font-display font-bold tracking-widest text-slate-300 mb-2">
            AUTONOMOUS CONTROLS
          </div>

          <button className="w-full glass-panel py-2 px-3 text-[10px] font-display font-bold text-cyan-300 hover:bg-cyan-500/10 transition-colors flex items-center justify-between border border-cyan-500/30">
            <span className="flex items-center gap-2">
              <Navigation className="w-3.5 h-3.5 text-cyan-400" />
              FOCUS ON HIGH RISK S-23
            </span>
            <Crosshair className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button className="w-full glass-panel py-2 px-3 text-[10px] font-display font-bold text-slate-300 hover:bg-white/10 transition-colors flex items-center justify-between">
            <span className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
              REROUTE PATROL WAYPOINTS
            </span>
          </button>

          <button className="w-full glass-panel py-2 px-3 text-[10px] font-display font-bold text-amber-300 hover:bg-amber-500/10 transition-colors flex items-center justify-between border border-amber-500/30">
            <span className="flex items-center gap-2">
              <Power className="w-3.5 h-3.5 text-amber-400" />
              RETURN TO BASE (RTH)
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
