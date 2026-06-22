const express = require('express');
const cors = require('cors');
const dataStore = require('./dataStore');

const app = express();
const PORT = 8924;

app.use(cors());
app.use(express.json());

setInterval(() => {
  const escalated = dataStore.checkAndEscalateTimeoutOrders();
  if (escalated.length > 0) {
    console.log(`[${new Date().toISOString()}] 超时升级工单: ${escalated.length}个`);
  }
}, 10000);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'security-patrol-backend', port: PORT });
});

app.get('/api/devices', (req, res) => {
  const { status, zone } = req.query;
  let devices = dataStore.getAllDevices();
  
  if (status) {
    devices = devices.filter(d => d.status === status);
  }
  if (zone) {
    devices = devices.filter(d => d.zone === zone);
  }
  
  res.json(devices);
});

app.get('/api/devices/:id', (req, res) => {
  const device = dataStore.getDeviceById(req.params.id);
  if (!device) {
    return res.status(404).json({ error: '设备不存在' });
  }
  res.json(device);
});

app.put('/api/devices/:id/status', (req, res) => {
  const { status } = req.body;
  const device = dataStore.updateDeviceStatus(req.params.id, status);
  if (!device) {
    return res.status(404).json({ error: '设备不存在' });
  }
  res.json(device);
});

app.get('/api/workers', (req, res) => {
  res.json(dataStore.getWorkers());
});

app.get('/api/workers/:id', (req, res) => {
  const worker = dataStore.getWorkerById(req.params.id);
  if (!worker) {
    return res.status(404).json({ error: '运维人员不存在' });
  }
  res.json(worker);
});

app.get('/api/work-orders', (req, res) => {
  const { status, assigneeId, deviceZone, escalated } = req.query;
  const filters = {};
  if (status) filters.status = status;
  if (assigneeId) filters.assigneeId = assigneeId;
  if (deviceZone) filters.deviceZone = deviceZone;
  if (escalated !== undefined) filters.escalated = escalated === 'true';
  
  const orders = dataStore.getWorkOrders(filters);
  res.json(orders);
});

app.get('/api/work-orders/:id', (req, res) => {
  const order = dataStore.getWorkOrderById(req.params.id);
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }
  res.json(order);
});

app.post('/api/work-orders', (req, res) => {
  const { deviceId, alarmType, description } = req.body;
  
  if (!deviceId || !alarmType) {
    return res.status(400).json({ error: 'deviceId 和 alarmType 必填' });
  }
  
  const order = dataStore.createWorkOrder(deviceId, alarmType, description || '');
  if (!order) {
    return res.status(404).json({ error: '设备不存在' });
  }
  
  res.status(201).json(order);
});

app.put('/api/work-orders/:id/status', (req, res) => {
  const { status, remark } = req.body;
  
  if (!status || !['pending', 'processing', 'closed'].includes(status)) {
    return res.status(400).json({ error: '无效的工单状态' });
  }
  
  const order = dataStore.updateWorkOrderStatus(req.params.id, status, remark);
  if (!order) {
    return res.status(404).json({ error: '工单不存在' });
  }
  
  res.json(order);
});

app.put('/api/work-orders/:id/assign', (req, res) => {
  const { workerId } = req.body;
  
  if (!workerId) {
    return res.status(400).json({ error: 'workerId 必填' });
  }
  
  const order = dataStore.assignWorkOrder(req.params.id, workerId);
  if (!order) {
    return res.status(404).json({ error: '工单或运维人员不存在' });
  }
  
  res.json(order);
});

app.post('/api/work-orders/:id/escalate', (req, res) => {
  const { reason } = req.body || {};
  const order = dataStore.escalateWorkOrder(req.params.id, reason);
  if (!order) {
    return res.status(400).json({ error: '无法升级工单，可能已达最高级别或工单不存在' });
  }
  res.json(order);
});

app.get('/api/patrol-records', (req, res) => {
  const { deviceId, type, startTime, endTime, limit } = req.query;
  const filters = {};
  if (deviceId) filters.deviceId = deviceId;
  if (type) filters.type = type;
  if (startTime) filters.startTime = startTime;
  if (endTime) filters.endTime = endTime;
  
  let records = dataStore.getPatrolRecords(filters);
  if (limit) {
    records = records.slice(0, parseInt(limit));
  }
  
  res.json(records);
});

app.post('/api/simulate/offline', (req, res) => {
  const { deviceIds } = req.body;
  
  if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({ error: 'deviceIds 必须是非空数组' });
  }
  
  const results = dataStore.batchSimulateOffline(deviceIds);
  
  const successCount = results.filter(r => r.success).length;
  
  res.json({
    total: deviceIds.length,
    success: successCount,
    failed: deviceIds.length - successCount,
    results
  });
});

app.post('/api/simulate/occlusion', (req, res) => {
  const { deviceIds } = req.body;
  
  if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({ error: 'deviceIds 必须是非空数组' });
  }
  
  const results = dataStore.batchSimulateOcclusion(deviceIds);
  
  const successCount = results.filter(r => r.success).length;
  
  res.json({
    total: deviceIds.length,
    success: successCount,
    failed: deviceIds.length - successCount,
    results
  });
});

app.post('/api/simulate/restore', (req, res) => {
  const { deviceIds } = req.body;
  
  if (!deviceIds || !Array.isArray(deviceIds)) {
    return res.status(400).json({ error: 'deviceIds 必须是数组' });
  }
  
  const results = deviceIds.map(id => {
    const device = dataStore.restoreDevice(id);
    return { deviceId: id, success: !!device };
  });
  
  res.json({
    total: deviceIds.length,
    success: results.filter(r => r.success).length,
    results
  });
});

app.post('/api/simulate/verify-assignment', (req, res) => {
  const { deviceIds } = req.body;
  
  if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({ error: 'deviceIds 必须是非空数组' });
  }
  
  const results = dataStore.batchSimulateOffline(deviceIds);
  const successful = results.filter(r => r.success);
  
  const verification = successful.map(r => {
    const order = dataStore.getWorkOrderById(r.orderId);
    const device = dataStore.getDeviceById(r.deviceId);
    const workers = dataStore.getWorkersByZone(device.zone);
    const workerIds = workers.map(w => w.id);
    const isCorrectZone = workerIds.includes(order.assigneeId);
    
    return {
      orderId: r.orderId,
      deviceId: r.deviceId,
      deviceZone: device.zone,
      assigneeId: order.assigneeId,
      assigneeName: order.assigneeName,
      isCorrectZone,
      availableWorkers: workers.map(w => ({ id: w.id, name: w.name, zones: w.zones }))
    };
  });
  
  const allCorrect = verification.every(v => v.isCorrectZone);
  
  res.json({
    total: successful.length,
    allCorrect,
    correctCount: verification.filter(v => v.isCorrectZone).length,
    verification
  });
});

app.post('/api/simulate/verify-escalation', (req, res) => {
  const { deviceIds, timeoutMinutes } = req.body;
  
  if (!deviceIds || !Array.isArray(deviceIds) || deviceIds.length === 0) {
    return res.status(400).json({ error: 'deviceIds 必须是非空数组' });
  }
  
  const originalConfig = dataStore.getConfig();
  const testTimeout = timeoutMinutes || 1;
  
  dataStore.updateConfig({ workOrderTimeoutMinutes: testTimeout });
  
  const results = dataStore.batchSimulateOffline(deviceIds);
  const successful = results.filter(r => r.success);
  
  const orderIds = successful.map(r => r.orderId);
  
  const deadline = new Date(Date.now() + testTimeout * 60 * 1000).toISOString();
  
  res.json({
    message: `已设置超时时间为 ${testTimeout} 分钟，${successful.length} 个工单将在超时时自动升级`,
    testTimeoutMinutes: testTimeout,
    orderCount: successful.length,
    orderIds,
    deadline,
    note: '升级检查每10秒执行一次，请等待超时后查看工单状态'
  });
});

app.get('/api/statistics', (req, res) => {
  res.json(dataStore.getStatistics());
});

app.get('/api/supervisors', (req, res) => {
  res.json(dataStore.getSupervisors());
});

app.get('/api/escalations', (req, res) => {
  res.json(dataStore.getEscalations());
});

app.get('/api/config', (req, res) => {
  res.json(dataStore.getConfig());
});

app.put('/api/config', (req, res) => {
  const config = dataStore.updateConfig(req.body);
  res.json(config);
});

app.listen(PORT, () => {
  console.log(`园区安防设备巡检管理系统 - 后端服务`);
  console.log(`服务端口: ${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/api/health`);
  console.log(`启动时间: ${new Date().toISOString()}`);
});
