// ─── Mine Designer — Domain Types ──────────────────────────────────────────

export type DesignerComponentType =
  | 'monitoring-pole'
  | 'tilt-sensor'
  | 'geophone'
  | 'soil-moisture'
  | 'weather-station'
  | 'camera'
  | 'gateway'
  | 'relay-node'
  | 'emergency-siren';

export type DesignerCategory = 'sensing' | 'infrastructure' | 'alert';

export interface DesignerVector3 {
  x: number;
  y: number;
  z: number;
}

export type DesignerObjectStatus = 'planned' | 'online';

export interface DesignerObject {
  id: string;
  name: string;
  type: DesignerComponentType;
  position: DesignerVector3;
  bench: number; // -1 = pit floor, 0..5 = bench index, -2 = top surface
  yaw: number;
  status: DesignerObjectStatus;
  battery: number;
  samplingRate: number; // seconds
  commGateway: string | null; // resolved gateway id
}

export interface DesignerLink {
  id: string;
  from: string;
  to: string;
  latency: number; // ms
  kind: 'direct' | 'mesh';
  hops: number;
}

export type DesignerTool =
  | 'select'
  | 'connect'
  | 'measure'
  | 'duplicate'
  | 'delete'
  | 'move'
  | 'rotate'
  | DesignerComponentType;

/** Action tools (non-component tools). Placement tools are component types. */
export function isPlacementTool(t: DesignerTool): boolean {
  return t !== 'select' && t !== 'connect' && t !== 'measure' && t !== 'duplicate'
    && t !== 'delete' && t !== 'move' && t !== 'rotate';
}

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  severity: ValidationSeverity;
  message: string;
  objectId?: string;
  linkId?: string;
  position?: DesignerVector3;
}

export interface ValidationResult {
  score: number;
  grade: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
  gatewayLoads: { gatewayId: string; load: number }[];
}

export interface AISuggestion {
  id: string;
  severity: ValidationSeverity | 'success';
  text: string;
  applied: boolean;
  apply: {
    kind: 'add-object';
    type: DesignerComponentType;
    position: DesignerVector3;
  } | {
    kind: 'add-link';
    from: string;
    to: string;
  } | null;
}

export interface Measurement {
  from: DesignerVector3;
  to: DesignerVector3;
  distance: number;
  deltaY: number;
}

export const COMPONENT_PREFIX: Record<DesignerComponentType, string> = {
  'monitoring-pole': 'PO',
  'tilt-sensor': 'TS',
  geophone: 'GE',
  'soil-moisture': 'SM',
  camera: 'CA',
  'weather-station': 'WS',
  gateway: 'GW',
  'relay-node': 'RL',
  'emergency-siren': 'SI',
};
