import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import { getAnalytics, getAACTMetrics } from '../utils/api';

// ─── Colour palettes ──────────────────────────────────────────────────────────
const SEVERITY_COLORS = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#3b82f6',
  benign:   '#22c55e',
};

const MODEL_COLORS = {
  xgboost:  '#22d3ee',
  cnn:      '#a78bfa',
  ensemble: '#fbbf24',
};

const DECISION_COLORS = {
  escalate:     '#ef4444',
  investigate:  '#eab308',
  close_attack: '#f97316',
  close_benign: '#22c55e',
};

const CHART_TOOLTIP_STYLE = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' },
  labelStyle:   { color: '#94a3b8' },
};

// ─── Small stat card ─────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = 'text-white', bg = 'bg-slate-700/60' }) {
  return (
    <div className={`rounded-xl p-5 border border-slate-700 ${bg}`}>
      <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-2">{label}</p>
      <p className={`text-3xl font-black ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Rate gauge (simple horizontal bar) ──────────────────────────────────────
function RateBar({ label, value, color }) {
  const pct = value != null ? Math.round(value * 100) : null;
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-400 mb-1">
        <span>{label}</span>
        <span className={`font-mono font-semibold ${color}`}>{pct != null ? `${pct}%` : '—'}</span>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`}
          style={{ width: pct != null ? `${pct}%` : '0%' }}
        />
      </div>
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────
function SectionTitle({ children }) {
  return (
    <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-4">{children}</p>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-slate-700/50 rounded-xl ${className}`} />;
}

// ─── Main dashboard ───────────────────────────────────────────────────────────
export default function AnalyticsDashboard() {
  const [overview, setOverview]   = useState(null);
  const [aact, setAact]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ov, ac] = await Promise.all([getAnalytics(), getAACTMetrics()]);
      setOverview(ov);
      setAact(ac);
    } catch (e) {
      setError(e.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 text-center">
        <p className="text-red-400 font-semibold mb-2">Failed to load analytics</p>
        <p className="text-red-300 text-sm mb-4">{error}</p>
        <button
          onClick={fetchAll}
          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-400 text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  // ── Derived chart data ──────────────────────────────────────────────────────
  const attackBenignData = [
    { name: 'Attack', value: overview.attack_vs_benign.attack, fill: '#ef4444' },
    { name: 'Benign', value: overview.attack_vs_benign.benign, fill: '#22c55e' },
  ];

  const severityData = Object.entries(overview.severity_distribution || {})
    .map(([name, value]) => ({ name, value, fill: SEVERITY_COLORS[name] || '#64748b' }))
    .sort((a, b) => {
      const order = ['critical', 'high', 'medium', 'low', 'benign'];
      return order.indexOf(a.name) - order.indexOf(b.name);
    });

  const modelData = Object.entries(overview.predictions_by_model || {})
    .map(([name, value]) => ({ name, value, fill: MODEL_COLORS[name] || '#64748b' }));

  const decisionsData = Object.entries(overview.decisions_breakdown || {})
    .map(([name, value]) => ({
      name: name.replace('_', ' '),
      value,
      fill: DECISION_COLORS[name] || '#64748b',
    }));

  const aactByModel = Object.entries(aact?.by_model || {}).map(([model, stats]) => ({
    model,
    'Agreement %': stats.agreement_rate != null ? Math.round(stats.agreement_rate * 100) : 0,
    'Reviews': stats.reviewed,
  }));

  const aactByLevel = Object.entries(aact?.by_analyst_level || {}).map(([level, stats]) => ({
    level,
    'Agreement %': stats.agreement_rate != null ? Math.round(stats.agreement_rate * 100) : 0,
    'Reviews': stats.reviewed,
  }));

  return (
    <div className="space-y-6">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="bg-slate-800 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
          <p className="text-slate-400 mt-1 text-sm">
            System-wide prediction stats and AACT feedback loop metrics
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm font-medium transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* ── Top stat cards ────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Predictions"
          value={overview.total_predictions.toLocaleString()}
          sub={`${overview.recent_predictions} in last 24 h`}
          color="text-white"
        />
        <StatCard
          label="Attacks Detected"
          value={overview.attack_vs_benign.attack.toLocaleString()}
          sub={`${overview.attack_vs_benign.benign} benign`}
          color="text-red-400"
          bg="bg-red-900/20 border-red-500/30"
        />
        <StatCard
          label="Triage Decisions"
          value={overview.total_triage_decisions.toLocaleString()}
          sub="Analyst-reviewed alerts"
          color="text-blue-400"
          bg="bg-blue-900/20 border-blue-500/30"
        />
        <StatCard
          label="AI–Analyst Agreement"
          value={aact?.agreement_rate != null ? `${Math.round(aact.agreement_rate * 100)}%` : '—'}
          sub={aact?.total_reviewed ? `from ${aact.total_reviewed} reviewed alerts` : 'No reviews yet'}
          color="text-green-400"
          bg="bg-green-900/20 border-green-500/30"
        />
      </div>

      {/* ── Row 1: Pie charts ─────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-6">

        {/* Attack vs Benign */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <SectionTitle>Attack vs Benign</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={attackBenignData} dataKey="value" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                {attackBenignData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Model usage */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <SectionTitle>Model Usage</SectionTitle>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={modelData} dataKey="value" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                {modelData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Triage decisions */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <SectionTitle>Triage Decisions</SectionTitle>
          {decisionsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={decisionsData} dataKey="value" cx="50%" cy="50%" outerRadius={70} paddingAngle={3}>
                  {decisionsData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
              No triage decisions yet
            </div>
          )}
        </div>
      </div>

      {/* ── Row 2: Severity bar + AACT metrics ───────────────── */}
      <div className="grid grid-cols-2 gap-6">

        {/* Severity distribution */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <SectionTitle>Severity Distribution</SectionTitle>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={severityData} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {severityData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">
              No predictions yet
            </div>
          )}
        </div>

        {/* AACT feedback loop panel */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 space-y-5">
          <SectionTitle>AACT Feedback Loop</SectionTitle>

          {aact?.total_reviewed === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-500 text-sm text-center">
              No triage decisions submitted yet.<br />
              <span className="text-xs mt-1">Submit analyst decisions in Live or Single mode to see metrics here.</span>
            </div>
          ) : (
            <>
              {/* Agreement / override rates */}
              <div className="space-y-3">
                <RateBar label="Agreement Rate"      value={aact?.agreement_rate} color="text-green-400" />
                <RateBar label="Override Rate"       value={aact?.override_rate}  color="text-red-400"   />
              </div>

              {/* FP / FN breakdown */}
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: 'FP Overrides',  value: aact?.false_positive_overrides, color: 'text-orange-400', hint: 'AI=Attack · Analyst=Benign' },
                  { label: 'FN Overrides',  value: aact?.false_negative_overrides, color: 'text-red-400',    hint: 'AI=Benign · Analyst=Attack' },
                  { label: 'Uncertain',     value: aact?.uncertain_count,          color: 'text-yellow-400', hint: 'Investigate decisions' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-700/50 rounded-lg p-3" title={s.hint}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value ?? 0}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Agreement by analyst level */}
              {aactByLevel.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">By Analyst Level</p>
                  <div className="space-y-2">
                    {aactByLevel.map(({ level, ...stats }) => (
                      <div key={level} className="flex items-center gap-3 text-xs">
                        <span className="text-slate-300 w-6 font-semibold">{level}</span>
                        <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${stats['Agreement %']}%` }}
                          />
                        </div>
                        <span className="text-slate-400 w-8 text-right">{stats['Agreement %']}%</span>
                        <span className="text-slate-600">({stats['Reviews']} reviews)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Row 3: Agreement by model bar chart ──────────────── */}
      {aactByModel.length > 0 && (
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <SectionTitle>Agreement Rate by Model</SectionTitle>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={aactByModel} barCategoryGap="40%">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="model" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} unit="%" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} formatter={v => [`${v}%`, 'Agreement']} />
              <Bar dataKey="Agreement %" radius={[4, 4, 0, 0]}>
                {aactByModel.map((entry, i) => (
                  <Cell key={i} fill={MODEL_COLORS[entry.model] || '#64748b'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

    </div>
  );
}
