import React, { useState, useEffect } from 'react';
import { getEscalatedAlerts, claimAlert, submitTriageDecision } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const SEVERITY_STYLES = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/50',
  high:     'bg-orange-500/20 text-orange-400 border-orange-500/50',
  medium:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  low:      'bg-blue-500/20 text-blue-400 border-blue-500/50',
  benign:   'bg-green-500/20 text-green-400 border-green-500/50',
};

// ─── Row action buttons ──────────────────────────────────────────
function AlertRow({ alert, onUpdate }) {
  const { user }     = useAuth();
  const { addToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing]     = useState(false);
  const [notes, setNotes]       = useState('');

  const isClosed  = alert.status === 'closed';
  const isOwned   = !!alert.owner_name;

  const handleClaim = async () => {
    setActing(true);
    try {
      const res = await claimAlert(alert.id);
      addToast('success', 'Alert claimed — you are now the owner');
      onUpdate(alert.id, { ...alert, status: res.status, owner_name: res.owner_name, owner_role: res.owner_role });
    } catch (e) {
      addToast('error', e.response?.data?.error || 'Failed to claim alert');
    } finally {
      setActing(false);
    }
  };

  const handleClose = async (decision) => {
    setActing(true);
    try {
      await submitTriageDecision(alert.id, user.role, decision, notes);
      addToast('success', `Alert closed as ${decision === 'close_attack' ? 'Attack' : 'Benign'}`);
      onUpdate(alert.id, { ...alert, status: 'closed', owner_name: user.name, owner_role: user.role });
    } catch (e) {
      addToast('error', 'Failed to close alert');
    } finally {
      setActing(false);
    }
  };

  return (
    <div className={`rounded-xl border p-4 space-y-3 transition-all ${
      isClosed ? 'bg-slate-800/40 border-slate-700/50 opacity-60' : 'bg-slate-800/70 border-slate-700'
    }`}>
      {/* ── Summary row ── */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* ID */}
        <span className="text-xs font-mono text-slate-400 w-24 shrink-0">
          {alert.id?.slice(0, 8).toUpperCase()}…
        </span>

        {/* Severity */}
        <span className={`px-2 py-0.5 rounded text-xs font-semibold border capitalize ${SEVERITY_STYLES[alert.severity] || ''}`}>
          {alert.severity}
        </span>

        {/* Prediction */}
        <span className={`text-xs font-semibold ${alert.prediction === 1 ? 'text-red-400' : 'text-green-400'}`}>
          {alert.prediction === 1 ? '⚠ Attack' : '✓ Benign'}
        </span>

        {/* Confidence */}
        <span className="text-xs text-slate-400">{Math.round(alert.confidence * 100)}% conf</span>

        {/* Escalated by */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-xs text-slate-500">Escalated by</span>
          <span className="text-xs font-semibold text-orange-300">{alert.escalated_by_name}</span>
        </div>

        {/* Time */}
        {alert.escalated_at && (
          <span className="text-xs text-slate-500">
            {new Date(alert.escalated_at).toLocaleTimeString()}
          </span>
        )}

        {/* Status */}
        {isClosed ? (
          <span className="text-xs text-green-400 font-semibold">✓ Closed</span>
        ) : isOwned ? (
          <span className="text-xs text-blue-300">👤 {alert.owner_name}</span>
        ) : (
          <button onClick={handleClaim} disabled={acting}
            className="px-3 py-1 text-xs font-semibold rounded-lg border border-blue-500/50 text-blue-300 hover:bg-blue-900/30 transition-all">
            {acting ? '…' : '🙋 Claim'}
          </button>
        )}

        {/* Expand toggle */}
        <button onClick={() => setExpanded(e => !e)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-1">
          {expanded ? '▲ Less' : '▼ More'}
        </button>
      </div>

      {/* ── Escalation notes ── */}
      {alert.escalation_notes && (
        <p className="text-xs text-slate-400 italic bg-slate-700/40 rounded-lg px-3 py-2">
          "{alert.escalation_notes}"
        </p>
      )}

      {/* ── Expanded action area ── */}
      {expanded && !isClosed && (
        <div className="border-t border-slate-700/60 pt-3 space-y-3">
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Add resolution notes…" rows={2}
            className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => handleClose('close_attack')} disabled={acting}
              className="flex-1 py-2 rounded-lg text-xs font-semibold border border-orange-500/50 text-slate-300 hover:bg-orange-900/20 transition-all">
              ⚠️ Close as Attack
            </button>
            <button onClick={() => handleClose('close_benign')} disabled={acting}
              className="flex-1 py-2 rounded-lg text-xs font-semibold border border-green-500/50 text-slate-300 hover:bg-green-900/20 transition-all">
              ✅ Close as Benign
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main EscalationQueue ────────────────────────────────────────
export default function EscalationQueue() {
  const { user }     = useAuth();
  const { addToast } = useToast();
  const [alerts, setAlerts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [filter, setFilter]   = useState('open'); // 'open' | 'closed' | 'all'

  const fetchQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEscalatedAlerts();
      setAlerts(data.alerts);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Failed to load escalation queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  const handleUpdate = (alertId, updated) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? updated : a));
  };

  const displayed = alerts.filter(a => {
    if (filter === 'open')   return a.status !== 'closed';
    if (filter === 'closed') return a.status === 'closed';
    return true;
  });

  const openCount   = alerts.filter(a => a.status !== 'closed').length;
  const closedCount = alerts.filter(a => a.status === 'closed').length;

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="bg-slate-800 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Escalation Queue</h2>
          <p className="text-slate-400 mt-1 text-sm">
            Alerts escalated to <span className="text-orange-300 font-semibold">{user?.role}</span> — claim and resolve them
          </p>
        </div>
        <button onClick={fetchQueue}
          className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm font-medium transition-colors">
          🔄 Refresh
        </button>
      </div>

      {/* ── Stats strip ── */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{alerts.length}</p>
          <p className="text-xs text-slate-400 mt-1">Total Escalated</p>
        </div>
        <div className="bg-orange-900/20 border border-orange-500/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{openCount}</p>
          <p className="text-xs text-slate-400 mt-1">Awaiting Resolution</p>
        </div>
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{closedCount}</p>
          <p className="text-xs text-slate-400 mt-1">Resolved</p>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="flex gap-2">
        {[['open', `Open (${openCount})`], ['closed', `Resolved (${closedCount})`], ['all', `All (${alerts.length})`]].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === val ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="bg-slate-800 rounded-xl p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4" />
          <p className="text-slate-400">Loading escalation queue…</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 text-center">
          <p className="text-red-400 font-semibold mb-2">{error}</p>
          <button onClick={fetchQueue} className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm">Retry</button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-16 text-center">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-slate-300 font-semibold">
            {filter === 'open' ? 'No open escalations' : 'No alerts in this view'}
          </p>
          <p className="text-slate-500 text-sm mt-1">
            {filter === 'open' ? `All escalations to ${user?.role} have been resolved.` : 'Try a different filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map(a => (
            <AlertRow key={a.id} alert={a} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
