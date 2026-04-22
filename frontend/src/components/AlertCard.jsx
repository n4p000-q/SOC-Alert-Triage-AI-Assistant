import React, { useState } from 'react';
import { submitTriageDecision, claimAlert, escalateAlert } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// ─── Severity config ────────────────────────────────────────────
const SEVERITY_CONFIG = {
  critical: {
    label: 'CRITICAL', bg: 'bg-red-950/60', border: 'border-red-500',
    badge: 'bg-red-500/20 text-red-300 border border-red-500/50',
    bar: 'bg-red-500', glow: 'shadow-red-500/20', dot: 'bg-red-400',
  },
  high: {
    label: 'HIGH', bg: 'bg-orange-950/40', border: 'border-orange-500',
    badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/50',
    bar: 'bg-orange-500', glow: 'shadow-orange-500/20', dot: 'bg-orange-400',
  },
  medium: {
    label: 'MEDIUM', bg: 'bg-yellow-950/30', border: 'border-yellow-500',
    badge: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/50',
    bar: 'bg-yellow-500', glow: 'shadow-yellow-500/20', dot: 'bg-yellow-400',
  },
  low: {
    label: 'LOW', bg: 'bg-blue-950/30', border: 'border-blue-500',
    badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/50',
    bar: 'bg-blue-500', glow: 'shadow-blue-500/20', dot: 'bg-blue-400',
  },
  benign: {
    label: 'BENIGN', bg: 'bg-green-950/30', border: 'border-green-500',
    badge: 'bg-green-500/20 text-green-300 border border-green-500/50',
    bar: 'bg-green-500', glow: 'shadow-green-500/20', dot: 'bg-green-400',
  },
};

const MODEL_COLORS = {
  xgboost:  'text-cyan-300 bg-cyan-500/10 border-cyan-500/40',
  cnn:      'text-purple-300 bg-purple-500/10 border-purple-500/40',
  ensemble: 'text-amber-300 bg-amber-500/10 border-amber-500/40',
};

// ─── Status config ──────────────────────────────────────────────
const STATUS_CONFIG = {
  awaiting_action: { label: 'Awaiting Action', cls: 'bg-slate-700/70 text-slate-300 border-slate-500/50' },
  in_progress:     { label: 'In Progress',     cls: 'bg-blue-500/20 text-blue-300 border-blue-500/50'   },
  escalated:       { label: 'Escalated',       cls: 'bg-orange-500/20 text-orange-300 border-orange-500/50' },
  closed:          { label: 'Closed',          cls: 'bg-green-500/20 text-green-300 border-green-500/50' },
};

// ─── Confidence ring ────────────────────────────────────────────
function ConfidenceRing({ confidence, severity }) {
  const cfg  = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.benign;
  const pct  = Math.round(confidence * 100);
  const r    = 36;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center w-24 h-24">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="8"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
          className={`transition-all duration-700 ${
            severity === 'benign'  ? 'stroke-green-400'  :
            severity === 'low'    ? 'stroke-blue-400'   :
            severity === 'medium' ? 'stroke-yellow-400' :
            severity === 'high'   ? 'stroke-orange-400' : 'stroke-red-400'
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

// ─── SHAP bar ───────────────────────────────────────────────────
function ShapBar({ feature, shapValue, impact }) {
  const isAttack = impact === 'attack';
  const width    = Math.min(Math.abs(shapValue) * 400, 100);
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs text-slate-400 w-32 truncate font-mono" title={feature}>{feature}</span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${isAttack ? 'bg-red-400' : 'bg-green-400'}`}
            style={{ width: `${width}%` }} />
        </div>
        <span className={`text-xs font-mono w-14 text-right ${isAttack ? 'text-red-400' : 'text-green-400'}`}>
          {isAttack ? '+' : ''}{shapValue.toFixed(3)}
        </span>
      </div>
      <span className={`text-xs px-1.5 py-0.5 rounded ${isAttack ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
        {isAttack ? '↑ atk' : '↓ ben'}
      </span>
    </div>
  );
}

// ─── Model pill ─────────────────────────────────────────────────
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

// ─── Escalate modal ─────────────────────────────────────────────
function EscalateModal({ userRole, onConfirm, onCancel, submitting }) {
  // L1 → can escalate to L2 or L3. L2 → only L3.
  const tiers   = userRole === 'L1' ? ['L2', 'L3'] : ['L3'];
  const [tier, setTier]   = useState(tiers[0]);
  const [notes, setNotes] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-800 border border-slate-600 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5">
        <div>
          <p className="text-base font-bold text-white mb-1">Escalate Alert</p>
          <p className="text-xs text-slate-400">
            This alert will be sent to the selected tier's queue. They will be notified and can claim it.
          </p>
        </div>

        {/* Tier selector */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Escalate To</p>
          <div className="flex gap-2">
            {tiers.map(t => (
              <button key={t} onClick={() => setTier(t)}
                className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${
                  tier === t
                    ? 'bg-orange-500/20 border-orange-400 text-orange-300'
                    : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
                }`}>
                {t} — {t === 'L2' ? 'Senior Analyst' : 'Lead / Threat Intel'}
              </button>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Escalation Notes</p>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Why are you escalating? What have you already checked?"
            rows={3}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
          />
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors">
            Cancel
          </button>
          <button onClick={() => onConfirm(tier, notes)} disabled={submitting}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
              submitting
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-400 text-white'
            }`}>
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Escalating…
              </span>
            ) : `🚨 Escalate to ${tier}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Triage panel ───────────────────────────────────────────────
const DECISIONS_BY_ROLE = {
  L1: ['escalate', 'investigate'],
  L2: ['escalate', 'investigate', 'close_attack', 'close_benign'],
  L3: ['escalate', 'investigate', 'close_attack', 'close_benign'],
};

function TriagePanel({ alertId, workflow, onWorkflowChange }) {
  const { user }     = useAuth();
  const { addToast } = useToast();

  const role = user?.role || 'L1';

  const [notes, setNotes]               = useState('');
  const [decision, setDecision]         = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [showEscalate, setShowEscalate] = useState(false);

  const status      = workflow?.status || 'awaiting_action';
  const isClosed    = status === 'closed';
  const isEscalated = status === 'escalated';
  const isOwned     = !!workflow?.owner_name;
  const isMyAlert   = workflow?.owner_name === user?.name;
  const allowed     = DECISIONS_BY_ROLE[role] || DECISIONS_BY_ROLE.L1;

  // ── Claim / take ownership ──
  const handleClaim = async () => {
    setSubmitting(true);
    try {
      const res = await claimAlert(alertId);
      onWorkflowChange({ status: res.status, owner_name: res.owner_name, owner_role: res.owner_role });
      addToast('success', 'Alert claimed — you are now the owner');
    } catch (e) {
      addToast('error', e.response?.data?.error || 'Failed to claim alert');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Investigate = claim + record triage ──
  const handleInvestigate = async () => {
    setSubmitting(true);
    try {
      const [claimRes] = await Promise.all([
        claimAlert(alertId),
        submitTriageDecision(alertId, role, 'investigate', notes),
      ]);
      onWorkflowChange({ status: 'in_progress', owner_name: claimRes.owner_name, owner_role: claimRes.owner_role });
      addToast('success', 'Alert marked as In Progress — assigned to you');
    } catch (e) {
      addToast('error', 'Failed to start investigation');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Close (attack / benign) ──
  const handleClose = async (dec) => {
    setSubmitting(true);
    try {
      await submitTriageDecision(alertId, role, dec, notes);
      onWorkflowChange({ status: 'closed', owner_name: user.name, owner_role: user.role });
      addToast('success', `Alert closed as ${dec === 'close_attack' ? 'Attack' : 'Benign'}`);
    } catch (e) {
      addToast('error', 'Failed to submit triage decision');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Escalate ──
  const handleEscalate = async (tier, escNotes) => {
    setSubmitting(true);
    try {
      const res = await escalateAlert(alertId, tier, escNotes);
      onWorkflowChange({
        status: 'escalated',
        escalated_to: res.escalated_to,
        escalated_by_name: res.escalated_by_name,
        escalated_at: res.escalated_at,
        owner_name: null,
        owner_role: null,
      });
      setShowEscalate(false);
      addToast('success', `Alert escalated to ${tier}`);
    } catch (e) {
      addToast('error', e.response?.data?.error || 'Failed to escalate alert');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Closed state ──
  if (isClosed) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-green-900/20 border border-green-500/30 rounded-lg">
        <span className="text-green-400 text-lg">✓</span>
        <div>
          <p className="text-green-300 text-sm font-medium">Alert Closed</p>
          {workflow?.owner_name && (
            <p className="text-green-600 text-xs">by {workflow.owner_name} ({workflow.owner_role})</p>
          )}
        </div>
      </div>
    );
  }

  // ── Escalated state ──
  if (isEscalated) {
    return (
      <div className="px-4 py-3 bg-orange-900/20 border border-orange-500/30 rounded-lg space-y-1">
        <p className="text-orange-300 text-sm font-semibold">🚨 Escalated to {workflow.escalated_to}</p>
        {workflow.escalated_by_name && (
          <p className="text-orange-500 text-xs">By {workflow.escalated_by_name}</p>
        )}
        {workflow.escalation_notes && (
          <p className="text-slate-400 text-xs italic">"{workflow.escalation_notes}"</p>
        )}
      </div>
    );
  }

  return (
    <>
      {showEscalate && (
        <EscalateModal
          userRole={role}
          onConfirm={handleEscalate}
          onCancel={() => setShowEscalate(false)}
          submitting={submitting}
        />
      )}

      <div className="space-y-3">
        <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Analyst Triage</p>

        {/* Claim button — shown when unowned */}
        {!isOwned && (
          <button onClick={handleClaim} disabled={submitting}
            className="w-full py-2 rounded-lg text-sm font-semibold border border-blue-500/50 text-blue-300 hover:bg-blue-900/30 transition-all">
            {submitting ? 'Claiming…' : '🙋 Claim This Alert'}
          </button>
        )}

        {/* Notes */}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Analyst notes (optional)…"
          rows={2}
          className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">

          {/* Investigate */}
          {allowed.includes('investigate') && (
            <button onClick={handleInvestigate} disabled={submitting}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-yellow-500/50 text-slate-300 hover:bg-yellow-900/20 hover:border-yellow-400 transition-all">
              🔍 Investigate
            </button>
          )}

          {/* Escalate */}
          {allowed.includes('escalate') && (
            <button onClick={() => setShowEscalate(true)} disabled={submitting}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-red-500/50 text-slate-300 hover:bg-red-900/30 hover:border-red-400 transition-all">
              🚨 Escalate
            </button>
          )}

          {/* Close as Attack */}
          {allowed.includes('close_attack') && (
            <button onClick={() => handleClose('close_attack')} disabled={submitting}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-orange-500/50 text-slate-300 hover:bg-orange-900/20 hover:border-orange-400 transition-all">
              ⚠️ Close (Attack)
            </button>
          )}

          {/* Close as Benign */}
          {allowed.includes('close_benign') && (
            <button onClick={() => handleClose('close_benign')} disabled={submitting}
              className="px-3 py-2 rounded-lg text-xs font-medium border border-green-500/50 text-slate-300 hover:bg-green-900/20 hover:border-green-400 transition-all">
              ✅ Close (Benign)
            </button>
          )}
        </div>

        {/* L1 hint */}
        {role === 'L1' && (
          <p className="text-xs text-slate-600 italic">
            L1: claim, investigate, or escalate. Closing requires L2+.
          </p>
        )}
      </div>
    </>
  );
}

// ─── Main AlertCard ─────────────────────────────────────────────
function AlertCard({ alert, selectedModel, onWorkflowChange }) {
  const [showFeatures, setShowFeatures] = useState(false);

  if (!alert) return null;

  const modelData = alert[selectedModel] || alert.ensemble;
  const { prediction, confidence, severity, top_features } = modelData;
  const cfg          = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.benign;
  const isAttack     = prediction === 1;
  const trueLabel    = alert.true_label;
  const hasTrueLabel = trueLabel !== null && trueLabel !== undefined;
  const correct      = hasTrueLabel ? trueLabel === prediction : null;

  // Workflow state
  const workflow   = alert.workflow || { status: 'awaiting_action' };
  const statusCfg  = STATUS_CONFIG[workflow.status] || STATUS_CONFIG.awaiting_action;

  const KEY_FEATURES = ['proto', 'service', 'state', 'sbytes', 'dbytes', 'sttl', 'dttl', 'rate'];
  const highlightedFeatures = Object.entries(alert.features || {})
    .filter(([k]) => KEY_FEATURES.includes(k))
    .slice(0, 6);

  const handleWorkflowChange = (updates) => {
    if (onWorkflowChange) onWorkflowChange(alert.id, { ...workflow, ...updates });
  };

  return (
    <div className={`rounded-xl border-2 shadow-xl transition-all duration-300 ${cfg.bg} ${cfg.border} shadow-${cfg.glow}`}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/60 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className={`w-3 h-3 rounded-full ${cfg.dot} ${isAttack ? 'animate-pulse' : ''}`} />
          <div>
            <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Alert ID</p>
            <p className="text-sm text-slate-300 font-mono">{alert.id?.slice(0, 8).toUpperCase()}…</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Workflow status badge */}
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusCfg.cls}`}>
            {statusCfg.label}
          </span>

          {/* Owner badge */}
          {workflow.owner_name && workflow.status !== 'closed' && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-blue-500/10 text-blue-300 border-blue-500/30">
              👤 {workflow.owner_name} ({workflow.owner_role})
            </span>
          )}

          {/* Escalated-to badge */}
          {workflow.status === 'escalated' && workflow.escalated_to && (
            <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-orange-500/10 text-orange-300 border-orange-500/30">
              → {workflow.escalated_to}
            </span>
          )}

          {/* Ground truth */}
          {hasTrueLabel && (
            <>
              <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                trueLabel === 1 ? 'bg-red-500/10 text-red-300 border-red-500/30' : 'bg-green-500/10 text-green-300 border-green-500/30'
              }`}>
                True: {trueLabel === 1 ? 'ATTACK' : 'BENIGN'}
              </div>
              <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                correct ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'
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
            isAttack ? 'bg-red-500/10 border border-red-500/30' : 'bg-green-500/10 border border-green-500/30'
          }`}>
            <p className={`text-2xl font-black tracking-tight ${isAttack ? 'text-red-300' : 'text-green-300'}`}>
              {isAttack ? '⚠ ATTACK' : '✓ BENIGN'}
            </p>
            <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-mono">{selectedModel}</p>
          </div>
        </div>

        {/* Centre: SHAP */}
        <div className="col-span-5 space-y-3">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
            Top Feature Contributions (SHAP)
          </p>
          <div className="space-y-1">
            {(top_features || []).map((f, i) => (
              <ShapBar key={i} feature={f.feature} shapValue={f.shap_value} impact={f.impact} />
            ))}
            {(!top_features || top_features.length === 0) && (
              <p className="text-slate-500 text-xs italic">No SHAP data available</p>
            )}
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>Prediction confidence</span>
              <span>{Math.round(confidence * 100)}%</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
                style={{ width: `${confidence * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Right: Model comparison + triage */}
        <div className="col-span-4 space-y-4">
          <div>
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">Model Comparison</p>
            <div className="space-y-1.5">
              {['xgboost', 'cnn', 'ensemble'].map(m => (
                <ModelPill key={m} name={m} prediction={alert[m]?.prediction} confidence={alert[m]?.confidence} />
              ))}
            </div>
          </div>
          <div className="border-t border-slate-700/60 pt-4">
            <TriagePanel
              alertId={alert.id}
              workflow={workflow}
              onWorkflowChange={handleWorkflowChange}
            />
          </div>
        </div>
      </div>

      {/* ── Raw features toggle ──────────────────────────────── */}
      <div className="border-t border-slate-700/60 px-6 py-3">
        <button onClick={() => setShowFeatures(f => !f)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors">
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
