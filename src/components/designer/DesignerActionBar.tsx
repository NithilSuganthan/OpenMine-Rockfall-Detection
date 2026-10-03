import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircle, Download, Eye, Play, RotateCcw, Save, Send, TriangleAlert,
} from 'lucide-react';
import { useDesigner } from '../../store/designerStore';
import { useApp } from '../../store/AppContext';

export function DesignerActionBar() {
  const objects = useDesigner(s => s.objects);
  const links = useDesigner(s => s.links);
  const validation = useDesigner(s => s.validation);
  const preview = useDesigner(s => s.preview);
  const lastSaved = useDesigner(s => s.lastSaved);
  const statusMessage = useDesigner(s => s.statusMessage);
  const saveLayout = useDesigner(s => s.saveLayout);
  const validate = useDesigner(s => s.validate);
  const togglePreview = useDesigner(s => s.togglePreview);
  const resetLayout = useDesigner(s => s.resetLayout);
  const exportJson = useDesigner(s => s.exportJson);
  const deployToTwin = useDesigner(s => s.deployToTwin);
  const { setCurrentPage } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);

  const errors = validation?.errorCount ?? 0;
  const score = validation?.score;

  const onDeploy = () => {
    deployToTwin();
    setTimeout(() => setCurrentPage('digital-twin'), 650);
  };

  return (
    <motion.div
      className="shrink-0 h-[46px] flex items-center gap-3 px-3 z-40"
      style={{
        background: 'rgba(8,13,22,0.92)',
        backdropFilter: 'blur(18px)',
        borderTop: '1px solid rgba(56,189,248,0.14)',
      }}
      initial={{ y: 46, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] as const }}
    >
      {/* Status */}
      <div className="flex items-center gap-3 min-w-0">
        <Stat label="OBJECTS" value={String(objects.length)} />
        <Stat label="LINKS" value={String(links.length)} />
        {score !== undefined && (
          <Stat
            label="COVERAGE"
            value={`${score}%`}
            color={errors > 0 ? '#f59e0b' : '#22c55e'}
          />
        )}
        <div className="w-px h-5 bg-white/[0.07]" />
        <AnimatePresence mode="wait">
          <motion.div
            key={statusMessage ? String(statusMessage.at) : 'none'}
            className="text-[8.5px] font-mono truncate max-w-[260px]"
            style={{ color: statusMessage?.kind === 'error' ? '#f87171' : statusMessage?.kind === 'warning' ? '#fbbf24' : statusMessage?.kind === 'success' ? '#4ade80' : '#64748b' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {statusMessage?.text ?? (lastSaved ? `Saved ${new Date(lastSaved).toLocaleTimeString('en-US', { hour12: false })}` : 'Unsaved draft')}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <BarButton icon={<Save className="w-3 h-3" />} label="Save Layout" onClick={saveLayout} />
        <BarButton
          icon={errors > 0 ? <TriangleAlert className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
          label="Validate"
          accent={errors > 0 ? 'orange' : 'cyan'}
          onClick={validate}
        />
        <BarButton
          icon={preview ? <Eye className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          label={preview ? 'Stop Preview' : 'Preview'}
          active={preview}
          onClick={togglePreview}
        />
        <div className="relative">
          <BarButton
            icon={<RotateCcw className="w-3 h-3" />}
            label="Reset"
            danger={confirmReset}
            onClick={() => {
              if (confirmReset) {
                resetLayout();
                setConfirmReset(false);
              } else {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 2600);
              }
            }}
          />
          <AnimatePresence>
            {confirmReset && (
              <motion.div
                className="absolute bottom-10 left-0 glass-panel px-3 py-2 whitespace-nowrap z-50"
                style={{ borderColor: 'rgba(239,68,68,0.4)' }}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <span className="text-[8.5px] font-mono text-red-300">Click again to reset to reference plan</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <BarButton icon={<Download className="w-3 h-3" />} label="Export JSON" onClick={exportJson} />
        <div className="w-px h-5 bg-white/[0.07] mx-1" />
        <motion.button
          className="relative flex items-center gap-2 rounded-lg px-4 py-1.5 text-[10px] font-display font-bold tracking-[0.12em] uppercase"
          style={{
            background: 'linear-gradient(135deg, rgba(34,211,238,0.9), rgba(37,99,235,0.9))',
            border: '1px solid rgba(103,232,249,0.5)',
            color: '#ffffff',
            boxShadow: '0 0 22px rgba(34,211,238,0.35)',
          }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onDeploy}
        >
          {errors > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center animate-pulse">
              {errors}
            </span>
          )}
          <Send className="w-3.5 h-3.5" />
          Deploy to Digital Twin
        </motion.button>
      </div>
    </motion.div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[7.5px] font-mono tracking-[0.15em] text-slate-500">{label}</span>
      <span className="text-[10px] font-mono font-bold tabular-nums" style={{ color: color ?? '#dbe4f0' }}>
        {value}
      </span>
    </div>
  );
}

function BarButton({ icon, label, onClick, active, accent, danger }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  accent?: 'cyan' | 'orange';
  danger?: boolean;
}) {
  const color = danger ? '#ef4444' : active ? '#22d3ee' : accent === 'orange' ? '#fb923c' : accent === 'cyan' ? '#38bdf8' : '#94a3b8';
  return (
    <motion.button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[9px] font-display font-bold tracking-wider transition-all duration-150"
      style={{
        background: active || accent ? `${color}14` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${active || accent || danger ? color + '55' : 'rgba(255,255,255,0.1)'}`,
        color,
      }}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.95 }}
    >
      {icon}
      {label}
    </motion.button>
  );
}
