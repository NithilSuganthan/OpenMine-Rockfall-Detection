import { motion } from 'framer-motion';
import { Copy, Link2, MousePointer2, Move, RotateCw, Ruler, Trash2 } from 'lucide-react';
import { COMPONENT_ORDER, COMPONENT_SPECS } from '../../data/designerCatalog';
import type { DesignerComponentType, DesignerTool } from '../../data/designerTypes';
import { useDesigner } from '../../store/designerStore';
import { benchLabel } from '../../utils/terrain';

const TOOLS: { id: DesignerTool; label: string; hint: string; icon: React.ReactNode }[] = [
  { id: 'select', label: 'Select', hint: 'Click · double-click to focus', icon: <MousePointer2 className="w-3.5 h-3.5" /> },
  { id: 'move', label: 'Move', hint: 'Click → drag on terrain (G)', icon: <Move className="w-3.5 h-3.5" /> },
  { id: 'rotate', label: 'Rotate', hint: 'Click → drag to aim (R)', icon: <RotateCw className="w-3.5 h-3.5" /> },
  { id: 'connect', label: 'Link Tool', hint: 'Click A → click B', icon: <Link2 className="w-3.5 h-3.5" /> },
  { id: 'measure', label: 'Measure', hint: 'Click two terrain points', icon: <Ruler className="w-3.5 h-3.5" /> },
  { id: 'duplicate', label: 'Duplicate', hint: 'Click an object to copy (D)', icon: <Copy className="w-3.5 h-3.5" /> },
  { id: 'delete', label: 'Delete', hint: 'Click object or link', icon: <Trash2 className="w-3.5 h-3.5" /> },
];

export function DesignerToolbar() {
  const tool = useDesigner(s => s.tool);
  const setTool = useDesigner(s => s.setTool);
  const startDrag = useDesigner(s => s.startDrag);
  const endDrag = useDesigner(s => s.endDrag);
  const objects = useDesigner(s => s.objects);
  const links = useDesigner(s => s.links);

  const activeTool: DesignerTool | null = tool === 'select' || tool === 'connect' || tool === 'measure' || tool === 'duplicate' || tool === 'delete' || tool === 'move' || tool === 'rotate' ? tool : null;

  return (
    <motion.aside
      className="w-[212px] shrink-0 z-40 flex flex-col min-h-0"
      style={{
        background: 'rgba(9,14,24,0.88)',
        backdropFilter: 'blur(18px)',
        borderRight: '1px solid rgba(56,189,248,0.12)',
      }}
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-3">
        {/* Header */}
        <div className="px-1 pb-3">
          <div className="text-[11px] font-display font-bold tracking-[0.18em] text-cyan-300 uppercase">
            Mine Designer
          </div>
          <div className="text-[8px] font-mono text-slate-500 mt-0.5 tracking-wider">
            PRE-DEPLOYMENT PLANNER
          </div>
        </div>

        {/* Components */}
        <div className="px-1 pb-1.5">
          <span className="text-[8px] font-mono tracking-[0.25em] text-slate-500 uppercase font-bold">Components</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {COMPONENT_ORDER.map(type => {
            const spec = COMPONENT_SPECS[type];
            const Icon = spec.icon;
            const isActive = tool === type;
            return (
              <div
                key={type}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', type);
                  e.dataTransfer.effectAllowed = 'copy';
                  startDrag(type);
                }}
                onDragEnd={endDrag}
                onClick={() => setTool(type)}
                className={`relative rounded-lg px-2 py-2 cursor-grab active:cursor-grabbing select-none transition-all duration-200 group ${
                  isActive ? 'ring-1' : 'hover:bg-white/[0.04] hover:-translate-y-0.5'
                } active:scale-95`}
                style={{
                  background: isActive ? `${spec.color}14` : 'rgba(15,23,36,0.55)',
                  border: `1px solid ${isActive ? spec.color + '66' : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: isActive ? `0 0 14px ${spec.color}22` : 'none',
                }}
                title={spec.description}
              >
                <Icon className="w-4 h-4 mb-1" style={{ color: spec.color }} />
                <div className="text-[9px] font-medium text-slate-200 leading-tight">{spec.label}</div>
                <div className="text-[7px] font-mono text-slate-500 mt-0.5">{spec.short}</div>
                {isActive && (
                  <motion.div
                    className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                    style={{ background: spec.color, boxShadow: `0 0 8px ${spec.color}` }}
                    layoutId="designer-tool-indicator"
                    transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Tools */}
        <div className="px-1 pb-1.5 mt-4">
          <span className="text-[8px] font-mono tracking-[0.25em] text-slate-500 uppercase font-bold">Tools</span>
        </div>
        <div className="flex flex-col gap-1">
          {TOOLS.map(t => {
            const isActive = activeTool === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => setTool(t.id)}
                className="relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors duration-200"
                style={{
                  background: isActive ? 'rgba(34,211,238,0.12)' : 'transparent',
                  border: `1px solid ${isActive ? 'rgba(34,211,238,0.35)' : 'transparent'}`,
                  color: isActive ? '#67e8f9' : '#94a3b8',
                }}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
              >
                <span className="shrink-0">{t.icon}</span>
                <span className="flex-1">
                  <span className="block text-[10px] font-medium text-slate-200">{t.label}</span>
                  <span className="block text-[7.5px] font-mono text-slate-500">{t.hint}</span>
                </span>
                {isActive && (
                  <motion.div
                    className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                    style={{ background: '#22d3ee', boxShadow: '0 0 8px rgba(34,211,238,0.8)' }}
                    layoutId="designer-tool-indicator"
                    transition={{ type: 'spring', stiffness: 340, damping: 28 }}
                  />
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Placement hint */}
        {activeTool === null && (
          <div className="mt-4 px-1">
            <div className="glass-panel-subtle px-2.5 py-2">
              <p className="text-[8px] text-slate-400 leading-relaxed">
                Drag a component onto the mine, or pick one to place with a click.
                Select → <b className="text-cyan-300">G</b> move · <b className="text-cyan-300">R</b> rotate · link with the Link Tool.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer stats */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-2.5">
        <div className="flex items-center justify-between text-[9px] font-mono">
          <span className="text-slate-500">OBJECTS</span>
          <span className="text-slate-200 font-bold">{objects.length}</span>
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono mt-1">
          <span className="text-slate-500">LINKS</span>
          <span className="text-slate-200 font-bold">{links.length}</span>
        </div>
        <div className="flex items-center justify-between text-[9px] font-mono mt-1">
          <span className="text-slate-500">GATEWAYS</span>
          <span className="text-cyan-300 font-bold">{objects.filter(o => o.type === 'gateway').length}</span>
        </div>
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <div className="text-[7.5px] font-mono text-slate-600 leading-relaxed">
            {objects.length > 0
              ? `Placed: ${Array.from(new Set(objects.map(o => benchLabel(o.bench)))).slice(0, 3).join(' · ')}`
              : 'No objects placed yet'}
          </div>
        </div>
      </div>
    </motion.aside>
  );
}

export type { DesignerComponentType };
