import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Brain, Check, ChevronDown, ChevronUp, CircleAlert, Copy, Crosshair, History, Info,
  LineChart, MapPin, RefreshCw, Send, Sparkles, X, Zap,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDesigner } from '../../store/designerStore';
import { useApp } from '../../store/AppContext';
import { usePrediction } from '../../hooks/usePrediction';
import { GATEWAYS } from '../../utils/network';
import { WEATHER } from '../../data/mockData';
import {
  answerQuestion,
  type AssistantAnswer, type AssistantSnapshot, type EvidenceItem,
} from '../../utils/assistantEngine';
import type { AISuggestion } from '../../data/designerTypes';
import { formatTimeAgo } from '../../utils/helpers';

const SEVERITY_STYLE: Record<AISuggestion['severity'], { color: string; icon: React.ReactNode }> = {
  error: { color: '#ef4444', icon: <CircleAlert className="w-3.5 h-3.5" /> },
  warning: { color: '#f59e0b', icon: <CircleAlert className="w-3.5 h-3.5" /> },
  info: { color: '#38bdf8', icon: <Info className="w-3.5 h-3.5" /> },
  success: { color: '#22c55e', icon: <Check className="w-3.5 h-3.5" /> },
};

const SUGGESTED_QUESTIONS = [
  'Which bench is the most dangerous right now?',
  'Why is the highest-risk sensor critical?',
  'Show sensors with vibration above 5 mm/s',
  'Which gateway has the highest traffic?',
  'How many sensors are offline?',
  'Which bench has poor coverage?',
  'Why is communication rerouted?',
  'Which sensors require maintenance?',
  'Show the last 24 hours for SN-021',
  'What is the predicted failure time?',
];

const METRIC_COLORS: Record<string, string> = {
  tilt: '#f59e0b',
  vibration: '#ef4444',
  moisture: '#38bdf8',
  risk: '#a78bfa',
  battery: '#22c55e',
};

export function AIAssistantPanel() {
  const app = useApp();
  const { prediction } = usePrediction();
  const suggestions = useDesigner(s => s.suggestions);
  const review = useDesigner(s => s.review);
  const applySuggestion = useDesigner(s => s.applySuggestion);
  const dismissSuggestion = useDesigner(s => s.dismissSuggestion);
  const designerObjects = useDesigner(s => s.objects);
  const designerLinks = useDesigner(s => s.links);
  const validation = useDesigner(s => s.validation);

  const [thinking, setThinking] = useState(true);
  const [answers, setAnswers] = useState<AssistantAnswer[]>([]);
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('rocksentinel-ai-queries') ?? localStorage.getItem('rocksafe-ai-queries') ?? '[]'); } catch { return []; }
  });
  const [reviewOpen, setReviewOpen] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => { review(); setThinking(false); }, 1400);
    return () => clearTimeout(t);
  }, [review]);

  const snapshot: AssistantSnapshot = useMemo(() => ({
    sensors: app.sensors,
    zones: app.zones,
    alerts: app.alerts,
    prediction,
    events: app.events,
    weather: WEATHER,
    objects: designerObjects,
    links: designerLinks,
    deploymentScore: validation?.score ?? null,
  }), [app, prediction, designerObjects, designerLinks, validation?.score]);

  const ask = (text: string) => {
    const question = text.trim();
    if (!question || thinking) return;
    setThinking(true);
    setQuery('');
    setRecent(prev => {
      const next = [question, ...prev.filter(q => q !== question)].slice(0, 8);
      localStorage.setItem('rocksentinel-ai-queries', JSON.stringify(next));
      return next;
    });
    // Compose delay for realism; the answer itself is computed from live state
    setTimeout(() => {
      setAnswers(prev => [answerQuestion(snapshot, question), ...prev].slice(0, 12));
      setThinking(false);
    }, 650);
  };

  const runReview = () => {
    setThinking(true);
    setTimeout(() => { review(); setThinking(false); }, 900);
  };

  const mapAction = (e: EvidenceItem) => {
    if (!e.targetId) { app.setCurrentPage('digital-twin'); return; }
    if (e.kind === 'sensor' || e.kind === 'zone') {
      if (e.kind === 'sensor') app.selectSensor(e.targetId);
      else app.selectZone(e.targetId);
      app.setCurrentPage('digital-twin');
      return;
    }
    if (e.kind === 'gateway' && GATEWAYS.some(g => g.id === e.targetId)) {
      app.setCurrentPage('digital-twin');
      return;
    }
    const obj = designerObjects.find(o => o.id === e.targetId);
    if (obj) useDesigner.getState().selectObject(obj.id, true);
    app.setCurrentPage('mine-designer');
  };

  const viewSensor = (id?: string) => {
    app.selectSensor(id ?? null);
    app.setCurrentPage('digital-twin');
  };

  const viewTrend = (id?: string) => {
    app.selectSensor(id ?? null);
    app.setCurrentPage('digital-twin');
  };

  const viewPrediction = () => {
    app.setCurrentPage('digital-twin');
    if (prediction && prediction.tier === 'emergency') app.setEmergencyOpen(true);
  };

  const copyAnswer = async (a: AssistantAnswer) => {
    const lines = [
      `[RockSentinel AI Ops Assistant] ${a.question}`,
      '',
      `SUMMARY: ${a.summary}`,
      '',
      'EVIDENCE:',
      ...a.evidence.map(e => `• ${e.label} = ${e.value}  (Source: ${e.source})`),
      '',
      `AI REASONING: ${a.reasoning}`,
      '',
      `RECOMMENDATION: ${a.recommendation}`,
      '',
      `CONFIDENCE: ${a.confidence}%`,
    ];
    try { await navigator.clipboard.writeText(lines.join('\n')); } catch { /* clipboard unavailable */ }
  };

  return (
    <motion.aside
      className="w-[292px] shrink-0 z-40 flex flex-col min-h-0"
      style={{
        background: 'rgba(9,14,24,0.88)',
        backdropFilter: 'blur(18px)',
        borderLeft: '1px solid rgba(56,189,248,0.12)',
      }}
      initial={{ x: 60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] as const }}
    >
      {/* Header */}
      <div className="shrink-0 px-3.5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="relative w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.35)', boxShadow: '0 0 12px rgba(167,139,250,0.15)' }}>
            <Brain className="w-3.5 h-3.5 text-purple-300" />
          </div>
          <div className="flex-1">
            <div className="text-[10px] font-display font-bold tracking-[0.18em] text-slate-200 uppercase">
              AI Assistant
            </div>
            <div className="text-[7.5px] font-mono text-slate-500 tracking-wider">
              MINE OPS COPILOT · LIVE DATA ONLY
            </div>
          </div>
          <span className={`flex items-center gap-1 text-[7.5px] font-mono font-bold ${thinking ? 'text-purple-300' : 'text-green-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${thinking ? 'bg-purple-400 animate-pulse' : 'bg-green-400'}`}
              style={{ boxShadow: thinking ? '0 0 6px #a78bfa' : '0 0 6px #22c55e' }} />
            {thinking ? 'ANALYZING' : 'READY'}
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3">
        {/* ── Suggested questions ── */}
        <div>
          <div className="text-[8px] font-display font-bold tracking-[0.18em] text-slate-500 uppercase mb-1.5 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-purple-400" /> Suggested Questions
          </div>
          <div className="flex flex-wrap gap-1">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => ask(q)}
                disabled={thinking}
                className="px-1.5 py-0.5 rounded text-[7.5px] font-mono transition-all duration-150 disabled:opacity-40 hover:scale-[1.03] text-left"
                style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.22)', color: '#b7a8e8' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* ── Answers ── */}
        {thinking && answers.length === 0 && (
          <div className="space-y-2">
            {[0, 1].map(i => (
              <div key={i} className="glass-panel-subtle p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full shimmer-block" />
                  <div className="h-2 flex-1 rounded shimmer-block" />
                </div>
                <div className="h-2 rounded shimmer-block w-3/4" />
              </div>
            ))}
            <p className="text-[8px] font-mono text-slate-600 text-center pt-1 animate-pulse">
              COMPOSING GROUNDED ANSWER…
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {answers.map((a, i) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, transition: { duration: 0.18 } }}
              transition={{ delay: i * 0.04, duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] as const }}
            >
              <AnswerCard
                answer={a}
                onMap={mapAction}
                onViewSensor={viewSensor}
                onViewTrend={viewTrend}
                onViewPrediction={viewPrediction}
                onCopy={copyAnswer}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* ── Recent queries ── */}
        {recent.length > 0 && (
          <div>
            <div className="text-[8px] font-display font-bold tracking-[0.18em] text-slate-500 uppercase mb-1.5 flex items-center gap-1">
              <History className="w-2.5 h-2.5 text-slate-500" /> Recent Queries
            </div>
            <div className="flex flex-wrap gap-1">
              {recent.slice(0, 6).map(q => (
                <button
                  key={q}
                  onClick={() => ask(q)}
                  disabled={thinking}
                  className="px-1.5 py-0.5 rounded text-[7.5px] font-mono text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-40 text-left"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {q.length > 34 ? `${q.slice(0, 34)}…` : q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Deployment review (existing assistant preserved) ── */}
        <div className="glass-panel-subtle overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-2.5 py-2"
            onClick={() => setReviewOpen(v => !v)}
          >
            <span className="text-[8px] font-display font-bold tracking-[0.18em] text-slate-400 uppercase flex items-center gap-1.5">
              <Zap className="w-2.5 h-2.5 text-cyan-400" /> Deployment Review
            </span>
            {reviewOpen ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
          </button>
          {reviewOpen && (
            <div className="px-2 pb-2 space-y-2">
              {suggestions.length === 0 ? (
                <p className="text-[8px] text-slate-500 px-1">Run a review to check the deployment.</p>
              ) : (
                suggestions.map((s, i) => {
                  const style = SEVERITY_STYLE[s.severity];
                  return (
                    <div key={s.id} className="p-2 rounded-md" style={{ border: `1px solid ${s.severity === 'success' ? 'rgba(34,197,94,0.25)' : `${style.color}2e`}`, background: 'rgba(255,255,255,0.02)' }}>
                      <div className="flex items-start gap-1.5">
                        <span className="mt-0.5 shrink-0" style={{ color: style.color }}>{style.icon}</span>
                        <p className="flex-1 text-[8px] text-slate-300 leading-relaxed">{s.text}</p>
                      </div>
                      <div className="flex gap-1 mt-1.5">
                        <button
                          disabled={s.applied}
                          onClick={() => applySuggestion(s.id)}
                          className="flex-1 py-0.5 rounded text-[7px] font-display font-bold tracking-wider transition-all duration-150 disabled:opacity-40"
                          style={{
                            background: s.applied ? 'rgba(34,197,94,0.12)' : 'rgba(34,211,238,0.12)',
                            border: `1px solid ${s.applied ? 'rgba(34,197,94,0.4)' : 'rgba(34,211,238,0.35)'}`,
                            color: s.applied ? '#4ade80' : '#67e8f9',
                          }}
                        >
                          {s.applied ? 'APPLIED' : 'APPLY'}
                        </button>
                        {!s.applied && (
                          <button
                            onClick={() => dismissSuggestion(s.id)}
                            className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/[0.06] text-slate-500 hover:text-slate-300"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Ask input ── */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 pt-2 pb-1">
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') ask(query); }}
            placeholder="Ask about live system data…"
            className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] rounded-lg px-2 py-1.5 text-[8.5px] font-mono text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-400/40"
          />
          <button
            onClick={() => ask(query)}
            disabled={thinking || !query.trim()}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-150 disabled:opacity-40 hover:scale-[1.05]"
            style={{ background: 'rgba(167,139,250,0.14)', border: '1px solid rgba(167,139,250,0.4)', color: '#c4b5fd' }}
          >
            <Send className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-white/[0.06] px-3 py-2.5">
        <button
          onClick={runReview}
          disabled={thinking}
          className="w-full py-1.5 rounded-lg text-[8.5px] font-display font-bold tracking-wider flex items-center justify-center gap-1.5 transition-all duration-150 disabled:opacity-50 hover:scale-[1.02]"
          style={{ background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.35)', color: '#c4b5fd' }}
        >
          <RefreshCw className={`w-3 h-3 ${thinking ? 'animate-sweep' : ''}`} />
          REVIEW DEPLOYMENT
        </button>
        <div className="flex items-center gap-1.5 mt-2">
          <Zap className="w-2.5 h-2.5 text-emerald-500/70" />
          <p className="text-[7px] font-mono text-slate-600">
            Grounded in live system data · zero-hallucination policy
          </p>
        </div>
      </div>
    </motion.aside>
  );
}

/* ─────────────────────── Engineering report card ─────────────────────── */

function AnswerCard({ answer: a, onMap, onViewSensor, onViewTrend, onViewPrediction, onCopy }: {
  answer: AssistantAnswer;
  onMap: (e: EvidenceItem) => void;
  onViewSensor: (id?: string) => void;
  onViewTrend: (id?: string) => void;
  onViewPrediction: () => void;
  onCopy: (a: AssistantAnswer) => void;
}) {
  const sensorId = a.evidence.find(e => e.kind === 'sensor')?.targetId;
  const accent = a.verified ? '#38bdf8' : '#ef4444';
  const chart = a.charts?.[0];

  return (
    <div
      className="glass-panel-subtle p-2.5"
      style={{ borderColor: a.verified ? 'rgba(56,189,248,0.22)' : 'rgba(239,68,68,0.35)', borderLeft: `2px solid ${accent}` }}
    >
      {/* Question + meta */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="flex-1 text-[8.5px] font-mono text-slate-400 leading-snug">“{a.question}”</p>
        <span className="shrink-0 text-[7px] font-mono text-slate-600">{formatTimeAgo(new Date(a.ts).toISOString())}</span>
      </div>

      {!a.verified && (
        <div className="flex items-center gap-1 mb-1.5">
          <span className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
            NO HALLUCINATION · UNVERIFIED
          </span>
        </div>
      )}

      {/* Summary */}
      <ReportBlock label="Summary">
        <p className={`text-[8.5px] leading-relaxed ${a.verified ? 'text-slate-200' : 'text-red-300'}`}>{a.summary}</p>
      </ReportBlock>

      {/* Evidence */}
      {a.evidence.length > 0 && (
        <ReportBlock label="Evidence">
          <div className="space-y-1">
            {a.evidence.map((e, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-[8px] text-slate-500 w-[74px] shrink-0">{e.label}</span>
                <span className="flex-1 text-[8.5px] font-mono text-slate-200 text-right truncate" title={e.value}>{e.value}</span>
                {e.targetId ? (
                  <button
                    onClick={() => onMap(e)}
                    className="shrink-0 px-1 py-0.5 rounded text-[6.5px] font-mono transition-all hover:scale-105 flex items-center gap-0.5"
                    style={{ background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)', color: '#67e8f9' }}
                    title="Highlight on map"
                  >
                    <MapPin className="w-2 h-2" />{e.source}
                  </button>
                ) : (
                  <span className="shrink-0 px-1 py-0.5 rounded text-[6.5px] font-mono"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
                    {e.source}
                  </span>
                )}
              </div>
            ))}
          </div>
        </ReportBlock>
      )}

      {/* AI reasoning */}
      <ReportBlock label="AI Reasoning">
        <p className="text-[8.5px] text-slate-400 leading-relaxed">{a.reasoning}</p>
      </ReportBlock>

      {/* Recommendation */}
      <ReportBlock label="Recommendation">
        <p className="text-[8.5px] text-slate-300 leading-relaxed">{a.recommendation}</p>
      </ReportBlock>

      {/* Chart */}
      {chart && (
        <div className="mt-2 rounded-md overflow-hidden" style={{ background: 'rgba(5,10,18,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-2 pt-1.5 flex items-center justify-between">
            <span className="text-[7px] font-mono text-slate-500">{chart.title}</span>
            <span className="flex gap-1">
              {chart.metrics.map(m => (
                <span key={m} className="flex items-center gap-0.5 text-[6.5px] font-mono" style={{ color: METRIC_COLORS[m] }}>
                  <span className="w-1 h-1 rounded-full" style={{ background: METRIC_COLORS[m] }} />{m}
                </span>
              ))}
            </span>
          </div>
          <div className="h-24 mt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart.points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  {chart.metrics.map(m => (
                    <linearGradient key={m} id={`grad-${a.id}-${m}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={METRIC_COLORS[m]} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={METRIC_COLORS[m]} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="label" hide />
                <YAxis hide domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ background: 'rgba(10,16,28,0.95)', border: '1px solid rgba(56,189,248,0.25)', borderRadius: 6, fontSize: 8, color: '#e2e8f0', padding: 6 }}
                  labelStyle={{ fontSize: 7, color: '#64748b' }}
                />
                {chart.keys.map((key, ki) => {
                  const m = chart.keyMetrics[ki];
                  return (
                    <Area key={key} type="monotone" dataKey={key} stroke={METRIC_COLORS[m]} strokeWidth={1.2} fill={`url(#grad-${a.id}-${m})`} isAnimationActive={false} />
                  );
                })}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Confidence */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[7px] font-mono text-slate-500">CONFIDENCE</span>
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: a.verified ? (a.confidence >= 80 ? '#22c55e' : a.confidence >= 55 ? '#eab308' : '#f97316') : '#ef4444', boxShadow: '0 0 6px rgba(56,189,248,0.4)' }}
            initial={{ width: 0 }}
            animate={{ width: `${a.confidence}%` }}
            transition={{ duration: 0.6 }}
          />
        </div>
        <span className="text-[8.5px] font-mono font-bold tabular-nums"
          style={{ color: a.verified ? (a.confidence >= 80 ? '#4ade80' : a.confidence >= 55 ? '#facc15' : '#fb923c') : '#f87171' }}>
          {a.confidence}%
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-1 mt-2">
        <ActionBtn label="COPY" onClick={() => onCopy(a)} icon={<Copy className="w-2.5 h-2.5" />} />
        <ActionBtn label="MAP" onClick={() => onMap(a.evidence[0] ?? { label: '', value: '', source: 'Twin' } as EvidenceItem)} icon={<Crosshair className="w-2.5 h-2.5" />} />
        {sensorId && <ActionBtn label="SENSOR" onClick={() => onViewSensor(sensorId)} icon={<MapPin className="w-2.5 h-2.5" />} />}
        {sensorId && <ActionBtn label="TREND" onClick={() => onViewTrend(sensorId)} icon={<LineChart className="w-2.5 h-2.5" />} />}
        <ActionBtn label="PREDICTION" onClick={onViewPrediction} icon={<Brain className="w-2.5 h-2.5" />} />
      </div>
    </div>
  );
}

function ReportBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1.5">
      <span className="text-[7px] font-display font-bold tracking-[0.18em] text-slate-500 uppercase">{label}</span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function ActionBtn({ label, onClick, icon }: { label: string; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-1 rounded text-[7px] font-display font-bold tracking-wider flex items-center justify-center gap-1 transition-all duration-150 hover:scale-[1.03]"
      style={{ background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.25)', color: '#7dd3fc' }}
    >
      {icon}{label}
    </button>
  );
}
