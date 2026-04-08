import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import ToastContainer from './components/Toast';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

const TABS = [
  { id: 'live',      name: 'Live Simulation', icon: '🔴' },
  { id: 'single',   name: 'Single Alert',    icon: '🎯' },
  { id: 'batch',    name: 'Batch Upload',    icon: '📊' },
  { id: 'analytics',name: 'Analytics',       icon: '📈' },
];

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
    >
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}

const ROLE_COLORS = {
  L1: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  L2: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
  L3: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
};

// ─── Inner app (rendered after auth is confirmed) ─────────────────────────────
function AppShell() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('live');

  // Show nothing while we verify the stored session
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <span className="animate-spin w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full" />
      </div>
    );
  }

  // Not authenticated → show login page
  if (!user) return <LoginPage />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">

      {/* ── Header ────────────────────────────────────────────── */}
      <header className="bg-slate-900/50 border-b border-slate-700 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">

            {/* Logo + title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">🛡️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">SOC Alert Triage Assistant</h1>
                <p className="text-sm text-slate-400">AI-Powered Security Operations Center</p>
              </div>
            </div>

            {/* Right side: status + user */}
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full">
                <span className="text-green-400 text-sm font-medium flex items-center">
                  <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                  System Online
                </span>
              </div>

              {/* Theme toggle */}
              <ThemeToggle />

              {/* User badge */}
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${ROLE_COLORS[user.role] || ROLE_COLORS.L1}`}>
                  {user.role}
                </span>
                <span className="text-slate-300 text-sm font-medium">{user.name}</span>
              </div>

              {/* Logout */}
              <button
                onClick={logout}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex space-x-1">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  px-6 py-3 rounded-lg font-medium transition-all duration-200
                  ${activeTab === tab.id
                    ? 'bg-slate-800 text-white shadow-lg shadow-slate-900/50'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                `}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Main content ──────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Dashboard activeTab={activeTab} />
      </main>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-slate-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <p>Built with XGBoost, CNN, and Ensemble Learning</p>
            <p>National University of Lesotho · 2025</p>
          </div>
        </div>
      </footer>

      {/* ── Toast notifications ────────────────────────────────── */}
      <ToastContainer />
    </div>
  );
}

// ─── Root: wrap with providers ────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
