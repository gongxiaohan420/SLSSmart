const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 4000;
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'data.json');

console.log('=== Server Starting ===');
console.log('Environment:', process.env.NODE_ENV || 'development');
console.log('PORT:', PORT);
console.log('HOST:', HOST);
console.log('Node version:', process.version);
console.log('Data file:', DATA_FILE);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, username, password');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

// 国家代码映射
const countryCodes = {
  '中国': 'CN', '美国': 'US', '日本': 'JP', '韩国': 'KR', '英国': 'GB', 
  '法国': 'FR', '德国': 'DE', '意大利': 'IT', '西班牙': 'ES', '加拿大': 'CA',
  '澳大利亚': 'AU', '新西兰': 'NZ', '新加坡': 'SG', '马来西亚': 'MY', '泰国': 'TH',
  '印度': 'IN', '俄罗斯': 'RU', '巴西': 'BR', '墨西哥': 'MX', '阿根廷': 'AR'
};

// 默认示例数据
const defaultData = {
  users: [
    { id: 1, username: 'admin', password: 'admin123', role: '管理员' },
    { id: 2, username: 'sales', password: 'sales123', role: '业务员' },
    { id: 3, username: 'purchase', password: 'purchase123', role: '采购员' }
  ],
  customers: [
    { id: 'CN0001', companyName: '上海科技有限公司', companyShortName: '上海科技', contact: '张三', country: '中国', countryCode: 'CN', companySize: '中型', website: 'www.shanghai-tech.com', created_at: '2024-01-15T10:00:00Z' },
    { id: 'US0001', companyName: 'Tech Corp USA', companyShortName: 'Tech USA', contact: 'John Smith', country: '美国', countryCode: 'US', companySize: '大型', website: 'www.techcorp.com', created_at: '2024-02-20T14:30:00Z' }
  ],
  suppliers: [
    { id: 'SUP001', name: '深圳电子供应商', companyType: '制造商', mainProducts: '电子元器件', contact: '李四', contactInfo: '13800138000', canInvoice: '是', invoiceThreshold: 1000, paymentLink: 'https://pay.example.com', note: '优质供应商', created_at: '2024-01-10T09:00:00Z', invoiceStatus: '正常', attachments: '' },
    { id: 'SUP002', name: '东莞塑胶厂', companyType: '加工厂', mainProducts: '塑胶配件', contact: '王五', contactInfo: '13900139000', canInvoice: '是', invoiceThreshold: 500, paymentLink: '', note: '', created_at: '2024-01-12T11:00:00Z', invoiceStatus: '正常', attachments: '' }
  ],
  products: [
    { id: 'P001', englishName: 'USB Flash Drive', chineseName: 'U盘', salesPriceLess100: 50, salesPriceMore100: 45, supplierId: 'SUP001', supplierName: '深圳电子供应商', purchasePriceLess100: 30, purchasePriceMore100: 25, purchaseLink: 'https://alibaba.com/item1', purchaseChannel: '阿里巴巴', features: '高速传输', created_at: '2024-01-15T10:00:00Z' },
    { id: 'P002', englishName: 'Bluetooth Speaker', chineseName: '蓝牙音箱', salesPriceLess100: 120, salesPriceMore100: 100, supplierId: 'SUP001', supplierName: '深圳电子供应商', purchasePriceLess100: 60, purchasePriceMore100: 55, purchaseLink: 'https://alibaba.com/item2', purchaseChannel: '阿里巴巴', features: '立体声', created_at: '2024-01-16T14:00:00Z' }
  ],
  piOrders: [
    { id: 'PI202401001', customerId: 'CN0001', customerName: '上海科技有限公司', products: JSON.stringify([{ productId: 'P001', quantity: 50, unitPrice: 50 }]), totalAmount: 2500, status: '已确认', created_at: '2024-01-15T10:00:00Z', customerCountry: '中国', customerContact: '张三' },
    { id: 'PI202402001', customerId: 'US0001', customerName: 'Tech Corp USA', products: JSON.stringify([{ productId: 'P001', quantity: 200, unitPrice: 45 }, { productId: 'P002', quantity: 100, unitPrice: 100 }]), totalAmount: 19000, status: '已确认', created_at: '2024-02-20T14:30:00Z', customerCountry: '美国', customerContact: 'John Smith' }
  ],
  purchaseOrders: [
    { id: 'CG20240115001', supplierId: 'SUP001', supplierName: '深圳电子供应商', products: JSON.stringify([{ productId: 'P001', quantity: 50, purchasePrice: 30 }]), totalAmount: 1500, status: '已完成', piId: 'PI202401001', piCustomerName: '上海科技有限公司', piTotalAmount: 2500, piCreatedAt: '2024-01-15T10:00:00Z', dataSource: '从PI单中生成', created_at: '2024-01-15T11:00:00Z' },
    { id: 'CG20240220001', supplierId: 'SUP001', supplierName: '深圳电子供应商', products: JSON.stringify([{ productId: 'P001', quantity: 200, purchasePrice: 25 }, { productId: 'P002', quantity: 100, purchasePrice: 55 }]), totalAmount: 10500, status: '采购中', piId: 'PI202402001', piCustomerName: 'Tech Corp USA', piTotalAmount: 19000, piCreatedAt: '2024-02-20T14:30:00Z', dataSource: '从PI单中生成', created_at: '2024-02-20T15:00:00Z' },
    { id: 'CG20240301001', supplierId: 'SUP002', supplierName: '东莞塑胶厂', products: JSON.stringify([{ productId: 'P001', quantity: 30, purchasePrice: 32 }]), totalAmount: 960, status: '已生成', piId: '', piCustomerName: '', piTotalAmount: 0, piCreatedAt: '', dataSource: '手动新增', created_at: '2024-03-01T09:00:00Z' }
  ],
  inventory: [
    { productId: 'P001', englishName: 'USB Flash Drive', chineseName: 'U盘', quantity: 500, warehouse: '深圳仓库', created_at: '2024-01-20T10:00:00Z' },
    { productId: 'P002', englishName: 'Bluetooth Speaker', chineseName: '蓝牙音箱', quantity: 200, warehouse: '深圳仓库', created_at: '2024-01-25T14:00:00Z' }
  ],
  reminders: [],
  emailConfigs: [
    { id: 1, email: 'gxhan0420@163.com', authCode: 'RGhwVqeQbTxVXTeE', smtpServer: 'smtp.163.com', smtpPort: 465 },
    { id: 2, email: 'reminder@example.com', authCode: 'your_auth_code_here', smtpServer: 'smtp.example.com', smtpPort: 465 }
  ],
  reminderLogs: []
};

// 加载数据
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(data);
      console.log('Loaded data from file:', Object.keys(parsed));
      return parsed;
    } else {
      console.log('Data file not found, using default data');
      saveData(defaultData);
      return defaultData;
    }
  } catch (err) {
    console.error('Error loading data:', err.message);
    return defaultData;
  }
}

// 保存数据
function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('Data saved successfully');
  } catch (err) {
    console.error('Error saving data:', err.message);
  }
}

// 初始化数据
const db = loadData();

let users = db.users;
let customers = db.customers;
let suppliers = db.suppliers;
let products = db.products;
let piOrders = db.piOrders;
let purchaseOrders = db.purchaseOrders;
let inventory = db.inventory;
let reminders = db.reminders;
let emailConfigs = db.emailConfigs || [];
let reminderLogs = db.reminderLogs || [];

// 自动保存数据
function autoSave() {
  saveData({ users, customers, suppliers, products, piOrders, purchaseOrders, inventory, reminders, emailConfigs, reminderLogs });
}

// 登录接口
app.post('/api/login', function(req, res) {
  const { username, password } = req.body;
  const user = users.find(function(u) {
    return u.username === username && u.password === password;
  });
  
  if (user) {
    res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
  } else {
    res.status(401).json({ success: false, error: '用户名或密码错误' });
  }
});

// 健康检查
app.get('/health', function(req, res) {
  console.log('Health check requested');
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// 根路径 - 返回首页
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 获取国家列表
app.get('/api/countries', function(req, res) {
  const countries = Object.keys(countryCodes).map(function(name) {
    return { name: name, code: countryCodes[name] };
  });
  res.json(countries);
});

// 客户相关接口
app.get('/api/customers', function(req, res) {
  res.json(customers);
});

app.get('/api/customers/:id', function(req, res) {
  const customer = customers.find(function(c) { return c.id === req.params.id; });
  if (customer) {
    res.json(customer);
  } else {
    res.status(404).json({ error: '客户不存在' });
  }
});

app.post('/api/customers', function(req, res) {
  try {
    const companyName = req.body.companyName || '';
    const companyShortName = req.body.companyShortName || '';
    const contact = req.body.contact || '';
    const country = req.body.country || '中国';
    const countryCode = countryCodes[country] || 'CN';
    const companySize = req.body.companySize || '';
    const website = req.body.website || '';
    
    const countryCustomers = customers.filter(function(c) { return c.countryCode === countryCode; });
    const nextNumber = countryCustomers.length + 1;
    const customerId = countryCode + String(nextNumber).padStart(4, '0');
    
    const customer = {
      id: customerId,
      companyName: companyName,
      companyShortName: companyShortName,
      contact: contact,
      country: country,
      countryCode: countryCode,
      companySize: companySize,
      website: website,
      created_at: new Date().toISOString()
    };
    
    customers.push(customer);
    autoSave();
    res.json({ success: true, id: customerId });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

app.put('/api/customers/:id', function(req, res) {
  const index = customers.findIndex(function(c) { return c.id === req.params.id; });
  if (index !== -1) {
    customers[index] = Object.assign({}, customers[index], req.body, { updated_at: new Date().toISOString() });
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '客户不存在' });
  }
});

app.delete('/api/customers/:id', function(req, res) {
  const index = customers.findIndex(function(c) { return c.id === req.params.id; });
  if (index !== -1) {
    customers.splice(index, 1);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '客户不存在' });
  }
});

// 供应商相关接口
app.get('/api/suppliers', function(req, res) {
  res.json(suppliers);
});

app.get('/api/suppliers/:id', function(req, res) {
  const supplier = suppliers.find(function(s) { return s.id === req.params.id; });
  if (supplier) {
    res.json(supplier);
  } else {
    res.status(404).json({ error: '供应商不存在' });
  }
});

app.post('/api/suppliers', function(req, res) {
  const id = 'SUP' + String(suppliers.length + 1).padStart(3, '0');
  const supplier = Object.assign({ id: id, created_at: new Date().toISOString(), invoiceStatus: '未开票' }, req.body);
  suppliers.push(supplier);
  autoSave();
  res.json({ success: true, id: id });
});

app.put('/api/suppliers/:id', function(req, res) {
  const index = suppliers.findIndex(function(s) { return s.id === req.params.id; });
  if (index !== -1) {
    suppliers[index] = Object.assign({}, suppliers[index], req.body);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '供应商不存在' });
  }
});

app.delete('/api/suppliers/:id', function(req, res) {
  const index = suppliers.findIndex(function(s) { return s.id === req.params.id; });
  if (index !== -1) {
    suppliers.splice(index, 1);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '供应商不存在' });
  }
});

// 更新供应商开票状态
app.put('/api/suppliers/:id/invoice-status', function(req, res) {
  const index = suppliers.findIndex(function(s) { return s.id === req.params.id; });
  if (index !== -1) {
    suppliers[index].invoiceStatus = req.body.invoiceStatus;
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '供应商不存在' });
  }
});

// 产品相关接口
app.get('/api/products', function(req, res) {
  res.json(products);
});

app.get('/api/products/:id', function(req, res) {
  const product = products.find(function(p) { return p.id === req.params.id; });
  if (product) {
    res.json(product);
  } else {
    res.status(404).json({ error: '产品不存在' });
  }
});

app.post('/api/products', function(req, res) {
  const id = 'P' + String(products.length + 1).padStart(3, '0');
  const product = Object.assign({ id: id, created_at: new Date().toISOString() }, req.body);
  products.push(product);
  autoSave();
  res.json({ success: true, id: id });
});

app.put('/api/products/:id', function(req, res) {
  const index = products.findIndex(function(p) { return p.id === req.params.id; });
  if (index !== -1) {
    products[index] = Object.assign({}, products[index], req.body);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '产品不存在' });
  }
});

app.delete('/api/products/:id', function(req, res) {
  const index = products.findIndex(function(p) { return p.id === req.params.id; });
  if (index !== -1) {
    products.splice(index, 1);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '产品不存在' });
  }
});

// 销售报价单（PI）相关接口
app.get('/api/pi', function(req, res) {
  res.json(piOrders);
});

app.post('/api/pi', function(req, res) {
  const now = new Date();
  const id = 'PI' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(piOrders.length + 1).padStart(3, '0');
  const pi = Object.assign({ id: id, created_at: now.toISOString() }, req.body);
  piOrders.push(pi);
  autoSave();
  res.json({ success: true, id: id });
});

app.put('/api/pi/:id', function(req, res) {
  const index = piOrders.findIndex(function(p) { return p.id === req.params.id; });
  if (index !== -1) {
    piOrders[index] = Object.assign({}, piOrders[index], req.body);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'PI单不存在' });
  }
});

app.get('/api/pi-orders', function(req, res) {
  res.json(piOrders);
});

app.get('/api/pi-orders/:id', function(req, res) {
  const pi = piOrders.find(function(p) { return p.id === req.params.id; });
  if (pi) {
    res.json(pi);
  } else {
    res.status(404).json({ error: 'PI单不存在' });
  }
});

app.post('/api/pi-orders', function(req, res) {
  const now = new Date();
  const id = 'PI' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(piOrders.length + 1).padStart(3, '0');
  const pi = Object.assign({ id: id, created_at: now.toISOString() }, req.body);
  piOrders.push(pi);
  autoSave();
  res.json({ success: true, id: id });
});

app.put('/api/pi-orders/:id', function(req, res) {
  const index = piOrders.findIndex(function(p) { return p.id === req.params.id; });
  if (index !== -1) {
    piOrders[index] = Object.assign({}, piOrders[index], req.body);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'PI单不存在' });
  }
});

app.delete('/api/pi-orders/:id', function(req, res) {
  const index = piOrders.findIndex(function(p) { return p.id === req.params.id; });
  if (index !== -1) {
    piOrders.splice(index, 1);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: 'PI单不存在' });
  }
});

// 采购单相关接口
app.get('/api/purchase-orders', function(req, res) {
  const search = req.query.search || '';
  let filtered = purchaseOrders;
  
  if (search) {
    filtered = purchaseOrders.filter(function(o) {
      return o.id.toLowerCase().includes(search.toLowerCase()) ||
             o.supplierName.toLowerCase().includes(search.toLowerCase());
    });
  }
  
  // 解析products字段为数组
  const result = filtered.map(function(order) {
    return Object.assign({}, order, {
      products: typeof order.products === 'string' ? JSON.parse(order.products) : order.products
    });
  });
  
  res.json(result);
});

app.get('/api/purchase-orders/:id', function(req, res) {
  const order = purchaseOrders.find(function(o) { return o.id === req.params.id; });
  if (order) {
    // 解析products字段为数组
    const result = Object.assign({}, order, {
      products: typeof order.products === 'string' ? JSON.parse(order.products) : order.products
    });
    res.json(result);
  } else {
    res.status(404).json({ error: '采购单不存在' });
  }
});

app.post('/api/purchase-orders', function(req, res) {
  const now = new Date();
  const id = 'CG' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + String(purchaseOrders.length + 1).padStart(3, '0');
  const order = Object.assign({ id: id, created_at: now.toISOString(), dataSource: '手动新增' }, req.body);
  purchaseOrders.push(order);
  autoSave();
  res.json({ success: true, id: id });
});

app.put('/api/purchase-orders/:id', function(req, res) {
  const index = purchaseOrders.findIndex(function(o) { return o.id === req.params.id; });
  if (index !== -1) {
    const body = Object.assign({}, req.body);
    // 将products数组转换为JSON字符串存储
    if (body.products && Array.isArray(body.products)) {
      body.products = JSON.stringify(body.products);
    }
    purchaseOrders[index] = Object.assign({}, purchaseOrders[index], body);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '采购单不存在' });
  }
});

app.delete('/api/purchase-orders/:id', function(req, res) {
  const index = purchaseOrders.findIndex(function(o) { return o.id === req.params.id; });
  if (index !== -1) {
    purchaseOrders.splice(index, 1);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '采购单不存在' });
  }
});

// 根据PI编号获取采购单列表
app.get('/api/purchase-orders/by-pi/:piId', function(req, res) {
  const piId = req.params.piId;
  const orders = purchaseOrders.filter(function(o) { return o.piId === piId; });
  res.json(orders);
});

// 获取产品历史采购价格
app.get('/api/purchase-orders/history/:productId', function(req, res) {
  const productId = req.params.productId;
  
  const history = [];
  purchaseOrders.forEach(function(po) {
    if (po.status === '已完成') {
      let products = po.products;
      if (typeof products === 'string') {
        try {
          products = JSON.parse(products);
        } catch (e) {
          products = [];
        }
      }
      if (Array.isArray(products)) {
        const product = products.find(function(p) { return p.productId === productId; });
        if (product) {
          history.push({
            purchaseOrderId: po.id,
            supplierId: po.supplierId,
            supplierName: po.supplierName,
            quantity: product.quantity,
            unitPrice: product.unitPrice,
            purchaseDate: po.created_at
          });
        }
      }
    }
  });
  
  history.sort(function(a, b) { return new Date(b.purchaseDate) - new Date(a.purchaseDate); });
  res.json(history);
});

// 更新采购单产品信息
app.put('/api/purchase-orders/:id/products', function(req, res) {
  const index = purchaseOrders.findIndex(function(o) { return o.id === req.params.id; });
  if (index !== -1) {
    // 将products数组转换为JSON字符串存储
    purchaseOrders[index].products = JSON.stringify(req.body.products);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '采购单不存在' });
  }
});

// 更新采购单状态
app.put('/api/purchase-orders/:id/status', function(req, res) {
  const index = purchaseOrders.findIndex(function(o) { return o.id === req.params.id; });
  if (index !== -1) {
    purchaseOrders[index].status = req.body.status;
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '采购单不存在' });
  }
});

// 库存相关接口
app.get('/api/inventory', function(req, res) {
  res.json(inventory);
});

app.get('/api/inventory/:productId', function(req, res) {
  const item = inventory.find(function(i) { return i.productId === req.params.productId; });
  if (item) {
    res.json(item);
  } else {
    res.status(404).json({ error: '库存不存在' });
  }
});

app.post('/api/inventory', function(req, res) {
  const existing = inventory.find(function(i) { return i.productId === req.body.productId; });
  if (existing) {
    existing.quantity += parseInt(req.body.quantity) || 0;
    autoSave();
    res.json({ success: true });
  } else {
    const item = Object.assign({ created_at: new Date().toISOString() }, req.body);
    inventory.push(item);
    autoSave();
    res.json({ success: true });
  }
});

app.put('/api/inventory/:productId', function(req, res) {
  const index = inventory.findIndex(function(i) { return i.productId === req.params.productId; });
  if (index !== -1) {
    inventory[index] = Object.assign({}, inventory[index], req.body);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '库存不存在' });
  }
});

app.delete('/api/inventory/:productId', function(req, res) {
  const index = inventory.findIndex(function(i) { return i.productId === req.params.productId; });
  if (index !== -1) {
    inventory.splice(index, 1);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '库存不存在' });
  }
});

// 提醒相关接口
app.get('/api/reminders', function(req, res) {
  res.json(reminders);
});

app.get('/api/reminders/:purchaseOrderId', function(req, res) {
  const purchaseOrderId = req.params.purchaseOrderId;
  const result = reminders.filter(function(r) { return r.purchaseOrderId === purchaseOrderId; });
  res.json(result);
});

app.post('/api/reminders', function(req, res) {
  const reminder = Object.assign({ id: reminders.length + 1, created_at: new Date().toISOString(), status: '待提醒' }, req.body);
  reminders.push(reminder);
  autoSave();
  res.json({ success: true, id: reminder.id });
});

app.put('/api/reminders/:id', function(req, res) {
  const index = reminders.findIndex(function(r) { return r.id === parseInt(req.params.id); });
  if (index !== -1) {
    reminders[index] = Object.assign(reminders[index], req.body, { updated_at: new Date().toISOString() });
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '提醒不存在' });
  }
});

app.delete('/api/reminders/:id', function(req, res) {
  const index = reminders.findIndex(function(r) { return r.id === parseInt(req.params.id); });
  if (index !== -1) {
    reminders.splice(index, 1);
    autoSave();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, error: '提醒不存在' });
  }
});

// 邮箱配置接口
app.get('/api/email-configs', function(req, res) {
  // 返回邮箱列表，不包含授权码
  const configsWithoutAuth = emailConfigs.map(function(c) {
    return { id: c.id, email: c.email };
  });
  res.json(configsWithoutAuth);
});

// 提醒日志接口
app.get('/api/purchase-orders/:id/reminder-logs', function(req, res) {
  const id = req.params.id;
  const logs = reminderLogs.filter(function(l) { return l.purchaseOrderId === id; });
  logs.sort(function(a, b) { return new Date(b.sentTime || b.created_at) - new Date(a.sentTime || a.created_at); });
  res.json(logs);
});

// 404处理
app.use(function(req, res) {
  res.status(404).json({ error: 'API endpoint not found: ' + req.originalUrl });
});

// 获取当前北京时间
function getBeijingTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 8 * 3600000); // UTC+8
}

// 检查提醒函数
function checkReminders() {
  try {
    const now = getBeijingTime();
    
    const pendingReminders = reminders.filter(r => r.status === '待提醒');
    
    for (const reminder of pendingReminders) {
      const reminderTime = new Date(reminder.reminderTime);
      // 转换为北京时间比较
      const reminderTimeUTC = reminderTime.getTime() + reminderTime.getTimezoneOffset() * 60000;
      const reminderBeijingTime = new Date(reminderTimeUTC + 8 * 3600000);
      
      if (now >= reminderBeijingTime) {
        // 发送邮件提醒（模拟发送，实际项目中需要配置邮件服务）
        console.log(`[${now.toLocaleString('zh-CN')}] Sending reminder to ${reminder.email}: ${reminder.content}`);
        
        // 创建提醒日志记录
        const log = {
          id: reminderLogs.length + 1,
          reminderId: reminder.id,
          purchaseOrderId: reminder.purchaseOrderId,
          event: reminder.event || 'custom',
          sentTime: new Date().toISOString(),
          email: reminder.email,
          content: reminder.content,
          status: '成功',
          error: null,
          created_at: new Date().toISOString()
        };
        reminderLogs.push(log);
        
        // 更新状态为已提醒
        const index = reminders.findIndex(r => r.id === reminder.id);
        if (index !== -1) {
          reminders[index].status = '已提醒';
          reminders[index].updated_at = new Date().toISOString();
          autoSave();
        }
      }
    }
  } catch (err) {
    console.error('Error checking reminders:', err.message);
  }
}

app.listen(PORT, HOST, function() {
  console.log('=== Server Started ===');
  console.log('Server running at http://' + HOST + ':' + PORT);
  console.log('Ready to accept requests');
  console.log('Beijing Time Now:', getBeijingTime().toLocaleString('zh-CN'));
  
  // 每1分钟检查一次提醒
  setInterval(checkReminders, 1 * 60 * 1000);
  
  // 启动时检查一次
  checkReminders();
});

process.on('uncaughtException', function(err) {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', function(err) {
  console.error('Unhandled Rejection:', err);
});
