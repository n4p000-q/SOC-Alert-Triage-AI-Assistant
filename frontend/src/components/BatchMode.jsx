import React, { useState, useRef, useEffect } from 'react';
import { uploadBatchFile, getBatchStatus, downloadBatchResults } from '../utils/api';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  queued:     { label: 'Queued',     color: 'text-blue-400',   bar: 'bg-blue-500',   pulse: true  },
  processing: { label: 'Processing', color: 'text-amber-400',  bar: 'bg-amber-500',  pulse: true  },
  completed:  { label: 'Completed',  color: 'text-green-400',  bar: 'bg-green-500',  pulse: false },
};

const isActive = status => status === 'queued' || status === 'processing';
const isFailed = status => typeof status === 'string' && status.startsWith('failed');

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

  const handleChange = e => {
    const selected = e.target.files[0];
    if (selected) onFile(selected);
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
      className={`
        cursor-pointer border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200
        ${dragging
          ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
          : 'border-slate-600 hover:border-slate-500 hover:bg-slate-700/30'
        }
      `}
    >
      <input ref={inputRef} type="file" accept=".csv" onChange={handleChange} className="hidden" />
      <div className="text-4xl mb-3">📂</div>
      <p className="text-slate-200 font-semibold mb-1">Drop a CSV file here</p>
      <p className="text-slate-500 text-sm mb-4">or click to browse</p>
      <p className="text-xs text-slate-600">
        File must contain all 194 UNSW-NB15 feature columns in the correct order
      </p>
    </div>
  );
}

// ─── Progress card ────────────────────────────────────────────────────────────
function ProgressCard({ job }) {
  if (!job) return null;

  const failed  = isFailed(job.status);
  const cfg     = STATUS_CONFIG[job.status] || {};
  const pct     = job.progress ?? 0;

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${
      failed
        ? 'bg-red-950/30 border-red-500/50'
        : 'bg-slate-800/60 border-slate-700'
    }`}>
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

      {/* Progress bar */}
      {!failed && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1.5">
            <span>{job.processed ?? 0} / {job.total ?? '?'} alerts</span>
            <span>{pct.toFixed(1)}%</span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${cfg.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {failed && (
        <p className="text-red-300 text-sm">{job.status.replace('failed: ', '')}</p>
      )}

      {/* Timestamps */}
      <div className="flex gap-6 text-xs text-slate-500">
        {job.started_at && (
          <span>Started: {new Date(job.started_at).toLocaleTimeString()}</span>
        )}
        {job.completed_at && (
          <span>Completed: {new Date(job.completed_at).toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  );
}

// ─── Results summary ──────────────────────────────────────────────────────────
function ResultsSummary({ job, onDownload, downloading }) {
  if (!job || job.status !== 'completed') return null;

  const stats = [
    { label: 'Total Alerts',  value: job.total,     color: 'text-white',       bg: 'bg-slate-700/60'       },
    { label: 'Processed',     value: job.processed, color: 'text-green-400',   bg: 'bg-green-900/20 border border-green-500/30'  },
    { label: 'Duration',      value: (() => {
        if (!job.started_at || !job.completed_at) return '—';
        const s = (new Date(job.completed_at) - new Date(job.started_at)) / 1000;
        return s < 60 ? `${s.toFixed(1)}s` : `${(s/60).toFixed(1)}m`;
      })(),
      color: 'text-blue-400', bg: 'bg-blue-900/20 border border-blue-500/30'
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className={`rounded-xl p-4 ${s.bg}`}>
            <p className="text-xs text-slate-400 mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

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
          <>⬇  Download Results CSV</>
        )}
      </button>

      <p className="text-xs text-slate-500 text-center">
        Results include: index, prediction, confidence, severity, top 3 feature names
      </p>
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
  const pollRef = useRef(null);

  // Stop polling on unmount
  useEffect(() => () => clearInterval(pollRef.current), []);

  const startPolling = jobId => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const status = await getBatchStatus(jobId);
        setJob(status);
        if (!isActive(status.status)) clearInterval(pollRef.current);
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
  };

  const canSubmit = file && !submitting && (!job || isFailed(job?.status));

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────── */}
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

      <div className="grid grid-cols-12 gap-6">

        {/* ── Left: upload + controls ──────────────────────────── */}
        <div className="col-span-7 space-y-4">

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

          {/* Progress */}
          <ProgressCard job={job} />

          {/* Results */}
          <ResultsSummary job={job} onDownload={handleDownload} downloading={downloading} />
        </div>

        {/* ── Right: info panel ───────────────────────────────── */}
        <div className="col-span-5">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 sticky top-24 space-y-5">

            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-3">How it works</p>
              <div className="space-y-3 text-sm text-slate-400">
                {[
                  ['Upload a CSV', 'with the 194 UNSW-NB15 feature columns. Column order must match the training data.'],
                  ['Processing runs in the background', '— you can see live progress via the polling bar.'],
                  ['Download the results', 'as a CSV with prediction, confidence, severity, and top 3 SHAP features per row.'],
                ].map(([bold, rest], i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-blue-400 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                    <p><span className="text-slate-300 font-medium">{bold}</span> {rest}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-3">
                Output columns
              </p>
              <div className="space-y-1.5">
                {[
                  ['index',        'Row number from the uploaded file'],
                  ['prediction',   '0 = Benign · 1 = Attack'],
                  ['confidence',   'Model confidence score (0 – 1)'],
                  ['severity',     'benign / low / medium / high / critical'],
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
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-3">
                CSV format
              </p>
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
    </div>
  );
}

export default BatchMode;
