import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, History, Pause, Play, Radio, SkipBack, SkipForward } from 'lucide-react';
import { useApp } from '../../store/AppContext';

const ARCHIVE_DAYS = 7;

export function playbackDate(position: number): Date {
  const now = Date.now();
  const back = ((100 - position) / 100) * ARCHIVE_DAYS * 24 * 3600000;
  return new Date(now - back);
}

export function PlaybackBar({ expanded = true, onToggle }: { expanded?: boolean; onToggle?: (open: boolean) => void }) {
  const { playback, setPlayback } = useApp();
  const [open, setOpen] = useState(expanded);

  const date = useMemo(() => playbackDate(playback.position), [playback.position]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  };

  return (
    <motion.div
      className="glass-panel overflow-hidden"
      animate={{ width: open ? 460 : 210 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const }}
      style={{ borderColor: playback.enabled ? 'rgba(251,191,36,0.4)' : 'rgba(56,189,248,0.25)', boxShadow: playback.enabled ? '0 0 24px rgba(251,191,36,0.15)' : undefined }}
    >
      <div className="px-3 py-2 flex items-center justify-between cursor-pointer" onClick={toggle}>
        <div className="flex items-center gap-2">
          <History className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[9px] font-display font-bold tracking-[0.22em] text-slate-300">
            HISTORICAL ARCHIVE
          </span>
          {playback.enabled && (
            <span className="text-[8px] font-mono text-amber-400 font-bold animate-pulse">● REPLAY</span>
          )}
        </div>
        <ChevronUp className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? '' : 'rotate-180'}`} />
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-cyan-300">{date.toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            <span className="text-[10px] font-mono text-slate-400">{date.toLocaleTimeString([], { hour12: false })}</span>
            <span className="text-[8px] font-mono text-slate-600">7-DAY WINDOW</span>
          </div>

          <input
            type="range"
            min={0}
            max={100}
            value={playback.position}
            disabled={!playback.enabled}
            onChange={(e) => setPlayback({ position: Number(e.target.value) })}
            className="w-full cursor-pointer disabled:opacity-30"
          />

          <div className="flex items-center gap-1.5">
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-display font-bold tracking-widest transition-colors"
              style={{ background: playback.enabled ? 'rgba(251,191,36,0.15)' : 'rgba(34,211,238,0.12)', border: `1px solid ${playback.enabled ? 'rgba(251,191,36,0.4)' : 'rgba(34,211,238,0.3)'}`, color: playback.enabled ? '#fcd34d' : '#67e8f9' }}
              onClick={() => setPlayback({ enabled: !playback.enabled, playing: playback.enabled ? false : true })}
            >
              <Radio className="w-3 h-3" />
              {playback.enabled ? 'LIVE MODE' : 'REPLAY MODE'}
            </button>
            {playback.enabled && (
              <>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-slate-300 transition-colors" onClick={() => setPlayback({ position: 0 })}>
                  <SkipBack className="w-3.5 h-3.5" />
                </button>
                <button
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: 'rgba(251,191,36,0.2)', color: '#fcd34d' }}
                  onClick={() => setPlayback({ playing: !playback.playing })}
                >
                  {playback.playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-slate-300 transition-colors" onClick={() => setPlayback({ position: 100 })}>
                  <SkipForward className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
