import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { registerUser } from '../utils/api';

const ROLES = [
  { value: 'L1', label: 'L1 — Junior Analyst',    desc: 'First-line triage, escalation' },
  { value: 'L2', label: 'L2 — Senior Analyst',    desc: 'Investigation, remediation' },
  { value: 'L3', label: 'L3 — Lead / Threat Intel', desc: 'Threat hunting, model oversight' },
];

function InputField({ label, type = 'text', value, onChange, placeholder, autoComplete }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 font-medium mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full bg-slate-700/60 border border-slate-600 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

export default function LoginPage() {
  const { login }    = useAuth();
  const { addToast } = useToast();

  const [mode, setMode]         = useState('login');   // 'login' | 'register'
  const [loading, setLoading]   = useState(false);

  // Shared fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Register-only fields
  const [name, setName]         = useState('');
  const [role, setRole]         = useState('L1');

  const [error, setError]       = useState('');

  const handleLogin = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      addToast('success', 'Welcome back!');
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      setError(msg);
      addToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await registerUser(email, password, name, role);
      addToast('success', 'Account created — please log in');
      setMode('login');
      setPassword('');
      setName('');
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      setError(msg);
      addToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Logo / title */}
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
            <span className="text-3xl">🛡️</span>
          </div>
          <h1 className="text-2xl font-bold text-white">SOC Triage Assistant</h1>
          <p className="text-slate-400 text-sm mt-1">AI-Powered Security Operations Center</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">

          {/* Mode toggle */}
          <div className="flex bg-slate-700/50 rounded-xl p-1 mb-6">
            {[['login', 'Sign In'], ['register', 'Create Account']].map(([m, label]) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  mode === m
                    ? 'bg-slate-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">

            {/* Register-only: name */}
            {mode === 'register' && (
              <InputField
                label="Full Name"
                value={name}
                onChange={setName}
                placeholder="e.g. Napo Mokoena"
                autoComplete="name"
              />
            )}

            <InputField
              label="Email Address"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="analyst@soc.org"
              autoComplete="email"
            />

            <InputField
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={mode === 'register' ? 'Minimum 6 characters' : '••••••••'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />

            {/* Register-only: role */}
            {mode === 'register' && (
              <div>
                <label className="block text-xs text-slate-400 font-medium mb-2">Analyst Level</label>
                <div className="space-y-2">
                  {ROLES.map(r => (
                    <label
                      key={r.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        role === r.value
                          ? 'border-blue-500/60 bg-blue-500/10'
                          : 'border-slate-600 hover:border-slate-500'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value={r.value}
                        checked={role === r.value}
                        onChange={() => setRole(r.value)}
                        className="accent-blue-500"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{r.label}</p>
                        <p className="text-xs text-slate-500">{r.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2">
                {error}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all duration-200 ${
                loading
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white shadow-lg shadow-blue-500/20'
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                  {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-slate-600">
          National University of Lesotho · SOC AI Triage · 2025
        </p>
      </div>
    </div>
  );
}
