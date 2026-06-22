const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();
const PORT = 3924;
const BACKEND_URL = 'http://localhost:8924';

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true,
}));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`园区安防设备巡检管理系统 - 前端界面`);
  console.log(`服务端口: ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log(`后端代理: ${BACKEND_URL}`);
  console.log(`启动时间: ${new Date().toISOString()}`);
});
