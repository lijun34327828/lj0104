const { v4: uuidv4 } = require('uuid');

const store = {
  devices: [],
  workers: [],
  workOrders: [],
  patrolRecords: [],
  supervisors: [],
  escalations: [],
  
  config: {
    workOrderTimeoutMinutes: 30,
    patrolIntervalMinutes: 5,
  }
};

function initMockData() {
  const zones = ['A区-办公楼', 'B区-生产车间', 'C区-仓储物流', 'D区-园区周界', 'E区-停车场'];
  
  for (let i = 1; i <= 50; i++) {
    const zoneIndex = Math.floor((i - 1) / 10);
    store.devices.push({
      id: `CAM-${String(i).padStart(3, '0')}`,
      name: `摄像头${i}号`,
      type: 'camera',
      zone: zones[zoneIndex],
      status: 'online',
      lastCheckTime: new Date().toISOString(),
      installationDate: '2024-01-15',
      location: `${zones[zoneIndex]} ${i}号点位`
    });
  }
  
  store.workers = [
    { id: 'W001', name: '张工', phone: '138****1001', zones: ['A区-办公楼', 'B区-生产车间'], status: 'onDuty' },
    { id: 'W002', name: '李工', phone: '138****1002', zones: ['C区-仓储物流', 'D区-园区周界'], status: 'onDuty' },
    { id: 'W003', name: '王工', phone: '138****1003', zones: ['E区-停车场', 'A区-办公楼'], status: 'onDuty' },
    { id: 'W004', name: '赵工', phone: '138****1004', zones: ['B区-生产车间', 'C区-仓储物流'], status: 'onDuty' },
    { id: 'W005', name: '刘工', phone: '138****1005', zones: ['D区-园区周界', 'E区-停车场'], status: 'onDuty' },
  ];
  
  store.supervisors = [
    { id: 'S001', name: '陈主管', phone: '139****2001', level: 1 },
    { id: 'S002', name: '周经理', phone: '139****2002', level: 2 },
  ];
}

function getAllDevices() {
  return store.devices;
}

function getDeviceById(id) {
  return store.devices.find(d => d.id === id);
}

function updateDeviceStatus(deviceId, status, extra = {}) {
  const device = getDeviceById(deviceId);
  if (device) {
    device.status = status;
    device.lastCheckTime = new Date().toISOString();
    Object.assign(device, extra);
  }
  return device;
}

function getWorkers() {
  return store.workers;
}

function getWorkerById(id) {
  return store.workers.find(w => w.id === id);
}

function getWorkersByZone(zone) {
  return store.workers.filter(w => w.zones.includes(zone));
}

function createWorkOrder(deviceId, alarmType, description) {
  const device = getDeviceById(deviceId);
  if (!device) return null;
  
  const workers = getWorkersByZone(device.zone);
  let assignee = null;
  
  if (workers.length > 0) {
    const zoneOrders = store.workOrders.filter(
      o => o.status === 'pending' || o.status === 'processing'
    );
    let minOrders = Infinity;
    for (const worker of workers) {
      const workerOrderCount = zoneOrders.filter(o => o.assigneeId === worker.id).length;
      if (workerOrderCount < minOrders) {
        minOrders = workerOrderCount;
        assignee = worker;
      }
    }
  }
  
  const workOrder = {
    id: `WO-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
    deviceId,
    deviceName: device.name,
    deviceZone: device.zone,
    deviceLocation: device.location,
    alarmType,
    description,
    status: 'pending',
    priority: alarmType === 'offline' ? 'high' : 'medium',
    assigneeId: assignee ? assignee.id : null,
    assigneeName: assignee ? assignee.name : '未分配',
    creator: 'system',
    createdAt: new Date().toISOString(),
    startedAt: null,
    closedAt: null,
    deadline: new Date(Date.now() + store.config.workOrderTimeoutMinutes * 60 * 1000).toISOString(),
    escalated: false,
    escalationLevel: 0,
    remark: ''
  };
  
  store.workOrders.unshift(workOrder);
  
  addPatrolRecord(deviceId, 'alarm', `${alarmType}: ${description}`);
  
  return workOrder;
}

function getWorkOrders(filters = {}) {
  let orders = [...store.workOrders];
  
  if (filters.status) {
    orders = orders.filter(o => o.status === filters.status);
  }
  if (filters.assigneeId) {
    orders = orders.filter(o => o.assigneeId === filters.assigneeId);
  }
  if (filters.deviceZone) {
    orders = orders.filter(o => o.deviceZone === filters.deviceZone);
  }
  if (filters.escalated !== undefined) {
    orders = orders.filter(o => o.escalated === filters.escalated);
  }
  
  return orders;
}

function getWorkOrderById(id) {
  return store.workOrders.find(o => o.id === id);
}

function updateWorkOrderStatus(id, status, remark = '') {
  const order = getWorkOrderById(id);
  if (!order) return null;
  
  order.status = status;
  if (remark) order.remark = remark;
  
  if (status === 'processing' && !order.startedAt) {
    order.startedAt = new Date().toISOString();
  }
  if (status === 'closed') {
    order.closedAt = new Date().toISOString();
  }
  
  addPatrolRecord(order.deviceId, 'workorder', `工单${id}状态变更为${status}`);
  
  return order;
}

function assignWorkOrder(orderId, workerId) {
  const order = getWorkOrderById(orderId);
  const worker = getWorkerById(workerId);
  
  if (!order || !worker) return null;
  
  order.assigneeId = worker.id;
  order.assigneeName = worker.name;
  
  return order;
}

function escalateWorkOrder(orderId, reason = '运维人员手动升级') {
  const order = getWorkOrderById(orderId);
  if (!order || order.escalationLevel >= store.supervisors.length) return null;

  order.escalated = true;
  order.escalationLevel += 1;

  const supervisor = store.supervisors.find(s => s.level === order.escalationLevel);

  store.escalations.push({
    id: uuidv4(),
    orderId,
    supervisorId: supervisor ? supervisor.id : null,
    supervisorName: supervisor ? supervisor.name : '未知',
    level: order.escalationLevel,
    escalatedAt: new Date().toISOString(),
    reason
  });

  return order;
}

function checkAndEscalateTimeoutOrders() {
  const now = new Date();
  const pendingOrders = store.workOrders.filter(
    o => (o.status === 'pending' || o.status === 'processing') && !o.closedAt
  );
  
  const escalated = [];
  
  for (const order of pendingOrders) {
    const deadline = new Date(order.deadline);
    const timePassed = now - deadline;
    
    if (timePassed > 0 && order.escalationLevel < store.supervisors.length) {
      const levelsToEscalate = Math.floor(timePassed / (store.config.workOrderTimeoutMinutes * 60 * 1000)) + 1;
      
      while (order.escalationLevel < Math.min(levelsToEscalate, store.supervisors.length)) {
        order.escalated = true;
        order.escalationLevel += 1;
        
        const supervisor = store.supervisors.find(s => s.level === order.escalationLevel);
        
        store.escalations.push({
          id: uuidv4(),
          orderId: order.id,
          supervisorId: supervisor ? supervisor.id : null,
          supervisorName: supervisor ? supervisor.name : '未知',
          level: order.escalationLevel,
          escalatedAt: new Date().toISOString(),
          reason: `工单超时${order.escalationLevel}级升级`
        });
        
        escalated.push(order);
      }
    }
  }
  
  return escalated;
}

function addPatrolRecord(deviceId, type, content) {
  const record = {
    id: uuidv4(),
    deviceId,
    type,
    content,
    createdAt: new Date().toISOString()
  };
  store.patrolRecords.unshift(record);
  return record;
}

function getPatrolRecords(filters = {}) {
  let records = [...store.patrolRecords];
  
  if (filters.deviceId) {
    records = records.filter(r => r.deviceId === filters.deviceId);
  }
  if (filters.type) {
    records = records.filter(r => r.type === filters.type);
  }
  if (filters.startTime) {
    records = records.filter(r => r.createdAt >= filters.startTime);
  }
  if (filters.endTime) {
    records = records.filter(r => r.createdAt <= filters.endTime);
  }
  
  return records;
}

function batchSimulateOffline(deviceIds) {
  const results = [];
  
  for (const deviceId of deviceIds) {
    const device = updateDeviceStatus(deviceId, 'offline', { offlineReason: '模拟离线' });
    if (device) {
      const existingOrder = store.workOrders.find(
        o => o.deviceId === deviceId && o.status !== 'closed' && o.alarmType === 'offline'
      );
      
      if (!existingOrder) {
        const order = createWorkOrder(deviceId, 'offline', '设备离线，需要排查处理');
        results.push({ deviceId, success: true, orderId: order.id, assignee: order.assigneeName });
      } else {
        results.push({ deviceId, success: false, reason: '已存在未关闭的离线工单' });
      }
    } else {
      results.push({ deviceId, success: false, reason: '设备不存在' });
    }
  }
  
  return results;
}

function batchSimulateOcclusion(deviceIds) {
  const results = [];
  
  for (const deviceId of deviceIds) {
    const device = updateDeviceStatus(deviceId, 'occluded', { occlusionReason: '模拟画面遮挡' });
    if (device) {
      const existingOrder = store.workOrders.find(
        o => o.deviceId === deviceId && o.status !== 'closed' && o.alarmType === 'occlusion'
      );
      
      if (!existingOrder) {
        const order = createWorkOrder(deviceId, 'occlusion', '画面被遮挡，需要清理');
        results.push({ deviceId, success: true, orderId: order.id, assignee: order.assigneeName });
      } else {
        results.push({ deviceId, success: false, reason: '已存在未关闭的遮挡工单' });
      }
    } else {
      results.push({ deviceId, success: false, reason: '设备不存在' });
    }
  }
  
  return results;
}

function restoreDevice(deviceId) {
  const device = updateDeviceStatus(deviceId, 'online');
  if (device) {
    addPatrolRecord(deviceId, 'restore', '设备恢复正常');
  }
  return device;
}

function getStatistics() {
  const totalDevices = store.devices.length;
  const onlineDevices = store.devices.filter(d => d.status === 'online').length;
  const offlineDevices = store.devices.filter(d => d.status === 'offline').length;
  const occludedDevices = store.devices.filter(d => d.status === 'occluded').length;
  
  const totalOrders = store.workOrders.length;
  const pendingOrders = store.workOrders.filter(o => o.status === 'pending').length;
  const processingOrders = store.workOrders.filter(o => o.status === 'processing').length;
  const closedOrders = store.workOrders.filter(o => o.status === 'closed').length;
  const escalatedOrders = store.workOrders.filter(o => o.escalated).length;
  
  const zones = [...new Set(store.devices.map(d => d.zone))];
  const zoneStats = zones.map(zone => ({
    zone,
    total: store.devices.filter(d => d.zone === zone).length,
    online: store.devices.filter(d => d.zone === zone && d.status === 'online').length,
    offline: store.devices.filter(d => d.zone === zone && d.status === 'offline').length,
    pending: store.workOrders.filter(o => o.deviceZone === zone && o.status === 'pending').length
  }));
  
  return {
    devices: {
      total: totalDevices,
      online: onlineDevices,
      offline: offlineDevices,
      occluded: occludedDevices
    },
    workOrders: {
      total: totalOrders,
      pending: pendingOrders,
      processing: processingOrders,
      closed: closedOrders,
      escalated: escalatedOrders
    },
    zoneStats
  };
}

function getSupervisors() {
  return store.supervisors;
}

function getEscalations() {
  return store.escalations;
}

function getConfig() {
  return store.config;
}

function updateConfig(newConfig) {
  Object.assign(store.config, newConfig);
  return store.config;
}

initMockData();

module.exports = {
  getAllDevices,
  getDeviceById,
  updateDeviceStatus,
  getWorkers,
  getWorkerById,
  getWorkersByZone,
  createWorkOrder,
  getWorkOrders,
  getWorkOrderById,
  updateWorkOrderStatus,
  assignWorkOrder,
  escalateWorkOrder,
  checkAndEscalateTimeoutOrders,
  addPatrolRecord,
  getPatrolRecords,
  batchSimulateOffline,
  batchSimulateOcclusion,
  restoreDevice,
  getStatistics,
  getSupervisors,
  getEscalations,
  getConfig,
  updateConfig
};
