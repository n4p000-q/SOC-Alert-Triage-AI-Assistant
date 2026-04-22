import React, { useState, useRef, useEffect } from 'react';
import {
  uploadBatchFile, getBatchStatus,
  downloadBatchResults, getBatchAnalytics,
} from '../utils/api';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  queued:     { label: 'Queued',     color: 'text-blue-400',   bar: 'bg-blue-500',   pulse: true  },
  processing: { label: 'Processing', color: 'text-amber-400',  bar: 'bg-amber-500',  pulse: true  },
  completed:  { label: 'Completed',  color: 'text-green-400',  bar: 'bg-green-500',  pulse: false },
};

const SEVERITY_COLORS = {
  benign:   '#22c55e',
  low:      '#3b82f6',
  medium:   '#f59e0b',
  high:     '#f97316',
  critical: '#ef4444',
};

const CONF_COLORS = ['#6366f1','#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe'];

const isActive = s => s === 'queued' || s === 'processing';
const isFailed = s => typeof s === 'string' && s.startsWith('failed');

// ─── Tooltip helpers ──────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill || '#fff' }}>
          {p.name}: <span className="font-bold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const { name, value, payload: { pct } } = payload[0];
  return (
    <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p style={{ color: payload[0].payload.fill }} className="font-bold">{name}</p>
      <p className="text-slate-300">{value} alerts ({pct}%)</p>
    </div>
  );
};

// ─── Dropzone ─────────────────────────────────────────────────────────────────
function Dropzone({ onFile, file }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleDrop = e => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.name.endsWith('.csv')) onFile(dropped);
  };

  if (file) {
    return (
      <div className="flex items-center justify-between px-5 py-4 bg-blue-500/10 border-2 border-blue-500/50 rounded-xl">
        <div className="flex items-center gap-3">
          <span className="text-2xl">📄</span>
          <div>
            <p className="text-sm font-semibold text-white">{file.name}</p>
            <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
        <button
          onClick={() => onFile(null)}
          className="text-slate-400 hover:text-red-400 transition-colors text-sm px-3 py-1 rounded-lg hover:bg-red-500/10"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current.click()}
      className={`cursor-pointer border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
        dragging ? 'border-blue-400 bg-blue-500/10 scale-[1.01]' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
      }`}
    >
      <input ref={inputRef} type="file" accept=".csv" onChange={e => { if (e.target.files[0]) onFile(e.target.files[0]); }} className="hidden" />
      <div className="text-4xl mb-3">📂</div>
      <p className="text-slate-200 font-semibold mb-1">Drop a CSV file here</p>
      <p className="text-slate-500 text-sm mb-4">or click to browse</p>
      <p className="text-xs text-slate-600">File must contain all 194 UNSW-NB15 feature columns in the correct order</p>
    </div>
  );
}

// ─── Progress card ────────────────────────────────────────────────────────────
function ProgressCard({ job }) {
  if (!job) return null;
  const failed = isFailed(job.status);
  const cfg    = STATUS_CONFIG[job.status] || {};
  const pct    = job.progress ?? 0;

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${failed ? 'bg-red-950/30 border-red-500/50' : 'bg-slate-800/60 border-slate-700'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-1">Job Status</p>
          <p className="text-xs text-slate-500 font-mono">{job.job_id?.slice(0, 8).toUpperCase()}…</p>
        </div>
        <div className="text-right">
          {failed ? (
            <span className="text-red-400 font-semibold text-sm">Failed</span>
          ) : (
            <span className={`font-semibold text-sm flex items-center gap-2 ${cfg.color}`}>
              {cfg.pulse && (
                <span className="relative flex h-2 w-2">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${cfg.bar}`} />
                  <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.bar}`} />
                </span>
              )}
              {cfg.label}
            </span>
          )}
        </div>
      </div>

      {!failed && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>{job.processed ?? 0} / {job.total ?? '?'} alerts</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {failed && <p className="text-red-300 text-sm">{job.status.replace('failed: ', '')}</p>}

      <div className="flex gap-6 text-xs text-slate-500">
        {job.started_at   && <span>Started:   {new Date(job.started_at).toLocaleTimeString()}</span>}
        {job.completed_at && <span>Completed: {new Date(job.completed_at).toLocaleTimeString()}</span>}
      </div>
    </div>
  );
}

// ─── Analytics Dashboard ──────────────────────────────────────────────────────
function BatchAnalytics({ analytics, job, onDownload, downloading }) {
  if (!analytics) return null;

  const { total, attacks, benign, attack_rate, avg_confidence, severity_counts, confidence_distribution, top_features } = analytics;

  const duration = (() => {
    if (!job?.started_at || !job?.completed_at) return '—';
    const s = (new Date(job.completed_at) - new Date(job.started_at)) / 1000;
    return s < 60 ? `${s.toFixed(1)}s` : `${(s / 60).toFixed(1)}m`;
  })();

  // KPI cards
  const kpis = [
    { label: 'Total Alerts',     value: total,                        sub: 'processed',         color: 'text-white',       accent: 'border-slate-600'      },
    { label: 'Attacks Detected', value: attacks,                      sub: `${attack_rate}% of total`, color: 'text-red-400',   accent: 'border-red-500/40'    },
    { label: 'Benign Traffic',   value: benign,                       sub: `${(100 - attack_rate).toFixed(1)}% of total`, color: 'text-green-400', accent: 'border-green-500/40' },
    { label: 'Avg Confidence',   value: `${(avg_confidence * 100).toFixed(1)}%`, sub: 'model certainty', color: 'text-blue-400',  accent: 'border-blue-500/40'   },
    { label: 'Process Time',     value: duration,                     sub: 'wall-clock',        color: 'text-amber-400',   accent: 'border-amber-500/40'  },
  ];

  // Pie data
  const pieData = [
    { name: 'Attack', value: attacks, fill: '#ef4444', pct: attack_rate },
    { name: 'Benign', value: benign,  fill: '#22c55e', pct: (100 - attack_rate).toFixed(1) },
  ];

  // Severity bar data
  const severityData = Object.entries(severity_counts).map(([name, count]) => ({ name, count }));

  // Confidence histogram
  const confData = Object.entries(confidence_distribution).map(([bucket, count]) => ({ bucket, count }));

  // Top features
  const featureData = top_features.slice(0, 8);

  return (
    <div className="space-y-6 mt-2">

      {/* ── Section header ── */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-700" />
        <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold px-2">Batch Results Analytics</span>
        <div className="h-px flex-1 bg-slate-700" />
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl p-4 bg-slate-800/70 border ${k.accent} flex flex-col gap-1`}>
            <p className="text-xs text-slate-500">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-xs text-slate-600">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Row 1: Threat Donut + Severity Bar ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Donut — Attack vs Benign */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-4">Threat Distribution</p>
          <div className="flex items-center gap-4">
            <ResponsiveContainer width="55%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%" cy="50%"
                  innerRadius={48} outerRadius={72}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} stroke="transparent" />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3 flex-1">
              {pieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.fill }} />
                  <div>
                    <p className="text-sm font-semibold text-white">{d.name}</p>
                    <p className="text-xs text-slate-500">{d.value} alerts · {d.pct}%</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Severity Breakdown */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-4">Severity Breakdown</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={severityData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Alerts">
                {severityData.map((entry, i) => (
                  <Cell key={i} fill={SEVERITY_COLORS[entry.name] || '#6366f1'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 2: Confidence Histogram + Top Features ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Confidence distribution */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-4">Confidence Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={confData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="bucket" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(99,102,241,0.1)' }} />
              <Bar dataKey="count" name="Alerts" radius={[4, 4, 0, 0]}>
                {confData.map((_, i) => (
                  <Cell key={i} fill={CONF_COLORS[i % CONF_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top SHAP features */}
        <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
          <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-4">Top Influential Features</p>
          {featureData.length === 0 ? (
            <p className="text-xs text-slate-600 mt-6 text-center">No SHAP feature data available</p>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={featureData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="feature" type="category" width={80} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(99,102,241,0.1)' }} />
                <Bar dataKey="count" name="Mentions" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Download + note ── */}
      <div className="space-y-2">
        <button
          onClick={onDownload}
          disabled={downloading}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
            downloading
              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white shadow-lg shadow-green-500/20'
          }`}
        >
          {downloading ? (
            <>
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              Preparing download…
            </>
          ) : (
            <>⬇  Download Full Results CSV</>
          )}
        </button>
        <p className="text-xs text-slate-500 text-center">
          CSV includes: index · prediction · confidence · severity · top 3 SHAP features
        </p>
      </div>
    </div>
  );
}

// ─── Main BatchMode ───────────────────────────────────────────────────────────
function BatchMode() {
  const [file, setFile]             = useState(null);
  const [model, setModel]           = useState('ensemble');
  const [submitting, setSubmitting] = useState(false);
  const [job, setJob]               = useState(null);
  const [error, setError]           = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [analytics, setAnalytics]   = useState(null);
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const fetchAnalytics = async (jobId) => {
    try {
      const data = await getBatchAnalytics(jobId);
      setAnalytics(data);
    } catch (_) {}
  };

  const startPolling = jobId => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await getBatchStatus(jobId);
        setJob(status);
        if (!isActive(status.status)) {
          clearInterval(pollRef.current);
          if (status.status === 'completed') fetchAnalytics(jobId);
        }
      } catch {
        clearInterval(pollRef.current);
      }
    }, 2000);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    setJob(null);
    setAnalytics(null);
    try {
      const res = await uploadBatchFile(file, model);
      setJob({ job_id: res.job_id, status: res.status, total: res.total_alerts, processed: 0, progress: 0 });
      startPolling(res.job_id);
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!job?.job_id) return;
    setDownloading(true);
    try {
      await downloadBatchResults(job.job_id);
    } catch (e) {
      setError('Download failed: ' + (e.message || 'unknown error'));
    } finally {
      setDownloading(false);
    }
  };

  const handleReset = () => {
    clearInterval(pollRef.current);
    setFile(null);
    setJob(null);
    setError(null);
    setAnalytics(null);
  };

  const canSubmit = file && !submitting && (!job || isFailed(job?.status));

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="bg-slate-800 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Batch Upload</h2>
          <p className="text-slate-400 mt-1 text-sm">
            Upload a CSV of network flows — all alerts classified in the background
          </p>
        </div>
        {job && (
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm font-medium transition-colors"
          >
            New Batch
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left: upload + controls ── */}
        <div className="lg:col-span-7 space-y-4">

          <Dropzone onFile={setFile} file={file} />

          {/* Model selector */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-200">Classification Model</p>
              <p className="text-xs text-slate-500 mt-0.5">Applied to every row in the CSV</p>
            </div>
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
              disabled={!!job && isActive(job.status)}
              className="bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm disabled:opacity-50"
            >
              <option value="xgboost">XGBoost</option>
              <option value="cnn">CNN</option>
              <option value="ensemble">Ensemble</option>
            </select>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className={`w-full py-4 rounded-xl text-base font-bold transition-all duration-200 ${
              canSubmit
                ? 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-3">
                <span className="animate-spin w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                Uploading…
              </span>
            ) : '🚀  Start Batch Classification'}
          </button>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 text-red-300 text-sm">
              {error}
            </div>
          )}

          <ProgressCard job={job} />
        </div>

        {/* ── Right: info panel ── */}
        <div className="lg:col-span-5">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 sticky top-24 space-y-5">

            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-3">How it works</p>
              <div className="space-y-3 text-sm text-slate-400">
                {[
                  ['Upload a CSV', 'with the 194 UNSW-NB15 feature columns. Column order must match the training data.'],
                  ['Processing runs in the background', '— you can see live progress via the polling bar.'],
                  ['Analytics appear automatically', 'once complete — charts, KPIs, and feature importance. Then download the full CSV.'],
                ].map(([bold, rest], i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-blue-400 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                    <p><span className="text-slate-300 font-medium">{bold}</span> {rest}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-3">Output columns</p>
              <div className="space-y-1.5">
                {[
                  ['index',           'Row number from the uploaded file'],
                  ['prediction',      '0 = Benign · 1 = Attack'],
                  ['confidence',      'Model confidence score (0 – 1)'],
                  ['severity',        'benign / low / medium / high / critical'],
                  ['top_feature_1-3', 'Most influential SHAP features'],
                ].map(([col, desc]) => (
                  <div key={col} className="flex gap-3 text-xs">
                    <span className="text-cyan-300 font-mono w-32 shrink-0">{col}</span>
                    <span className="text-slate-500">{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-3">CSV format</p>
              <div className="bg-slate-900 rounded-lg p-3 text-xs font-mono text-slate-400 leading-relaxed overflow-x-auto">
                <p className="text-slate-500"># header row required</p>
                <p>dur,spkts,dpkts,sbytes,...</p>
                <p>0.121,4,2,512,...</p>
                <p>0.003,1,0,64,...</p>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Tip: export a slice of X_test.csv from <span className="font-mono text-slate-400">data/processed/</span> to test with real data.
              </p>
            </div>

          </div>
        </div>
      </div>

      {/* ── Full-width analytics (shown after completion) ── */}
      {analytics && (
        <BatchAnalytics
          analytics={analytics}
          job={job}
          onDownload={handleDownload}
          downloading={downloading}
        />
      )}
    </div>
  );
}

export default BatchMode;
