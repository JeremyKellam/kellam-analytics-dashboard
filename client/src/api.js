import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000/api',
});

API.interceptors.request.use((config) => {
  const key = localStorage.getItem('apiKey');
  if (key) config.headers['Authorization'] = `Bearer ${key}`;
  return config;
});

API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('apiKey');
      window.location.reload();
    }
    return Promise.reject(err);
  }
);

// Invoices
export const getInvoices = (params) => API.get('/invoices', { params });
export const createInvoice = (data) => API.post('/invoices', data);
export const updateInvoice = (id, data) => API.put(`/invoices/${id}`, data);
export const toggleInvoicePaid = (id, receiptFile) => {
  const fd = new FormData();
  if (receiptFile) fd.append('receipt', receiptFile);
  return API.patch(`/invoices/${id}/paid`, fd);
};
export const deleteInvoice = (id) => API.delete(`/invoices/${id}`);
export const getInvoiceReceiptUrl = (id) => API.get(`/invoices/${id}/receipt`);
export const parseInvoice = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return API.post('/invoices/parse', fd);
};

// Expenses
export const getExpenses = (params) => API.get('/expenses', { params });
export const addExpense = (data) => {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => { if (v != null) fd.append(k, v); });
  return API.post('/expenses', fd);
};
export const updateExpense = (id, data) => {
  const fd = new FormData();
  Object.entries(data).forEach(([k, v]) => { if (v != null) fd.append(k, v); });
  return API.put(`/expenses/${id}`, fd);
};
export const deleteExpense = (id) => API.delete(`/expenses/${id}`);
export const getReceiptUrl = (id) => API.get(`/expenses/${id}/receipt`);

// Trips
export const getTrips = (params) => API.get('/trips', { params });
export const getTripSummary = (params) => API.get('/trips/summary', { params });
export const addTrip = (data) => API.post('/trips', data);
export const updateTrip = (id, data) => API.put(`/trips/${id}`, data);
export const deleteTrip = (id) => API.delete(`/trips/${id}`);

// Summary
export const getMonthlySummary = (params) => API.get('/summary/monthly', { params });

export const getYears = () => API.get('/years');

// Export
export const exportToExcel = async (year) => {
  const params = year ? { year } : {};
  const res = await API.get('/export', { params, responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = year ? `kellam-analytics-${year}.xlsx` : 'kellam-analytics.xlsx';
  a.click();
  URL.revokeObjectURL(url);
};
