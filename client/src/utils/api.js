import axios from 'axios';

const resolveApiBaseUrl = () => {
  const configuredUrl = import.meta.env.VITE_API_URL;
  if (!configuredUrl) return '/api';

  const normalized = configuredUrl.replace(/\/+$/, '');
  return normalized.endsWith('/api') ? normalized : `${normalized}/api`;
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
});

// Attach token to every request if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;
