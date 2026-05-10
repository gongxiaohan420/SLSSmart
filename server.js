const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const multer = require('multer');
const app = express();

// multer配置用于文件上传
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// SQLite数据库连接
const dbPath = path.join(__dirname, 'backend', 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('SQLite database connection error:', err.message);
  } else {
    console.log('SQLite database connected:', dbPath);
    
    // 创建customers表（如果不存在）
    db.run(`CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      companyName TEXT,
      companyShortName TEXT,
      contact TEXT,
      country TEXT,
      countryCode TEXT,
      companySize TEXT,
      website TEXT,
      created_at TEXT
    )`, (createErr) => {
      if (createErr) {
        console.error('Error creating customers table:', createErr.message);
      } else {
        console.log('Customers table is ready');
        // 尝试添加countryCode字段（SQLite不支持IF NOT EXISTS）
        db.run('ALTER TABLE customers ADD COLUMN countryCode TEXT', (alterErr) => {
          if (alterErr && !alterErr.message.includes('duplicate column name')) {
            console.log('countryCode column may already exist or error:', alterErr.message);
          }
        });
      }
    });
    
    // 创建inventory表（如果不存在）
    db.run(`CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      productId TEXT UNIQUE,
      englishName TEXT,
      chineseName TEXT,
      quantity INTEGER DEFAULT 0,
      warehouse TEXT DEFAULT '深圳仓库',
      created_at TEXT
    )`, (createErr) => {
      if (createErr) {
        console.error('Error creating inventory table:', createErr.message);
      } else {
        console.log('Inventory table is ready');
      }
    });
    
    // 数据库迁移：为suppliers表添加invoiceStatus列（如果不存在）
    db.run("ALTER TABLE suppliers ADD COLUMN invoiceStatus TEXT DEFAULT '未开票'", (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        // 如果错误不是"列已存在"，则打印错误
        console.log('数据库迁移 - suppliers表已包含invoiceStatus列，无需迁移');
      } else if (!alterErr) {
        console.log('数据库迁移成功 - 已为suppliers表添加invoiceStatus列');
      }
    });
    
    // 数据库迁移：为purchaseOrders表添加PI相关列（如果不存在）
    const purchaseOrderColumns = ['piCustomerName', 'piTotalAmount', 'piCreatedAt', 'dataSource'];
    purchaseOrderColumns.forEach(function(column) {
      db.run("ALTER TABLE purchaseOrders ADD COLUMN " + column + " TEXT DEFAULT ''", (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column name')) {
          // 忽略"列已存在"的错误
        }
      });
    });
    
    // 数据库迁移：为products表添加purchaseChannel列（如果不存在）
    db.run("ALTER TABLE products ADD COLUMN purchaseChannel TEXT DEFAULT ''", (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        // 如果错误不是"列已存在"，则打印错误
        console.log('数据库迁移 - products表已包含purchaseChannel列，无需迁移');
      } else if (!alterErr) {
        console.log('数据库迁移成功 - 已为products表添加purchaseChannel列');
      }
    });
  }
});

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

// 初始化数据（使用JSON文件作为备用存储）
const jsonData = loadData();

let users = jsonData.users;
let customers = jsonData.customers;
let suppliers = jsonData.suppliers;
let products = jsonData.products;
let piOrders = jsonData.piOrders;
let purchaseOrders = jsonData.purchaseOrders;
let inventory = jsonData.inventory;
let emailConfigs = jsonData.emailConfigs || defaultData.emailConfigs || [];
console.log('Email configs loaded:', emailConfigs.length, 'configs');
if (emailConfigs.length === 0) {
  console.error('Warning: No email configurations found! Using default configs.');
  emailConfigs = defaultData.emailConfigs;
}

// 自动保存数据
function autoSave() {
  saveData({ users, customers, suppliers, products, piOrders, purchaseOrders, inventory, emailConfigs });
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
  const customerId = req.params.id;
  
  // 先检查内存中是否存在该客户
  const customerIndex = customers.findIndex(function(c) { return c.id === customerId; });
  if (customerIndex === -1) {
    res.status(404).json({ success: false, error: '客户不存在' });
    return;
  }
  
  // 更新数据库
  db.run('UPDATE customers SET companyName = ?, companyShortName = ?, contact = ?, country = ?, website = ?, companySize = ?, countryCode = ? WHERE id = ?', 
    [req.body.companyName, req.body.companyShortName, req.body.contact, req.body.country, req.body.website, req.body.companySize, countryCodes[req.body.country] || 'CN', customerId], 
    function(err) {
      if (err) {
        console.error('Error updating customer:', err);
        res.status(500).json({ success: false, error: err.message });
      } else {
        // 更新内存变量
        customers[customerIndex].companyName = req.body.companyName;
        customers[customerIndex].companyShortName = req.body.companyShortName;
        customers[customerIndex].contact = req.body.contact;
        customers[customerIndex].country = req.body.country;
        customers[customerIndex].website = req.body.website;
        customers[customerIndex].companySize = req.body.companySize;
        customers[customerIndex].countryCode = countryCodes[req.body.country] || 'CN';
        
        res.json({ success: true });
      }
    }
  );
});

app.delete('/api/customers/:id', function(req, res) {
  const customerId = req.params.id;
  const customerIndex = customers.findIndex(function(c) { return c.id === customerId; });
  
  if (customerIndex === -1) {
    res.status(404).json({ success: false, error: '客户不存在' });
    return;
  }
  
  const deletedCustomer = customers[customerIndex];
  customers.splice(customerIndex, 1);
  
  db.run('DELETE FROM customers WHERE id = ?', [customerId], function(err) {
    if (err) {
      console.error('Error deleting customer from DB:', err);
    }
    saveData();
    res.json({ success: true });
  });
});

// 供应商相关接口
app.get('/api/suppliers', function(req, res) {
  db.all('SELECT * FROM suppliers', function(err, suppliers) {
    if (err) {
      console.error('Error fetching suppliers:', err);
      res.status(500).json({ error: err.message });
    } else {
      res.json(suppliers);
    }
  });
});

app.get('/api/suppliers/:id', function(req, res) {
  db.get('SELECT * FROM suppliers WHERE id = ?', [req.params.id], function(err, supplier) {
    if (err) {
      console.error('Error fetching supplier:', err);
      res.status(500).json({ error: err.message });
    } else if (supplier) {
      res.json(supplier);
    } else {
      res.status(404).json({ error: '供应商不存在' });
    }
  });
});

app.post('/api/suppliers', function(req, res) {
  db.get('SELECT COUNT(*) as count FROM suppliers', function(err, result) {
    if (err) {
      console.error('Error counting suppliers:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    const id = 'SUP' + String((result.count || 0) + 1).padStart(3, '0');
    db.run('INSERT INTO suppliers (id, name, contact, contactInfo, paymentLink, canInvoice, invoiceThreshold, invoiceStatus, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [id, req.body.name, req.body.contact, req.body.contactInfo, req.body.paymentLink, req.body.canInvoice, req.body.invoiceThreshold, '未开票', new Date().toISOString()], 
      function(err) {
        if (err) {
          console.error('Error inserting supplier:', err);
          res.status(500).json({ success: false, error: err.message });
        } else {
          res.json({ success: true, id: id });
        }
      }
    );
  });
});

app.put('/api/suppliers/:id', function(req, res) {
  db.run('UPDATE suppliers SET name = ?, companyType = ?, mainProducts = ?, contact = ?, contactInfo = ?, canInvoice = ?, invoiceThreshold = ?, paymentLink = ?, note = ?, attachments = ? WHERE id = ?', 
    [req.body.name, req.body.companyType, req.body.mainProducts, req.body.contact, req.body.contactInfo, req.body.canInvoice, req.body.invoiceThreshold, req.body.paymentLink, req.body.note, req.body.attachments, req.params.id], 
    function(err) {
      if (err) {
        console.error('Error updating supplier:', err);
        res.status(500).json({ success: false, error: err.message });
      } else if (this.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: '供应商不存在' });
      }
    }
  );
});

app.delete('/api/suppliers/:id', function(req, res) {
  const supplierId = req.params.id;
  const supplierIndex = suppliers.findIndex(function(s) { return s.id === supplierId; });
  
  if (supplierIndex === -1) {
    res.status(404).json({ success: false, error: '供应商不存在' });
    return;
  }
  
  suppliers.splice(supplierIndex, 1);
  
  db.run('DELETE FROM suppliers WHERE id = ?', [supplierId], function(err) {
    if (err) {
      console.error('Error deleting supplier from DB:', err);
    }
    saveData();
    res.json({ success: true });
  });
});

// 更新供应商开票状态
app.put('/api/suppliers/:id/invoice-status', function(req, res) {
  db.run('UPDATE suppliers SET invoiceStatus = ? WHERE id = ?', 
    [req.body.invoiceStatus, req.params.id], 
    function(err) {
      if (err) {
        console.error('Error updating supplier invoice status:', err);
        res.status(500).json({ success: false, error: err.message });
      } else if (this.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: '供应商不存在' });
      }
    }
  );
});

// 供应商附件上传
app.post('/api/suppliers/:id/attachments', upload.array('files', 5), function(req, res) {
  try {
    const supplierId = req.params.id;
    
    if (!req.files || req.files.length === 0) {
      res.status(400).json({ success: false, error: '请选择文件' });
      return;
    }
    
    // 获取现有附件
    db.get('SELECT attachments FROM suppliers WHERE id = ?', [supplierId], function(err, supplier) {
      if (err) {
        console.error('Error fetching supplier:', err);
        res.status(500).json({ success: false, error: err.message });
        return;
      }
      
      if (!supplier) {
        res.status(404).json({ success: false, error: '供应商不存在' });
        return;
      }
      
      // 解析现有附件
      let existingAttachments = [];
      if (supplier.attachments) {
        try {
          existingAttachments = JSON.parse(supplier.attachments);
        } catch (e) {
          // 如果解析失败，可能是旧格式（逗号分隔），尝试转换
          const oldFiles = supplier.attachments.split(',');
          existingAttachments = oldFiles.filter(f => f.trim()).map((f, idx) => ({
            id: f,
            originalName: f,
            fileSize: 0,
            uploadedAt: new Date().toISOString(),
            storedName: f
          }));
        }
      }
      
      // 添加新附件
      const newAttachments = req.files.map(f => ({
        id: f.filename,
        originalName: f.originalname,
        fileSize: f.size,
        uploadedAt: new Date().toISOString(),
        storedName: f.filename
      }));
      
      // 合并附件（最多5个）
      const allAttachments = [...existingAttachments, ...newAttachments].slice(0, 5);
      
      // 保存到数据库
      db.run('UPDATE suppliers SET attachments = ? WHERE id = ?', 
        [JSON.stringify(allAttachments), supplierId], 
        function(err) {
          if (err) {
            console.error('Error updating supplier attachments:', err);
            res.status(500).json({ success: false, error: err.message });
          } else if (this.changes > 0) {
            res.json({ success: true, attachments: allAttachments });
          } else {
            res.status(404).json({ success: false, error: '供应商不存在' });
          }
        }
      );
    });
  } catch (err) {
    console.error('Error uploading attachments:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 供应商附件下载
app.get('/api/suppliers/attachments/download/:fileName', function(req, res) {
  const fileName = decodeURIComponent(req.params.fileName);
  const filePath = path.join(__dirname, 'uploads', fileName);
  
  fs.exists(filePath, function(exists) {
    if (!exists) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    
    res.download(filePath, fileName, function(err) {
      if (err) {
        console.error('Error downloading file:', err);
        res.status(500).json({ success: false, error: '下载失败' });
      }
    });
  });
});

// 供应商附件删除
app.delete('/api/suppliers/:id/attachments/:attachmentId', function(req, res) {
  const supplierId = req.params.id;
  const attachmentId = req.params.attachmentId;
  
  db.get('SELECT attachments FROM suppliers WHERE id = ?', [supplierId], function(err, supplier) {
    if (err) {
      console.error('Error fetching supplier:', err);
      res.status(500).json({ success: false, error: err.message });
    } else if (!supplier) {
      res.status(404).json({ success: false, error: '供应商不存在' });
    } else {
      // 解析附件
      let attachments = [];
      if (supplier.attachments) {
        try {
          attachments = JSON.parse(supplier.attachments);
        } catch (e) {
          // 如果解析失败，可能是旧格式
          const oldFiles = supplier.attachments.split(',');
          attachments = oldFiles.filter(f => f.trim()).map((f, idx) => ({
            id: f,
            originalName: f,
            fileSize: 0,
            uploadedAt: new Date().toISOString(),
            storedName: f
          }));
        }
      }
      
      // 删除附件
      const newAttachments = attachments.filter(att => att.id !== attachmentId);
      
      // 删除磁盘上的文件
      const toDelete = attachments.find(att => att.id === attachmentId);
      if (toDelete && toDelete.storedName) {
        const filePath = path.join(__dirname, 'uploads', toDelete.storedName);
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error('Error deleting file:', err);
          }
        });
      }
      
      db.run('UPDATE suppliers SET attachments = ? WHERE id = ?', 
        [JSON.stringify(newAttachments), supplierId], 
        function(err) {
          if (err) {
            console.error('Error updating supplier attachments:', err);
            res.status(500).json({ success: false, error: err.message });
          } else {
            res.json({ success: true });
          }
        }
      );
    }
  });
});

// 产品相关接口
app.get('/api/products', function(req, res) {
  db.all('SELECT * FROM products', function(err, products) {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).json({ error: err.message });
    } else {
      res.json(products);
    }
  });
});

app.get('/api/products/:id', function(req, res) {
  db.get('SELECT * FROM products WHERE id = ?', [req.params.id], function(err, product) {
    if (err) {
      console.error('Error fetching product:', err);
      res.status(500).json({ error: err.message });
    } else if (product) {
      res.json(product);
    } else {
      res.status(404).json({ error: '产品不存在' });
    }
  });
});

// 下载产品导入模板
app.get('/api/templates/products', function(req, res) {
  try {
    const XLSX = require('xlsx');
    
    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    // 创建表头（包含完整字段）
    const headers = ['产品ID', '英文名称', '中文名称', '销售价(≤100)', '销售价(>100)', '供应商', '采购价', '采购链接', '采购渠道'];
    
    // 创建工作表
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    
    // 添加工作表到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '产品导入模板');
    
    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=product_import_template.xlsx');
    res.send(excelBuffer);
  } catch (err) {
    console.error('Error generating template:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 下载客户导入模板
app.get('/api/templates/customers', function(req, res) {
  try {
    const XLSX = require('xlsx');
    
    const workbook = XLSX.utils.book_new();
    const headers = ['公司名称', '公司简称', '联系人', '国家', '公司规模'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, '客户导入模板');
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=customer_import_template.xlsx');
    res.send(excelBuffer);
  } catch (err) {
    console.error('Error generating template:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 下载库存导入模板
app.get('/api/templates/inventory', function(req, res) {
  try {
    const XLSX = require('xlsx');
    
    const workbook = XLSX.utils.book_new();
    const headers = ['产品ID', '英文名称', '中文名称', '数量', '仓库'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, '库存导入模板');
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=inventory_import_template.xlsx');
    res.send(excelBuffer);
  } catch (err) {
    console.error('Error generating template:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 下载供应商导入模板
app.get('/api/templates/suppliers', function(req, res) {
  try {
    const XLSX = require('xlsx');
    
    const workbook = XLSX.utils.book_new();
    const headers = ['供应商名称', '公司类型', '主营产品', '联系人', '联系方式', '是否可开票', '开票门槛', '支付链接'];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, '供应商导入模板');
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=supplier_import_template.xlsx');
    res.send(excelBuffer);
  } catch (err) {
    console.error('Error generating template:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 导入客户数据
app.post('/api/import/customers', upload.single('file'), function(req, res) {
  try {
    const XLSX = require('xlsx');
    
    if (!req.file) {
      res.status(400).json({ success: false, error: '请选择文件' });
      return;
    }
    
    const workbook = XLSX.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    let successCount = 0;
    let failCount = 0;
    let errors = [];
    let completed = 0;
    
    if (data.length === 0) {
      fs.unlinkSync(req.file.path);
      res.json({ success: true, successCount: 0, failCount: 0, errors: [] });
      return;
    }
    
    function processRow(row, index) {
      const companyName = row['公司名称'] || row['companyName'] || '';
      const companyShortName = row['公司简称'] || row['companyShortName'] || '';
      const contact = row['联系人'] || row['contact'] || '';
      const country = row['国家'] || row['country'] || '中国';
      const companySize = row['公司规模'] || row['companySize'] || '';
      
      if (!companyName) {
        errors.push(`第${index + 2}行：公司名称不能为空`);
        failCount++;
        completed++;
        checkComplete();
        return;
      }
      
      const countryCode = countryCodes[country] || 'CN';
      db.get('SELECT * FROM customers WHERE companyName = ?', [companyName], function(err, existing) {
        if (err) {
          errors.push(`第${index + 2}行：数据库查询错误: ${err.message}`);
          failCount++;
          completed++;
          checkComplete();
        } else if (existing) {
          db.run('UPDATE customers SET companyShortName = ?, contact = ?, country = ?, companySize = ? WHERE id = ?',
            [companyShortName, contact, country, companySize, existing.id],
            function(err) {
              if (err) {
                errors.push(`第${index + 2}行：更新失败: ${err.message}`);
                failCount++;
              } else {
                successCount++;
                const idx = customers.findIndex(function(c) { return c.id === existing.id; });
                if (idx !== -1) {
                  customers[idx].companyShortName = companyShortName;
                  customers[idx].contact = contact;
                  customers[idx].country = country;
                  customers[idx].companySize = companySize;
                }
              }
              completed++;
              checkComplete();
            }
          );
        } else {
          db.get('SELECT COUNT(*) as count FROM customers WHERE country = ?', [country], function(err, result) {
            if (err) {
              errors.push(`第${index + 2}行：获取客户数量失败: ${err.message}`);
              failCount++;
              completed++;
              checkComplete();
            } else {
              const nextNumber = (result.count || 0) + 1;
              const customerId = countryCode + String(nextNumber).padStart(4, '0');
              db.run('INSERT INTO customers (id, companyName, companyShortName, contact, country, countryCode, companySize, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [customerId, companyName, companyShortName, contact, country, countryCode, companySize, new Date().toISOString()],
                function(err) {
                  if (err) {
                    errors.push(`第${index + 2}行：插入失败: ${err.message}`);
                    failCount++;
                  } else {
                    successCount++;
                    customers.push({ id: customerId, companyName, companyShortName, contact, country, countryCode, companySize, created_at: new Date().toISOString() });
                  }
                  completed++;
                  checkComplete();
                }
              );
            }
          });
        }
      });
    }
    
    function checkComplete() {
      if (completed === data.length) {
        fs.unlinkSync(req.file.path);
        res.json({ success: true, successCount, failCount, errors });
      }
    }
    
    data.forEach(processRow);
    
  } catch (err) {
    console.error('Error importing customers:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 导入库存数据
app.post('/api/import/inventory', upload.single('file'), function(req, res) {
  try {
    const XLSX = require('xlsx');
    
    if (!req.file) {
      res.status(400).json({ success: false, error: '请选择文件' });
      return;
    }
    
    const workbook = XLSX.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    let successCount = 0;
    let failCount = 0;
    let errors = [];
    let completed = 0;
    
    if (data.length === 0) {
      fs.unlinkSync(req.file.path);
      res.json({ success: true, successCount: 0, failCount: 0, errors: [] });
      return;
    }
    
    function processRow(row, index) {
      const productId = row['产品ID'] || row['productId'] || '';
      const englishName = row['英文名称'] || row['englishName'] || '';
      const chineseName = row['中文名称'] || row['chineseName'] || '';
      const quantity = parseInt(row['数量'] || row['quantity'] || 0);
      const warehouse = row['仓库'] || row['warehouse'] || '深圳仓库';
      
      if (!productId) {
        errors.push(`第${index + 2}行：产品ID不能为空`);
        failCount++;
        completed++;
        checkComplete();
        return;
      }
      
      db.get('SELECT * FROM inventory WHERE productId = ?', [productId], function(err, existing) {
        if (err) {
          errors.push(`第${index + 2}行：数据库查询错误: ${err.message}`);
          failCount++;
          completed++;
          checkComplete();
        } else if (existing) {
          db.run('UPDATE inventory SET englishName = ?, chineseName = ?, quantity = ?, warehouse = ? WHERE productId = ?',
            [englishName, chineseName, quantity, warehouse, productId],
            function(err) {
              if (err) {
                errors.push(`第${index + 2}行：更新失败: ${err.message}`);
                failCount++;
              } else {
                successCount++;
                const idx = inventory.findIndex(function(i) { return i.productId === productId; });
                if (idx !== -1) {
                  inventory[idx].englishName = englishName;
                  inventory[idx].chineseName = chineseName;
                  inventory[idx].quantity = quantity;
                  inventory[idx].warehouse = warehouse;
                }
              }
              completed++;
              checkComplete();
            }
          );
        } else {
          db.run('INSERT INTO inventory (productId, englishName, chineseName, quantity, warehouse, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [productId, englishName, chineseName, quantity, warehouse, new Date().toISOString()],
            function(err) {
              if (err) {
                errors.push(`第${index + 2}行：插入失败: ${err.message}`);
                failCount++;
              } else {
                successCount++;
                inventory.push({ productId, englishName, chineseName, quantity, warehouse, created_at: new Date().toISOString() });
              }
              completed++;
              checkComplete();
            }
          );
        }
      });
    }
    
    function checkComplete() {
      if (completed === data.length) {
        fs.unlinkSync(req.file.path);
        res.json({ success: true, successCount, failCount, errors });
      }
    }
    
    data.forEach(processRow);
    
  } catch (err) {
    console.error('Error importing inventory:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 导入产品数据
app.post('/api/import/products', upload.single('file'), function(req, res) {
  try {
    const XLSX = require('xlsx');
    
    if (!req.file) {
      res.status(400).json({ success: false, error: '请选择文件' });
      return;
    }
    
    // 读取Excel文件
    const workbook = XLSX.readFile(req.file.path);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    let successCount = 0;
    let failCount = 0;
    let errors = [];
    let completed = 0;
    
    if (data.length === 0) {
      fs.unlinkSync(req.file.path);
      res.json({ success: true, successCount: 0, failCount: 0, errors: [] });
      return;
    }
    
    function processRow(row, index) {
      const productId = row['产品ID'] || row['产品id'] || row['id'] || '';
      const englishName = row['英文名称'] || row['englishName'] || '';
      const chineseName = row['中文名称'] || row['chineseName'] || '';
      const salesPriceLess100 = parseFloat(row['销售价(≤100)'] || row['销售价'] || row['salesPriceLess100'] || 0);
      const salesPriceMore100 = parseFloat(row['销售价(>100)'] || row['salesPriceMore100'] || 0);
      const supplierName = row['供应商'] || row['supplierName'] || '';
      const purchasePrice = parseFloat(row['采购价'] || row['purchasePrice'] || 0);
      const purchaseLink = row['采购链接'] || row['purchaseLink'] || '';
      const purchaseChannel = row['采购渠道'] || row['purchaseChannel'] || '';
      
      // 验证必填字段
      if (!chineseName && !englishName) {
        errors.push(`第${index + 2}行：产品名称不能为空`);
        failCount++;
        completed++;
        checkComplete();
        return;
      }
      
      // 使用提供的ID或自动生成
      const id = productId || 'P' + String(Date.now()).slice(-3);
      
      // 检查产品是否已存在
      db.get('SELECT * FROM products WHERE id = ? OR chineseName = ? OR englishName = ?', [id, chineseName, englishName], function(err, existing) {
        if (err) {
          errors.push(`第${index + 2}行：数据库查询错误: ${err.message}`);
          failCount++;
          completed++;
          checkComplete();
          return;
        }
        
        if (existing) {
          // 更新现有产品
          db.run('UPDATE products SET englishName = ?, chineseName = ?, salesPriceLess100 = ?, salesPriceMore100 = ?, supplierName = ?, purchasePriceLess100 = ?, purchasePriceMore100 = ?, purchaseLink = ?, purchaseChannel = ? WHERE id = ?',
            [englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierName, purchasePrice, purchasePrice, purchaseLink, purchaseChannel, existing.id],
            function(err) {
              if (err) {
                errors.push(`第${index + 2}行：更新失败: ${err.message}`);
                failCount++;
              } else {
                successCount++;
              }
              completed++;
              checkComplete();
            }
          );
        } else {
          // 插入新产品
          db.run('INSERT INTO products (id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierName, purchasePriceLess100, purchasePriceMore100, purchaseLink, purchaseChannel, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierName, purchasePrice, purchasePrice, purchaseLink, purchaseChannel, new Date().toISOString()],
            function(err) {
              if (err) {
                errors.push(`第${index + 2}行：插入失败: ${err.message}`);
                failCount++;
              } else {
                successCount++;
              }
              completed++;
              checkComplete();
            }
          );
        }
      });
    }
    
    function checkComplete() {
      if (completed === data.length) {
        // 删除临时文件
        fs.unlinkSync(req.file.path);
        res.json({ success: true, successCount, failCount, errors });
      }
    }
    
    data.forEach(processRow);
    
  } catch (err) {
    console.error('Error importing products:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/products', function(req, res) {
  db.get('SELECT COUNT(*) as count FROM products', function(err, result) {
    if (err) {
      console.error('Error counting products:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    const id = 'P' + String((result.count || 0) + 1).padStart(3, '0');
    db.run('INSERT INTO products (id, chineseName, englishName, purchaseLink, purchaseChannel, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
      [id, req.body.chineseName, req.body.englishName, req.body.purchaseLink, req.body.purchaseChannel, new Date().toISOString()], 
      function(err) {
        if (err) {
          console.error('Error inserting product:', err);
          res.status(500).json({ success: false, error: err.message });
        } else {
          res.json({ success: true, id: id });
        }
      }
    );
  });
});

app.put('/api/products/:id', function(req, res) {
  db.run('UPDATE products SET englishName = ?, chineseName = ?, salesPriceLess100 = ?, salesPriceMore100 = ?, supplierId = ?, supplierName = ?, purchasePriceLess100 = ?, purchasePriceMore100 = ?, purchaseLink = ?, features = ? WHERE id = ?', 
    [req.body.englishName, req.body.chineseName, req.body.salesPriceLess100, req.body.salesPriceMore100, req.body.supplierId, req.body.supplierName, req.body.purchasePriceLess100, req.body.purchasePriceMore100, req.body.purchaseLink, req.body.features, req.params.id], 
    function(err) {
      if (err) {
        console.error('Error updating product:', err);
        res.status(500).json({ success: false, error: err.message });
      } else if (this.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: '产品不存在' });
      }
    }
  );
});

app.delete('/api/products/:id', function(req, res) {
  const productId = req.params.id;
  const productIndex = products.findIndex(function(p) { return p.id === productId; });
  
  if (productIndex === -1) {
    res.status(404).json({ success: false, error: '产品不存在' });
    return;
  }
  
  products.splice(productIndex, 1);
  
  db.run('DELETE FROM products WHERE id = ?', [productId], function(err) {
    if (err) {
      console.error('Error deleting product from DB:', err);
    }
    saveData();
    res.json({ success: true });
  });
});

// 销售报价单（PI）相关接口
app.get('/api/pi', function(req, res) {
  db.all('SELECT * FROM pi', function(err, piOrders) {
    if (err) {
      console.error('Error fetching PI orders:', err);
      res.status(500).json({ error: err.message });
    } else {
      // 解析products字段为数组
      const result = piOrders.map(function(pi) {
        return Object.assign({}, pi, {
          products: typeof pi.products === 'string' ? JSON.parse(pi.products) : pi.products
        });
      });
      res.json(result);
    }
  });
});

app.post('/api/pi', function(req, res) {
  const now = new Date();
  const products = JSON.stringify(req.body.products || []);
  db.run('INSERT INTO pi (id, customerId, customerName, products, totalAmount, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    ['PI' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(Date.now()).slice(-3), req.body.customerId, req.body.customerName, products, req.body.totalAmount, req.body.note, req.body.status || '待处理', now.toISOString()], 
    function(err) {
      if (err) {
        console.error('Error inserting PI:', err);
        res.status(500).json({ success: false, error: err.message });
      } else {
        res.json({ success: true, id: this.lastID || 'PI' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(Date.now()).slice(-3) });
      }
    }
  );
});

app.put('/api/pi/:id', function(req, res) {
  const products = JSON.stringify(req.body.products || []);
  db.run('UPDATE pi SET customerId = ?, customerName = ?, products = ?, totalAmount = ?, note = ?, status = ? WHERE id = ?', 
    [req.body.customerId, req.body.customerName, products, req.body.totalAmount, req.body.note, req.body.status, req.params.id], 
    function(err) {
      if (err) {
        console.error('Error updating PI:', err);
        res.status(500).json({ success: false, error: err.message });
      } else if (this.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: 'PI单不存在' });
      }
    }
  );
});

app.get('/api/pi-orders', function(req, res) {
  db.all('SELECT * FROM pi', function(err, piOrders) {
    if (err) {
      console.error('Error fetching PI orders:', err);
      res.status(500).json({ error: err.message });
    } else {
      // 解析products字段为数组
      const result = piOrders.map(function(pi) {
        return Object.assign({}, pi, {
          products: typeof pi.products === 'string' ? JSON.parse(pi.products) : pi.products
        });
      });
      res.json(result);
    }
  });
});

app.get('/api/pi-orders/:id', function(req, res) {
  db.get('SELECT * FROM pi WHERE id = ?', [req.params.id], function(err, pi) {
    if (err) {
      console.error('Error fetching PI:', err);
      res.status(500).json({ error: err.message });
    } else if (pi) {
      // 解析products字段为数组
      const result = Object.assign({}, pi, {
        products: typeof pi.products === 'string' ? JSON.parse(pi.products) : pi.products
      });
      res.json(result);
    } else {
      res.status(404).json({ error: 'PI单不存在' });
    }
  });
});

app.post('/api/pi-orders', function(req, res) {
  const now = new Date();
  const products = JSON.stringify(req.body.products || []);
  db.run('INSERT INTO pi (id, customerId, customerName, products, totalAmount, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    ['PI' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(Date.now()).slice(-3), req.body.customerId, req.body.customerName, products, req.body.totalAmount, req.body.note, req.body.status || '待处理', now.toISOString()], 
    function(err) {
      if (err) {
        console.error('Error inserting PI:', err);
        res.status(500).json({ success: false, error: err.message });
      } else {
        res.json({ success: true, id: this.lastID || 'PI' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(Date.now()).slice(-3) });
      }
    }
  );
});

app.put('/api/pi-orders/:id', function(req, res) {
  const products = JSON.stringify(req.body.products || []);
  db.run('UPDATE pi SET customerId = ?, customerName = ?, products = ?, totalAmount = ?, note = ?, status = ? WHERE id = ?', 
    [req.body.customerId, req.body.customerName, products, req.body.totalAmount, req.body.note, req.body.status, req.params.id], 
    function(err) {
      if (err) {
        console.error('Error updating PI:', err);
        res.status(500).json({ success: false, error: err.message });
      } else if (this.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: 'PI单不存在' });
      }
    }
  );
});

app.delete('/api/pi-orders/:id', function(req, res) {
  db.run('DELETE FROM pi WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Error deleting PI:', err);
      res.status(500).json({ success: false, error: err.message });
    } else if (this.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'PI单不存在' });
    }
  });
});

// PI获取API别名（兼容前端调用）
app.get('/api/pi/:id', function(req, res) {
  db.get('SELECT * FROM pi WHERE id = ?', [req.params.id], function(err, pi) {
    if (err) {
      console.error('Error fetching PI:', err);
      res.status(500).json({ error: err.message });
    } else if (pi) {
      // 解析products字段
      if (pi.products) {
        try {
          pi.products = JSON.parse(pi.products);
        } catch (e) {
          pi.products = [];
        }
      } else {
        pi.products = [];
      }
      res.json(pi);
    } else {
      res.status(404).json({ error: 'PI订单不存在' });
    }
  });
});

// PI删除API别名（兼容前端调用）
app.delete('/api/pi/:id', function(req, res) {
  db.run('DELETE FROM pi WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Error deleting PI:', err);
      res.status(500).json({ success: false, error: err.message });
    } else if (this.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: 'PI单不存在' });
    }
  });
});

// 采购单相关接口
app.get('/api/purchase-orders', function(req, res) {
  const search = req.query.search || '';
  let query = 'SELECT * FROM purchaseOrders';
  let params = [];
  
  if (search) {
    query += ' WHERE id LIKE ? OR supplierName LIKE ?';
    params = ['%' + search + '%', '%' + search + '%'];
  }
  
  db.all(query, params, function(err, purchaseOrders) {
    if (err) {
      console.error('Error fetching purchase orders:', err);
      res.status(500).json({ error: err.message });
    } else {
      // 解析products字段为数组
      const result = purchaseOrders.map(function(order) {
        return Object.assign({}, order, {
          products: typeof order.products === 'string' ? JSON.parse(order.products) : order.products
        });
      });
      res.json(result);
    }
  });
});

app.get('/api/purchase-orders/:id', function(req, res) {
  db.get('SELECT * FROM purchaseOrders WHERE id = ?', [req.params.id], function(err, order) {
    if (err) {
      console.error('Error fetching purchase order:', err);
      res.status(500).json({ error: err.message });
    } else if (order) {
      // 解析products字段为数组
      const result = Object.assign({}, order, {
        products: typeof order.products === 'string' ? JSON.parse(order.products) : order.products
      });
      res.json(result);
    } else {
      res.status(404).json({ error: '采购单不存在' });
    }
  });
});

// 从PI生成采购单
app.post('/api/purchase-orders/generate', function(req, res) {
  const piId = req.body.piId;
  
  if (!piId) {
    res.status(400).json({ success: false, error: 'PI编号不能为空' });
    return;
  }
  
  // 从JSON数据中查找PI订单
  const piOrder = piOrders.find(p => p.id === piId);
  if (!piOrder) {
    res.status(404).json({ success: false, error: 'PI订单不存在' });
    return;
  }
  
  // 解析PI订单中的产品
  let piProducts = [];
  try {
    piProducts = typeof piOrder.products === 'string' ? JSON.parse(piOrder.products) : piOrder.products;
  } catch (e) {
    piProducts = [];
  }
  
  if (!piProducts || piProducts.length === 0) {
    res.status(400).json({ success: false, error: 'PI订单中没有产品信息' });
    return;
  }
  
  const now = new Date();
  let generatedCount = 0;
  
  // 为每个产品创建采购订单
  function createPurchaseOrder(product, index, callback) {
    // 生成采购单编号
    db.get('SELECT COUNT(*) as count FROM purchaseOrders', function(err, result) {
      if (err) {
        callback(err);
        return;
      }
      
      const poId = 'CG' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + String((result.count || 0) + index + 1).padStart(3, '0');
      
      // 查找产品信息
      const productInfo = products.find(p => p.id === product.productId);
      const purchasePrice = product.purchasePrice || (productInfo ? productInfo.purchasePrice : 0);
      const productName = productInfo ? productInfo.chineseName || productInfo.englishName || product.productId : product.productId;
      
      const poProducts = [{
        productId: product.productId,
        productName: productName,
        quantity: product.quantity,
        purchasePrice: purchasePrice
      }];
      
      const totalAmount = product.quantity * purchasePrice;
      
      // 创建采购订单，供应商设为空，等待用户后续编辑
      db.run('INSERT INTO purchaseOrders (id, piId, supplierId, supplierName, products, totalAmount, status, note, created_at, piCustomerName, piTotalAmount, piCreatedAt, dataSource) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
        [poId, piId, '', '', JSON.stringify(poProducts), totalAmount, '待处理', '', now.toISOString(), piOrder.customerName || '', piOrder.totalAmount || 0, piOrder.created_at || '', '从PI单中生成'], 
        function(err) {
          if (err) {
            console.error('Error inserting purchase order:', err);
            callback(err);
          } else {
            generatedCount++;
            callback(null);
          }
        }
      );
    });
  }
  
  // 串行创建每个产品的采购订单
  let completed = 0;
  let hasError = false;
  
  if (piProducts.length === 0) {
    res.json({ success: true, count: 0 });
    return;
  }
  
  piProducts.forEach(function(product, index) {
    createPurchaseOrder(product, index, function(err) {
      completed++;
      if (err && !hasError) {
        hasError = true;
        res.status(500).json({ success: false, error: '生成采购单失败：' + err.message });
      } else if (completed === piProducts.length && !hasError) {
        res.json({ success: true, count: generatedCount });
      }
    });
  });
});

app.post('/api/purchase-orders', function(req, res) {
  const now = new Date();
  db.get('SELECT COUNT(*) as count FROM purchaseOrders', function(err, result) {
    if (err) {
      console.error('Error counting purchase orders:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    const id = 'CG' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + String((result.count || 0) + 1).padStart(3, '0');
    const products = JSON.stringify(req.body.products || []);
    db.run('INSERT INTO purchaseOrders (id, piId, supplierId, supplierName, products, totalAmount, status, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [id, req.body.piId, req.body.supplierId, req.body.supplierName, products, req.body.totalAmount, req.body.status || '待处理', req.body.note, now.toISOString()], 
      function(err) {
        if (err) {
          console.error('Error inserting purchase order:', err);
          res.status(500).json({ success: false, error: err.message });
        } else {
          res.json({ success: true, id: id });
        }
      }
    );
  });
});

app.put('/api/purchase-orders/:id', function(req, res) {
  const body = Object.assign({}, req.body);
  // 将products数组转换为JSON字符串存储
  if (body.products && Array.isArray(body.products)) {
    body.products = JSON.stringify(body.products);
  }
  
  db.run('UPDATE purchaseOrders SET supplierId = ?, products = ?, note = ? WHERE id = ?', 
    [body.supplierId, body.products, body.note, req.params.id], 
    function(err) {
      if (err) {
        console.error('Error updating purchase order:', err);
        res.status(500).json({ success: false, error: err.message });
      } else if (this.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: '采购单不存在' });
      }
    }
  );
});

app.delete('/api/purchase-orders/:id', function(req, res) {
  db.run('DELETE FROM purchaseOrders WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      console.error('Error deleting purchase order:', err);
      res.status(500).json({ success: false, error: err.message });
    } else if (this.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: '采购单不存在' });
    }
  });
});

// 根据PI编号获取采购单列表
app.get('/api/purchase-orders/by-pi/:piId', function(req, res) {
  const piId = req.params.piId;
  db.all('SELECT * FROM purchaseOrders WHERE piId = ?', [piId], function(err, orders) {
    if (err) {
      console.error('Error fetching purchase orders by PI:', err);
      res.status(500).json({ error: err.message });
    } else {
      // 解析products字段为数组
      const result = orders.map(function(order) {
        return Object.assign({}, order, {
          products: typeof order.products === 'string' ? JSON.parse(order.products) : order.products
        });
      });
      res.json(result);
    }
  });
});

// 获取产品历史采购价格
app.get('/api/purchase-orders/history/:productId', function(req, res) {
  const productId = req.params.productId;
  
  db.all('SELECT * FROM purchaseOrders WHERE status = ?', ['已完成'], function(err, purchaseOrders) {
    if (err) {
      console.error('Error fetching purchase orders:', err);
      res.status(500).json({ error: err.message });
      return;
    }
    
    const history = [];
    purchaseOrders.forEach(function(po) {
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
            totalPrice: product.totalPrice,
            productName: product.productName,
            purchaseDate: po.created_at
          });
        }
      }
    });
    
    history.sort(function(a, b) { return new Date(b.purchaseDate) - new Date(a.purchaseDate); });
    res.json(history);
  });
});

// 更新采购单产品信息
app.put('/api/purchase-orders/:id/products', function(req, res) {
  const products = JSON.stringify(req.body.products);
  
  db.run('UPDATE purchaseOrders SET products = ? WHERE id = ?', 
    [products, req.params.id], 
    function(err) {
      if (err) {
        console.error('Error updating purchase order products:', err);
        res.status(500).json({ success: false, error: err.message });
        return;
      }
      
      if (this.changes === 0) {
        res.status(404).json({ success: false, error: '采购单不存在' });
        return;
      }
      
      const productsArray = req.body.products || [];
      let completed = 0;
      
      if (productsArray.length === 0) {
        res.json({ success: true });
        return;
      }
      
      function checkComplete() {
        if (completed === productsArray.length) {
          res.json({ success: true });
        }
      }
      
      productsArray.forEach(function(product) {
        const quantity = parseInt(product.quantity) || 0;
        
        db.get('SELECT * FROM inventory WHERE productId = ?', [product.productId], function(err, existing) {
          if (err) {
            console.error('Error checking inventory:', err);
            completed++;
            checkComplete();
            return;
          }
          
          if (existing) {
            db.run('UPDATE inventory SET quantity = quantity + ? WHERE productId = ?', 
              [quantity, product.productId], 
              function(err) {
                if (err) {
                  console.error('Error updating inventory:', err);
                }
                completed++;
                checkComplete();
              }
            );
          } else {
            db.run('INSERT INTO inventory (productId, englishName, chineseName, quantity, warehouse, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
              [product.productId, product.englishName || '', product.chineseName || '', quantity, '深圳仓库', new Date().toISOString()], 
              function(err) {
                if (err) {
                  console.error('Error inserting inventory:', err);
                }
                completed++;
                checkComplete();
              }
            );
          }
        });
      });
    }
  );
});

// 更新采购单状态
app.put('/api/purchase-orders/:id/status', function(req, res) {
  db.run('UPDATE purchaseOrders SET status = ? WHERE id = ?', 
    [req.body.status, req.params.id], 
    function(err) {
      if (err) {
        console.error('Error updating purchase order status:', err);
        res.status(500).json({ success: false, error: err.message });
      } else if (this.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: '采购单不存在' });
      }
    }
  );
});

// 库存相关接口
app.get('/api/inventory', function(req, res) {
  db.all('SELECT * FROM inventory', function(err, rows) {
    if (err) {
      console.error('Error fetching inventory:', err);
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

app.get('/api/inventory/:productId', function(req, res) {
  db.get('SELECT * FROM inventory WHERE productId = ?', [req.params.productId], function(err, item) {
    if (err) {
      console.error('Error fetching inventory:', err);
      res.status(500).json({ error: err.message });
    } else if (item) {
      res.json(item);
    } else {
      res.status(404).json({ error: '库存不存在' });
    }
  });
});

app.post('/api/inventory', function(req, res) {
  db.get('SELECT * FROM inventory WHERE productId = ?', [req.body.productId], function(err, existing) {
    if (err) {
      console.error('Error checking inventory:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    if (existing) {
      db.run('UPDATE inventory SET quantity = quantity + ? WHERE productId = ?', 
        [parseInt(req.body.quantity) || 0, req.body.productId], 
        function(err) {
          if (err) {
            console.error('Error updating inventory:', err);
            res.status(500).json({ success: false, error: err.message });
          } else {
            res.json({ success: true });
          }
        }
      );
    } else {
      db.run('INSERT INTO inventory (productId, englishName, chineseName, quantity, warehouse, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
        [req.body.productId, req.body.englishName, req.body.chineseName, parseInt(req.body.quantity) || 0, req.body.warehouse, new Date().toISOString()], 
        function(err) {
          if (err) {
            console.error('Error inserting inventory:', err);
            res.status(500).json({ success: false, error: err.message });
          } else {
            res.json({ success: true });
          }
        }
      );
    }
  });
});

app.put('/api/inventory/:productId', function(req, res) {
  db.run('UPDATE inventory SET englishName = ?, chineseName = ?, quantity = ?, warehouse = ? WHERE productId = ?', 
    [req.body.englishName, req.body.chineseName, parseInt(req.body.quantity) || 0, req.body.warehouse, req.params.productId], 
    function(err) {
      if (err) {
        console.error('Error updating inventory:', err);
        res.status(500).json({ success: false, error: err.message });
      } else if (this.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: '库存不存在' });
      }
    }
  );
});

app.delete('/api/inventory/:productId', function(req, res) {
  const productId = req.params.productId;
  
  db.run('DELETE FROM inventory WHERE productId = ?', [productId], function(err) {
    if (err) {
      console.error('Error deleting inventory:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ success: false, error: '库存不存在' });
      return;
    }
    
    const inventoryIndex = inventory.findIndex(function(i) { return i.productId === productId; });
    if (inventoryIndex !== -1) {
      inventory.splice(inventoryIndex, 1);
      saveData();
    }
    
    res.json({ success: true });
  });
});

// 提醒相关接口
app.get('/api/reminders', function(req, res) {
  db.all('SELECT * FROM reminders ORDER BY created_at DESC', function(err, rows) {
    if (err) {
      console.error('Error fetching reminders:', err);
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.get('/api/reminders/:purchaseOrderId', function(req, res) {
  const purchaseOrderId = req.params.purchaseOrderId;
  db.all('SELECT * FROM reminders WHERE purchaseOrderId = ? ORDER BY reminderTime', [purchaseOrderId], function(err, rows) {
    if (err) {
      console.error('Error fetching reminders:', err);
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json(rows);
    }
  });
});

app.post('/api/reminders', function(req, res) {
  const { purchaseOrderId, reminderTime, content, email } = req.body;
  db.run('INSERT INTO reminders (purchaseOrderId, reminderTime, content, email, status, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
    [purchaseOrderId, reminderTime, content, email, '待提醒', new Date().toISOString()], 
    function(err) {
      if (err) {
        console.error('Error creating reminder:', err);
        res.status(500).json({ success: false, error: err.message });
      } else {
        res.json({ success: true, id: this.lastID });
      }
    }
  );
});

app.put('/api/reminders/:id', function(req, res) {
  const id = parseInt(req.params.id);
  const { reminderTime, content, email } = req.body;
  db.run('UPDATE reminders SET reminderTime = ?, content = ?, email = ?, updated_at = ? WHERE id = ?', 
    [reminderTime, content, email, new Date().toISOString(), id], 
    function(err) {
      if (err) {
        console.error('Error updating reminder:', err);
        res.status(500).json({ success: false, error: err.message });
      } else if (this.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: '提醒不存在' });
      }
    }
  );
});

app.delete('/api/reminders/:id', function(req, res) {
  const id = parseInt(req.params.id);
  db.run('DELETE FROM reminders WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Error deleting reminder:', err);
      res.status(500).json({ success: false, error: err.message });
    } else if (this.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ success: false, error: '提醒不存在' });
    }
  });
});

// 邮箱配置接口
app.get('/api/email-configs', function(req, res) {
  // 返回邮箱列表，不包含授权码
  db.all('SELECT id, email FROM email_configs ORDER BY id', function(err, rows) {
    if (err) {
      console.error('Error fetching email configs:', err);
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json(rows);
    }
  });
});

// 获取邮箱配置详情（含授权码，内部使用）
app.get('/api/email-configs/:email', function(req, res) {
  const email = req.params.email;
  db.get('SELECT * FROM email_configs WHERE email = ?', [email], function(err, row) {
    if (err) {
      console.error('Error fetching email config:', err);
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json(row);
    }
  });
});

// 提醒日志接口
app.get('/api/purchase-orders/:id/reminder-logs', function(req, res) {
  const id = req.params.id;
  db.all('SELECT * FROM reminderLogs WHERE purchaseOrderId = ? ORDER BY sentTime DESC, created_at DESC', [id], function(err, rows) {
    if (err) {
      console.error('Error fetching reminder logs:', err);
      res.status(500).json({ success: false, error: err.message });
    } else {
      res.json(rows);
    }
  });
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
  const now = getBeijingTime();
  
  db.all('SELECT * FROM reminders WHERE status = ?', ['待提醒'], function(err, pendingReminders) {
    if (err) {
      console.error('Error fetching pending reminders:', err.message);
      return;
    }
    
    if (pendingReminders.length === 0) {
      return;
    }
    
    // 获取邮箱配置（使用内存中的变量）
    if (!emailConfigs || emailConfigs.length === 0) {
      console.error('No email configuration found');
      pendingReminders.forEach(function(reminder) {
        updateReminderStatus(reminder, '发送失败', '未配置邮箱');
      });
      return;
    }
    
    const emailConfig = emailConfigs[0];
    
    // 创建邮件传输器
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpServer,
      port: emailConfig.smtpPort,
      secure: emailConfig.smtpPort === 465,
      auth: {
        user: emailConfig.email,
        pass: emailConfig.authCode
      }
    });
    
    pendingReminders.forEach(function(reminder) {
        // 将前端传入的时间字符串按北京时间解析
        // 前端datetime-local输入的是用户看到的北京时间，格式为 YYYY-MM-DDTHH:mm
        const timeStr = reminder.reminderTime;
        const match = timeStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
        
        if (!match) {
          console.error('Invalid reminder time format:', timeStr);
          return;
        }
        
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // 月份从0开始
        const day = parseInt(match[3]);
        const hour = parseInt(match[4]);
        const minute = parseInt(match[5]);
        
        // 创建北京时间的Date对象（不考虑时区转换）
        const reminderBeijingTime = new Date(year, month, day, hour, minute);
        
        if (now >= reminderBeijingTime) {
          console.log(`[${now.toLocaleString('zh-CN')}] Sending reminder to ${reminder.email}: ${reminder.content}`);
          console.log(`  - Reminder time: ${reminderBeijingTime.toLocaleString('zh-CN')}`);
          console.log(`  - Current time: ${now.toLocaleString('zh-CN')}`);
          
          const mailOptions = {
            from: emailConfig.email,
            to: reminder.email,
            subject: '采购单提醒 - ' + reminder.purchaseOrderId,
            text: reminder.content || '您有一条提醒'
          };
          
          transporter.sendMail(mailOptions, function(err, info) {
            const sentTime = new Date().toISOString();
            let status = '成功';
            let errorMessage = null;
            
            if (err) {
              status = '发送失败';
              errorMessage = err.message;
              console.error('Error sending email:', err.message);
            } else {
              console.log('Email sent successfully:', info.response);
            }
            
            // 记录到reminderLogs
            db.run('INSERT INTO reminderLogs (reminderId, purchaseOrderId, sentTime, email, content, status, errorMessage, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
              [reminder.id, reminder.purchaseOrderId, sentTime, reminder.email, reminder.content, status, errorMessage, sentTime],
              function(err) {
                if (err) {
                  console.error('Error inserting reminder log:', err.message);
                }
              }
            );
            
            // 更新状态为已提醒
            db.run('UPDATE reminders SET status = ?, updated_at = ? WHERE id = ?', 
              [status === '成功' ? '已提醒' : '待提醒', new Date().toISOString(), reminder.id],
              function(err) {
                if (err) {
                  console.error('Error updating reminder status:', err.message);
                }
              }
            );
          });
        }
      });
  });
}

function updateReminderStatus(reminder, status, errorMessage) {
  const sentTime = new Date().toISOString();
  db.run('INSERT INTO reminderLogs (reminderId, purchaseOrderId, sentTime, email, content, status, errorMessage, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [reminder.id, reminder.purchaseOrderId, sentTime, reminder.email, reminder.content || '', status, errorMessage, sentTime],
    function(err) {
      if (err) {
        console.error('Error inserting reminder log:', err.message);
      }
    }
  );
  
  db.run('UPDATE reminders SET status = ?, updated_at = ? WHERE id = ?', 
    ['已提醒', new Date().toISOString(), reminder.id],
    function(err) {
      if (err) {
        console.error('Error updating reminder status:', err.message);
      }
    }
  );
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
