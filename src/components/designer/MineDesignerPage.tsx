import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Box, Circle, Crosshair, Layers, MousePointerClick, Ruler, Target } from 'lucide-react';
import { DesignerScene } from './DesignerScene';
import { DesignerToolbar } from './DesignerToolbar';
import { AIAssistantPanel } from './AIAssistantPanel';
import { DesignerActionBar } from './DesignerActionBar';
import { PropertiesPanel } from './PropertiesPanel';
import { ValidationPanel } from './ValidationPanel';
import { DeploymentMetrics } from './DeploymentMetrics';
import { useDesigner } from '../../store/designerStore';
import type { ViewPreset } from '../../store/designerStore';
import type { DesignerTool } from '../../data/designerTypes';
import { isPlacementTool, type DesignerComponentType } from '../../data/designerTypes';
import { benchLabel } from '../../utils/terrain';

const VIEW_CYCLE: ViewPreset[] = ['perspective', 'iso', 'top'];

export function MineDesignerPage() {
  // Global keyboard shortcuts (professional CAD layout)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      const s = useDesigner.getState();
      if (e.key === 'Escape') {
        if (s.transform) {
          s.cancelTransform();
          return;
        }
        if (s.linkFromId || s.linkPendingId) {
          s.cancelLinkPending();
          return;
        }
        if (s.measureFrom || s.measurement) {
          s.clearMeasurement();
          return;
        }
        s.setTool('select');
        s.selectObject(null);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (s.selectedId) s.deleteObject(s.selectedId);
        else if (s.linkPendingId) s.removeLink(s.linkPendingId);
      } else if (e.key === 'g' || e.key === 'G') {
        if (s.selectedId) s.startTransform(s.selectedId, 'move');
      } else if (e.key === 'r' || e.key === 'R') {
        if (s.selectedId) s.startTransform(s.selectedId, 'rotate');
      } else if (e.key === 'd' || e.key === 'D') {
        if (s.selectedId) s.duplicateObject(s.selectedId);
      } else if (e.key === 'f' || e.key === 'F') {
        const sel = s.objects.find(o => o.id === s.selectedId);
        if (sel) s.focusOn(sel.position);
      } else if (e.key === 'v' || e.key === 'V') {
        const next = VIEW_CYCLE[(VIEW_CYCLE.indexOf(s.viewPreset?.kind ?? 'perspective') + 1) % VIEW_CYCLE.length];
        s.setViewPreset(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full min-h-0">
      <DesignerToolbar />

      {/* Center viewport column */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <DesignerScene />

          {/* Viewport header hint */}
          <ViewportHint />
          <PropertiesPanel />
          <ValidationPanel />
          <ViewportControls />
          <DeploymentMetrics />
        </div>
        <DesignerActionBar />
      </div>

      <AIAssistantPanel />
    </div>
  );
}

/* ─── Tool state hint (top-left of viewport) ────────────────────────────── */

function ViewportHint() {
  const tool = useDesigner(s => s.tool);
  const linkFromId = useDesigner(s => s.linkFromId);
  const measureFrom = useDesigner(s => s.measureFrom);
  const selectedId = useDesigner(s => s.selectedId);
  const objects = useDesigner(s => s.objects);
  const transform = useDesigner(s => s.transform);

  const isPlacement = isPlacementTool(tool);
  const selected = objects.find(o => o.id === selectedId);

  let hint: React.ReactNode;
  if (transform) {
    hint = (
      <HintText icon={<Crosshair className="w-3 h-3 text-cyan-300" />}>
        {transform.mode === 'move'
          ? <>Move <b className="text-cyan-200">{transform.id}</b> — drag, release to drop · Esc to cancel</>
          : <>Rotate <b className="text-cyan-200">{transform.id}</b> — drag to aim · release · Esc to cancel</>}
      </HintText>
    );
  } else if (isPlacement) {
    hint = (
      <HintText icon={<MousePointerClick className="w-3 h-3 text-cyan-300" />}>
        Place <b className="text-cyan-200">{componentLabel(tool)}</b> — click the terrain, or drag from the palette
      </HintText>
    );
  } else if (tool === 'connect') {
    hint = (
      <HintText icon={<Crosshair className="w-3 h-3 text-cyan-300" />}>
        {linkFromId
          ? <>Link <b className="text-cyan-200">{linkFromId}</b> → click the second node</>
          : 'Link tool — click the first node'}
      </HintText>
    );
  } else if (tool === 'measure') {
    hint = (
      <HintText icon={<Ruler className="w-3 h-3 text-cyan-300" />}>
        {measureFrom ? 'Click the second terrain point' : 'Measure — click two terrain points'}
      </HintText>
    );
  } else if (tool === 'duplicate') {
    hint = <HintText icon={<Target className="w-3 h-3 text-cyan-300" />}>Duplicate — click an object</HintText>;
  } else if (tool === 'delete') {
    hint = <HintText icon={<Crosshair className="w-3 h-3 text-red-300" />}>Delete — click an object or link</HintText>;
  } else if (tool === 'move') {
    hint = <HintText icon={<Crosshair className="w-3 h-3 text-cyan-300" />}>Move — click an object to drag it</HintText>;
  } else if (tool === 'rotate') {
    hint = <HintText icon={<Crosshair className="w-3 h-3 text-cyan-300" />}>Rotate — click an object to aim it</HintText>;
  } else {
    hint = (
      <HintText icon={<Crosshair className="w-3 h-3 text-slate-500" />}>
        {selected
          ? <>Selected <b className="text-cyan-200">{selected.id}</b> · {benchLabel(selected.bench)} · G move · R rotate · D dup · F frame</>
          : 'Orbit · pan · zoom · click to select · double-click to focus'}
      </HintText>
    );
  }

  return (
    <motion.div
      className="absolute top-4 left-4 z-20"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
    >
      <div className="glass-panel px-3 py-2 flex items-center gap-2" style={{ borderColor: 'rgba(56,189,248,0.22)' }}>
        <div>
          <div className="text-[7.5px] font-mono tracking-[0.25em] text-slate-500 uppercase font-bold">Mine Designer</div>
          <div className="flex items-center gap-2 mt-0.5">{hint}</div>
        </div>
      </div>
    </motion.div>
  );
}

function componentLabel(t: DesignerTool): string {
  return (t as DesignerComponentType).replace('-', ' ');
}

function HintText({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
      {icon}
      <span className="max-w-[460px] truncate">{children}</span>
    </span>
  );
}

/* ─── View controls (bottom-right of viewport) ──────────────────────────── */

function ViewportControls() {
  const resetCamera = useDesigner(s => s.resetCamera);
  const focusOn = useDesigner(s => s.focusOn);
  const setViewPreset = useDesigner(s => s.setViewPreset);
  const selectedId = useDesigner(s => s.selectedId);
  const objects = useDesigner(s => s.objects);
  const preview = useDesigner(s => s.preview);

  const frameSelected = () => {
    const sel = objects.find(o => o.id === selectedId);
    if (sel) focusOn(sel.position);
  };

  return (
    <motion.div
      className="absolute bottom-3 right-4 z-20 flex flex-col gap-1.5"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 }}
    >
      <ViewBtn title="Perspective view (V)" onClick={() => setViewPreset('perspective')}>
        <Box className="w-3.5 h-3.5" />
      </ViewBtn>
      <ViewBtn title="Top view (V)" onClick={() => setViewPreset('top')}>
        <Circle className="w-3.5 h-3.5" />
      </ViewBtn>
      <ViewBtn title="Isometric view (V)" onClick={() => setViewPreset('iso')}>
        <Layers className="w-3.5 h-3.5" />
      </ViewBtn>
      <ViewBtn title="Frame selected (F)" onClick={frameSelected}>
        <Crosshair className="w-3.5 h-3.5" />
      </ViewBtn>
      <ViewBtn title="Fit mine" onClick={() => resetCamera()}>
        <Target className="w-3.5 h-3.5" />
      </ViewBtn>
      {preview && (
        <div className="glass-panel-subtle px-2 py-1 text-center">
          <span className="text-[7px] font-mono text-emerald-400 animate-pulse">SIMULATING</span>
        </div>
      )}
    </motion.div>
  );
}

function ViewBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      title={title}
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200"
      style={{
        background: 'rgba(13,20,34,0.78)',
        border: '1px solid rgba(56,189,248,0.22)',
        color: '#94a3b8',
        backdropFilter: 'blur(10px)',
      }}
      whileHover={{ scale: 1.08, color: '#22d3ee', borderColor: 'rgba(34,211,238,0.5)' }}
      whileTap={{ scale: 0.94 }}
    >
      {children}
    </motion.button>
  );
}
