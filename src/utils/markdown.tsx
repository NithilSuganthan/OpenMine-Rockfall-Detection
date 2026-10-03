import type { ReactNode } from 'react';
import { MapPin } from 'lucide-react';

/**
 * Lightweight markdown renderer for RockSentinel AI answers.
 * Supports: headings, tables, lists, code blocks, quotes, bold/italic/code
 * spans, inline citations (Source: X), and clickable entity IDs
 * (sensors, zones, gateways, relays, cameras, benches, deployment objects).
 */

export type EntityKind = 'sensor' | 'zone' | 'gateway' | 'relay' | 'camera' | 'pole' | 'bench' | 'deployment';

interface MarkdownProps {
  text: string;
  onMap?: (kind: EntityKind, id: string) => void;
}

const ENTITY_PATTERNS: { kind: EntityKind; re: RegExp }[] = [
  { kind: 'sensor', re: /\bSN-\d{3}\b/ },
  { kind: 'zone', re: /\bHRZ-\d{3}\b/ },
  { kind: 'gateway', re: /\bGW-\d{2}\b/ },
  { kind: 'relay', re: /\bRL-[A-Z0-9-]+\b/ },
  { kind: 'camera', re: /\b(?:ESP-CAM|CAM)-\d*\w*/ },
  { kind: 'pole', re: /\bPO-\d{2}\b/ },
  { kind: 'deployment', re: /\b(?:G|GE|SR|BME)-\d{2}\b/ },
];

export function extractEntities(text: string): { kind: EntityKind; id: string }[] {
  const found = new Map<string, EntityKind>();
  for (const { kind, re } of ENTITY_PATTERNS) {
    const g = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = g.exec(text))) {
      const id = m[0].toUpperCase();
      if (!found.has(id)) found.set(id, kind);
    }
  }
  const bench = text.match(/\bBench (\d+)/g);
  bench?.forEach(b => { const n = b.replace(/\D/g, ''); if (!found.has(`Bench ${n}`)) found.set(`Bench ${n}`, 'bench'); });
  return [...found.entries()].map(([id, kind]) => ({ id, kind }));
}

const INLINE_RE = new RegExp(
  `(\`[^\`]+\`|\\*\\*[^*]+\\*\\*|\\*[^*]+\\*|\\(Source:\\s*[^)]+\\)|SN-\\d{3}|HRZ-\\d{3}|GW-\\d{2}|RL-[A-Z0-9-]+|ESP-CAM|CAM-\\d*|PO-\\d{2}|(?:G|GE|SR|BME)-\\d{2}|Bench \\d+)`,
  'g',
);

function IdChip({ id, kind, onMap }: { id: string; kind: EntityKind; onMap?: (kind: EntityKind, id: string) => void }) {
  if (!onMap) return <span className="px-1 py-px rounded text-[7.5px] font-mono text-cyan-300" style={{ background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.2)' }}>{id}</span>;
  return (
    <button
      onClick={() => onMap(kind, id)}
      title="Highlight on map"
      className="inline-flex items-center gap-0.5 px-1 py-px rounded text-[7.5px] font-mono transition-all hover:scale-105 cursor-pointer align-baseline"
      style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#67e8f9' }}
    >
      <MapPin className="w-2 h-2" />{id}
    </button>
  );
}

function inline(text: string, onMap?: (kind: EntityKind, id: string) => void): ReactNode[] {
  const nodes: ReactNode[] = [];
  const parts = text.split(INLINE_RE);
  let key = 0;
  for (const part of parts) {
    if (!part) continue;
    const trimmed = part.trim();
    const entity = ENTITY_PATTERNS.find(p => new RegExp(`^${p.re.source}$`).test(trimmed));
    const benchMatch = /^Bench (\d+)$/.test(trimmed);
    const sourceMatch = trimmed.match(/^\(Source:\s*([^)]+)\)$/);
    if (entity || benchMatch) {
      const id = trimmed.toUpperCase();
      nodes.push(<IdChip key={key++} id={id} kind={entity?.kind ?? 'bench'} onMap={onMap} />);
    } else if (sourceMatch) {
      nodes.push(
        <span key={key++} className="px-1 py-px rounded text-[6.5px] font-mono text-slate-500" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
          {sourceMatch[1]}
        </span>,
      );
    } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      nodes.push(<code key={key++} className="px-1 py-px rounded text-[8.5px] font-mono text-purple-300" style={{ background: 'rgba(167,139,250,0.1)' }}>{part.slice(1, -1)}</code>);
    } else if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      nodes.push(<strong key={key++} className="text-slate-100 font-bold">{inline(part.slice(2, -2), onMap)}</strong>);
    } else if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      nodes.push(<em key={key++} className="text-slate-300 italic">{inline(part.slice(1, -1), onMap)}</em>);
    } else {
      nodes.push(<span key={key++}>{part}</span>);
    }
  }
  return nodes;
}

function EvidenceRow({ text, onMap }: { text: string; onMap?: (kind: EntityKind, id: string) => void }) {
  const m = text.match(/^[•\-*]\s*(.+?)\s*[:=]\s*(.+?)\s*\(Source:\s*([^)]+)\)\s*$/);
  if (m) {
    return (
      <div className="flex items-center gap-1.5 py-0.5">
        <span className="w-1 h-1 rounded-full shrink-0 bg-cyan-400" style={{ boxShadow: '0 0 4px #22d3ee' }} />
        <span className="text-[8.5px] text-slate-400 shrink-0">{m[1]}</span>
        <span className="text-[8.5px] font-mono font-bold text-slate-100">{m[2]}</span>
        <span className="flex-1" />
        <span className="text-[6.5px] font-mono text-slate-500 shrink-0" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 3, padding: '0 3px' }}>
          {m[3]}
        </span>
      </div>
    );
  }
  return (
    <li className="flex items-start gap-1.5 py-0.5">
      <span className="text-cyan-400 mt-px">•</span>
      <span className="text-[9px] text-slate-300 leading-relaxed">{inline(text.replace(/^[•\-*]\s*/, ''), onMap)}</span>
    </li>
  );
}

function TableBlock({ rows }: { rows: string[][] }) {
  if (rows.length === 0) return null;
  const [header, ...body] = rows;
  return (
    <div className="overflow-x-auto rounded-md" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
      <table className="w-full text-left text-[8.5px] font-mono">
        <thead>
          <tr style={{ background: 'rgba(56,189,248,0.08)' }}>
            {header.map((h, i) => (
              <th key={i} className="px-2 py-1 text-cyan-300 font-bold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="border-t border-white/[0.05]">
              {row.map((c, ci) => (
                <td key={ci} className="px-2 py-1 text-slate-300 whitespace-nowrap">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Markdown({ text, onMap }: MarkdownProps) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let key = 0;
  let i = 0;

  const pushParagraph = (raw: string[]) => {
    const content = raw.join(' ').trim();
    if (!content) return;
    blocks.push(
      <p key={key++} className="text-[9px] text-slate-300 leading-relaxed whitespace-pre-wrap">
        {inline(content, onMap)}
      </p>,
    );
  };

  while (i < lines.length) {
    const line = lines[i];

    // Code fence
    if (/^\s*```/.test(line)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push(
        <pre key={key++} className="rounded-md p-2 overflow-x-auto text-[8px] font-mono text-purple-200" style={{ background: 'rgba(5,10,18,0.7)', border: '1px solid rgba(167,139,250,0.2)' }}>
          <code>{buf.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Table
    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        const cells = lines[i].trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        if (!(cells.length === 1 && /^[\s:|-]+$/.test(cells[0]))) rows.push(cells);
        i++;
      }
      blocks.push(<TableBlock key={key++} rows={rows} />);
      continue;
    }

    // Headings
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      const level = h[1].length;
      const style = { 1: 'text-[12px]', 2: 'text-[11px]', 3: 'text-[10.5px]', 4: 'text-[10px]' }[level as 1 | 2 | 3 | 4];
      blocks.push(
        <div key={key++} className={`${style} font-display font-bold text-slate-100 mt-1.5 mb-0.5 uppercase tracking-wider flex items-center gap-1.5`}>
          <span className="w-1 h-3 rounded-full bg-purple-400" style={{ boxShadow: '0 0 6px #a78bfa' }} />
          {inline(h[2], onMap)}
        </div>,
      );
      i++;
      continue;
    }

    if (/^\s*(---|___)\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="my-1.5 border-white/[0.08]" />);
      i++;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-purple-400/60 pl-2 py-0.5 my-1 text-[8.5px] text-purple-200/90 italic" style={{ background: 'rgba(167,139,250,0.05)' }}>
          {inline(buf.join(' '), onMap)}
        </blockquote>,
      );
      continue;
    }

    // List items
    if (/^\s*([•\-*]|\d+\.)\s/.test(line)) {
      const items: { ordered: boolean; text: string }[] = [];
      while (i < lines.length) {
        const m = lines[i].match(/^\s*([•\-*]|\d+\.)\s+(.*)/);
        if (!m) break;
        items.push({ ordered: m[1] !== '•' && m[1] !== '-' && m[1] !== '*', text: m[2] });
        i++;
      }
      const ordered = items[0]?.ordered ?? false;
      blocks.push(
        <ul key={key++} className={`space-y-0.5 my-1 ${ordered ? 'list-decimal list-inside' : ''}`}>
          {items.map((it, j) =>
            it.text.includes('(Source:')
              ? <EvidenceRow key={j} text={it.text} onMap={onMap} />
              : <li key={j} className="flex items-start gap-1.5">
                  <span className="text-purple-400 mt-px shrink-0">{it.ordered ? `${j + 1}.` : '•'}</span>
                  <span className="text-[9px] text-slate-300 leading-relaxed">{inline(it.text, onMap)}</span>
                </li>,
          )}
        </ul>,
      );
      continue;
    }

    // Paragraph (accumulate until blank/next block)
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*(```|>|[•\-*]|\d+\.\s|#|\||---)/.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    pushParagraph(buf);
    if (i < lines.length && lines[i].trim() === '') i++;
  }

  return <div className="space-y-1">{blocks}</div>;
}
