import { useState } from 'react';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts';
import { Calendar, Download, Filter, History, Play, Search, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ANALYTICS, SENSORS } from '../../data/mockData';
import { useApp } from '../../store/AppContext';

const TIME_RANGES = ['24 Hours', '7 Days', '30 Days', '90 Days'] as const;

export function HistoricalPage() {
  const [range, setRange] = useState<typeof TIME_RANGES[number]>('7 Days');
  const [selectedSensorId, setSelectedSensorId] = useState('SN-004');
  const { setPlayback } = useApp();

  const sensor = SENSORS.find(s => s.id === selectedSensorId) || SENSORS[0];

  return (
    <div className="relative w-full h-full p-4 flex flex-col gap-4 overflow-y-auto">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between glass-panel p-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-display font-bold text-slate-100 tracking-wide">
              HISTORICAL TELEMETRY & INCIDENT ARCHIVE
            </h1>
            <p className="text-[10px] font-mono text-slate-400">
              Retroactive slope movement analysis, seismic trends, and AI alert validation log
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex glass-panel p-1 gap-1">
            {TIME_RANGES.map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 rounded text-[9.5px] font-display font-bold transition-all ${
                  range === r ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          <button className="glass-panel px-3 py-1.5 text-[10px] font-display font-bold text-slate-300 hover:text-white flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            EXPORT RECORD (CSV)
          </button>
        </div>
      </div>

      {/* Main Charts & Incident History Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Risk Trend Chart */}
        <div className="col-span-2 glass-panel p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
            <span className="text-[11px] font-display font-bold tracking-widest text-slate-200">
              HISTORICAL RISK TREND & SLOPE DISPLACEMENT
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-slate-400">SENSOR:</span>
              <select
                value={selectedSensorId}
                onChange={e => setSelectedSensorId(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-cyan-300 text-[10px] font-mono px-2 py-0.5 rounded"
              >
                {SENSORS.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.id} — {s.zone} ({s.status.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ANALYTICS.dailyRisk}>
                <defs>
                  <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" stroke="#64748b" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10, fontFamily: 'monospace' }} />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(10,16,28,0.95)',
                    border: '1px solid rgba(56,189,248,0.25)',
                    borderRadius: 8,
                    fontSize: 10,
                    color: '#e2e8f0',
                  }}
                />
                <Area type="monotone" dataKey="east" name="East Bench Risk" stroke="#f97316" strokeWidth={2} fill="url(#histGrad)" />
                <Area type="monotone" dataKey="north" name="North Slope Risk" stroke="#ef4444" strokeWidth={1.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Selected Sensor Quick Telemetry Summary */}
        <div className="glass-panel p-4 flex flex-col gap-3">
          <div className="text-[11px] font-display font-bold tracking-widest text-slate-200 border-b border-white/[0.08] pb-2">
            TELEMETRY RECAP — {sensor.id}
          </div>

          <div className="space-y-2 text-[10px] font-mono">
            <div className="flex justify-between glass-panel-subtle p-2">
              <span className="text-slate-400">ZONE:</span>
              <span className="text-slate-200 font-bold">{sensor.zone}</span>
            </div>
            <div className="flex justify-between glass-panel-subtle p-2">
              <span className="text-slate-400">CURRENT TILT:</span>
              <span className="text-cyan-300 font-bold">{sensor.tilt}°</span>
            </div>
            <div className="flex justify-between glass-panel-subtle p-2">
              <span className="text-slate-400">VIBRATION:</span>
              <span className="text-amber-400 font-bold">{sensor.vibration} mm/s</span>
            </div>
            <div className="flex justify-between glass-panel-subtle p-2">
              <span className="text-slate-400">MOISTURE:</span>
              <span className="text-purple-400 font-bold">{sensor.moisture}%</span>
            </div>
            <div className="flex justify-between glass-panel-subtle p-2">
              <span className="text-slate-400">HISTORICAL PEAK RISK:</span>
              <span className="text-red-400 font-bold">{sensor.riskScore}%</span>
            </div>
          </div>

          <button
            onClick={() => setPlayback({ enabled: true, position: 20, playing: true })}
            className="w-full mt-auto glass-panel py-2 px-3 text-[10px] font-display font-bold text-amber-300 hover:bg-amber-500/10 transition-colors flex items-center justify-center gap-2 border border-amber-500/30"
          >
            <Play className="w-3.5 h-3.5 text-amber-400" />
            REPLAY INCIDENT WINDOW
          </button>
        </div>
      </div>

      {/* Rockfall Incident Log Table */}
      <div className="glass-panel p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
          <span className="text-[11px] font-display font-bold tracking-widest text-slate-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            PAST ROCKFALL & SLOPE INSTABILITY EVENTS
          </span>
          <span className="text-[9px] font-mono text-slate-400">6 RECORDED INCIDENTS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[10px] font-mono">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="pb-2">DATE</th>
                <th className="pb-2">LOCATION</th>
                <th className="pb-2">SEVERITY</th>
                <th className="pb-2">AI PREDICTED</th>
                <th className="pb-2">CONFIDENCE</th>
                <th className="pb-2">LEAD TIME</th>
                <th className="pb-2 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {ANALYTICS.failureHistory.map((item, idx) => (
                <tr key={idx} className="hover:bg-white/[0.02]">
                  <td className="py-2 text-slate-300">{item.date}</td>
                  <td className="py-2 text-cyan-300">{item.location}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-[8.5px] font-bold ${
                      item.severity === 'Major' ? 'bg-red-500/20 text-red-400 border border-red-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}>
                      {item.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-2">
                    {item.predicted ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> YES
                      </span>
                    ) : (
                      <span className="text-slate-500">NO</span>
                    )}
                  </td>
                  <td className="py-2 text-slate-300">{item.confidence}%</td>
                  <td className="py-2 text-slate-300">{item.hoursAhead} hrs</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => setPlayback({ enabled: true, position: (idx + 1) * 15, playing: true })}
                      className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-display font-bold"
                    >
                      REPLAY
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
