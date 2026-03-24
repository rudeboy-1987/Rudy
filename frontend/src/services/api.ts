import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface MaterialItem {
  name: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface LaborItem {
  description: string;
  hours: number;
  rate: number;
  total: number;
}

export interface EquipmentItem {
  name: string;
  days: number;
  daily_rate: number;
  total: number;
}

export interface Estimate {
  id: string;
  user_id: string;
  project_name: string;
  project_type: string;
  client_name: string;
  client_email?: string;
  client_phone?: string;
  address?: string;
  description?: string;
  materials: MaterialItem[];
  labor: LaborItem[];
  equipment: EquipmentItem[];
  materials_total: number;
  labor_total: number;
  equipment_total: number;
  subtotal: number;
  overhead_percentage: number;
  overhead_amount: number;
  profit_percentage: number;
  profit_amount: number;
  grand_total: number;
  notes?: string;
  ai_analysis?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  user_id: string;
  poster_type: string;
  poster_name: string;
  poster_email: string;
  poster_phone?: string;
  title: string;
  description: string;
  project_type: string;
  location: string;
  budget_range?: string;
  timeline?: string;
  status: string;
  images: string[];
  created_at: string;
}

export interface MaterialPrice {
  id: string;
  category: string;
  name: string;
  unit: string;
  price: number;
  description?: string;
}

// Estimates API
export const estimatesApi = {
  getAll: () => api.get<Estimate[]>('/estimates'),
  getOne: (id: string) => api.get<Estimate>(`/estimates/${id}`),
  create: (data: Partial<Estimate>) => api.post<Estimate>('/estimates', data),
  update: (id: string, data: Partial<Estimate>) => api.put<Estimate>(`/estimates/${id}`, data),
  delete: (id: string) => api.delete(`/estimates/${id}`),
  send: (id: string, email: string, message?: string) =>
    api.post(`/estimates/${id}/send`, { estimate_id: id, recipient_email: email, message }),
};

// AI API
export const aiApi = {
  analyzeBlueprint: (blueprint_base64: string | null, project_description: string, project_type: string) =>
    api.post('/ai/analyze-blueprint', { blueprint_base64, project_description, project_type }),
  generateEstimate: (estimate_id: string) =>
    api.post(`/ai/generate-estimate?estimate_id=${estimate_id}`),
  analyzeProject: (project_description: string, project_type: string, client_name?: string, address?: string) =>
    api.post('/ai/analyze-project', { project_description, project_type, client_name, address }),
};

// Payments API
export const paymentsApi = {
  createCheckout: (tier: string, origin_url: string) =>
    api.post('/payments/checkout', { tier, origin_url }),
  getPaymentStatus: (session_id: string) =>
    api.get(`/payments/status/${session_id}`),
};

// Email API (updated)
export const emailApi = {
  sendEstimate: (estimate_id: string, recipient_email: string, message?: string) =>
    api.post(`/estimates/${estimate_id}/email`, { estimate_id, recipient_email, message }),
};

// Materials API
export const materialsApi = {
  getPrices: (category?: string) =>
    api.get<MaterialPrice[]>('/materials/prices', { params: { category } }),
  seedPrices: () => api.post('/materials/prices/seed'),
};

// Jobs API
export const jobsApi = {
  getAll: (status?: string, project_type?: string) =>
    api.get<Job[]>('/jobs', { params: { status, project_type } }),
  getOne: (id: string) => api.get<Job>(`/jobs/${id}`),
  create: (data: Partial<Job>) => api.post<Job>('/jobs', data),
  update: (id: string, data: Partial<Job>) => api.put<Job>(`/jobs/${id}`, data),
  delete: (id: string) => api.delete(`/jobs/${id}`),
};

// Subscription API
export const subscriptionApi = {
  getStatus: () => api.get('/subscription/status'),
  upgrade: (tier: string) => api.post(`/subscription/upgrade?tier=${tier}`),
};

export default api;
