import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Brain, Copy, Crosshair, Download, FileText, History, LineChart,
  MapPin, MessageSquare, Plus, Radar, Send, Sparkles, Trash2, Wifi,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../store/AppContext';
import { usePrediction } from '../hooks/usePrediction';
import { useDesigner } from '../store/designerStore';
import type { DesignerLink, DesignerObject, ValidationResult } from '../data/designerTypes';
import { WEATHER, SENSOR_HISTORY } from '../data/mockData';
import { buildNetwork, GATEWAYS } from '../utils/network';
import {
  answerQuestion, trendChartFor,
  type AssistantSnapshot, type TrendChartSpec,
} from '../utils/assistantEngine';
import { streamAssistant } from '../services/assistantService';
import { Markdown, extractEntities, type EntityKind } from '../utils/markdown';
import {
  formatTimeAgo, getRiskLabel, scoreToRisk, tierColors, tierLabels,
} from '../utils/helpers';

/* ───────────────────────────── types ───────────────────────────── */

type MessageStatus = 'streaming' | 'complete' | 'fallback' | 'error';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
  status: MessageStatus;
  source?: 'groq' | 'engine';
  charts?: TrendChartSpec[];
}

interface Session {
  id: string;
  title: string;
  ts: number;
  messages: ChatMessage[];
}

const SUGGESTED_QUESTIONS = [
  'Which bench is currently the most dangerous?',
  'Why is SN-021 red?',
  'Compare SN-021 and SN-018.',
  'Show vibration trend for SN-021.',
  'Which sensors require maintenance?',
  'Which gateway has the highest traffic?',
  'Why did the AI classify this as Emergency?',
  'What caused today\'s highest risk?',
  'Show LoRa mesh health.',
  'Show deployment coverage.',
];

const SESSION_KEY = 'rocksentinel-sessions';
const METRIC_COLORS: Record<string, string> = {
  tilt: '#f59e0b', vibration: '#ef4444', moisture: '#38bdf8', risk: '#a78bfa', battery: '#22c55e',
};

/* ───────────────────── live context collection ───────────────────── */

function buildLiveContext(
  app: ReturnType<typeof useApp>,
  prediction: ReturnType<typeof usePrediction>['prediction'],
  objects: DesignerObject[],
  links: DesignerLink[],
  validation: ValidationResult | null,
): Record<string, unknown> {
  const network = buildNetwork(app.sensors);
  const gatewayTraffic: Record<string, number> = {};
  network.links.forEach(l => { if (GATEWAYS.some(g => g.id === l.to)) gatewayTraffic[l.to] = (gatewayTraffic[l.to] ?? 0) + 1; });

  const topSensors = [...app.sensors]
    .filter(s => s.status !== 'offline')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3);

  return {
    timestamp: new Date().toISOString(),
    prediction: prediction
      ? { score: prediction.score, tier: prediction.tier, confidence: prediction.confidence, recommendation: prediction.recommendation, at: Date.now() }
      : null,
    weather: WEATHER,
    sensors: app.sensors.map(s => ({
      id: s.id, zone: s.zone, bench: s.bench, status: s.status, riskScore: s.riskScore,
      tilt: s.tilt, vibration: s.vibration, moisture: s.moisture, temperature: s.temperature,
      humidity: s.humidity, battery: s.battery, signalStrength: s.signalStrength,
      predictionConfidence: s.predictionConfidence, lastUpdated: s.lastUpdated,
    })),
    zones: app.zones.map(z => ({
      id: z.id, name: z.name, shortName: z.shortName, currentRisk: z.currentRisk,
      historicalRisk: z.historicalRisk, predictedFailureTime: z.predictedFailureTime,
      predictionHours: z.predictionHours, confidence: z.confidence,
      activeSensorIds: z.activeSensorIds, contributingFactors: z.contributingFactors,
    })),
    alerts: app.alerts.map(a => ({
      id: a.id, type: a.type, time: a.time, location: a.location, sensorId: a.sensorId,
      reason: a.reason, confidence: a.confidence, acknowledgedBy: a.acknowledgedBy, resolved: a.resolved,
    })),
    network: {
      coverage: network.coverage,
      offlineCount: network.offlineCount,
      reroutedCount: network.reroutedCount,
      totalLinks: network.links.length,
      gatewayTraffic,
      gateways: GATEWAYS.map(g => g.id),
    },
    selected: {
      sensor: app.selectedSensor ? { id: app.selectedSensor.id, zone: app.selectedSensor.zone, bench: app.selectedSensor.bench, status: app.selectedSensor.status } : null,
      zone: app.selectedZone ? { id: app.selectedZone.id, name: app.selectedZone.name, currentRisk: app.selectedZone.currentRisk } : null,
    },
    history: Object.fromEntries(topSensors.map(s => [s.id, (SENSOR_HISTORY[s.id] ?? []).slice(-24)])),
    deployment: {
      objects: objects.map(o => ({ id: o.id, type: o.type, name: o.name, bench: o.bench, status: o.status })),
      links: links.map(l => ({ id: l.id, from: l.from, to: l.to, latency: l.latency })),
      validationScore: validation?.score ?? null,
    },
  };
}

function answerToText(a: ReturnType<typeof answerQuestion>): string {
  const lines: string[] = [
    `# ${a.summary}`,
    '',
    '## Evidence',
    ...a.evidence.map(e => `• ${e.label} = ${e.value} (Source: ${e.source})`),
    ...(a.evidence.length === 0 ? ['I cannot verify this using the current system data.'] : []),
    '',
    '## AI Reasoning',
    a.reasoning,
    '',
    '## Recommendation',
    a.recommendation,
    '',
    `**Confidence:** ${a.confidence}%`,
  ];
  return lines.join('\n');
}

function entityLabel(kind: EntityKind): string {
  return { sensor: 'sensor', zone: 'zone', gateway: 'gateway', relay: 'relay', camera: 'camera', pole: 'pole', bench: 'bench', deployment: 'object' }[kind];
}

/* ─────────────────────────────── page ─────────────────────────────── */

export function RockSentinelAIPage() {
  const app = useApp();
  const { prediction } = usePrediction();
  const designerObjects = useDesigner(s => s.objects);
  const designerLinks = useDesigner(s => s.links);
  const validation = useDesigner(s => s.validation);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [sessions, setSessions] = useState<Session[]>(() => {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) ?? '[]'); } catch { return []; }
  });
  const [activeId, setActiveId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const msgIdRef = useRef(0);
  const nextId = () => `m-${Date.now()}-${++msgIdRef.current}`;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const persist = useCallback((msgs: ChatMessage[], id: string | null) => {
    setSessions(prev => {
      let next = prev;
      if (id) {
        if (next.some(s => s.id === id)) {
          next = next.map(s => (s.id === id ? { ...s, messages: msgs } : s));
        } else {
          const title = msgs.find(m => m.role === 'user')?.text ?? 'New conversation';
          next = [{ id, title, ts: Date.now(), messages: msgs }, ...next];
        }
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(next.slice(0, 10)));
      return next;
    });
  }, []);

  const patchMessage = useCallback((id: string, patch: Partial<ChatMessage>) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const mapTo = useCallback((kind: EntityKind, id: string) => {
    if (kind === 'sensor') {
      app.selectSensor(id);
      app.setCurrentPage('digital-twin');
      return;
    }
    if (kind === 'zone') {
      app.selectZone(id);
      app.setCurrentPage('digital-twin');
      return;
    }
    if (kind === 'gateway' && GATEWAYS.some(g => g.id === id)) {
      app.setCurrentPage('digital-twin');
      return;
    }
    if (kind === 'bench') {
      const benchIdx = parseInt(id.replace(/\D/g, ''), 10) - 1;
      const zone = app.zones.find(z => z.levels && benchIdx >= z.levels[0] && benchIdx <= z.levels[1]);
      if (zone) app.selectZone(zone.id);
      app.setCurrentPage('digital-twin');
      return;
    }
    const obj = designerObjects.find(o => o.id === id);
    if (obj) useDesigner.getState().selectObject(obj.id, true);
    app.setCurrentPage('mine-designer');
  }, [app, designerObjects]);

  /* Streaming is handled by the dedicated runner inside ask() */

  const ask = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text || streaming) return;
    const userMsg: ChatMessage = { id: nextId(), role: 'user', text, ts: Date.now(), status: 'complete' };
    const aiId = nextId();
    const aiMsg: ChatMessage = { id: aiId, role: 'assistant', text: '', ts: Date.now(), status: 'streaming' };

    const sessionId = activeId ?? `s-${Date.now()}`;
    setActiveId(sessionId);
    const nextMessages: ChatMessage[] = [...messages, userMsg, aiMsg];
    setMessages(nextMessages);
    setInput('');
    setStreaming(true);

    const context = buildLiveContext(app, prediction, designerObjects, designerLinks, validation);
    const abort = new AbortController();
    abortRef.current = abort;

    let finalText = '';
    let status: MessageStatus = 'complete';
    let source: 'groq' | 'engine' = 'groq';
    let charts: TrendChartSpec[] | undefined;
    const onDelta = (delta: string) => {
      finalText += delta;
      setMessages(prev => prev.map(m => (m.id === aiId ? { ...m, text: m.text + delta } : m)));
    };

    try {
      await streamAssistant(text, context, onDelta, abort.signal);
    } catch (err) {
      const snap: AssistantSnapshot = {
        sensors: app.sensors, zones: app.zones, alerts: app.alerts,
        prediction, events: app.events, weather: WEATHER,
        objects: designerObjects, links: designerLinks,
        deploymentScore: validation?.score ?? null,
      };
      const answer = answerQuestion(snap, text);
      finalText = answerToText(answer);
      source = 'engine';
      charts = answer.charts;
      if (err instanceof DOMException && err.name === 'AbortError') {
        status = 'complete';
        source = 'groq';
      } else {
        status = 'fallback';
      }
    }
    setStreaming(false);
    patchMessage(aiId, { text: finalText, status, source, charts });
    persist(
      [...nextMessages.slice(0, -1), { ...nextMessages[nextMessages.length - 1], text: finalText, status, source, charts }],
      sessionId,
    );
  }, [app, prediction, designerObjects, designerLinks, validation, streaming, activeId, messages, persist, patchMessage]);

  const newConversation = () => {
    abortRef.current?.abort();
    setMessages([]);
    setActiveId(null);
    setStreaming(false);
  };

  const loadSession = (s: Session) => {
    abortRef.current?.abort();
    setMessages(s.messages);
    setActiveId(s.id);
    setStreaming(false);
  };

  return (
    <div className="relative w-full h-full flex min-h-0 overflow-hidden">
      {/* Animated gradient backdrop */}
      <div className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(60% 50% at 20% 0%, rgba(167,139,250,0.08) 0%, transparent 60%), radial-gradient(50% 40% at 85% 100%, rgba(34,211,238,0.06) 0%, transparent 60%)',
      }} />

      {/* ── LEFT: Conversation history ── */}
      <aside className="w-[248px] shrink-0 flex flex-col min-h-0 border-r border-white/[0.06] relative z-10"
        style={{ background: 'rgba(9,14,24,0.66)', backdropFilter: 'blur(14px)' }}>
        <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-[9px] font-display font-bold tracking-[0.18em] text-slate-300 uppercase flex items-center gap-1.5">
            <MessageSquare className="w-3 h-3 text-purple-400" /> Conversations
          </span>
          <button
            onClick={newConversation}
            title="New conversation"
            className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2 space-y-1.5">
          {sessions.length === 0 && (
            <p className="text-[8px] font-mono text-slate-600 text-center pt-4 leading-relaxed">
              No saved conversations yet.<br />Ask a question to begin.
            </p>
          )}
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => loadSession(s)}
              className={`w-full text-left px-2 py-1.5 rounded-lg transition-colors ${activeId === s.id ? 'text-cyan-300' : 'text-slate-300 hover:bg-white/[0.04]'}`}
              style={activeId === s.id ? { background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.22)' } : { border: '1px solid transparent' }}
            >
              <div className="text-[8.5px] font-medium truncate">{s.title}</div>
              <div className="text-[7px] font-mono text-slate-600 mt-0.5">
                {s.messages.length} msgs · {formatTimeAgo(new Date(s.ts).toISOString())}
              </div>
            </button>
          ))}
        </div>

        <div className="px-2.5 py-2 border-t border-white/[0.06]">
          <button
            onClick={newConversation}
            className="w-full py-1.5 rounded-lg text-[8.5px] font-display font-bold tracking-wider flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 hover:bg-white/[0.05] transition-colors"
          >
            <Trash2 className="w-3 h-3" /> CLEAR CONVERSATION
          </button>
        </div>
      </aside>

      {/* ── CENTER: Chat ── */}
      <main className="flex-1 min-w-0 flex flex-col min-h-0 relative z-10">
        {/* Header */}
        <div className="shrink-0 px-4 py-2.5 border-b border-white/[0.06] flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.9), rgba(139,92,246,0.9))', boxShadow: '0 0 16px rgba(167,139,250,0.4)' }}>
            <Brain className="w-4 h-4 text-white" />
          </div>
          <div className="leading-none">
            <div className="text-[12px] font-display font-bold tracking-wide text-slate-100">
              RockSentinel AI
            </div>
            <div className="text-[7.5px] font-mono text-slate-500 tracking-wider mt-0.5">
              MINE OPERATIONS COPILOT · LIVE DATA ONLY
            </div>
          </div>
          <div className="flex-1" />
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[7.5px] font-mono font-bold"
            style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" style={{ boxShadow: '0 0 6px #22c55e' }} />
            GROQ ENGINE {streaming ? '· STREAMING' : '· READY'}
          </span>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-8">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.35), rgba(139,92,246,0.25))', border: '1px solid rgba(167,139,250,0.4)', boxShadow: '0 0 30px rgba(167,139,250,0.25)' }}
              >
                <Brain className="w-7 h-7 text-purple-300" />
              </motion.div>
              <div>
                <div className="text-[13px] font-display font-bold text-slate-200">RockSentinel AI — Operations Copilot</div>
                <p className="text-[9px] font-mono text-slate-500 mt-1 leading-relaxed">
                  Answers every engineering question using LIVE system data only.<br />
                  No fabrication. Every claim cites a sensor, gateway or model source.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-md mt-1">
                {SUGGESTED_QUESTIONS.slice(0, 6).map(q => (
                  <button
                    key={q}
                    onClick={() => ask(q)}
                    disabled={streaming}
                    className="px-2 py-1 rounded-lg text-[8px] font-mono text-purple-200 transition-all hover:scale-[1.03] disabled:opacity-40"
                    style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.25)' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          <AnimatePresence initial={false}>
            {messages.map(m => (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] as const }}
              >
                {m.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="max-w-[82%] px-3 py-2 rounded-2xl rounded-br-sm text-[10px] leading-relaxed text-slate-100"
                      style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.28)' }}>
                      {m.text}
                      <div className="text-[6.5px] font-mono text-slate-500 mt-1 text-right">
                        {new Date(m.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <AssistantMessage message={m} onMap={mapTo} onAsk={ask} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-2.5 border-t border-white/[0.06]">
          <div className="rounded-xl p-1.5 flex items-end gap-1.5"
            style={{ background: 'rgba(13,20,34,0.8)', border: '1px solid rgba(167,139,250,0.25)', boxShadow: '0 0 18px rgba(0,0,0,0.35)' }}>
            <textarea
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 132)}px`; }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void ask(input);
                }
              }}
              rows={1}
              placeholder="Ask about live mine data… (Shift+Enter for newline)"
              className="flex-1 min-h-[34px] max-h-[132px] resize-none bg-transparent px-2 py-1.5 text-[10px] text-slate-200 placeholder:text-slate-600 focus:outline-none font-mono"
            />
            <button
              onClick={() => void ask(input)}
              disabled={streaming || !input.trim()}
              className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-150 disabled:opacity-40 hover:scale-[1.05]"
              style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.5), rgba(139,92,246,0.5))', border: '1px solid rgba(167,139,250,0.5)', color: 'white', boxShadow: '0 0 14px rgba(167,139,250,0.3)' }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1.5 px-1">
            <Sparkles className="w-2.5 h-2.5 text-purple-400/70" />
            <p className="text-[7px] font-mono text-slate-600">
              Structured context → Groq (server-side key) · grounded fallback engine · zero-hallucination policy
            </p>
          </div>
        </div>
      </main>

      {/* ── RIGHT: Live Mine Context ── */}
      <LiveContext onMap={mapTo} />
    </div>
  );
}

/* ───────────────────────── assistant message ───────────────────────── */

function AssistantMessage({ message: m, onMap, onAsk }: {
  message: ChatMessage;
  onMap: (kind: EntityKind, id: string) => void;
  onAsk: (q: string) => void;
}) {
  const app = useApp();
  const { prediction } = usePrediction();
  const entities = useMemo(() => extractEntities(m.text), [m.text]);
  const sensorId = entities.find(e => e.kind === 'sensor')?.id;
  const isStreaming = m.status === 'streaming';

  const copy = async () => {
    try { await navigator.clipboard.writeText(m.text); } catch { /* clipboard unavailable */ }
  };

  const exportMd = () => {
    const blob = new Blob([`# RockSentinel AI — Answer\n\n${m.text}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rocksentinel-answer-${new Date(m.ts).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pdf = () => {
    const win = window.open('', '_blank', 'width=900,height=1200');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>RockSentinel AI — Report</title>
      <style>body{font-family:Inter,Arial,sans-serif;background:#0a0f1a;color:#e2e8f0;padding:32px;max-width:760px;margin:auto}
      h1{font-size:20px;border-bottom:1px solid #334;padding-bottom:8px}pre{white-space:pre-wrap;font-size:13px;line-height:1.6}</style></head>
      <body><h1>RockSentinel AI — Engineering Report</h1><p style="color:#64748b;font-size:11px">${new Date(m.ts).toLocaleString()}</p>
      <pre>${m.text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const viewPrediction = () => {
    app.setCurrentPage('digital-twin');
    if (prediction && prediction.tier === 'emergency') app.setEmergencyOpen(true);
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] w-full">
        <div className="glass-panel p-2.5 rounded-xl rounded-tl-sm"
          style={{ borderColor: isStreaming ? 'rgba(167,139,250,0.4)' : 'rgba(167,139,250,0.18)', boxShadow: isStreaming ? '0 0 18px rgba(167,139,250,0.12)' : 'none' }}>
          {/* Header */}
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded flex items-center justify-center"
              style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)' }}>
              <Brain className="w-3 h-3 text-purple-300" />
            </div>
            <span className="text-[8px] font-display font-bold tracking-wider text-purple-300 uppercase">RockSentinel AI</span>
            {isStreaming && (
              <span className="flex items-center gap-1 text-[7px] font-mono text-purple-300">
                <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
                <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" style={{ animationDelay: '300ms' }} />
                ANALYZING
              </span>
            )}
            {m.status === 'fallback' && (
              <span className="px-1.5 py-px rounded text-[6.5px] font-mono font-bold"
                style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
                GROUNDED ENGINE
              </span>
            )}
            {m.status === 'error' && (
              <span className="px-1.5 py-px rounded text-[6.5px] font-mono font-bold"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#f87171' }}>
                ERROR
              </span>
            )}
            <span className="flex-1" />
            <span className="text-[7px] font-mono text-slate-600">{new Date(m.ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>

          {/* Body */}
          <div className="text-[10px] leading-relaxed">
            {isStreaming ? (
              <div className="text-[9.5px] text-slate-200 leading-relaxed whitespace-pre-wrap">
                {m.text}
                <span className="inline-block w-[6px] h-3.5 align-middle ml-0.5 animate-pulse" style={{ background: '#a78bfa', boxShadow: '0 0 8px #a78bfa' }} />
              </div>
            ) : (
              <Markdown text={m.text} onMap={onMap} />
            )}
          </div>

          {/* Charts */}
          {m.charts && m.charts.map(c => <TrendChart key={c.sensorId + c.title} chart={c} />)}

          {/* Actions */}
          {!isStreaming && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-white/[0.05]">
              <MsgBtn label="COPY" icon={<Copy className="w-2.5 h-2.5" />} onClick={copy} />
              <MsgBtn label="EXPORT" icon={<Download className="w-2.5 h-2.5" />} onClick={exportMd} />
              <MsgBtn label="PDF" icon={<FileText className="w-2.5 h-2.5" />} onClick={pdf} />
              <MsgBtn label="MAP" icon={<Crosshair className="w-2.5 h-2.5" />} onClick={() => entities[0] && onMap(entities[0].kind, entities[0].id)} />
              {sensorId && <MsgBtn label="SENSOR" icon={<MapPin className="w-2.5 h-2.5" />} onClick={() => { app.selectSensor(sensorId); app.setCurrentPage('digital-twin'); }} />}
              {sensorId && <MsgBtn label="TREND" icon={<LineChart className="w-2.5 h-2.5" />} onClick={() => { app.selectSensor(sensorId); app.setCurrentPage('digital-twin'); }} />}
              <MsgBtn label="PREDICTION" icon={<Brain className="w-2.5 h-2.5" />} onClick={viewPrediction} />
              <MsgBtn label="HISTORY" icon={<History className="w-2.5 h-2.5" />} onClick={() => app.setCurrentPage('historical')} />
            </div>
          )}
        </div>
        {/* Follow-up suggestions */}
        {!isStreaming && m.role === 'assistant' && sensorId && (
          <div className="flex gap-1 mt-1 ml-1">
            <button onClick={() => onAsk(`Show the last 24 hours for ${sensorId}`)}
              className="px-1.5 py-0.5 rounded text-[7px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Show 24h history for {sensorId}
            </button>
            <button onClick={() => onAsk(`Which nodes are connected to the gateway of ${sensorId}?`)}
              className="px-1.5 py-0.5 rounded text-[7px] font-mono text-slate-500 hover:text-slate-300 transition-colors"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              Communication route
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MsgBtn({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-1.5 py-1 rounded text-[7px] font-display font-bold tracking-wider flex items-center gap-1 transition-all hover:scale-[1.04] text-slate-400 hover:text-cyan-300"
      style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.18)' }}
    >
      {icon}{label}
    </button>
  );
}

/* ───────────────────────── trend chart card ───────────────────────── */

function TrendChart({ chart }: { chart: TrendChartSpec }) {
  return (
    <div className="mt-2 rounded-lg overflow-hidden" style={{ background: 'rgba(5,10,18,0.6)', border: '1px solid rgba(167,139,250,0.18)' }}>
      <div className="px-2.5 pt-2 flex items-center justify-between">
        <span className="text-[7.5px] font-mono text-slate-500">{chart.title}</span>
        <span className="flex gap-1">
          {chart.metrics.map(m => (
            <span key={m} className="flex items-center gap-0.5 text-[6.5px] font-mono" style={{ color: METRIC_COLORS[m] }}>
              <span className="w-1 h-1 rounded-full" style={{ background: METRIC_COLORS[m] }} />{m}
            </span>
          ))}
        </span>
      </div>
      <div className="h-28 mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chart.points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              {chart.metrics.map(m => (
                <linearGradient key={m} id={`rg-${chart.sensorId}-${m}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={METRIC_COLORS[m]} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={METRIC_COLORS[m]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <XAxis dataKey="label" hide />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: 'rgba(10,16,28,0.95)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 6, fontSize: 8, color: '#e2e8f0', padding: 6 }}
              labelStyle={{ fontSize: 7, color: '#64748b' }}
            />
            {chart.keys.map((key, ki) => (
              <Area key={key} type="monotone" dataKey={key} stroke={METRIC_COLORS[chart.keyMetrics[ki]]} strokeWidth={1.3} fill={`url(#rg-${chart.sensorId}-${chart.keyMetrics[ki]})`} isAnimationActive={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ───────────────────────── live mine context ───────────────────────── */

function LiveContext({ onMap }: { onMap: (kind: EntityKind, id: string) => void }) {
  const app = useApp();
  const { prediction } = usePrediction();
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const network = useMemo(() => buildNetwork(app.sensors), [app.sensors]);
  const online = app.sensors.filter(s => s.status !== 'offline').length;
  const active = app.alerts.filter(a => !a.resolved);
  const critical = active.filter(a => a.type === 'critical').length;
  const overallRisk = prediction ? scoreToRisk(prediction.score) : Math.max(0, ...app.zones.map(z => z.currentRisk));
  const riskColor = prediction ? tierColors[prediction.tier] : overallRisk >= 85 ? '#ef4444' : overallRisk >= 65 ? '#f97316' : overallRisk >= 45 ? '#eab308' : '#22c55e';
  const riskLabel = prediction ? tierLabels[prediction.tier].toUpperCase() : getRiskLabel(overallRisk).toUpperCase();

  const mineStatus = critical > 0 || overallRisk >= 85
    ? { label: 'CRITICAL', color: '#ef4444' }
    : overallRisk >= 65
      ? { label: 'ELEVATED', color: '#f97316' }
      : app.connection === 'degraded'
        ? { label: 'DEGRADED', color: '#eab308' }
        : { label: 'OPERATIONAL', color: '#22c55e' };

  const gatewayId = app.selectedSensor
    ? [...GATEWAYS].sort((a, b) =>
        Math.hypot(a.position.x - app.selectedSensor!.position.x, a.position.z - app.selectedSensor!.position.z) -
        Math.hypot(b.position.x - app.selectedSensor!.position.x, b.position.z - app.selectedSensor!.position.z))[0].id
    : 'GW-01';

  const ctxRow = (label: string, value: string, color = '#e2e8f0', onClick?: () => void) => (
    <div className="flex items-center justify-between py-0.5" onClick={onClick}>
      <span className="text-[8px] text-slate-500">{label}</span>
      {onClick ? (
        <button className="text-[8.5px] font-mono font-bold transition-all hover:scale-105" style={{ color }}>
          {value}
        </button>
      ) : (
        <span className="text-[8.5px] font-mono font-bold tabular-nums" style={{ color }}>{value}</span>
      )}
    </div>
  );

  return (
    <aside className="w-[252px] shrink-0 flex flex-col min-h-0 border-l border-white/[0.06] relative z-10"
      style={{ background: 'rgba(9,14,24,0.66)', backdropFilter: 'blur(14px)' }}>
      <div className="px-3 py-2.5 border-b border-white/[0.06] flex items-center gap-1.5">
        <Radar className="w-3 h-3 text-cyan-400" />
        <span className="text-[9px] font-display font-bold tracking-[0.18em] text-slate-300 uppercase">Live Mine Context</span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 space-y-2.5">
        {/* Overall risk */}
        <div className="glass-panel-subtle p-2.5" style={{ borderColor: `${riskColor}40` }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[7px] font-mono text-slate-500 tracking-wider">OVERALL RISK</div>
              <div className="text-[20px] font-display font-bold leading-tight" style={{ color: riskColor, textShadow: `0 0 14px ${riskColor}66` }}>
                {riskLabel}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-mono font-bold tabular-nums" style={{ color: riskColor }}>{overallRisk}</div>
              <div className="text-[7px] font-mono text-slate-600">/ 100</div>
            </div>
          </div>
          <div className="h-1 rounded-full mt-2 overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div className="h-full rounded-full" style={{ background: riskColor, boxShadow: `0 0 8px ${riskColor}` }}
              initial={{ width: 0 }} animate={{ width: `${overallRisk}%` }} transition={{ duration: 0.6 }} />
          </div>
        </div>

        {/* Prediction */}
        <div className="glass-panel-subtle p-2.5">
          <SectionTitle label="AI PREDICTION" />
          {prediction ? (
            <div className="mt-1 space-y-1">
              {ctxRow('Score', `${prediction.score.toFixed(1)} / 10`, riskColor)}
              {ctxRow('Tier', tierLabels[prediction.tier].toUpperCase(), tierColors[prediction.tier])}
              {ctxRow('Confidence', `${(prediction.confidence * 100).toFixed(1)}%`, prediction.confidence >= 0.7 ? '#22c55e' : '#f59e0b')}
              {ctxRow('At', new Date().toLocaleTimeString())}
              <p className="text-[7.5px] text-slate-500 leading-relaxed mt-1">{prediction.recommendation}</p>
            </div>
          ) : (
            <p className="text-[8px] font-mono text-slate-600 mt-1">No prediction result yet</p>
          )}
        </div>

        {/* Weather */}
        <div className="glass-panel-subtle p-2.5">
          <SectionTitle label="WEATHER" />
          <div className="mt-1 space-y-1">
            {ctxRow('Condition', WEATHER.condition, '#38bdf8')}
            {ctxRow('Temperature', `${WEATHER.temperature}°C`)}
            {ctxRow('Humidity', `${WEATHER.humidity}%`)}
            {ctxRow('Wind', `${WEATHER.windSpeed} m/s ${WEATHER.windDirection}`)}
            {ctxRow('Rainfall 24h', `${WEATHER.rainfall} mm`, WEATHER.rainfall > 2 ? '#f59e0b' : '#e2e8f0')}
          </div>
        </div>

        {/* Sensors */}
        <div className="glass-panel-subtle p-2.5">
          <SectionTitle label="SENSOR NETWORK" />
          <div className="mt-1 space-y-1">
            {ctxRow('Online', `${online} / ${app.sensors.length}`, '#22c55e')}
            {ctxRow('Offline', `${network.offlineCount}`, network.offlineCount > 0 ? '#ef4444' : '#e2e8f0')}
            {ctxRow('Battery < 30%', `${app.sensors.filter(s => s.battery < 30).length}`, app.sensors.some(s => s.battery < 30) ? '#f59e0b' : '#e2e8f0')}
          </div>
        </div>

        {/* Alerts */}
        <div className="glass-panel-subtle p-2.5">
          <SectionTitle label="ALERTS" />
          <div className="mt-1 space-y-1">
            {ctxRow('Active', `${active.length}`, active.length > 0 ? '#f59e0b' : '#22c55e')}
            {ctxRow('Critical', `${critical}`, critical > 0 ? '#ef4444' : '#e2e8f0')}
            {active.slice(0, 2).map(a => (
              <p key={a.id} className="text-[7.5px] text-slate-500 leading-relaxed">• {a.reason}</p>
            ))}
          </div>
        </div>

        {/* Communication */}
        <div className="glass-panel-subtle p-2.5">
          <SectionTitle label="COMMUNICATION" />
          <div className="mt-1 space-y-1">
            {ctxRow('Coverage', `${network.coverage}%`, network.coverage >= 85 ? '#22c55e' : '#f59e0b')}
            {ctxRow('Rerouted Links', `${network.reroutedCount}`, network.reroutedCount > 0 ? '#f97316' : '#e2e8f0')}
            {ctxRow('Uplink', app.connection.toUpperCase(), app.connection === 'online' ? '#22c55e' : app.connection === 'degraded' ? '#f59e0b' : '#ef4444')}
          </div>
        </div>

        {/* Selected */}
        <div className="glass-panel-subtle p-2.5">
          <SectionTitle label="SELECTED" />
          <div className="mt-1 space-y-1">
            {ctxRow('Sensor', app.selectedSensor?.id ?? '—', '#38bdf8', app.selectedSensor ? () => onMap('sensor', app.selectedSensor!.id) : undefined)}
            {ctxRow('Zone', app.selectedZone?.id ?? '—', '#38bdf8', app.selectedZone ? () => onMap('zone', app.selectedZone!.id) : undefined)}
            {ctxRow('Gateway', gatewayId, '#38bdf8', () => onMap('gateway', gatewayId))}
          </div>
        </div>
      </div>

      {/* Footer: status + clock */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[8px] font-mono font-bold" style={{ color: mineStatus.color }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: mineStatus.color, boxShadow: `0 0 6px ${mineStatus.color}` }} />
            MINE {mineStatus.label}
          </span>
          <span className="flex items-center gap-1 text-[8px] font-mono text-slate-500">
            <Wifi className="w-2.5 h-2.5" />
            {now.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
        <div className="text-[7px] font-mono text-slate-600 mt-1.5">
          {now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · UPDATES LIVE
        </div>
      </div>
    </aside>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <div className="text-[7.5px] font-display font-bold tracking-[0.18em] text-slate-500 uppercase">{label}</div>
  );
}

export default RockSentinelAIPage;
