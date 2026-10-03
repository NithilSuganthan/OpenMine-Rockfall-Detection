import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck, CircleAlert, Info, TriangleAlert, X,
} from 'lucide-react';
import { useDesigner } from '../../store/designerStore';
import type { ValidationIssue } from '../../data/designerTypes';

const SEVERITY_ICON: Record<ValidationIssue['severity'], React.ReactNode> = {
  error: <TriangleAlert className="w-3.5 h-3.5 text-red-400" />,
  warning: <CircleAlert className="w-3.5 h-3.5 text-amber-400" />,
  info: <Info className="w-3.5 h-3.5 text-sky-400" />,
};

const SEVERITY_COLOR: Record<ValidationIssue['severity'], string> = {
  error: '#ef4444',
  warning: '#f59e0b',
  info: '#38bdf8',
};

export function ValidationPanel() {
  const validation = useDesigner(s => s.validation);
  const focusOn = useDesigner(s => s.focusOn);
  const selectObject = useDesigner(s => s.selectObject);
  const objects = useDesigner(s => s.objects);
  const setValidation = useDesigner(s => s.setValidation);

  if (!validation) return null;

  const passing = validation.errorCount === 0 && validation.warningCount === 0;
  const gradeColor = validation.score >= 90 ? '#22c55e' : validation.score >= 78 ? '#38bdf8' : validation.score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <AnimatePresence>
      <motion.div
        className="absolute bottom-3 left-3 z-30 w-[300px] max-h-[46%] flex flex-col glass-panel overflow-hidden hud-corners"
        style={{ borderColor: passing ? 'rgba(34,197,94,0.35)' : 'rgba(249,115,22,0.35)' }}
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] as const }}
      >
        {/* Header */}
        <div className="shrink-0 px-3 py-2.5 flex items-center gap-2.5 border-b border-white/[0.06]">
          <svg viewBox="0 0 36 36" className="w-9 h-9 shrink-0">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke={gradeColor}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${validation.score * 0.975} 97.5`}
              transform="rotate(-90 18 18)"
              style={{ filter: `drop-shadow(0 0 4px ${gradeColor})` }}
            />
            <text x="18" y="19" textAnchor="middle" fontSize="8.5" fontWeight="bold" fill={gradeColor} fontFamily="monospace">
              {validation.score}
            </text>
            <text x="18" y="25" textAnchor="middle" fontSize="4.5" fill="#64748b" fontFamily="monospace">
              COVERAGE
            </text>
          </svg>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-display font-bold tracking-wider text-slate-100">
              {passing ? 'DEPLOYMENT VALIDATED' : 'VALIDATION COMPLETE'}
            </div>
            <div className="text-[8px] font-mono text-slate-500 mt-0.5">
              {validation.grade.toUpperCase()} · {validation.errorCount} ERR · {validation.warningCount} WARN
            </div>
          </div>
          <button onClick={() => setValidation(null)} className="w-6 h-6 rounded flex items-center justify-center hover:bg-white/10 text-slate-500">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Issue list */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          {validation.issues.length === 0 ? (
            <div className="flex items-center gap-2 py-2">
              <BadgeCheck className="w-4 h-4 text-green-400" />
              <span className="text-[9px] text-slate-300">No issues found — the deployment is ready.</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              {validation.issues.map(issue => {
                const obj = issue.objectId ? objects.find(o => o.id === issue.objectId) : null;
                return (
                  <motion.button
                    key={issue.id}
                    className="w-full flex items-start gap-2 text-left rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.05]"
                    onClick={() => {
                      if (issue.position) focusOn(issue.position);
                      if (issue.objectId) selectObject(issue.objectId);
                    }}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                  >
                    <span className="mt-0.5 shrink-0">{SEVERITY_ICON[issue.severity]}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[8.5px] text-slate-300 leading-snug">{issue.message}</span>
                      {(obj || issue.linkId) && (
                        <span className="block text-[7px] font-mono mt-0.5" style={{ color: SEVERITY_COLOR[issue.severity] }}>
                          {obj ? `@ ${obj.id}` : issue.linkId ? `@ ${issue.linkId}` : ''} — CLICK TO FOCUS
                        </span>
                      )}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {!passing && (
          <div className="shrink-0 px-3 py-2 border-t border-white/[0.06]">
            <p className="text-[7.5px] font-mono text-slate-500 leading-relaxed">
              {validation.errorCount > 0
                ? 'Resolve errors before deploying to the Digital Twin.'
                : 'Warnings are advisory — deployment is possible.'}
            </p>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
