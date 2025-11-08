// src/lib/api.js
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add token to requests if available
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('payment-token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle response errors
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      // localStorage.removeItem('payment-token');
      // window.location.href = '/';
      return
    }
    return Promise.reject(error.response?.data || error.message);
  }
);

// ==================== PAYMENT APIS ====================

// Daily Payments
export const paymentAPI = {
  // Daily Payments
  createDailyPayment: (data) => apiClient.post('/payments/daily', data),
  getDailyPayments: (params) => apiClient.get('/payments/daily', { params }),
  updateDailyPayment: (id, data) => apiClient.patch(`/payments/daily/${id}`, data),
  deleteDailyPayment: (id) => apiClient.delete(`/payments/daily/${id}`),

  // Bulk Upsert Payments
  bulkUpsertPayments: (payments) => apiClient.post('/payments/bulk-upsert', { payments }),

  // Multi-Day Payments
  createMultiDayPayment: (data) => apiClient.post('/multi-day-payments/payments/bulk-upsert', data),
  getMultiDayPayments: (params) => apiClient.get('/multi-day-payments/payments', { params }),

  // Weekly Summary
  getWeeklySummary: (weekNumber, year) =>
    apiClient.get('/payments/weekly-summary', { params: { weekNumber, year } }),
  finalizeWeek: (data) => apiClient.post('/payments/finalize-week', data)
};

// ==================== EXPENSE APIS ====================

export const expenseAPI = {
  createExpense: (data) => apiClient.post('/expenses', data),
  getExpenses: (params) => apiClient.get('/expenses', { params }),
  updateExpense: (id, data) => apiClient.patch(`/expenses/${id}`, data),
  deleteExpense: (id) => apiClient.delete(`/expenses/${id}`)
};

export const dashboardAPI = {
  getRangeSummary: (startDate, endDate) =>
    apiClient.get('/dashboard/summary', { params: { startDate, endDate } })
};

// ==================== PARTY APIS ====================

export const partyAPI = {
  createParty: (data) => apiClient.post('/parties', data),
  getAllParties: () => apiClient.get('/parties'),
  getDailyParties: () => apiClient.get('/parties/daily', { params: { partyType: 'daily' } }),
  getMultiDayParties: () => apiClient.get('/parties/multiday', { params: { partyType: 'multiday' } }),
  getPartyDetails: (id, weekNumber) =>
    apiClient.get(`/parties/${id}`, { params: { weekNumber } }),
  updateParty: (id, data) => apiClient.patch(`/parties/${id}`, data),
  deactivateParty: (id) => apiClient.patch(`/parties/${id}/deactivate`, {})
};


export const bankColorAPI = {
  updateBankColor: (data) => apiClient.patch('/bank-color', data)
};

export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  role: (id) => apiClient.get('/auth/role',{params:{userId:id} })
};

export default apiClient;
