import React, { useState } from 'react';
import { submitTriageDecision } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// ─── Severity config ───────────────────────────────────────────
const SEVERITY_CONFIG = {
  critical: {
    label: 'CRITICAL',
    bg: 'bg-red-950/60',
    border: 'border-red-500',
    badge: 'bg-red-500/20 text-red-300 border border-red-500/50',
    bar: 'bg-red-500',
    glow: 'shadow-red-500/20',
    dot: 'bg-red-400',
  },
  high: {
    label: 'HIGH',
    bg: 'bg-orange-950/40',
    border: 'border-orange-500',
    badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/50',
    bar: 'bg-orange-500',
    glow: 'shadow-orange-500/20',
    dot: 'bg-orange-400',
  },
  medium: {
    label: 'MEDIUM',
    bg: 'bg-yellow-950/30',
    border: 'border-yellow-500',
    badge: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50',
    bar: 'bg-yellow-500',
    glow: 'shadow-yellow-500/20',
    dot: 'bg-yellow-400',
  },
  low: {
    label: 'LOW',
    bg: 'bg-blue-950/30',
    border: 'border-blue-500',
    badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/50',
    bar: 'bg-blue-500',
    glow: 'shadow-blue-500/20',
    dot: 'bg-blue-400',
  },
  benign: {
    label: 'BENIGN',
    bg: 'bg-green-950/30',
    border: 'border-green-500',
    badge: 'bg-green-500/20 text-green-300 border border-green-500/50',
    bar: 'bg-green-500',
    glow: 'shadow-green-500/20',
    dot: 'bg-green-400',
  },
};

// ─── Model badge colours ────────────────────────────────────────
const MODEL_COLORS = {
  xgboost: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/40',
  cnn:     'text-purple-300 bg-purple-500/10 border-purple-500/40',
  ensemble:'text-amber-300 bg-amber-500/10 border-amber-500/40',
};

// ─── Confidence ring ────────────────────────────────────────────
function ConfidenceRing({ confidence, severity }) {
  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.benign;
  const pct = Math.round(confidence * 100);
  const r = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={r} fill="none"
          strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={`transition-all duration-700 ${
            severity === 'benign'   ? 'stroke-green-400' :
            severity === 'low'     ? 'stroke-blue-400'  :
            severity === 'medium'  ? 'stroke-yellow-400':
            severity === 'high'    ? 'stroke-orange-400':
                                     'stroke-red-400'
          }`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-white font-mono">{pct}%</span>
        <span className="text-xs text-slate-400 uppercase tracking-widest">conf</span>
      </div>
    </div>
  );
}

// ─── SHAP feature bar ───────────────────────────────────────────
function ShapBar({ feature, shapValue, impact }) {
  const isAttack = impact === 'attack';
  const width = Math.min(Math.abs(shapValue) * 400, 100);

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-slate-400 w-32 truncate font-mono" title={feature}>
        {feature}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isAttack ? 'bg-red-400' : 'bg-green-400'
            }`}
            style={{ width: `${width}%` }}
          />
        </div>
        <span className={`text-xs font-mono w-14 text-right ${
          isAttack ? 'text-red-400' : 'text-green-400'
        }`}>
          {isAttack ? '+' : ''}{shapValue.toFixed(3)}
        </span>
      </div>
      <span className={`text-xs px-1.5 py-0.5 rounded ${
        isAttack
          ? 'bg-red-500/20 text-red-300'
          : 'bg-green-500/20 text-green-300'
      }`}>
        {isAttack ? '↑ atk' : '↓ ben'}
      </span>
    </div>
  );
}

// ─── Model comparison pill ──────────────────────────────────────
function ModelPill({ name, prediction, confidence }) {
  const isAttack = prediction === 1;
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border ${MODEL_COLORS[name]}`}>
      <span className="text-xs font-semibold uppercase tracking-wider">{name}</span>
      <div className="flex items-center gap-2">
        <span className={`text-xs font-mono ${isAttack ? 'text-red-300' : 'text-green-300'}`}>
          {isAttack ? 'ATTACK' : 'BENIGN'}
        </span>
        <span className="text-xs text-slate-400">{Math.round(confidence * 100)}%</span>
      </div>
    </div>
  );
}

// Role-based permissions:
// L1 — can escalate or investigate (front-line triage only)
// L2 — can escalate, investigate, close as attack or benign
// L3 — full access (same as L2 + authoritative close)
const DECISIONS_BY_ROLE = {
  L1: ['escalate', 'investigate'],
  L2: ['escalate', 'investigate', 'close_attack', 'close_benign'],
  L3: ['escalate', 'investigate', 'close_attack', 'close_benign'],
};

const ALL_DECISIONS = [
  { id: 'escalate',     label: '🚨 Escalate',       cls: 'border-red-500/50 hover:bg-red-900/30 hover:border-red-400'       },
  { id: 'investigate',  label: '🔍 Investigate',    cls: 'border-yellow-500/50 hover:bg-yellow-900/20 hover:border-yellow-400' },
  { id: 'close_attack', label: '⚠️ Close (Attack)',  cls: 'border-orange-500/50 hover:bg-orange-900/20 hover:border-orange-400' },
  { id: 'close_benign', label: '✅ Close (Benign)',  cls: 'border-green-500/50 hover:bg-green-900/20 hover:border-green-400'  },
];

// ─── Triage panel ───────────────────────────────────────────────
function TriagePanel({ alertId, onDecision }) {
  const { user }     = useAuth();
  const { addToast } = useToast();

  const role = user?.role || 'L1';

  const [analystLevel, setAnalystLevel] = useState(role);
  const [decision, setDecision]         = useState('');
  const [notes, setNotes]               = useState('');
  const [submitted, setSubmitted]       = useState(false);
  const [submitting, setSubmitting]     = useState(false);

  // Allowed decisions for the currently selected level
  const allowed = DECISIONS_BY_ROLE[analystLevel] || DECISIONS_BY_ROLE.L1;

  // Clear decision if it's not allowed at the newly selected level
  const handleLevelChange = lvl => {
    setAnalystLevel(lvl);
    if (!DECISIONS_BY_ROLE[lvl].includes(decision)) setDecision('');
  };

  const handleSubmit = async () => {
    if (!decision) return;
    setSubmitting(true);
    try {
      await submitTriageDecision(alertId, analystLevel, decision, notes);
      setSubmitted(true);
      onDecision && onDecision(decision);
      addToast('success', `Triage recorded: ${decision.replace('_', ' ')}`);
    } catch (e) {
      addToast('error', 'Failed to submit triage decision');
      console.error('Triage submit error:', e);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-900/30 border border-green-500/40 rounded-lg">
        <span className="text-green-400 text-lg">✓</span>
        <span className="text-green-300 text-sm font-medium">Triage decision recorded</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Analyst Triage</p>

      {/* Analyst level — locked to logged-in role by default, can be lowered */}
      <div className="flex gap-2">
        {['L1', 'L2', 'L3'].map(lvl => (
          <button
            key={lvl}
            onClick={() => handleLevelChange(lvl)}
            className={`px-3 py-1 rounded text-xs font-semibold border transition-all ${
              analystLevel === lvl
                ? 'bg-blue-500 border-blue-400 text-white'
                : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
            }`}
          >
            {lvl}
          </button>
        ))}
      </div>

      {/* Decision buttons — disabled if not permitted for this level */}
      <div className="grid grid-cols-2 gap-2">
        {ALL_DECISIONS.map(opt => {
          const permitted = allowed.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => permitted && setDecision(opt.id)}
              disabled={!permitted}
              title={!permitted ? `Not available for ${analystLevel} analysts` : ''}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                !permitted
                  ? 'border-slate-700 text-slate-600 cursor-not-allowed opacity-40'
                  : `text-slate-300 ${opt.cls}`
              } ${decision === opt.id ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-slate-900' : ''}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Permission hint for L1 */}
      {analystLevel === 'L1' && (
        <p className="text-xs text-slate-600 italic">
          L1 analysts can escalate or flag for investigation. Closing requires L2+.
        </p>
      )}

      {/* Notes */}
      <textarea
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Optional analyst notes..."
        rows={2}
        className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
      />

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!decision || submitting}
        className={`w-full py-2 rounded-lg text-sm font-semibold transition-all ${
          decision && !submitting
            ? 'bg-blue-500 hover:bg-blue-400 text-white'
            : 'bg-slate-700 text-slate-500 cursor-not-allowed'
        }`}
      >
        {submitting ? 'Submitting...' : 'Submit Decision'}
      </button>
    </div>
  );
}

// ─── Main AlertCard ─────────────────────────────────────────────
function AlertCard({ alert, selectedModel }) {
  const [showFeatures, setShowFeatures] = useState(false);
  const [triageDecision, setTriageDecision] = useState(null);

  if (!alert) return null;

  const modelData   = alert[selectedModel] || alert.ensemble;
  const { prediction, confidence, severity, top_features } = modelData;
  const cfg         = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.benign;
  const isAttack       = prediction === 1;
  const trueLabel      = alert.true_label;
  const hasTrueLabel   = trueLabel !== null && trueLabel !== undefined;
  const correct        = hasTrueLabel ? trueLabel === prediction : null;

  // Key network features to highlight
  const KEY_FEATURES = ['proto', 'service', 'state', 'sbytes', 'dbytes', 'sttl', 'dttl', 'rate'];
  const highlightedFeatures = Object.entries(alert.features || {})
    .filter(([k]) => KEY_FEATURES.includes(k))
    .slice(0, 6);

  return (
    <div className={`
      rounded-xl border-2 shadow-xl transition-all duration-300
      ${cfg.bg} ${cfg.border} shadow-${cfg.glow}
    `}>
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          {/* Animated status dot */}
          <span className={`w-3 h-3 rounded-full ${cfg.dot} ${isAttack ? 'animate-pulse' : ''}`} />
          <div>
            <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Alert ID</p>
            <p className="text-sm text-slate-300 font-mono">{alert.id?.slice(0, 8).toUpperCase()}…</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Ground truth badge — hidden when true_label is not available (e.g. SingleMode) */}
          {hasTrueLabel && (
            <>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                trueLabel === 1
                  ? 'bg-red-500/10 text-red-300 border-red-500/30'
                  : 'bg-green-500/10 text-green-300 border-green-500/30'
              }`}>
                True: {trueLabel === 1 ? 'ATTACK' : 'BENIGN'}
              </div>

              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                correct
                  ? 'bg-green-500/10 text-green-400 border-green-500/30'
                  : 'bg-red-500/10 text-red-400 border-red-500/30'
              }`}>
                {correct ? '✓ Correct' : '✗ Wrong'}
              </div>
            </>
          )}

          {/* Severity badge */}
          <div className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${cfg.badge}`}>
            {cfg.label}
          </div>
        </div>
      </div>

      {/* ── Main body ───────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-6 p-6">

        {/* Left: Confidence ring + verdict */}
        <div className="col-span-3 flex flex-col items-center justify-center gap-4">
          <ConfidenceRing confidence={confidence} severity={severity} />

          <div className={`text-center px-6 py-3 rounded-xl ${
            isAttack
              ? 'bg-red-500/10 border border-red-500/30'
              : 'bg-green-500/10 border border-green-500/30'
          }`}>
            <p className={`text-2xl font-black tracking-tight ${
              isAttack ? 'text-red-300' : 'text-green-300'
            }`}>
              {isAttack ? '⚠ ATTACK' : '✓ BENIGN'}
            </p>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-mono">
              {selectedModel}
            </p>
          </div>
        </div>

        {/* Centre: SHAP features */}
        <div className="col-span-5 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
            Top Feature Contributions (SHAP)
          </p>
          <div className="space-y-1">
            {(top_features || []).map((f, i) => (
              <ShapBar
                key={i}
                feature={f.feature}
                shapValue={f.shap_value}
                impact={f.impact}
              />
            ))}
            {(!top_features || top_features.length === 0) && (
              <p className="text-slate-500 text-xs italic">No SHAP data available</p>
            )}
          </div>

          {/* Confidence bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Prediction confidence</span>
              <span>{Math.round(confidence * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                style={{ width: `${confidence * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right: Model comparison + triage */}
        <div className="col-span-4 space-y-4">
          {/* Model comparison */}
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">
              Model Comparison
            </p>
            <div className="space-y-1.5">
              {['xgboost', 'cnn', 'ensemble'].map(m => (
                <ModelPill
                  key={m}
                  name={m}
                  prediction={alert[m]?.prediction}
                  confidence={alert[m]?.confidence}
                />
              ))}
            </div>
          </div>

          {/* Triage */}
          <div className="border-t border-slate-700/60 pt-4">
            <TriagePanel
              alertId={alert.id}
              onDecision={setTriageDecision}
            />
          </div>
        </div>
      </div>

      {/* ── Raw feature toggle ───────────────────────────────── */}
      <div className="border-t border-slate-700/60 px-6 py-3">
        <button
          onClick={() => setShowFeatures(f => !f)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <span className={`transition-transform duration-200 ${showFeatures ? 'rotate-90' : ''}`}>▶</span>
          {showFeatures ? 'Hide' : 'Show'} raw network features
        </button>

        {showFeatures && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {highlightedFeatures.map(([k, v]) => (
              <div key={k} className="bg-slate-800 rounded-lg px-3 py-2">
                <p className="text-xs text-slate-500 font-mono truncate">{k}</p>
                <p className="text-xs text-slate-200 font-semibold truncate">{String(v)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AlertCard;
