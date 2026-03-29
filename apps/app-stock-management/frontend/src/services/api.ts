import { apiClient } from '@/lib/api-client';

// --- Auth ---
export const authApi = {
  validateEntity: (crpCode: string) =>
    apiClient.get(`/v1/entities/${crpCode}/validate`).then(r => r.data),
  login: (data: { crp_code: string; email: string; password: string }) =>
    apiClient.post('/v1/auth/login', data).then(r => r.data),
  changePassword: (data: { current_password: string; new_password: string }) =>
    apiClient.post('/v1/auth/change-password', data).then(r => r.data),
  refresh: (data: { refresh_token: string }) =>
    apiClient.post('/v1/auth/refresh', data).then(r => r.data),
  me: () => apiClient.get('/v1/entities/me').then(r => r.data),
  profile: () => apiClient.get('/v1/profile').then(r => r.data),
};

// --- Products ---
export const productApi = {
  getAll: () => apiClient.get('/v1/products').then(r => r.data),
  getById: (id: string) => apiClient.get(`/v1/products/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) => apiClient.post('/v1/products', data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch(`/v1/products/${id}`, data).then(r => r.data),
  delete: (id: string) => apiClient.delete(`/v1/products/${id}`).then(r => r.data),
};

// --- SKUs ---
export const skuApi = {
  getAll: (search?: string) => apiClient.get('/v1/skus', { params: { search } }).then(r => r.data),
  getById: (id: string) => apiClient.get(`/v1/skus/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) => apiClient.post('/v1/skus', data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) => apiClient.patch(`/v1/skus/${id}`, data).then(r => r.data),
  changeStatus: (id: string, status: string) => apiClient.patch(`/v1/skus/${id}/status`, { status }).then(r => r.data),
};

// --- Transactions ---
export const transactionApi = {
  getAll: () => apiClient.get('/v1/transactions').then(r => r.data),
  create: (data: Record<string, unknown>) => apiClient.post('/v1/transactions', data).then(r => r.data),
};

// --- Inventories ---
export const inventoryApi = {
  getAll: () => apiClient.get('/v1/inventories').then(r => r.data),
  getBySku: (skuId: string) => apiClient.get(`/v1/inventories/${skuId}`).then(r => r.data),
};

// --- Receiving Schedules ---
export const receivingApi = {
  getAll: () => apiClient.get('/v1/receiving-schedules').then(r => r.data),
  inspection: (id: string, data: Record<string, unknown>) => apiClient.post(`/v1/receiving-schedules/${id}/inspection`, data).then(r => r.data),
};

// --- Sales Orders ---
export const salesOrderApi = {
  getAll: () => apiClient.get('/v1/sales-orders').then(r => r.data),
  getById: (id: string) => apiClient.get(`/v1/sales-orders/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) => apiClient.post('/v1/sales-orders', data).then(r => r.data),
  confirm: (id: string) => apiClient.patch(`/v1/sales-orders/${id}/confirm`).then(r => r.data),
  ship: (id: string) => apiClient.patch(`/v1/sales-orders/${id}/ship`).then(r => r.data),
  cancel: (id: string) => apiClient.patch(`/v1/sales-orders/${id}/cancel`).then(r => r.data),
};

// --- Order Batches ---
export const orderBatchApi = {
  getAll: () => apiClient.get('/v1/order-batches').then(r => r.data),
  adjust: (id: string, adjustedQty: number) => apiClient.patch(`/v1/order-batches/${id}/adjust`, { adjusted_qty: adjustedQty }).then(r => r.data),
  approve: (id: string) => apiClient.patch(`/v1/order-batches/${id}/approve`).then(r => r.data),
  confirm: (id: string) => apiClient.post(`/v1/order-batches/${id}/confirm`).then(r => r.data),
};

// --- Forecasts ---
export const forecastApi = {
  getAll: () => apiClient.get('/v1/forecasts').then(r => r.data),
};

// --- Safety Stocks ---
export const safetyStockApi = {
  getAll: () => apiClient.get('/v1/safety-stocks').then(r => r.data),
};

// --- Settings ---
export const parameterApi = {
  get: () => apiClient.get('/v1/settings/parameters').then(r => r.data),
  update: (data: Record<string, unknown>) => apiClient.patch('/v1/settings/parameters', data).then(r => r.data),
};

export const seasonalityApi = {
  get: () => apiClient.get('/v1/settings/seasonality').then(r => r.data),
  update: (items: { month: number; index: number }[]) => apiClient.patch('/v1/settings/seasonality', { items }).then(r => r.data),
};

export const channelApi = {
  getAll: () => apiClient.get('/v1/channels').then(r => r.data),
  create: (data: Record<string, unknown>) => apiClient.post('/v1/channels', data).then(r => r.data),
};

// --- Dashboard ---
export const dashboardApi = {
  summary: () => apiClient.get('/v1/dashboard/summary').then(r => r.data),
  stockRisk: () => apiClient.get('/v1/dashboard/stock-risk').then(r => r.data),
  trend: () => apiClient.get('/v1/dashboard/trend').then(r => r.data),
};
