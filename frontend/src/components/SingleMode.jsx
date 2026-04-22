import React, { useState } from 'react';
import { predictSingleAlert } from '../utils/api';
import AlertCard from './AlertCard';

// ─── Feature definitions ──────────────────────────────────────────────────────

const PROTOCOL_OPTIONS = [
  '3pc', 'a/n', 'aes-sp3-d', 'any', 'argus', 'aris', 'arp', 'ax.25',
  'bbn-rcc', 'bna', 'br-sat-mon', 'cbt', 'cftp', 'chaos', 'compaq-peer',
  'cphb', 'cpnx', 'crtp', 'crudp', 'dcn', 'ddp', 'ddx', 'dgp', 'egp',
  'eigrp', 'emcon', 'encap', 'etherip', 'fc', 'fire', 'ggp', 'gmtp',
  'gre', 'hmp', 'i-nlsp', 'iatp', 'ib', 'icmp', 'idpr', 'idpr-cmtp',
  'idrp', 'ifmp', 'igmp', 'igp', 'il', 'ip', 'ipcomp', 'ipcv', 'ipip',
  'iplt', 'ipnip', 'ippc', 'ipv6', 'ipv6-frag', 'ipv6-no', 'ipv6-opts',
  'ipv6-route', 'ipx-n-ip', 'irtp', 'isis', 'iso-ip', 'iso-tp4',
  'kryptolan', 'l2tp', 'larp', 'leaf-1', 'leaf-2', 'merit-inp', 'mfe-nsp',
  'mhrp', 'micp', 'mobile', 'mtp', 'mux', 'narp', 'netblt', 'nsfnet-igp',
  'nvp', 'ospf', 'pgm', 'pim', 'pipe', 'pnni', 'pri-enc', 'prm', 'ptp',
  'pup', 'pvp', 'qnx', 'rdp', 'rsvp', 'rtp', 'rvd', 'sat-expak', 'sat-mon',
  'sccopmce', 'scps', 'sctp', 'sdrp', 'secure-vmtp', 'sep', 'skip', 'sm',
  'smp', 'snp', 'sprite-rpc', 'sps', 'srp', 'st2', 'stp', 'sun-nd', 'swipe',
  'tcf', 'tcp', 'tlsp', 'tp++', 'trunk-1', 'trunk-2', 'ttp', 'udp', 'unas',
  'uti', 'vines', 'visa', 'vmtp', 'vrrp', 'wb-expak', 'wb-mon', 'wsn',
  'xnet', 'xns-idp', 'xtp', 'zero',
];

const SERVICE_OPTIONS = [
  '-', 'dhcp', 'dns', 'ftp', 'ftp-data', 'http', 'irc', 'pop3', 'radius',
  'smtp', 'snmp', 'ssh', 'ssl',
];

const STATE_OPTIONS = ['CON', 'ECO', 'FIN', 'INT', 'PAR', 'REQ', 'RST', 'URN', 'no'];

const FEATURE_GROUPS = [
  {
    title: 'Basic Traffic',
    icon: '📊',
    fields: [
      { key: 'dur',      label: 'Duration',    hint: 'Connection duration (seconds)', type: 'float' },
      { key: 'spkts',    label: 'Src Packets', hint: 'Source-to-dest packets',        type: 'int'   },
      { key: 'dpkts',    label: 'Dst Packets', hint: 'Dest-to-source packets',        type: 'int'   },
      { key: 'sbytes',   label: 'Src Bytes',   hint: 'Source-to-dest bytes',          type: 'int'   },
      { key: 'dbytes',   label: 'Dst Bytes',   hint: 'Dest-to-source bytes',          type: 'int'   },
      { key: 'rate',     label: 'Rate',        hint: 'Packet rate (packets/sec)',      type: 'float' },
      { key: 'sttl',     label: 'Src TTL',     hint: 'Source IP TTL value',           type: 'int'   },
      { key: 'dttl',     label: 'Dst TTL',     hint: 'Destination IP TTL value',      type: 'int'   },
      { key: 'sload',    label: 'Src Load',    hint: 'Source bits/sec load',          type: 'float' },
      { key: 'dload',    label: 'Dst Load',    hint: 'Destination bits/sec load',     type: 'float' },
      { key: 'sloss',    label: 'Src Loss',    hint: 'Source retransmitted packets',  type: 'int'   },
      { key: 'dloss',    label: 'Dst Loss',    hint: 'Dest retransmitted packets',    type: 'int'   },
    ],
  },
  {
    title: 'Timing & Jitter',
    icon: '⏱️',
    fields: [
      { key: 'sinpkt',  label: 'Src Inter-pkt', hint: 'Src inter-packet arrival time (ms)', type: 'float' },
      { key: 'dinpkt',  label: 'Dst Inter-pkt', hint: 'Dst inter-packet arrival time (ms)', type: 'float' },
      { key: 'sjit',    label: 'Src Jitter',    hint: 'Source jitter (ms)',                  type: 'float' },
      { key: 'djit',    label: 'Dst Jitter',    hint: 'Destination jitter (ms)',             type: 'float' },
      { key: 'tcprtt',  label: 'TCP RTT',       hint: 'TCP round-trip time (ms)',            type: 'float' },
      { key: 'synack',  label: 'SYN→ACK',       hint: 'Time from SYN to SYN-ACK (ms)',      type: 'float' },
      { key: 'ackdat',  label: 'ACK→Data',      hint: 'Time from SYN-ACK to ACK (ms)',      type: 'float' },
    ],
  },
  {
    title: 'Window & Payload',
    icon: '📦',
    fields: [
      { key: 'swin',               label: 'Src Window',     hint: 'Source TCP window size',              type: 'int' },
      { key: 'stcpb',              label: 'Src TCP Base',   hint: 'Source TCP base sequence number',     type: 'int' },
      { key: 'dtcpb',              label: 'Dst TCP Base',   hint: 'Destination TCP base sequence number',type: 'int' },
      { key: 'dwin',               label: 'Dst Window',     hint: 'Destination TCP window size',         type: 'int' },
      { key: 'smean',              label: 'Src Mean Pkt',   hint: 'Mean source packet size (bytes)',      type: 'int' },
      { key: 'dmean',              label: 'Dst Mean Pkt',   hint: 'Mean dest packet size (bytes)',        type: 'int' },
      { key: 'trans_depth',        label: 'Trans Depth',    hint: 'HTTP transaction pipeline depth',      type: 'int' },
      { key: 'response_body_len',  label: 'Response Body',  hint: 'HTTP response body length (bytes)',    type: 'int' },
    ],
  },
  {
    title: 'Connection Tracking',
    icon: '🔗',
    fields: [
      { key: 'ct_srv_src',      label: 'CT Srv→Src',   hint: '# connections same service+source IP',  type: 'int' },
      { key: 'ct_state_ttl',   label: 'CT State TTL', hint: '# connections same state+TTL',           type: 'int' },
      { key: 'ct_dst_ltm',     label: 'CT Dst LTM',   hint: '# connections to same dst (last 100ms)', type: 'int' },
      { key: 'ct_src_dport_ltm',label: 'CT Src Dport',hint: '# connections same src IP+dst port',     type: 'int' },
      { key: 'ct_dst_sport_ltm',label: 'CT Dst Sport',hint: '# connections same dst IP+src port',     type: 'int' },
      { key: 'ct_dst_src_ltm', label: 'CT Dst↔Src',   hint: '# connections same dst+src IP pair',    type: 'int' },
      { key: 'ct_src_ltm',     label: 'CT Src LTM',   hint: '# connections same source IP',           type: 'int' },
      { key: 'ct_srv_dst',     label: 'CT Srv→Dst',   hint: '# connections same service+dest IP',     type: 'int' },
    ],
  },
  {
    title: 'Application & Flags',
    icon: '🚩',
    fields: [
      { key: 'is_ftp_login',      label: 'FTP Login',    hint: 'FTP session with login (0/1)',     type: 'binary' },
      { key: 'ct_ftp_cmd',        label: 'FTP Cmds',     hint: '# FTP commands in session',        type: 'int'    },
      { key: 'ct_flw_http_mthd',  label: 'HTTP Methods', hint: '# HTTP methods in connection',     type: 'int'    },
      { key: 'is_sm_ips_ports',   label: 'Same IP/Port', hint: 'Same src/dst IPs and ports (0/1)', type: 'binary' },
    ],
  },
];

const ALL_NUMERIC_KEYS = FEATURE_GROUPS.flatMap(g => g.fields.map(f => f.key));
const INITIAL_VALUES = Object.fromEntries(ALL_NUMERIC_KEYS.map(k => [k, 0]));

// Mirrors the backend severity logic
const calcSeverity = (pred, conf) => {
  if (pred === 0) return 'benign';
  if (conf >= 0.9) return 'critical';
  if (conf >= 0.7) return 'high';
  if (conf >= 0.5) return 'medium';
  return 'low';
};

// Shape the API response into the format AlertCard expects
const adaptToAlertFormat = (apiResult, features, primaryModel) => {
  const mc = apiResult.model_comparison;
  return {
    id: apiResult.id,
    true_label: null,   // no ground truth for manual input
    features,
    xgboost: {
      prediction:  mc.xgboost.prediction,
      confidence:  mc.xgboost.confidence,
      severity:    calcSeverity(mc.xgboost.prediction, mc.xgboost.confidence),
      top_features: primaryModel === 'xgboost' ? apiResult.top_features : [],
    },
    cnn: {
      prediction:  mc.cnn.prediction,
      confidence:  mc.cnn.confidence,
      severity:    calcSeverity(mc.cnn.prediction, mc.cnn.confidence),
      top_features: primaryModel === 'cnn' ? apiResult.top_features : [],
    },
    ensemble: {
      prediction:  mc.ensemble.prediction,
      confidence:  mc.ensemble.confidence,
      severity:    calcSeverity(mc.ensemble.prediction, mc.ensemble.confidence),
      top_features: primaryModel === 'ensemble' ? apiResult.top_features : [],
    },
  };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(value === 1 ? 0 : 1)}
      className={`relative w-10 h-6 rounded-full transition-colors duration-200 focus:outline-none ${
        value === 1 ? 'bg-blue-500' : 'bg-slate-600'
      }`}
    >
      <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${
        value === 1 ? 'left-5' : 'left-1'
      }`} />
    </button>
  );
}

function FieldInput({ field, value, onChange }) {
  if (field.type === 'binary') {
    return (
      <div className="flex items-center gap-3 h-8">
        <Toggle value={value} onChange={v => onChange(field.key, v)} />
        <span className="text-xs text-slate-400 font-mono">{value === 1 ? '1 · Yes' : '0 · No'}</span>
      </div>
    );
  }
  return (
    <input
      type="number"
      value={value}
      step={field.type === 'float' ? 'any' : 1}
      min={0}
      onChange={e => {
        const raw = e.target.value;
        const parsed = field.type === 'float' ? parseFloat(raw) : parseInt(raw, 10);
        onChange(field.key, isNaN(parsed) ? 0 : parsed);
      }}
      className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
    />
  );
}

function FeatureGroup({ group, values, onChange }) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{group.icon}</span>
          <span className="text-sm font-semibold text-slate-200">{group.title}</span>
          <span className="text-xs text-slate-500">({group.fields.length} features)</span>
        </div>
        <span className={`text-slate-400 text-xs transition-transform duration-200 ${collapsed ? '' : 'rotate-90'}`}>
          ▶
        </span>
      </button>

      {!collapsed && (
        <div className="border-t border-slate-700/60 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
          {group.fields.map(field => (
            <div key={field.key}>
              <label className="block text-xs text-slate-400 font-mono mb-1.5" title={field.hint}>
                {field.label}
                <span className="ml-1 text-slate-600 cursor-help" title={field.hint}> (?)</span>
              </label>
              <FieldInput field={field} value={values[field.key]} onChange={onChange} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

function SingleMode() {
  const [values, setValues]           = useState(INITIAL_VALUES);
  const [protocol, setProtocol]       = useState('tcp');
  const [service, setService]         = useState('http');
  const [connState, setConnState]     = useState('FIN');
  const [selectedModel, setModel]     = useState('ensemble');
  const [loading, setLoading]         = useState(false);
  const [result, setResult]           = useState(null);
  const [error, setError]             = useState(null);

  const handleValueChange = (key, val) => setValues(prev => ({ ...prev, [key]: val }));

  const buildFeatures = () => {
    const f = { ...values };
    PROTOCOL_OPTIONS.forEach(p  => { f[`proto_${p}`]   = 0; });
    SERVICE_OPTIONS.forEach(s   => { f[`service_${s}`] = 0; });
    STATE_OPTIONS.forEach(s     => { f[`state_${s}`]   = 0; });
    f[`proto_${protocol}`]  = 1;
    f[`service_${service}`] = 1;
    f[`state_${connState}`] = 1;
    return f;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const features   = buildFeatures();
      const apiResult  = await predictSingleAlert(features, selectedModel);
      setResult(adaptToAlertFormat(apiResult, features, selectedModel));
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'Prediction failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setValues(INITIAL_VALUES);
    setProtocol('tcp');
    setService('http');
    setConnState('FIN');
    setResult(null);
    setError(null);
  };

  const selectCls = 'w-full bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500';

  return (
    <div className="space-y-6">

      {/* ── Header bar ──────────────────────────────────────────── */}
      <div className="bg-slate-800 rounded-xl p-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Single Alert Classification</h2>
          <p className="text-slate-400 mt-1 text-sm">
            Enter network flow features manually — all three models classify in parallel
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-slate-300 text-sm font-medium">Primary model:</label>
          <select
            value={selectedModel}
            onChange={e => setModel(e.target.value)}
            className="bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="xgboost">XGBoost</option>
            <option value="cnn">CNN</option>
            <option value="ensemble">Ensemble</option>
          </select>
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-slate-700 text-slate-300 rounded-lg hover:bg-slate-600 text-sm font-medium transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Left: form ──────────────────────────────────────────── */}
        <div className="lg:col-span-7 space-y-4">

          {/* Categorical dropdowns */}
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-4">
              Network Classification
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 font-mono mb-1.5">Protocol</label>
                <select value={protocol} onChange={e => setProtocol(e.target.value)} className={selectCls}>
                  {PROTOCOL_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-mono mb-1.5">Service</label>
                <select value={service} onChange={e => setService(e.target.value)} className={selectCls}>
                  {SERVICE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s === '-' ? 'None  (-)' : s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 font-mono mb-1.5">Connection State</label>
                <select value={connState} onChange={e => setConnState(e.target.value)} className={selectCls}>
                  {STATE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Numeric feature groups */}
          {FEATURE_GROUPS.map(group => (
            <FeatureGroup
              key={group.title}
              group={group}
              values={values}
              onChange={handleValueChange}
            />
          ))}

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className={`w-full py-4 rounded-xl text-base font-bold transition-all duration-200 ${
              loading
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/20'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-3">
                <span className="animate-spin inline-block w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                Classifying…
              </span>
            ) : '🔍  Classify Alert'}
          </button>

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4 text-red-300 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* ── Right: info panel ───────────────────────────────────── */}
        <div className="lg:col-span-5">
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 sticky top-24 space-y-5">

            <div>
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-3">How it works</p>
              <div className="space-y-3 text-sm text-slate-400">
                {[
                  ['Protocol, Service & State', 'are the most impactful categorical features — start here.'],
                  ['Numeric fields', 'default to 0. Adjust traffic volume, timing, and window values to match your alert.'],
                  ['All 3 models', 'run simultaneously. The primary model provides SHAP explanations; the others show predictions for comparison.'],
                ].map(([bold, rest], i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-blue-400 font-bold mt-0.5 shrink-0">{i + 1}.</span>
                    <p><span className="text-slate-300 font-medium">{bold}</span> {rest}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold mb-3">Model Info</p>
              <div className="space-y-2 text-xs">
                {[
                  { dot: 'bg-cyan-400',   name: 'XGBoost',  cls: 'text-cyan-300',   desc: 'Gradient boosted trees · TreeSHAP explanations' },
                  { dot: 'bg-purple-400', name: 'CNN',       cls: 'text-purple-300', desc: 'Convolutional neural network · feature importance' },
                  { dot: 'bg-amber-400',  name: 'Ensemble',  cls: 'text-amber-300',  desc: '60 % XGBoost + 40 % CNN weighted average' },
                ].map(m => (
                  <div key={m.name} className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full mt-0.5 shrink-0 ${m.dot}`} />
                    <span>
                      <span className={`font-semibold ${m.cls}`}>{m.name}</span>
                      <span className="text-slate-500 ml-1">— {m.desc}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-700 pt-4">
              <p className="text-xs text-slate-500">
                UNSW-NB15 dataset · {ALL_NUMERIC_KEYS.length} numeric + {PROTOCOL_OPTIONS.length} protocol
                + {SERVICE_OPTIONS.length} service + {STATE_OPTIONS.length} state = 194 features total
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Result ──────────────────────────────────────────────── */}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-700" />
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">
              Classification Result
            </p>
            <div className="h-px flex-1 bg-slate-700" />
          </div>
          <AlertCard alert={result} selectedModel={selectedModel} />
        </div>
      )}
    </div>
  );
}

export default SingleMode;
