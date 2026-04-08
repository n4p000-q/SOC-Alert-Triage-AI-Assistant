import React, { useState, useEffect } from 'react';
import { loadSimulationAlerts } from '../utils/api';
import AlertCard from './AlertCard';

function LiveMode() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedModel, setSelectedModel] = useState('ensemble');
  const [stats, setStats] = useState(null);

  // Load alerts on mount
  useEffect(() => {
    loadAlerts();
  }, []);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && currentIndex < alerts.length - 1) {
      const timer = setTimeout(() => {
        setCurrentIndex(currentIndex + 1);
      }, 3000); // 3 seconds per alert
      return () => clearTimeout(timer);
    } else if (isPlaying && currentIndex === alerts.length - 1) {
      setIsPlaying(false);
    }
  }, [isPlaying, currentIndex, alerts.length]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await loadSimulationAlerts(50, 'balanced');
      setAlerts(data.alerts);
      setStats(data.statistics);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < alerts.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-12 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <h2 className="text-xl font-bold text-white mb-2">Loading Alerts...</h2>
        <p className="text-slate-400">Fetching 50 balanced alerts from backend</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-8 text-center">
        <h2 className="text-xl font-bold text-red-400 mb-2">Error Loading Alerts</h2>
        <p className="text-red-300 mb-4">{error}</p>
        <button
          onClick={loadAlerts}
          className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
        >
          Retry
        </button>
      </div>
    );
  }

  const currentAlert = alerts[currentIndex];

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Live Simulation</h2>
            <p className="text-slate-400 mt-1">
              Alert {currentIndex + 1} of {alerts.length}
            </p>
          </div>
          
          {/* Model Selector */}
          <div className="flex items-center space-x-4">
            <label className="text-slate-300 text-sm font-medium">Model:</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="xgboost">XGBoost</option>
              <option value="cnn">CNN</option>
              <option value="ensemble">Ensemble</option>
            </select>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-4 gap-4 mb-4">
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

        {/* Playback Controls */}
        <div className="flex items-center justify-center space-x-4">
          <button
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className={`px-6 py-2 rounded-lg font-medium ${
              currentIndex === 0
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            ← Previous
          </button>
          
          <button
            onClick={handlePlayPause}
            className={`px-8 py-2 rounded-lg font-medium ${
              isPlaying
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-green-500 hover:bg-green-600 text-white'
            }`}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          
          <button
            onClick={handleNext}
            disabled={currentIndex === alerts.length - 1}
            className={`px-6 py-2 rounded-lg font-medium ${
              currentIndex === alerts.length - 1
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            }`}
          >
            Next →
          </button>
          
          <button
            onClick={loadAlerts}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
          >
            🔄 Reload
          </button>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 bg-slate-700 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-500 h-full transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / alerts.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Current Alert */}
      {currentAlert && (
        <AlertCard
          alert={currentAlert}
          selectedModel={selectedModel}
        />
      )}
    </div>
  );
}

export default LiveMode;
