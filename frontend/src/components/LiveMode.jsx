import React, { useState, useEffect } from 'react';
import { loadSimulationAlerts } from '../utils/api';
import AlertCard from './AlertCard';

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'benign'];

const SEVERITY_STYLES = {
  critical: 'bg-red-500/20 text-red-400 border border-red-500/50',
  high:     'bg-orange-500/20 text-orange-400 border border-orange-500/50',
  medium:   'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50',
  low:      'bg-blue-500/20 text-blue-400 border border-blue-500/50',
  benign:   'bg-green-500/20 text-green-400 border border-green-500/50',
};

const STATUS_STYLES = {
  awaiting_action: { label: 'Awaiting',    cls: 'bg-slate-700/50 text-slate-400 border-slate-600' },
  in_progress:     { label: 'In Progress', cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  escalated:       { label: 'Escalated',   cls: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  closed:          { label: 'Closed',      cls: 'bg-green-500/20 text-green-300 border-green-500/40' },
};

function LiveMode() {
  const [alerts, setAlerts]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [selectedModel, setSelectedModel] = useState('ensemble');
  const [stats, setStats]           = useState(null);

  // Filters
  const [filterSeverity,   setFilterSeverity]   = useState('all');
  const [filterPrediction, setFilterPrediction] = useState('all');
  const [filterStatus,     setFilterStatus]     = useState('all');

  const filteredAlerts = alerts.filter(a => {
    const modelData = a[selectedModel] || a.ensemble;
    if (filterPrediction === 'attack' && modelData.prediction !== 1)        return false;
    if (filterPrediction === 'benign' && modelData.prediction !== 0)        return false;
    if (filterSeverity   !== 'all'   && modelData.severity !== filterSeverity) return false;
    if (filterStatus     !== 'all'   && (a.workflow?.status || 'awaiting_action') !== filterStatus) return false;
    return true;
  });

  useEffect(() => { loadAlerts(); }, []);

  useEffect(() => {
    if (isPlaying && currentIndex < filteredAlerts.length - 1) {
      const t = setTimeout(() => setCurrentIndex(i => i + 1), 5000);
      return () => clearTimeout(t);
    } else if (isPlaying && currentIndex >= filteredAlerts.length - 1) {
      setIsPlaying(false);
    }
  }, [isPlaying, currentIndex, filteredAlerts.length]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loadSimulationAlerts(50, 'balanced');
      setAlerts(data.alerts);
      setStats(data.statistics);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Called by AlertCard when a workflow action completes
  const handleWorkflowChange = (alertId, updatedWorkflow) => {
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, workflow: updatedWorkflow } : a
    ));
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-12 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-white mb-2">Loading Alerts…</h2>
        <p className="text-slate-400">Fetching 50 balanced alerts from backend</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-8 text-center">
        <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Alerts</h2>
        <p className="text-red-300 mb-4">{error}</p>
        <button onClick={loadAlerts} className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">
          Retry
        </button>
      </div>
    );
  }

  const currentAlert = filteredAlerts[currentIndex] || filteredAlerts[0];

  // Triage queue — alerts seen so far sorted by severity
  const seenAlerts = filteredAlerts
    .slice(0, currentIndex + 1)
    .map((a, i) => ({ alert: a, originalIndex: i }))
    .sort((a, b) => {
      const ma = a.alert[selectedModel] || a.alert.ensemble;
      const mb = b.alert[selectedModel] || b.alert.ensemble;
      return SEVERITY_ORDER.indexOf(ma.severity) - SEVERITY_ORDER.indexOf(mb.severity);
    });

  // Status counts for the filter bar
  const statusCounts = alerts.reduce((acc, a) => {
    const s = a.workflow?.status || 'awaiting_action';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const FilterBtn = ({ active, onClick, children }) => (
    <button onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
        active ? 'bg-blue-500 border-blue-400 text-white' : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
      }`}>
      {children}
    </button>
  );

  return (
    <div className="space-y-6">

      {/* ── Controls ─────────────────────────────────────────── */}
      <div className="bg-slate-800 rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Live Simulation</h2>
            <p className="text-slate-400 mt-1">
              Alert {filteredAlerts.length > 0 ? currentIndex + 1 : 0} of {filteredAlerts.length}
              {filteredAlerts.length !== alerts.length && (
                <span className="text-slate-500 ml-1">(filtered from {alerts.length})</span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-slate-300 text-sm font-medium">Model:</label>
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
              className="bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="xgboost">XGBoost</option>
              <option value="cnn">CNN</option>
              <option value="ensemble">Ensemble</option>
            </select>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 text-xs font-medium w-20">Prediction:</span>
            {[['all','All'],['attack','Attack'],['benign','Benign']].map(([val, label]) => (
              <FilterBtn key={val} active={filterPrediction === val}
                onClick={() => { setFilterPrediction(val); setCurrentIndex(0); }}>
                {label}
              </FilterBtn>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 text-xs font-medium w-20">Severity:</span>
            {['all', ...SEVERITY_ORDER].map(val => (
              <FilterBtn key={val} active={filterSeverity === val}
                onClick={() => { setFilterSeverity(val); setCurrentIndex(0); }}>
                <span className="capitalize">{val}</span>
              </FilterBtn>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 text-xs font-medium w-20">Status:</span>
            <FilterBtn active={filterStatus === 'all'}
              onClick={() => { setFilterStatus('all'); setCurrentIndex(0); }}>
              All
            </FilterBtn>
            {Object.entries(STATUS_STYLES).map(([val, { label }]) => (
              <FilterBtn key={val} active={filterStatus === val}
                onClick={() => { setFilterStatus(val); setCurrentIndex(0); }}>
                {label}
                {statusCounts[val] ? (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-slate-600 rounded-full text-xs">{statusCounts[val]}</span>
                ) : null}
              </FilterBtn>
            ))}
          </div>
        </div>

        {/* ── Stats ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-700 rounded-lg p-4">
              <p className="text-slate-400 text-sm">Total Alerts</p>
              <p className="text-2xl font-bold text-white">{stats.total}</p>
            </div>
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4">
              <p className="text-red-300 text-sm">Attacks</p>
              <p className="text-2xl font-bold text-red-400">{stats.attacks}</p>
            </div>
            <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4">
              <p className="text-green-300 text-sm">Benign</p>
              <p className="text-2xl font-bold text-green-400">{stats.benign}</p>
            </div>
            <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-4">
              <p className="text-blue-300 text-sm">Attack Rate</p>
              <p className="text-2xl font-bold text-blue-400">{stats.attack_rate}%</p>
            </div>
          </div>
        )}

        {/* ── Playback ── */}
        <div className="flex items-center justify-center gap-4">
          <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0 || filteredAlerts.length === 0}
            className="px-6 py-2 rounded-lg font-medium bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed">
            ← Previous
          </button>
          <button onClick={() => setIsPlaying(p => !p)}
            className={`px-8 py-2 rounded-lg font-medium ${isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <button onClick={() => setCurrentIndex(i => Math.min(filteredAlerts.length - 1, i + 1))}
            disabled={currentIndex >= filteredAlerts.length - 1 || filteredAlerts.length === 0}
            className="px-6 py-2 rounded-lg font-medium bg-slate-700 text-white hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed">
            Next →
          </button>
          <button onClick={loadAlerts} className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium">
            🔄 Reload
          </button>
        </div>

        {/* Progress bar */}
        <div className="bg-slate-700 rounded-full h-2 overflow-hidden">
          <div className="bg-blue-500 h-full transition-all duration-300"
            style={{ width: filteredAlerts.length ? `${((currentIndex + 1) / filteredAlerts.length) * 100}%` : '0%' }} />
        </div>
      </div>

      {/* ── Current Alert ─────────────────────────────────────── */}
      {currentAlert && (
        <AlertCard
          alert={currentAlert}
          selectedModel={selectedModel}
          onWorkflowChange={handleWorkflowChange}
        />
      )}

      {/* ── Triage Queue ──────────────────────────────────────── */}
      {seenAlerts.length > 0 && (
        <div className="bg-slate-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Triage Queue</h3>
            <span className="text-slate-400 text-sm">
              {seenAlerts.length} alert{seenAlerts.length !== 1 ? 's' : ''} received — sorted by severity
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="pb-3 pr-4 font-medium">#</th>
                  <th className="pb-3 pr-4 font-medium">Severity</th>
                  <th className="pb-3 pr-4 font-medium">Prediction</th>
                  <th className="pb-3 pr-4 font-medium">Confidence</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Owner</th>
                  <th className="pb-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {seenAlerts.map(({ alert: a, originalIndex }, rowIdx) => {
                  const modelData  = a[selectedModel] || a.ensemble;
                  const wf         = a.workflow || {};
                  const statusCfg  = STATUS_STYLES[wf.status || 'awaiting_action'];
                  const isActive   = originalIndex === currentIndex;

                  return (
                    <tr key={originalIndex}
                      className={`border-b border-slate-700/50 transition-colors ${isActive ? 'bg-blue-500/10' : 'hover:bg-slate-700/40'}`}>
                      <td className="py-3 pr-4 text-slate-400">{rowIdx + 1}</td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${SEVERITY_STYLES[modelData.severity] || ''}`}>
                          {modelData.severity}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`font-medium ${modelData.prediction === 1 ? 'text-red-400' : 'text-green-400'}`}>
                          {modelData.prediction === 1 ? 'Attack' : 'Benign'}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-slate-700 rounded-full h-1.5">
                            <div className={`h-1.5 rounded-full ${modelData.prediction === 1 ? 'bg-red-500' : 'bg-green-500'}`}
                              style={{ width: `${Math.min(modelData.confidence * 100, 99)}%` }} />
                          </div>
                          <span className="text-slate-300 text-xs">{(modelData.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${statusCfg.cls}`}>
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        {wf.owner_name ? (
                          <span className="text-xs text-slate-300">
                            {wf.owner_name} <span className="text-slate-500">({wf.owner_role})</span>
                          </span>
                        ) : wf.status === 'escalated' ? (
                          <span className="text-xs text-orange-400">→ {wf.escalated_to}</span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <button onClick={() => setCurrentIndex(originalIndex)}
                          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                            isActive ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                          }`}>
                          {isActive ? 'Viewing' : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveMode;
