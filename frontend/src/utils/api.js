import axios from 'axios';

// Base API URL — set via REACT_APP_API_URL in frontend/.env
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Inject auth token on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('soc_token');
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  return config;
});

// ============================================================
// Auth
// ============================================================
export const registerUser = async (email, password, name, role) => {
  const response = await api.post('/auth/register', { email, password, name, role });
  return response.data;
};

export const loginUser = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  const { token, user } = response.data;
  localStorage.setItem('soc_token', token);
  localStorage.setItem('soc_user', JSON.stringify(user));
  return { token, user };
};

export const logoutUser = async () => {
  try { await api.post('/auth/logout'); } catch (_) {}
  localStorage.removeItem('soc_token');
  localStorage.removeItem('soc_user');
};

export const getMe = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

// ============================================================
// Health Check
// ============================================================
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

// ============================================================
// Simulation Mode
// ============================================================
export const loadSimulationAlerts = async (count = 50, balance = 'balanced') => {
  const response = await api.get('/simulation/load-alerts', {
    params: { count, balance }
  });
  return response.data;
};

// ============================================================
// Single Alert Classification
// ============================================================
export const predictSingleAlert = async (features, model = 'ensemble') => {
  const response = await api.post('/predict/single', {
    features,
    model
  });
  return response.data;
};

// ============================================================
// Batch Processing
// ============================================================
export const uploadBatchFile = async (file, model = 'ensemble') => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('model', model);
  
  const response = await api.post('/predict/batch', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const getBatchStatus = async (jobId) => {
  const response = await api.get(`/batch/${jobId}/status`);
  return response.data;
};

export const downloadBatchResults = async (jobId) => {
  const response = await api.get(`/batch/${jobId}/download`, {
    responseType: 'blob',
  });
  
  // Create download link
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `batch_results_${jobId}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
};

// ============================================================
// Triage Feedback (AACT)
// ============================================================
export const submitTriageDecision = async (predictionId, analystLevel, decision, notes = '') => {
  const response = await api.post('/triage', {
    prediction_id: predictionId,
    analyst_level: analystLevel,
    decision,
    notes
  });
  return response.data;
};

// ============================================================
// Analytics
// ============================================================
export const getAnalytics = async () => {
  const response = await api.get('/analytics/overview');
  return response.data;
};

export const getAACTMetrics = async () => {
  const response = await api.get('/analytics/aact-metrics');
  return response.data;
};

export default api;
