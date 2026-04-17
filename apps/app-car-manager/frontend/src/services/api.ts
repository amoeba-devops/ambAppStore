import { apiClient } from '@/lib/api-client';

// --- Vehicle ---
export const vehicleApi = {
  getAll: (params?: { type?: string; status?: string }) =>
    apiClient.get('/v1/vehicles', { params }).then((r) => r.data),
  getById: (id: string) =>
    apiClient.get(`/v1/vehicles/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/v1/vehicles', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/v1/vehicles/${id}`, data).then((r) => r.data),
  updateStatus: (id: string, data: { status: string; reason: string }) =>
    apiClient.patch(`/v1/vehicles/${id}/status`, data).then((r) => r.data),
  updateDedicated: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/v1/vehicles/${id}/dedicated`, data).then((r) => r.data),
};

// --- Driver ---
export const driverApi = {
  getAll: (params?: { vehicle_id?: string; status?: string }) =>
    apiClient.get('/v1/drivers', { params }).then((r) => r.data),
  getAvailable: () =>
    apiClient.get('/v1/drivers/available').then((r) => r.data),
  getById: (id: string) =>
    apiClient.get(`/v1/drivers/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/v1/drivers', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/v1/drivers/${id}`, data).then((r) => r.data),
  updateStatus: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/v1/drivers/${id}/status`, data).then((r) => r.data),
  assign: (id: string, data: { vehicle_id: string }) =>
    apiClient.patch(`/v1/drivers/${id}/assign`, data).then((r) => r.data),
  unassign: (id: string) =>
    apiClient.patch(`/v1/drivers/${id}/unassign`).then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete(`/v1/drivers/${id}`).then((r) => r.data),
};

// --- Dispatch ---
export const dispatchApi = {
  getAll: (params?: { status?: string; vehicle_id?: string; driver_id?: string }) =>
    apiClient.get('/v1/dispatches', { params }).then((r) => r.data),
  getById: (id: string) =>
    apiClient.get(`/v1/dispatches/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/v1/dispatches', data).then((r) => r.data),
  approve: (id: string, data: { vehicle_id: string; driver_id?: string }) =>
    apiClient.patch(`/v1/dispatches/${id}/approve`, data).then((r) => r.data),
  reject: (id: string, data: { reason: string }) =>
    apiClient.patch(`/v1/dispatches/${id}/reject`, data).then((r) => r.data),
  driverRespond: (id: string, data: { accepted: boolean; reject_reason?: string }) =>
    apiClient.patch(`/v1/dispatches/${id}/driver-respond`, data).then((r) => r.data),
  depart: (id: string) =>
    apiClient.patch(`/v1/dispatches/${id}/depart`).then((r) => r.data),
  arrive: (id: string) =>
    apiClient.patch(`/v1/dispatches/${id}/arrive`).then((r) => r.data),
  complete: (id: string) =>
    apiClient.patch(`/v1/dispatches/${id}/complete`).then((r) => r.data),
  cancel: (id: string, data: { reason: string }) =>
    apiClient.patch(`/v1/dispatches/${id}/cancel`, data).then((r) => r.data),
};

// --- Trip Log ---
export const tripLogApi = {
  getAll: (params?: { vehicle_id?: string; status?: string }) =>
    apiClient.get('/v1/trip-logs', { params }).then((r) => r.data),
  getById: (id: string) =>
    apiClient.get(`/v1/trip-logs/${id}`).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/v1/trip-logs/${id}`, data).then((r) => r.data),
  submit: (id: string, data: { status: string }) =>
    apiClient.patch(`/v1/trip-logs/${id}/submit`, data).then((r) => r.data),
};

// --- Maintenance ---
export const maintenanceApi = {
  getAll: (params?: { vehicle_id?: string; type?: string }) =>
    apiClient.get('/v1/maintenance', { params }).then((r) => r.data),
  getById: (id: string) =>
    apiClient.get(`/v1/maintenance/${id}`).then((r) => r.data),
  create: (data: Record<string, unknown>) =>
    apiClient.post('/v1/maintenance', data).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    apiClient.patch(`/v1/maintenance/${id}`, data).then((r) => r.data),
  delete: (id: string) =>
    apiClient.delete(`/v1/maintenance/${id}`).then((r) => r.data),
};

// --- AMA ---
export const amaApi = {
  getMembers: (params?: { search?: string }) =>
    apiClient.get('/v1/ama/members', { params }).then((r) => r.data),
  getOAuthStatus: () =>
    apiClient.get('/v1/ama/oauth/status').then((r) => r.data),
  getOAuthUrl: () =>
    apiClient.get('/v1/ama/oauth/authorize').then((r) => r.data),
  exchangeOAuthCode: (code: string, state: string) =>
    apiClient.get('/v1/ama/oauth/callback', { params: { code, state } }).then((r) => r.data),
};

// --- Monitor ---
export const monitorApi = {
  getDashboard: () =>
    apiClient.get('/v1/monitor/dashboard').then((r) => r.data),
  getActiveDispatches: () =>
    apiClient.get('/v1/monitor/active-dispatches').then((r) => r.data),
};
