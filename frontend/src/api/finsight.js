import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const api = axios.create({ baseURL: BASE });

export const generateReport  = (ticker, force = false) =>
  api.post(`/report?ticker=${ticker}&force_refresh=${force}`).then(r => r.data);

export const getReport       = (ticker) =>
  api.get(`/report/${ticker}`).then(r => r.data);

export const getAggregate    = (limit = 20) =>
  api.get(`/sentiment/aggregate?limit=${limit}`).then(r => r.data);

export const getTrending     = () =>
  api.get('/tickers/trending').then(r => r.data);