let currentPage = 'dashboard';
let allDevices = [];
let allZones = [];
let selectedDevices = new Set();
let dashboardRefreshTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  updateCurrentTime();
  setInterval(updateCurrentTime, 1000);
  loadZones();
  loadDashboard();
  setupAutoRefresh();
});

function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  currentPage = page;
  
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });
  
  document.querySelectorAll('.page').forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });
  
  const titles = {
    dashboard: '监控概览',
    workorders: '工单管理',
    devices: '设备管理',
    patrol: '巡检记录',
    simulate: '模拟测试'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  
  if (page === 'workorders') {
    loadWorkOrders();
  } else if (page === 'devices') {
    loadDevices();
  } else if (page === 'patrol') {
    loadPatrolRecords();
  } else if (page === 'simulate') {
    loadSimulatePage();
  }
}

function updateCurrentTime() {
  const now = new Date();
  const timeStr = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  document.getElementById('current-time').textContent = timeStr;
}

function setupAutoRefresh() {
  if (dashboardRefreshTimer) {
    clearInterval(dashboardRefreshTimer);
  }
  dashboardRefreshTimer = setInterval(() => {
    if (currentPage === 'dashboard') {
      loadDashboard();
    }
  }, 10000);
}

async function loadZones() {
  try {
    const devices = await API.getDevices();
    allZones = [...new Set(devices.map(d => d.zone))];
    
    const zoneSelects = ['filter-zone', 'device-zone-filter'];
    zoneSelects.forEach(id => {
      const select = document.getElementById(id);
      if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">全部区域</option>';
        allZones.forEach(zone => {
          const option = document.createElement('option');
          option.value = zone;
          option.textContent = zone;
          select.appendChild(option);
        });
        select.value = currentValue;
      }
    });
  } catch (error) {
    console.error('加载区域失败:', error);
  }
}

async function loadDashboard() {
  try {
    const stats = await API.getStatistics();
    
    document.getElementById('stat-total-devices').textContent = stats.devices.total;
    document.getElementById('stat-online-devices').textContent = stats.devices.online;
    document.getElementById('stat-offline-devices').textContent = stats.devices.offline + stats.devices.occluded;
    document.getElementById('stat-pending-orders').textContent = stats.workOrders.pending;
    
    document.getElementById('pending-badge').textContent = stats.workOrders.pending;
    document.getElementById('pending-badge').style.display = stats.workOrders.pending > 0 ? 'inline-block' : 'none';
    
    renderZoneStats(stats.zoneStats);
    
    const recentOrders = await API.getWorkOrders({ limit: 10 });
    renderRecentOrders(recentOrders.slice(0, 8));
    
    const escalatedOrders = await API.getWorkOrders({ escalated: 'true' });
    renderEscalatedOrders(escalatedOrders);
  } catch (error) {
    console.error('加载仪表盘失败:', error);
  }
}

function renderZoneStats(zoneStats) {
  const container = document.getElementById('zone-stats');
  container.innerHTML = zoneStats.map(zone => {
    const onlinePercent = zone.total > 0 ? (zone.online / zone.total * 100).toFixed(1) : 0;
    const offlinePercent = zone.total > 0 ? (zone.offline / zone.total * 100).toFixed(1) : 0;
    return `
      <div class="zone-item">
        <div class="zone-name">${zone.zone}</div>
        <div class="zone-progress">
          <div class="zone-bar">
            <div class="zone-bar-online" style="width: ${onlinePercent}%"></div>
            <div class="zone-bar-offline" style="width: ${offlinePercent}%"></div>
          </div>
          <div class="zone-counts">${zone.online}/${zone.total}</div>
        </div>
      </div>
    `;
  }).join('');
}

function renderRecentOrders(orders) {
  const container = document.getElementById('recent-orders');
  
  if (orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📋</div>
        <div>暂无告警工单</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = orders.map(order => `
    <div class="order-item" onclick="showOrderDetail('${order.id}')">
      <div class="order-item-id">${order.id}</div>
      <div class="order-item-info">
        <div class="order-item-device">${order.deviceName}</div>
        <div class="order-item-zone">${order.deviceZone} · ${getAlarmTypeText(order.alarmType)}</div>
      </div>
      <div class="order-item-status">
        <span class="status-tag ${order.status}">${getStatusText(order.status)}</span>
        ${order.escalated ? `<br><span class="escalation-badge" style="margin-top: 4px; display: inline-block;">${order.escalationLevel}级升级</span>` : ''}
      </div>
    </div>
  `).join('');
}

function renderEscalatedOrders(orders) {
  const container = document.getElementById('escalated-orders');
  
  if (orders.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div>暂无升级工单</div>
      </div>
    `;
    return;
  }
  
  container.innerHTML = orders.map(order => `
    <div class="order-item" onclick="showOrderDetail('${order.id}')">
      <div class="order-item-id">${order.id}</div>
      <div class="order-item-info">
        <div class="order-item-device">${order.deviceName}</div>
        <div class="order-item-zone">${order.deviceZone} · ${order.assigneeName}</div>
      </div>
      <div class="order-item-status">
        <span class="escalation-badge">${order.escalationLevel}级升级</span>
      </div>
    </div>
  `).join('');
}

async function loadWorkOrders() {
  try {
    const status = document.getElementById('filter-status').value;
    const zone = document.getElementById('filter-zone').value;
    const escalated = document.getElementById('filter-escalated').value;
    
    const filters = {};
    if (status) filters.status = status;
    if (zone) filters.deviceZone = zone;
    if (escalated !== '') filters.escalated = escalated;
    
    const orders = await API.getWorkOrders(filters);
    
    document.getElementById('workorder-count').textContent = `共 ${orders.length} 条`;
    
    const tbody = document.getElementById('workorder-table-body');
    tbody.innerHTML = orders.map(order => `
      <tr>
        <td><strong>${order.id}</strong></td>
        <td>
          <div>${order.deviceName}</div>
          <div style="font-size: 11px; color: #a0aec0;">${order.deviceId}</div>
        </td>
        <td>${getAlarmTypeText(order.alarmType)}</td>
        <td>${order.deviceZone}</td>
        <td>${order.assigneeName || '未分配'}</td>
        <td>
          <span class="status-tag ${order.status}">${getStatusText(order.status)}</span>
          ${order.escalated ? `<br><span class="escalation-badge" style="margin-top: 4px; display: inline-block;">${order.escalationLevel}级升级</span>` : ''}
        </td>
        <td><span class="priority-tag ${order.priority}">${getPriorityText(order.priority)}</span></td>
        <td>${formatTime(order.createdAt)}</td>
        <td>
          <button class="btn btn-primary" style="padding: 4px 10px; font-size: 12px;" onclick="showOrderDetail('${order.id}')">详情</button>
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('加载工单失败:', error);
  }
}

function refreshWorkOrders() {
  loadWorkOrders();
}

async function loadDevices() {
  try {
    const status = document.getElementById('device-status-filter').value;
    const zone = document.getElementById('device-zone-filter').value;
    
    const devices = await API.getDevices(status, zone);
    allDevices = devices;
    
    document.getElementById('device-count').textContent = `共 ${devices.length} 台设备`;
    
    const grid = document.getElementById('device-grid');
    grid.innerHTML = devices.map(device => `
      <div class="device-card ${device.status}" onclick="showDeviceInfo('${device.id}')">
        <div class="device-card-header">
          <span class="device-id">${device.id}</span>
          <span class="device-status-icon">${getDeviceStatusIcon(device.status)}</span>
        </div>
        <div class="device-name">${device.name}</div>
        <div class="device-zone">${device.zone}</div>
      </div>
    `).join('');
  } catch (error) {
    console.error('加载设备失败:', error);
  }
}

function refreshDevices() {
  loadDevices();
}

async function loadPatrolRecords() {
  try {
    const type = document.getElementById('patrol-type-filter').value;
    const deviceId = document.getElementById('patrol-device-filter').value;
    
    const filters = {};
    if (type) filters.type = type;
    if (deviceId) filters.deviceId = deviceId;
    filters.limit = 100;
    
    const records = await API.getPatrolRecords(filters);
    
    document.getElementById('patrol-count').textContent = `共 ${records.length} 条记录`;
    
    const tbody = document.getElementById('patrol-table-body');
    tbody.innerHTML = records.map(record => `
      <tr>
        <td>${formatTime(record.createdAt)}</td>
        <td><code>${record.deviceId}</code></td>
        <td><span class="priority-tag ${getRecordTypeClass(record.type)}">${getRecordTypeText(record.type)}</span></td>
        <td>${record.content}</td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('加载巡检记录失败:', error);
  }
}

async function loadSimulatePage() {
  try {
    const devices = await API.getDevices();
    allDevices = devices;
    
    const container = document.getElementById('simulate-device-list');
    container.innerHTML = devices.map(device => `
      <label class="device-checkbox-item">
        <input type="checkbox" value="${device.id}" onchange="toggleDeviceSelection('${device.id}', this.checked)">
        <span>${device.id}</span>
      </label>
    `).join('');
    
    const escalationSelect = document.getElementById('escalation-device');
    escalationSelect.innerHTML = devices.slice(0, 10).map(d => 
      `<option value="${d.id}">${d.id} - ${d.name}</option>`
    ).join('');
    
    selectedDevices.clear();
  } catch (error) {
    console.error('加载模拟测试页失败:', error);
  }
}

function toggleDeviceSelection(deviceId, checked) {
  if (checked) {
    selectedDevices.add(deviceId);
  } else {
    selectedDevices.delete(deviceId);
  }
}

function selectAllDevices() {
  const checkboxes = document.querySelectorAll('#simulate-device-list input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = true;
    selectedDevices.add(cb.value);
  });
}

function clearDeviceSelection() {
  const checkboxes = document.querySelectorAll('#simulate-device-list input[type="checkbox"]');
  checkboxes.forEach(cb => {
    cb.checked = false;
  });
  selectedDevices.clear();
}

async function simulateOffline() {
  if (selectedDevices.size === 0) {
    alert('请先选择要模拟的设备');
    return;
  }
  
  try {
    const result = await API.simulateOffline([...selectedDevices]);
    displaySimulateResult(result);
    
    if (currentPage === 'dashboard') {
      loadDashboard();
    }
  } catch (error) {
    alert('模拟失败: ' + error.message);
  }
}

async function simulateOcclusion() {
  if (selectedDevices.size === 0) {
    alert('请先选择要模拟的设备');
    return;
  }
  
  try {
    const result = await API.simulateOcclusion([...selectedDevices]);
    displaySimulateResult(result, '画面遮挡模拟结果');
    
    if (currentPage === 'dashboard') {
      loadDashboard();
    }
  } catch (error) {
    alert('模拟失败: ' + error.message);
  }
}

async function simulateRestore() {
  if (selectedDevices.size === 0) {
    alert('请先选择要恢复的设备');
    return;
  }
  
  try {
    const result = await API.simulateRestore([...selectedDevices]);
    displaySimulateResult(result, '恢复结果');
    
    if (currentPage === 'dashboard') {
      loadDashboard();
    }
  } catch (error) {
    alert('恢复失败: ' + error.message);
  }
}

function displaySimulateResult(result, title = '模拟结果') {
  const container = document.getElementById('simulate-result');
  const content = document.getElementById('simulate-result-content');
  
  container.style.display = 'block';
  content.innerHTML = `
    <p><strong>${title}：</strong> 共 ${result.total} 个，成功 ${result.success} 个，失败 ${result.failed} 个</p>
    <pre>${JSON.stringify(result.results, null, 2)}</pre>
  `;
}

async function verifyAssignment() {
  if (selectedDevices.size === 0) {
    alert('请先选择要校验的设备');
    return;
  }
  
  try {
    const result = await API.verifyAssignment([...selectedDevices]);
    displayVerificationResult(result);
  } catch (error) {
    alert('校验失败: ' + error.message);
  }
}

function displayVerificationResult(result) {
  const container = document.getElementById('verification-result');
  container.style.display = 'block';
  
  const successClass = result.allCorrect ? 'success' : 'failed';
  const successText = result.allCorrect ? '✅ 全部正确' : '❌ 存在错误';
  
  container.innerHTML = `
    <div class="verification-summary ${successClass}">
      <strong>${successText}</strong> - 共 ${result.total} 个工单，正确分配 ${result.correctCount} 个
    </div>
    ${result.verification.map(v => `
      <div class="verification-detail">
        <div><strong>工单:</strong> ${v.orderId}</div>
        <div><strong>设备:</strong> ${v.deviceId} (${v.deviceZone})</div>
        <div><strong>分配:</strong> ${v.assigneeName} (${v.assigneeId})</div>
        <div><strong>区域匹配:</strong> ${v.isCorrectZone ? '✅ 正确' : '❌ 错误'}</div>
        <div><strong>可选运维:</strong> ${v.availableWorkers.map(w => w.name).join(', ')}</div>
      </div>
    `).join('')}
  `;
}

async function startEscalationTest() {
  const timeoutMinutes = parseInt(document.getElementById('escalation-timeout').value);
  const deviceId = document.getElementById('escalation-device').value;
  
  if (!deviceId) {
    alert('请选择测试设备');
    return;
  }
  
  try {
    const result = await API.verifyEscalation([deviceId], timeoutMinutes);
    
    const container = document.getElementById('escalation-result');
    const content = document.getElementById('escalation-result-content');
    
    container.style.display = 'block';
    content.innerHTML = `
      <p><strong>${result.message}</strong></p>
      <p><strong>工单编号：</strong>${result.orderIds.join(', ')}</p>
      <p><strong>预计升级时间：</strong>${formatTime(result.deadline)}</p>
      <p><strong>注意：</strong>${result.note}</p>
      <p style="margin-top: 10px; color: #666;">
        💡 提示：可以前往「工单管理」页面查看该工单状态变化，
        超时后会自动升级并显示升级标记。
      </p>
    `;
    
    if (currentPage === 'dashboard') {
      loadDashboard();
    }
  } catch (error) {
    alert('启动测试失败: ' + error.message);
  }
}

async function showOrderDetail(orderId) {
  try {
    const [order, supervisors, escalations] = await Promise.all([
      API.getWorkOrderById(orderId),
      API.getSupervisors(),
      API.getEscalations()
    ]);

    const orderEscalations = escalations.filter(e => e.orderId === orderId);
    const maxLevel = supervisors.length;
    const isMaxLevel = order.escalationLevel >= maxLevel;
    const nextSupervisor = supervisors.find(s => s.level === order.escalationLevel + 1);
    const canShowEscalateBtn = (order.status === 'pending' || order.status === 'processing') && !order.closedAt;

    const modal = document.getElementById('order-detail-modal');
    const body = document.getElementById('order-detail-body');

    body.innerHTML = `
      <div class="detail-row">
        <div class="detail-label">工单编号</div>
        <div class="detail-value"><strong>${order.id}</strong></div>
      </div>
      <div class="detail-row">
        <div class="detail-label">设备信息</div>
        <div class="detail-value">
          ${order.deviceName} (${order.deviceId})
          <br><span style="color: #a0aec0; font-size: 12px;">${order.deviceLocation}</span>
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label">所属区域</div>
        <div class="detail-value">${order.deviceZone}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">告警类型</div>
        <div class="detail-value">${getAlarmTypeText(order.alarmType)}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">问题描述</div>
        <div class="detail-value">${order.description || '-'}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">优先级</div>
        <div class="detail-value"><span class="priority-tag ${order.priority}">${getPriorityText(order.priority)}</span></div>
      </div>
      <div class="detail-row">
        <div class="detail-label">当前状态</div>
        <div class="detail-value">
          <span class="status-tag ${order.status}">${getStatusText(order.status)}</span>
          ${order.escalated ? `<span class="escalation-badge" style="margin-left: 8px;">${order.escalationLevel}级升级</span>` : ''}
        </div>
      </div>
      <div class="detail-row">
        <div class="detail-label">负责人员</div>
        <div class="detail-value">${order.assigneeName || '未分配'}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">升级级别</div>
        <div class="detail-value">
          ${order.escalationLevel > 0 
            ? `<strong style="color: #e53e3e;">${order.escalationLevel}级</strong> / ${maxLevel}级（最高）`
            : `<span style="color: #a0aec0;">0级（未升级）</span> / ${maxLevel}级（最高）`
          }
        </div>
      </div>
      ${order.escalationLevel > 0 ? `
      <div class="detail-row">
        <div class="detail-label">当前接收主管</div>
        <div class="detail-value">
          ${(supervisors.find(s => s.level === order.escalationLevel)?.name) || '-'}
        </div>
      </div>` : ''}
      ${nextSupervisor && canShowEscalateBtn && !isMaxLevel ? `
      <div class="detail-row">
        <div class="detail-label">升级后将通知</div>
        <div class="detail-value" style="color: #d69e2e; font-weight: 500;">
          ${nextSupervisor.name}（${order.escalationLevel + 1}级主管）
        </div>
      </div>` : ''}
      <div class="detail-row">
        <div class="detail-label">创建时间</div>
        <div class="detail-value">${formatTime(order.createdAt)}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">截止时间</div>
        <div class="detail-value">${formatTime(order.deadline)}</div>
      </div>
      ${order.startedAt ? `
      <div class="detail-row">
        <div class="detail-label">开始处理</div>
        <div class="detail-value">${formatTime(order.startedAt)}</div>
      </div>` : ''}
      ${order.closedAt ? `
      <div class="detail-row">
        <div class="detail-label">闭环时间</div>
        <div class="detail-value">${formatTime(order.closedAt)}</div>
      </div>` : ''}
      ${order.remark ? `
      <div class="detail-row">
        <div class="detail-label">备注</div>
        <div class="detail-value">${order.remark}</div>
      </div>` : ''}

      ${orderEscalations.length > 0 ? `
      <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
        <div style="font-weight: 600; margin-bottom: 12px; color: #2d3748;">📢 升级记录</div>
        ${orderEscalations.map(esc => `
          <div style="padding: 10px 12px; background: #fffaf0; border: 1px solid #fbd38d; border-radius: 8px; margin-bottom: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-weight: 600; color: #c05621;">${esc.level}级升级</span>
              <span style="font-size: 12px; color: #a0aec0;">${formatTime(esc.escalatedAt)}</span>
            </div>
            <div style="font-size: 13px; color: #718096;">
              通知主管：${esc.supervisorName}
              ${esc.reason ? `<br>原因：${esc.reason}` : ''}
            </div>
          </div>
        `).join('')}
      </div>` : ''}

      <div class="detail-actions">
        ${order.status === 'pending' ? `
          <button class="btn btn-primary" onclick="processOrder('${order.id}')">开始处理</button>
        ` : ''}
        ${order.status === 'processing' ? `
          <button class="btn btn-success" onclick="closeOrder('${order.id}')">完成闭环</button>
        ` : ''}
        ${canShowEscalateBtn ? `
          ${isMaxLevel ? `
            <button class="btn" style="background: #cbd5e0; color: #718096; cursor: not-allowed;" disabled title="已达到最高升级级别">
              ⚠️ 已达最高级别
            </button>
          ` : `
            <button class="btn btn-escalate" onclick="escalateOrder('${order.id}', ${maxLevel})">
              ⬆️ 手动升级
            </button>
          `}
        ` : ''}
        <button class="btn btn-secondary" onclick="closeOrderDetail()">关闭</button>
      </div>
    `;

    modal.classList.add('show');
  } catch (error) {
    alert('获取工单详情失败: ' + error.message);
  }
}

async function escalateOrder(orderId, maxLevel) {
  try {
    const order = await API.getWorkOrderById(orderId);
    const nextLevel = order.escalationLevel + 1;

    if (order.escalationLevel >= maxLevel) {
      alert('该工单已达到最高升级级别，无法继续升级');
      return;
    }

    const supervisors = await API.getSupervisors();
    const nextSupervisor = supervisors.find(s => s.level === nextLevel);
    const nextSupervisorName = nextSupervisor ? nextSupervisor.name : '下一级主管';

    const reason = prompt(
      `【确认手动升级】\n\n` +
      `当前级别：${order.escalationLevel}级\n` +
      `升级后级别：${nextLevel}级\n` +
      `将通知：${nextSupervisorName}\n\n` +
      `请输入升级原因（可选）：`,
      '工单需要上级主管协助处理'
    );

    if (reason === null) return;

    const confirmMsg = `确认将工单升级到 ${nextLevel} 级？\n\n升级后将立即通知 ${nextSupervisorName}，此操作不可撤销。`;
    if (!confirm(confirmMsg)) return;

    const updatedOrder = await API.escalateWorkOrder(orderId, reason || '运维人员手动升级');

    alert(`✅ 工单升级成功！\n\n当前级别：${updatedOrder.escalationLevel}级\n已通知：${nextSupervisorName}`);

    closeOrderDetail();
    showOrderDetail(orderId);

    if (currentPage === 'dashboard') loadDashboard();
    if (currentPage === 'workorders') loadWorkOrders();
  } catch (error) {
    alert('升级失败: ' + error.message);
    showOrderDetail(orderId);
  }
}

function closeOrderDetail() {
  document.getElementById('order-detail-modal').classList.remove('show');
}

async function processOrder(orderId) {
  try {
    await API.updateWorkOrderStatus(orderId, 'processing', '运维人员已接单，开始处理');
    alert('工单已开始处理');
    closeOrderDetail();
    showOrderDetail(orderId);
    
    if (currentPage === 'dashboard') loadDashboard();
    if (currentPage === 'workorders') loadWorkOrders();
  } catch (error) {
    alert('操作失败: ' + error.message);
  }
}

async function closeOrder(orderId) {
  const remark = prompt('请输入处理结果：', '故障已排除，设备恢复正常');
  if (remark === null) return;
  
  try {
    await API.updateWorkOrderStatus(orderId, 'closed', remark);
    alert('工单已闭环');
    closeOrderDetail();
    
    if (currentPage === 'dashboard') loadDashboard();
    if (currentPage === 'workorders') loadWorkOrders();
  } catch (error) {
    alert('操作失败: ' + error.message);
  }
}

function showDeviceInfo(deviceId) {
  const device = allDevices.find(d => d.id === deviceId);
  if (device) {
    alert(`设备信息:\n\n编号: ${device.id}\n名称: ${device.name}\n区域: ${device.zone}\n位置: ${device.location}\n状态: ${getDeviceStatusText(device.status)}\n最近检查: ${formatTime(device.lastCheckTime)}`);
  }
}

function getStatusText(status) {
  const map = {
    pending: '待处理',
    processing: '维修中',
    closed: '已闭环'
  };
  return map[status] || status;
}

function getAlarmTypeText(type) {
  const map = {
    offline: '设备离线',
    occlusion: '画面遮挡',
    fault: '设备故障'
  };
  return map[type] || type;
}

function getPriorityText(priority) {
  const map = {
    high: '高',
    medium: '中',
    low: '低'
  };
  return map[priority] || priority;
}

function getDeviceStatusIcon(status) {
  const map = {
    online: '🟢',
    offline: '🔴',
    occluded: '🟡'
  };
  return map[status] || '⚪';
}

function getDeviceStatusText(status) {
  const map = {
    online: '在线',
    offline: '离线',
    occluded: '画面遮挡'
  };
  return map[status] || status;
}

function getRecordTypeText(type) {
  const map = {
    alarm: '告警',
    workorder: '工单',
    restore: '恢复',
    patrol: '巡检'
  };
  return map[type] || type;
}

function getRecordTypeClass(type) {
  const map = {
    alarm: 'high',
    workorder: 'medium',
    restore: 'low',
    patrol: 'low'
  };
  return map[type] || 'medium';
}

function formatTime(isoString) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

document.getElementById('order-detail-modal').addEventListener('click', (e) => {
  if (e.target.id === 'order-detail-modal') {
    closeOrderDetail();
  }
});
