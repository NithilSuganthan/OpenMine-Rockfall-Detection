import { create } from 'zustand';
import type {
  AISuggestion, DesignerLink, DesignerObject, DesignerTool, DesignerVector3,
  Measurement, ValidationResult,
} from '../data/designerTypes';
import { COMPONENT_PREFIX, isPlacementTool } from '../data/designerTypes';
import { COMPONENT_SPECS } from '../data/designerCatalog';
import { seedDeployment } from '../data/mockDesigner';
import { facingPitCenter, nextId, snapToTerrain } from '../utils/terrain';
import { validateDeployment } from '../utils/designerValidation';
import { generateSuggestions } from '../utils/aiReview';

const STORAGE_KEY = 'rocksentinel-designer-layout';
const LEGACY_STORAGE_KEY = 'rocksafe-designer-layout';
const DEPLOYMENT_KEY = 'rocksentinel-deployment';
const LEGACY_DEPLOYMENT_KEY = 'rocksafe-deployment';

export type StatusKind = 'success' | 'warning' | 'error' | 'info';
export type ViewPreset = 'perspective' | 'top' | 'iso';

export interface DesignerState {
  objects: DesignerObject[];
  links: DesignerLink[];
  tool: DesignerTool;
  dragType: DesignerObject['type'] | null;
  ghostPosition: DesignerVector3 | null;
  selectedId: string | null;
  hoveredId: string | null;
  hoveredLinkId: string | null;
  linkFromId: string | null;
  linkPendingId: string | null;
  measureFrom: DesignerVector3 | null;
  measurement: Measurement | null;
  preview: boolean;
  previewFault: string | null;
  validation: ValidationResult | null;
  suggestions: AISuggestion[];
  lastSaved: string | null;
  statusMessage: { text: string; kind: 'success' | 'warning' | 'error' | 'info'; at: number } | null;
  focusRequest: { position: DesignerVector3; nonce: number } | null;
  transform: { id: string; mode: 'move' | 'rotate' } | null;
  transformTarget: DesignerVector3 | null;
  viewPreset: { kind: ViewPreset; nonce: number } | null;
  placedAnimation: { id: string; nonce: number } | null;

  setTool: (tool: DesignerTool) => void;
  startDrag: (type: DesignerObject['type']) => void;
  endDrag: () => void;
  setGhostPosition: (p: DesignerVector3 | null) => void;
  setHovered: (id: string | null) => void;
  setHoveredLink: (id: string | null) => void;

  placeObject: (position: DesignerVector3) => string | null;
  selectObject: (id: string | null, focus?: boolean) => void;
  renameObject: (id: string, name: string) => void;
  setSamplingRate: (id: string, rate: number) => void;
  deleteObject: (id: string) => void;
  duplicateObject: (id: string) => void;

  clickObject: (id: string) => void;
  clickLink: (id: string | null) => void;
  addLink: (from: string, to: string) => void;
  removeLink: (id: string) => void;
  cancelLinkPending: () => void;

  addMeasurePoint: (p: DesignerVector3) => void;
  clearMeasurement: () => void;

  togglePreview: () => void;
  setPreviewFault: (id: string | null) => void;

  startTransform: (id: string, mode: 'move' | 'rotate') => void;
  setTransformTarget: (p: DesignerVector3 | null) => void;
  commitTransform: () => void;
  cancelTransform: () => void;

  setViewPreset: (kind: ViewPreset) => void;
  clearPlacedAnimation: (nonce: number) => void;

  validate: () => ValidationResult;
  setValidation: (v: ValidationResult | null) => void;
  review: () => void;
  applySuggestion: (id: string) => void;
  dismissSuggestion: (id: string) => void;

  saveLayout: () => void;
  resetLayout: () => void;
  exportJson: () => void;
  deployToTwin: () => void;
  resetCamera: () => void;
  focusOn: (position: DesignerVector3) => void;

  notify: (text: string, kind?: StatusKind) => void;
}

/** Re-ground objects onto the Digital Twin height field (terrain changed). */
function resnapObjects(objects: DesignerObject[]): DesignerObject[] {
  return objects.map(o => {
    const snap = snapToTerrain(o.position.x, o.position.z, false);
    return { ...o, position: snap.position, bench: snap.bench };
  });
}

function loadSeed() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { objects: DesignerObject[]; links: DesignerLink[] };
      if (parsed.objects?.length) {
        return { objects: resnapObjects(parsed.objects), links: parsed.links };
      }
    }
  } catch {
    /* fall through to seed */
  }
  const seed = seedDeployment();
  return { objects: resnapObjects(seed.objects), links: seed.links };
}

function latencyBetween(a: DesignerVector3, b: DesignerVector3): number {
  const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const deterministic = Math.abs(a.x * 31 + a.z * 17 + b.x * 7 + b.z * 13) % 40;
  return Math.max(3, Math.round(3 + d * 0.22 + deterministic / 10));
}

export const useDesigner = create<DesignerState>((set, get) => {
  const seed = loadSeed();

  const notify = (text: string, kind: StatusKind = 'info') => {
    set({ statusMessage: { text, kind, at: Date.now() } });
  };

  return {
    objects: seed.objects,
    links: seed.links,
    tool: 'select',
    dragType: null,
    ghostPosition: null,
    selectedId: null,
    hoveredId: null,
    hoveredLinkId: null,
    linkFromId: null,
    linkPendingId: null,
    measureFrom: null,
    measurement: null,
    preview: false,
    previewFault: null,
    validation: null,
    suggestions: [],
    lastSaved: null,
    statusMessage: null,
    focusRequest: null,
    transform: null,
    transformTarget: null,
    viewPreset: null,
    placedAnimation: null,

    setTool: (tool) => set({
      tool,
      dragType: null,
      ghostPosition: null,
      linkFromId: null,
      linkPendingId: null,
      measureFrom: null,
      measurement: null,
      transform: null,
      transformTarget: null,
    }),

    startDrag: (type) => {
      const d = get();
      set({
        dragType: type,
        tool: type,
        ghostPosition: d.ghostPosition,
        linkFromId: null,
        linkPendingId: null,
        transform: null,
        transformTarget: null,
        selectedId: null,
      });
    },

    endDrag: () => {
      const { dragType } = get();
      if (dragType) set({ dragType: null, ghostPosition: null, tool: 'select' });
    },

    setGhostPosition: (p) => set({ ghostPosition: p }),
    setHovered: (id) => set({ hoveredId: id }),
    setHoveredLink: (id) => set({ hoveredLinkId: id }),

    placeObject: (position) => {
      const { objects, dragType, tool } = get();
      const type = (dragType ?? (isPlacementTool(tool) ? tool : null)) as DesignerObject['type'] | null;
      if (!type) return null;

      const snap = snapToTerrain(position.x, position.z, true);
      const spec = COMPONENT_SPECS[type];
      const id = nextId(COMPONENT_PREFIX[type], objects.map(o => o.id));
      const obj: DesignerObject = {
        id,
        name: `${spec.label} ${id}`,
        type,
        position: snap.position,
        bench: snap.bench,
        yaw: facingPitCenter(snap.position.x, snap.position.z),
        status: 'planned',
        battery: spec.defaultBattery,
        samplingRate: spec.defaultRate,
        commGateway: null,
      };
      const nonce = Date.now();
      set({
        objects: [...get().objects, obj],
        selectedId: id,
        dragType: null,
        ghostPosition: null,
        tool: 'select',
        placedAnimation: { id, nonce },
      });
      get().validate();
      return id;
    },

    selectObject: (id, focus = false) => {
      set({ selectedId: id });
      if (focus && id) {
        const o = get().objects.find(x => x.id === id);
        if (o) get().focusOn(o.position);
      }
    },

    renameObject: (id, name) => {
      set({ objects: get().objects.map(o => (o.id === id ? { ...o, name } : o)) });
    },

    setSamplingRate: (id, rate) => {
      set({ objects: get().objects.map(o => (o.id === id ? { ...o, samplingRate: rate } : o)) });
    },

    deleteObject: (id) => {
      const { objects, links, selectedId, hoveredId, linkFromId, transform } = get();
      set({
        objects: objects.filter(o => o.id !== id),
        links: links.filter(l => l.from !== id && l.to !== id),
        selectedId: selectedId === id ? null : selectedId,
        hoveredId: hoveredId === id ? null : hoveredId,
        linkFromId: linkFromId === id ? null : linkFromId,
        transform: transform && transform.id === id ? null : transform,
        transformTarget: transform && transform.id === id ? null : get().transformTarget,
      });
      notify(`${id} removed from deployment`, 'info');
      get().validate();
    },

    duplicateObject: (id) => {
      const { objects } = get();
      const src = objects.find(o => o.id === id);
      if (!src) return;
      const r = Math.hypot(src.position.x, src.position.z) + 3.5;
      const dir = Math.atan2(src.position.z, src.position.x);
      const snap = snapToTerrain(Math.cos(dir) * r, Math.sin(dir) * r, true);
      const newId = nextId(COMPONENT_PREFIX[src.type], objects.map(o => o.id));
      const copy: DesignerObject = {
        ...src,
        id: newId,
        name: `${src.name} (copy)`,
        position: snap.position,
        bench: snap.bench,
        yaw: facingPitCenter(snap.position.x, snap.position.z),
        commGateway: null,
      };
      const nonce = Date.now();
      set({
        objects: [...objects, copy],
        selectedId: newId,
        tool: 'select',
        placedAnimation: { id: newId, nonce },
      });
      notify(`${copy.id} duplicated`, 'success');
      get().validate();
    },

    clickObject: (id) => {
      const { tool, linkFromId, dragType } = get();
      if (dragType) return;
      switch (tool) {
        case 'delete': {
          get().deleteObject(id);
          break;
        }
        case 'duplicate': {
          get().duplicateObject(id);
          break;
        }
        case 'connect': {
          if (linkFromId === id) {
            set({ linkFromId: null, linkPendingId: null });
            break;
          }
          if (linkFromId) {
            get().addLink(linkFromId, id);
          } else {
            set({ linkFromId: id, linkPendingId: id });
          }
          break;
        }
        case 'move': {
          get().startTransform(id, 'move');
          break;
        }
        case 'rotate': {
          get().startTransform(id, 'rotate');
          break;
        }
        default:
          get().selectObject(id);
      }
    },

    clickLink: (id) => {
      if (!id) return;
      const { tool, linkFromId } = get();
      if (tool === 'delete') {
        get().removeLink(id);
        return;
      }
      if (tool === 'connect') {
        if (linkFromId) {
          get().removeLink(id);
          set({ linkFromId: null, linkPendingId: null });
          return;
        }
        set({ selectedId: null, linkPendingId: id });
        return;
      }
      set({ selectedId: null, linkPendingId: id });
    },

    addLink: (from, to) => {
      const { objects, links } = get();
      if (from === to) return;
      const exists = links.some(l =>
        (l.from === from && l.to === to) || (l.from === to && l.to === from),
      );
      if (exists) {
        notify('Connection already exists', 'warning');
        set({ linkFromId: null, linkPendingId: null });
        return;
      }
      const a = objects.find(o => o.id === from);
      const b = objects.find(o => o.id === to);
      if (!a || !b) return;
      const id = nextId('L', links.map(l => l.id));
      const link: DesignerLink = {
        id,
        from,
        to,
        latency: latencyBetween(a.position, b.position),
        kind: 'mesh',
        hops: 1,
      };
      set({
        links: [...links, link],
        linkFromId: null,
        linkPendingId: null,
      });
      notify(`Connection ${from} ↔ ${to} created`, 'success');
      get().validate();
    },

    removeLink: (id) => {
      set({
        links: get().links.filter(l => l.id !== id),
        linkPendingId: null,
      });
      notify('Connection removed', 'info');
      get().validate();
    },

    cancelLinkPending: () => set({ linkFromId: null, linkPendingId: null }),

    addMeasurePoint: (p) => {
      const { measureFrom } = get();
      if (!measureFrom) {
        set({ measureFrom: p, measurement: null });
        return;
      }
      const distance = Math.hypot(p.x - measureFrom.x, p.y - measureFrom.y, p.z - measureFrom.z);
      set({
        measureFrom: null,
        measurement: { from: measureFrom, to: p, distance, deltaY: p.y - measureFrom.y },
      });
    },

    clearMeasurement: () => set({ measureFrom: null, measurement: null }),

    togglePreview: () => {
      const next = !get().preview;
      set({ preview: next, previewFault: null });
      notify(next ? 'Preview simulation started' : 'Preview simulation stopped', next ? 'success' : 'info');
    },

    setPreviewFault: (id) => set({ previewFault: id }),

    startTransform: (id, mode) => {
      set({
        transform: { id, mode },
        transformTarget: null,
        selectedId: id,
        linkFromId: null,
        linkPendingId: null,
        measureFrom: null,
        measurement: null,
      });
      notify(mode === 'move' ? `${id} — drag to move, release to drop` : `${id} — drag to rotate`, 'info');
    },

    setTransformTarget: (p) => set({ transformTarget: p }),

    commitTransform: () => {
      const { transform, transformTarget, objects } = get();
      if (!transform || !transformTarget) {
        set({ transform: null, transformTarget: null, tool: 'select' });
        return;
      }
      const src = objects.find(o => o.id === transform.id);
      if (!src) {
        set({ transform: null, transformTarget: null, tool: 'select' });
        return;
      }
      if (transform.mode === 'move') {
        const snap = snapToTerrain(transformTarget.x, transformTarget.z, true);
        set({
          objects: objects.map(o =>
            o.id === src.id
              ? { ...o, position: snap.position, bench: snap.bench, yaw: facingPitCenter(snap.position.x, snap.position.z) }
              : o,
          ),
          transform: null,
          transformTarget: null,
          tool: 'select',
        });
        notify(`${src.id} moved${snap.snappedToBench ? ' · snapped to bench' : ''}`, 'success');
      } else {
        const yaw = Math.atan2(transformTarget.x - src.position.x, transformTarget.z - src.position.z);
        set({
          objects: objects.map(o =>
            o.id === src.id ? { ...o, yaw } : o,
          ),
          transform: null,
          transformTarget: null,
          tool: 'select',
        });
        notify(`${src.id} rotated ${((yaw * 180) / Math.PI).toFixed(0)}°`, 'success');
      }
      get().validate();
    },

    cancelTransform: () => set({ transform: null, transformTarget: null }),

    setViewPreset: (kind) => set({ viewPreset: { kind, nonce: Date.now() } }),

    clearPlacedAnimation: (nonce) => {
      const current = get().placedAnimation;
      if (current && current.nonce === nonce) set({ placedAnimation: null });
    },

    validate: () => {
      const { objects, links } = get();
      const result = validateDeployment(objects, links);
      set({ validation: result });
      return result;
    },

    setValidation: (v) => set({ validation: v }),

    review: () => {
      const { objects, links } = get();
      set({ suggestions: generateSuggestions(objects, links) });
    },

    applySuggestion: (id) => {
      const { suggestions } = get();
      const s = suggestions.find(x => x.id === id);
      if (!s || s.applied) return;
      if (s.apply?.kind === 'add-object') {
        const placed = get().placeObject(s.apply.position);
        if (placed) {
          const obj = get().objects.find(o => o.id === placed);
          if (obj) get().focusOn(obj.position);
          set({ placedAnimation: { id: placed, nonce: Date.now() } });
          notify(`AI suggestion applied — ${placed} placed`, 'success');
        }
      } else if (s.apply?.kind === 'add-link') {
        get().addLink(s.apply.from, s.apply.to);
      } else {
        notify('Suggestion accepted', 'success');
      }
      set({
        suggestions: suggestions.map(x => (x.id === id ? { ...x, applied: true } : x)),
      });
    },

    dismissSuggestion: (id) => {
      set({ suggestions: get().suggestions.filter(x => x.id !== id) });
    },

    saveLayout: () => {
      const { objects, links } = get();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ objects, links }));
        set({ lastSaved: new Date().toISOString() });
        notify('Layout saved to workspace', 'success');
      } catch {
        notify('Failed to save layout', 'error');
      }
    },

    resetLayout: () => {
      const seedState = seedDeployment();
      set({
        objects: resnapObjects(seedState.objects),
        links: seedState.links,
        selectedId: null,
        linkFromId: null,
        linkPendingId: null,
        measurement: null,
        validation: null,
        suggestions: [],
        preview: false,
        previewFault: null,
        tool: 'select',
        dragType: null,
        ghostPosition: null,
        transform: null,
        transformTarget: null,
        placedAnimation: null,
      });
      notify('Layout reset to reference plan', 'info');
    },

    exportJson: () => {
      const { objects, links } = get();
      const payload = {
        name: 'SHIVNERI_OPEN_PIT_MINE',
        schema: 'rocksentinel.deployment.v1',
        exportedAt: new Date().toISOString(),
        objects,
        links,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mine-deployment.json';
      a.click();
      URL.revokeObjectURL(url);
      notify('Deployment exported as JSON', 'success');
    },

    deployToTwin: () => {
      const { objects, links, validate } = get();
      const result = validate();
      const deployment = {
        deployed: true,
        deployedAt: new Date().toISOString(),
        objects,
        links,
        issues: result.issues,
      };
      try {
        localStorage.setItem(DEPLOYMENT_KEY, JSON.stringify(deployment));
        set({ validation: result, lastSaved: new Date().toISOString() });
        useDeployment.setState({
          deployed: true,
          deployedAt: deployment.deployedAt,
          objects,
          links,
        });
        notify(
          result.errorCount > 0
            ? `Deployed with ${result.errorCount} unresolved issue${result.errorCount > 1 ? 's' : ''}`
            : 'Deployment activated — Digital Twin updated',
          result.errorCount > 0 ? 'warning' : 'success',
        );
      } catch {
        notify('Deployment failed to persist', 'error');
      }
    },

    resetCamera: () => set({ focusRequest: { position: { x: 0, y: -4, z: 0 }, nonce: Date.now() } }),

    focusOn: (position) => set({ focusRequest: { position, nonce: Date.now() } }),

    notify,
  };
});

// ─── Deployment (Digital Twin) store ───────────────────────────────────────

export interface DeploymentState {
  deployed: boolean;
  deployedAt: string | null;
  objects: DesignerObject[];
  links: DesignerLink[];
}

function loadDeployment(): DeploymentState {
  try {
    const raw = localStorage.getItem(DEPLOYMENT_KEY) ?? localStorage.getItem(LEGACY_DEPLOYMENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DeploymentState;
      if (parsed?.deployed && parsed.objects) return parsed;
    }
  } catch {
    /* ignore */
  }
  return { deployed: false, deployedAt: null, objects: [], links: [] };
}

export const useDeployment = create<DeploymentState>(() => loadDeployment());
