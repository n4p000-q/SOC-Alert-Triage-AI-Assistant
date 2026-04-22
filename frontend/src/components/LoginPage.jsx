import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { registerUser, forgotPassword, resetPassword } from '../utils/api';

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

  // 'login' | 'register' | 'forgot' | 'reset'
  const [mode, setMode]         = useState('login');
  const [loading, setLoading]   = useState(false);

  // Shared fields
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  // Register-only fields
  const [name, setName]         = useState('');
  const [role, setRole]         = useState('L1');

  // Reset-only fields
  const [resetToken, setResetToken]   = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [generatedToken, setGeneratedToken] = useState(''); // demo: shown on screen

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

  const handleForgot = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await forgotPassword(email);
      // Demo: backend returns the token directly (no email server)
      if (res.reset_token) {
        setGeneratedToken(res.reset_token);
        addToast('info', 'Reset token generated — see below');
      } else {
        addToast('info', res.message);
      }
    } catch (err) {
      const msg = err.response?.data?.error || 'Request failed';
      setError(msg);
      addToast('error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await resetPassword(resetToken, newPassword);
      addToast('success', 'Password reset — please log in');
      setMode('login');
      setResetToken('');
      setNewPassword('');
      setGeneratedToken('');
    } catch (err) {
      const msg = err.response?.data?.error || 'Reset failed';
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
          <h1 className="text-2xl font-bold text-white">SOC Analyst Triage AI Assistant</h1>
          <p className="text-slate-400 text-sm mt-1">AI-Powered Security Operations Center</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">

          {/* Mode toggle — only for login/register */}
          {(mode === 'login' || mode === 'register') && (
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
          )}

          {/* ── Forgot password form ── */}
          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-slate-200 font-semibold">Forgot Password</p>
                <p className="text-slate-500 text-xs mt-1">Enter your email to receive a reset token</p>
              </div>
              <InputField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="analyst@soc.org" />
              {generatedToken && (
                <div className="bg-amber-900/30 border border-amber-500/50 rounded-lg p-3 space-y-1">
                  <p className="text-amber-300 text-xs font-semibold">Demo Mode — Reset Token:</p>
                  <p className="text-amber-200 text-xs font-mono break-all">{generatedToken}</p>
                  <p className="text-amber-600 text-xs">Copy this token, then click "Use Token"</p>
                  <button type="button" onClick={() => { setResetToken(generatedToken); setMode('reset'); }}
                    className="w-full mt-1 py-1.5 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-xs font-semibold">
                    Use Token →
                  </button>
                </div>
              )}
              {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white">
                {loading ? 'Sending…' : 'Get Reset Token'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(''); setGeneratedToken(''); }}
                className="w-full text-slate-400 hover:text-slate-200 text-sm text-center transition-colors">
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* ── Reset password form ── */}
          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-slate-200 font-semibold">Reset Password</p>
                <p className="text-slate-500 text-xs mt-1">Enter your reset token and new password</p>
              </div>
              <InputField label="Reset Token" value={resetToken} onChange={setResetToken} placeholder="Paste your reset token" />
              <InputField label="New Password" type="password" value={newPassword} onChange={setNewPassword} placeholder="Minimum 6 characters" autoComplete="new-password" />
              {error && <p className="text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-400 hover:to-cyan-400 text-white">
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError(''); }}
                className="w-full text-slate-400 hover:text-slate-200 text-sm text-center transition-colors">
                ← Back to Sign In
              </button>
            </form>
          )}

          {/* ── Login / Register form ── */}
          {(mode === 'login' || mode === 'register') && (
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

            {/* Forgot password link */}
            {mode === 'login' && (
              <button type="button" onClick={() => { setMode('forgot'); setError(''); }}
                className="w-full text-slate-500 hover:text-slate-300 text-xs text-center transition-colors mt-1">
                Forgot password?
              </button>
            )}
          </form>
          )}
        </div>

        <p className="text-center text-xs text-slate-600">
          National University of Lesotho · SOC Analyst Triage AI Assistant · 2025
        </p>
      </div>
    </div>
  );
}
