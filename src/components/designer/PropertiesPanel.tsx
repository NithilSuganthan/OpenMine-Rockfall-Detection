import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Battery, Copy, Link2, MapPin, Pencil, Radio, RefreshCw, Trash2, X, Zap,
} from 'lucide-react';
import { useDesigner } from '../../store/designerStore';
import { COMPONENT_SPECS } from '../../data/designerCatalog';
import { benchLabel } from '../../utils/terrain';
import { gatewayFor } from '../../utils/designerValidation';

export function PropertiesPanel() {
  const selectedId = useDesigner(s => s.selectedId);
  const linkPendingId = useDesigner(s => s.linkPendingId);
  const objects = useDesigner(s => s.objects);
  const links = useDesigner(s => s.links);
  const renameObject = useDesigner(s => s.renameObject);
  const setSamplingRate = useDesigner(s => s.setSamplingRate);
  const deleteObject = useDesigner(s => s.deleteObject);
  const duplicateObject = useDesigner(s => s.duplicateObject);
  const removeLink = useDesigner(s => s.removeLink);
  const selectObject = useDesigner(s => s.selectObject);
  const clickLink = useDesigner(s => s.clickLink);

  const object = objects.find(o => o.id === selectedId) ?? null;
  const link = linkPendingId ? links.find(l => l.id === linkPendingId) ?? null : null;

  if (!object && !link) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={object ? `obj-${object.id}` : `link-${link?.id}`}
        className="absolute top-4 right-4 z-30 w-[250px]"
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] as const }}
      >
        {object ? (
          <ObjectProperties
            objectId={object.id}
            objects={objects}
            links={links}
            onRename={renameObject}
            onSetRate={setSamplingRate}
            onDelete={deleteObject}
            onDuplicate={duplicateObject}
            onClose={() => selectObject(null)}
          />
        ) : link ? (
          <LinkProperties
            linkId={link.id}
            objects={objects}
            links={links}
            onRemove={removeLink}
            onSelect={clickLink}
          />
        ) : null}
      </motion.div>
    </AnimatePresence>
  );
}

function ObjectProperties({
  objectId, objects, links, onRename, onSetRate, onDelete, onDuplicate, onClose,
}: {
  objectId: string;
  objects: ReturnType<typeof useDesigner.getState>['objects'];
  links: ReturnType<typeof useDesigner.getState>['links'];
  onRename: (id: string, name: string) => void;
  onSetRate: (id: string, rate: number) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onClose: () => void;
}) {
  const object = objects.find(o => o.id === objectId)!;
  const spec = COMPONENT_SPECS[object.type];
  const Icon = spec.icon;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(object.name);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setDraft(object.name);
    setEditing(false);
  }, [object.name, objectId]);

  const directLinks = links.filter(l => l.from === object.id || l.to === object.id);
  const gateway = gatewayFor(object, objects, links);
  const commOk = directLinks.length > 0;
  const batteryOk = object.battery > 30;

  const commitRename = () => {
    const name = draft.trim() || object.name;
    onRename(object.id, name);
    setEditing(false);
  };

  return (
    <div className="glass-panel overflow-hidden hud-corners" style={{ borderColor: `${spec.color}3a` }}>
      {/* Header */}
      <div
        className="px-3 py-2.5 flex items-center gap-2 border-b border-white/[0.06]"
        style={{ background: `${spec.color}0d` }}
      >
        <Icon className="w-4 h-4 shrink-0" style={{ color: spec.color }} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
              className="w-full bg-black/30 border border-cyan-500/40 rounded px-1.5 py-0.5 text-[10px] font-mono text-cyan-100 outline-none"
            />
          ) : (
            <div className="text-[11px] font-display font-bold text-slate-100 truncate">{object.name}</div>
          )}
          <div className="text-[8px] font-mono text-slate-500">{object.id} · {spec.label.toUpperCase()}</div>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-slate-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 py-2.5 space-y-2.5">
        {/* Location */}
        <Row icon={<MapPin className="w-3 h-3" />} label="Location" value={`${benchLabel(object.bench)} · ${sector(object)}`} />
        <Row icon={<Zap className="w-3 h-3" />} label="Coordinates" value={`${object.position.x.toFixed(1)}, ${object.position.y.toFixed(1)}, ${object.position.z.toFixed(1)}`} mono />
        <Row
          icon={<Radio className="w-3 h-3" />}
          label="Status"
          value={object.status === 'online' ? 'ONLINE' : 'PLANNED'}
          valueColor={object.status === 'online' ? '#22c55e' : '#94a3b8'}
        />

        {/* Battery */}
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <Battery className="w-3 h-3 text-slate-500" />
            <span className="text-[8.5px] text-slate-500 flex-1">Battery</span>
            <span className={`text-[9px] font-mono font-bold ${batteryOk ? 'text-slate-200' : 'text-red-400'}`}>
              {object.battery.toFixed(0)}%
            </span>
          </div>
          <div className="h-[4px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: batteryOk ? '#22c55e' : '#ef4444', boxShadow: '0 0 6px rgba(34,197,94,0.5)' }}
              initial={{ width: 0 }}
              animate={{ width: `${object.battery}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Sampling rate */}
        <div className="flex items-center gap-1.5">
          <RefreshCw className="w-3 h-3 text-slate-500" />
          <span className="text-[8.5px] text-slate-500 flex-1">Sampling Rate</span>
          <select
            value={object.samplingRate}
            onChange={e => onSetRate(object.id, Number(e.target.value))}
            className="bg-black/30 border border-white/10 rounded px-1 py-0.5 text-[9px] font-mono text-cyan-200 outline-none focus:border-cyan-500/50"
          >
            {spec.rateOptions.map(r => (
              <option key={r} value={r}>{r}s</option>
            ))}
          </select>
        </div>

        {/* Communication */}
        <div className="glass-panel-subtle px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${commOk ? 'animate-pulse' : ''}`}
              style={{ background: commOk ? '#22c55e' : '#ef4444', boxShadow: commOk ? '0 0 5px #22c55e' : '0 0 5px #ef4444' }} />
            <span className="text-[8.5px] font-mono text-slate-300 flex-1">
              {commOk ? `LINKED · ${directLinks.length} CONNECTION${directLinks.length > 1 ? 'S' : ''}` : 'NOT CONNECTED'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <Link2 className="w-3 h-3 text-slate-500" />
            <span className="text-[8px] font-mono text-slate-500">GATEWAY</span>
            <span className={`text-[9px] font-mono font-bold ${gateway ? 'text-cyan-300' : 'text-red-400'}`}>
              {gateway ?? 'NONE'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1.5 pt-1">
          <ActionButton icon={<Pencil className="w-3 h-3" />} label="Rename" onClick={() => setEditing(true)} />
          <ActionButton icon={<Copy className="w-3 h-3" />} label="Duplicate" onClick={() => onDuplicate(object.id)} />
          <ActionButton icon={<Trash2 className="w-3 h-3" />} label="Delete" danger onClick={() => { onDelete(object.id); onClose(); }} />
        </div>

        <button
          className="w-full py-1.5 rounded-lg text-[8.5px] font-display font-bold tracking-wider flex items-center justify-center gap-1.5"
          style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#67e8f9' }}
          onClick={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 900); }}
        >
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-sweep' : ''}`} />
          {refreshing ? 'CHECKING BATTERY…' : 'REFRESH TELEMETRY'}
        </button>
      </div>
    </div>
  );
}

function LinkProperties({
  linkId, objects, links, onRemove, onSelect,
}: {
  linkId: string;
  objects: ReturnType<typeof useDesigner.getState>['objects'];
  links: ReturnType<typeof useDesigner.getState>['links'];
  onRemove: (id: string) => void;
  onSelect: (id: string | null) => void;
}) {
  const link = links.find(l => l.id === linkId)!;
  const a = objects.find(o => o.id === link.from);
  const b = objects.find(o => o.id === link.to);

  return (
    <div className="glass-panel overflow-hidden hud-corners" style={{ borderColor: 'rgba(34,211,238,0.35)' }}>
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-white/[0.06]" style={{ background: 'rgba(34,211,238,0.08)' }}>
        <Link2 className="w-4 h-4 text-cyan-300" />
        <div className="flex-1">
          <div className="text-[11px] font-display font-bold text-slate-100">Communication Link</div>
          <div className="text-[8px] font-mono text-slate-500">{link.id}</div>
        </div>
        <button onClick={() => onSelect(null)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-slate-400">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-1.5">
          <NodeChip id={link.from} label={a?.name ?? link.from} />
          <span className="text-cyan-400/70 text-[10px]">↔</span>
          <NodeChip id={link.to} label={b?.name ?? link.to} />
        </div>
        <Row icon={<Zap className="w-3 h-3" />} label="Latency" value={`${link.latency} ms`} mono />
        <Row icon={<RefreshCw className="w-3 h-3" />} label="Kind" value={link.kind.toUpperCase()} />
        <Row icon={<Radio className="w-3 h-3" />} label="Hops" value={String(link.hops)} />
        <button
          className="w-full py-1.5 rounded-lg text-[8.5px] font-display font-bold tracking-wider flex items-center justify-center gap-1.5"
          style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
          onClick={() => { onRemove(link.id); onSelect(null); }}
        >
          <Trash2 className="w-3 h-3" />
          REMOVE CONNECTION
        </button>
      </div>
    </div>
  );
}

function NodeChip({ id, label }: { id: string; label: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="text-[10px] font-mono font-bold text-cyan-200">{id}</div>
      <div className="text-[7.5px] font-mono text-slate-500 truncate">{label}</div>
    </div>
  );
}

function sector(object: { position: { x: number; z: number } }): string {
  const a = Math.atan2(object.position.z, object.position.x);
  const sectors = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
  const idx = Math.round(a / (Math.PI / 4)) % 8;
  return `${sectors[(idx + 8) % 8]} Sector`;
}

function Row({ icon, label, value, mono, valueColor }: {
  icon: React.ReactNode; label: string; value: string; mono?: boolean; valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500 shrink-0">{icon}</span>
      <span className="text-[8.5px] text-slate-500 flex-1">{label}</span>
      <span className={`text-[9px] font-mono font-bold truncate ${mono ? 'font-mono' : ''}`} style={{ color: valueColor ?? '#dbe4f0' }}>
        {value}
      </span>
    </div>
  );
}

function ActionButton({ icon, label, danger, onClick }: {
  icon: React.ReactNode; label: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg transition-all duration-150 hover:scale-[1.03]"
      style={{
        background: danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${danger ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
        color: danger ? '#f87171' : '#94a3b8',
      }}
    >
      {icon}
      <span className="text-[8.5px] font-display font-bold tracking-wider">{label}</span>
    </button>
  );
}
