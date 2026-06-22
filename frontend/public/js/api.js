const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    };

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: '请求失败' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`API 请求失败 [${endpoint}]:`, error);
      throw error;
    }
  },

  async getHealth() {
    return this.request('/health');
  },

  async getDevices(status, zone) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (zone) params.append('zone', zone);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/devices${query}`);
  },

  async getDeviceById(id) {
    return this.request(`/devices/${id}`);
  },

  async updateDeviceStatus(id, status) {
    return this.request(`/devices/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  async getWorkers() {
    return this.request('/workers');
  },

  async getWorkOrders(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/work-orders${query}`);
  },

  async getWorkOrderById(id) {
    return this.request(`/work-orders/${id}`);
  },

  async createWorkOrder(deviceId, alarmType, description) {
    return this.request('/work-orders', {
      method: 'POST',
      body: JSON.stringify({ deviceId, alarmType, description })
    });
  },

  async updateWorkOrderStatus(id, status, remark) {
    return this.request(`/work-orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, remark })
    });
  },

  async assignWorkOrder(orderId, workerId) {
    return this.request(`/work-orders/${orderId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ workerId })
    });
  },

  async escalateWorkOrder(orderId, reason) {
    const body = {};
    if (reason) body.reason = reason;
    return this.request(`/work-orders/${orderId}/escalate`, {
      method: 'POST',
      body: Object.keys(body).length > 0 ? JSON.stringify(body) : undefined
    });
  },

  async getPatrolRecords(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, value);
      }
    });
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/patrol-records${query}`);
  },

  async simulateOffline(deviceIds) {
    return this.request('/simulate/offline', {
      method: 'POST',
      body: JSON.stringify({ deviceIds })
    });
  },

  async simulateOcclusion(deviceIds) {
    return this.request('/simulate/occlusion', {
      method: 'POST',
      body: JSON.stringify({ deviceIds })
    });
  },

  async simulateRestore(deviceIds) {
    return this.request('/simulate/restore', {
      method: 'POST',
      body: JSON.stringify({ deviceIds })
    });
  },

  async verifyAssignment(deviceIds) {
    return this.request('/simulate/verify-assignment', {
      method: 'POST',
      body: JSON.stringify({ deviceIds })
    });
  },

  async verifyEscalation(deviceIds, timeoutMinutes) {
    return this.request('/simulate/verify-escalation', {
      method: 'POST',
      body: JSON.stringify({ deviceIds, timeoutMinutes })
    });
  },

  async getStatistics() {
    return this.request('/statistics');
  },

  async getSupervisors() {
    return this.request('/supervisors');
  },

  async getEscalations() {
    return this.request('/escalations');
  },

  async getConfig() {
    return this.request('/config');
  },

  async updateConfig(config) {
    return this.request('/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });
  }
};
