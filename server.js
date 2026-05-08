const express = require('express');
const app = express();

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';

console.log('=== Server Starting ===');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('PORT:', PORT);
console.log('HOST:', HOST);
console.log('Node version:', process.version);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

let customers = [{ id: 'CN0001', companyName: '测试客户', contact: '李四', country: '中国', countryCode: 'CN' }];

app.get('/health', (req, res) => {
  console.log('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

app.get('/api/customers', (req, res) => {
  res.json(customers);
});

app.listen(PORT, HOST, () => {
  console.log(`=== Server Started ===`);
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log('Ready to accept requests');
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
});