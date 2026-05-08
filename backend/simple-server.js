const express = require('express');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// 内存数据存储
let customers = [];
let suppliers = [];
let products = [];
let purchaseOrders = [];

// 国家代码映射
const countryCodes = {
  '中国': 'CN', '美国': 'US', '日本': 'JP', '韩国': 'KR', '英国': 'GB', '德国': 'DE', '法国': 'FR', '意大利': 'IT'
};

function getCountryCode(countryName) {
  return countryCodes[countryName] || 'CN';
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 客户接口
app.get('/api/customers', (req, res) => {
  res.json(customers);
});

app.post('/api/customers', (req, res) => {
  try {
    const { companyName, companyShortName, contact, country, website, companySize } = req.body;
    const countryCode = getCountryCode(country);
    const countryCustomers = customers.filter(c => c.countryCode === countryCode);
    const nextNumber = countryCustomers.length + 1;
    const customerId = countryCode + String(nextNumber).padStart(4, '0');
    
    const customer = {
      id: customerId,
      companyName,
      companyShortName: companyShortName || '',
      contact,
      country,
      countryCode,
      website: website || '',
      companySize: companySize || '',
      created_at: new Date().toISOString()
    };
    
    customers.push(customer);
    res.json({ success: true, id: customerId });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// 供应商接口
app.get('/api/suppliers', (req, res) => {
  res.json(suppliers);
});

// 产品接口
app.get('/api/products', (req, res) => {
  res.json(products);
});

// 采购单接口
app.get('/api/purchase-orders', (req, res) => {
  res.json(purchaseOrders);
});

// 初始化数据
function initData() {
  customers = [
    { id: 'CN0001', companyName: '测试客户公司', companyShortName: '测试客户', contact: '李四', country: '中国', countryCode: 'CN', website: '', companySize: '中型', created_at: new Date().toISOString() }
  ];
  suppliers = [
    { id: 'SUP001', name: '测试供应商', companyType: '工厂', mainProducts: '电子产品', contact: '张三', contactInfo: '13800138000', canInvoice: '是', invoiceThreshold: 1000, paymentLink: '', note: '测试供应商', created_at: new Date().toISOString() }
  ];
  products = [
    { id: 'PRO001', englishName: 'Test Product', chineseName: '测试产品', salesPriceLess100: 100, salesPriceMore100: 95, supplierId: 'SUP001', supplierName: '测试供应商', purchasePriceLess100: 80, purchasePriceMore100: 75, purchaseLink: '', purchaseChannel: '', features: '测试产品特性', created_at: new Date().toISOString() }
  ];
}

initData();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log('Server is ready to accept requests');
});