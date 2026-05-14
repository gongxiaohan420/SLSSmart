const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const multer = require('multer');
const app = express();

// multer配置用于文件上传
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// 修复文件名编码问题
function fixFileNameEncoding(fileName) {
  if (!fileName) return fileName;
  
  try {
    // 检测是否为ISO-8859-1编码的乱码
    const isGarbled = /[\x80-\xFF]/.test(fileName) && !/[\u4e00-\u9fa5]/.test(fileName);
    
    if (isGarbled) {
      // 将ISO-8859-1转换为UTF-8
      return Buffer.from(fileName, 'latin1').toString('utf8');
    }
    
    return fileName;
  } catch (e) {
    console.error('Error fixing file name encoding:', e);
    return fileName;
  }
}

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
        db.run('ALTER TABLE customers ADD COLUMN updated_at TEXT', (alterErr) => {
          if (alterErr && !alterErr.message.includes('duplicate column name')) {
            console.log('updated_at column may already exist or error:', alterErr.message);
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
    
    // 数据库迁移：为products表添加description列（如果不存在）
    db.run("ALTER TABLE products ADD COLUMN description TEXT DEFAULT ''", (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        console.log('数据库迁移 - products表已包含description列，无需迁移');
      } else if (!alterErr) {
        console.log('数据库迁移成功 - 已为products表添加description列');
      }
    });
    
    // 数据库迁移：为products表添加communication列（如果不存在）
    db.run("ALTER TABLE products ADD COLUMN communication TEXT DEFAULT ''", (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        console.log('数据库迁移 - products表已包含communication列，无需迁移');
      } else if (!alterErr) {
        console.log('数据库迁移成功 - 已为products表添加communication列');
      }
    });
    
    // 数据库迁移：为products表添加dimensions列（如果不存在）
    db.run("ALTER TABLE products ADD COLUMN dimensions TEXT DEFAULT ''", (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        console.log('数据库迁移 - products表已包含dimensions列，无需迁移');
      } else if (!alterErr) {
        console.log('数据库迁移成功 - 已为products表添加dimensions列');
      }
    });
    
    // 为pi表添加updated_at字段
    db.run("ALTER TABLE pi ADD COLUMN updated_at TEXT", (alterErr) => {
      if (alterErr && !alterErr.message.includes('duplicate column name')) {
        console.log('数据库迁移 - pi表已包含updated_at列，无需迁移');
      } else if (!alterErr) {
        console.log('数据库迁移成功 - 已为pi表添加updated_at列');
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
  '阿富汗': 'AF', '阿尔巴尼亚': 'AL', '阿尔及利亚': 'DZ', '安道尔': 'AD', '安哥拉': 'AO',
  '安提瓜和巴布达': 'AG', '阿根廷': 'AR', '亚美尼亚': 'AM', '澳大利亚': 'AU', '奥地利': 'AT',
  '阿塞拜疆': 'AZ', '巴哈马': 'BS', '巴林': 'BH', '孟加拉国': 'BD', '巴巴多斯': 'BB',
  '白俄罗斯': 'BY', '比利时': 'BE', '伯利兹': 'BZ', '贝宁': 'BJ', '不丹': 'BT',
  '玻利维亚': 'BO', '波斯尼亚和黑塞哥维那': 'BA', '博茨瓦纳': 'BW', '巴西': 'BR', '文莱': 'BN',
  '保加利亚': 'BG', '布基纳法索': 'BF', '布隆迪': 'BI', '柬埔寨': 'KH', '喀麦隆': 'CM',
  '加拿大': 'CA', '佛得角': 'CV', '中非共和国': 'CF', '乍得': 'TD', '智利': 'CL',
  '中国': 'CN', '哥伦比亚': 'CO', '科摩罗': 'KM', '刚果(布)': 'CG', '刚果(金)': 'CD',
  '哥斯达黎加': 'CR', '科特迪瓦': 'CI', '克罗地亚': 'HR', '古巴': 'CU', '塞浦路斯': 'CY',
  '捷克': 'CZ', '丹麦': 'DK', '吉布提': 'DJ', '多米尼克': 'DM', '多米尼加': 'DO',
  '厄瓜多尔': 'EC', '埃及': 'EG', '萨尔瓦多': 'SV', '赤道几内亚': 'GQ', '厄立特里亚': 'ER',
  '爱沙尼亚': 'EE', '埃塞俄比亚': 'ET', '斐济': 'FJ', '芬兰': 'FI', '法国': 'FR',
  '加蓬': 'GA', '冈比亚': 'GM', '格鲁吉亚': 'GE', '德国': 'DE', '加纳': 'GH',
  '希腊': 'GR', '格林纳达': 'GD', '危地马拉': 'GT', '几内亚': 'GN', '几内亚比绍': 'GW',
  '圭亚那': 'GY', '海地': 'HT', '洪都拉斯': 'HN', '匈牙利': 'HU', '冰岛': 'IS',
  '印度': 'IN', '印度尼西亚': 'ID', '伊朗': 'IR', '伊拉克': 'IQ', '爱尔兰': 'IE',
  '以色列': 'IL', '意大利': 'IT', '牙买加': 'JM', '日本': 'JP', '约旦': 'JO',
  '哈萨克斯坦': 'KZ', '肯尼亚': 'KE', '基里巴斯': 'KI', '朝鲜': 'KP', '韩国': 'KR',
  '科威特': 'KW', '吉尔吉斯斯坦': 'KG', '老挝': 'LA', '拉脱维亚': 'LV', '黎巴嫩': 'LB',
  '莱索托': 'LS', '利比里亚': 'LR', '利比亚': 'LY', '列支敦士登': 'LI', '立陶宛': 'LT',
  '卢森堡': 'LU', '马达加斯加': 'MG', '马拉维': 'MW', '马来西亚': 'MY', '马尔代夫': 'MV',
  '马里': 'ML', '马耳他': 'MT', '马绍尔群岛': 'MH', '毛里塔尼亚': 'MR', '毛里求斯': 'MU',
  '墨西哥': 'MX', '密克罗尼西亚': 'FM', '摩尔多瓦': 'MD', '摩纳哥': 'MC', '蒙古': 'MN',
  '黑山': 'ME', '摩洛哥': 'MA', '莫桑比克': 'MZ', '缅甸': 'MM', '纳米比亚': 'NA',
  '瑙鲁': 'NR', '尼泊尔': 'NP', '荷兰': 'NL', '新西兰': 'NZ', '尼加拉瓜': 'NI',
  '尼日尔': 'NE', '尼日利亚': 'NG', '挪威': 'NO', '阿曼': 'OM', '巴基斯坦': 'PK',
  '帕劳': 'PW', '巴拿马': 'PA', '巴布亚新几内亚': 'PG', '巴拉圭': 'PY', '秘鲁': 'PE',
  '菲律宾': 'PH', '波兰': 'PL', '葡萄牙': 'PT', '卡塔尔': 'QA', '罗马尼亚': 'RO',
  '俄罗斯': 'RU', '卢旺达': 'RW', '圣基茨和尼维斯': 'KN', '圣卢西亚': 'LC', '圣文森特和格林纳丁斯': 'VC',
  '萨摩亚': 'WS', '圣马力诺': 'SM', '圣多美和普林西比': 'ST', '沙特阿拉伯': 'SA', '塞内加尔': 'SN',
  '塞尔维亚': 'RS', '塞舌尔': 'SC', '塞拉利昂': 'SL', '新加坡': 'SG', '斯洛伐克': 'SK',
  '斯洛文尼亚': 'SI', '所罗门群岛': 'SB', '索马里': 'SO', '南非': 'ZA', '南苏丹': 'SS',
  '西班牙': 'ES', '斯里兰卡': 'LK', '苏丹': 'SD', '苏里南': 'SR', '斯威士兰': 'SZ',
  '瑞典': 'SE', '瑞士': 'CH', '叙利亚': 'SY', '塔吉克斯坦': 'TJ', '坦桑尼亚': 'TZ',
  '泰国': 'TH', '东帝汶': 'TL', '多哥': 'TG', '汤加': 'TO', '特立尼达和多巴哥': 'TT',
  '突尼斯': 'TN', '土耳其': 'TR', '土库曼斯坦': 'TM', '图瓦卢': 'TV', '乌干达': 'UG',
  '乌克兰': 'UA', '阿联酋': 'AE', '英国': 'GB', '美国': 'US', '乌拉圭': 'UY',
  '乌兹别克斯坦': 'UZ', '瓦努阿图': 'VU', '梵蒂冈': 'VA', '委内瑞拉': 'VE', '越南': 'VN',
  '也门': 'YE', '赞比亚': 'ZM', '津巴布韦': 'ZW'
};

// 默认示例数据
const defaultData = {
  users: [
    { id: 1, username: 'admin', password: 'admin123', role: '管理员' },
    { id: 2, username: 'sales', password: 'sales123', role: '业务员' },
    { id: 3, username: 'purchase', password: 'purchase123', role: '采购员' }
  ],
  customers: [
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
    { id: 2, email: 'karl@slsele.com', authCode: 'bd60nmTelvbsEvDN', smtpServer: 'smtp.exmail.qq.com', smtpPort: 465 }
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

// 根路径 - 重定向到登录页
app.get('/', function(req, res) {
  res.redirect('/login.html');
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
  const search = req.query.search || '';
  let query = `
    SELECT c.*, COALESCE(SUM(p.totalAmount), 0) as totalPurchaseAmount 
    FROM customers c 
    LEFT JOIN pi p ON c.id = p.customerId 
  `;
  let params = [];
  
  if (search) {
    query += ' WHERE c.companyName LIKE ? OR c.contact LIKE ? OR c.country LIKE ?';
    params = [`%${search}%`, `%${search}%`, `%${search}%`];
  }
  
  query += ' GROUP BY c.id ORDER BY COALESCE(c.updated_at, c.created_at) DESC';
  
  db.all(query, params, function(err, rows) {
    if (err) {
      console.error('Error fetching customers:', err);
      res.status(500).json({ error: err.message });
    } else {
      res.json(rows || []);
    }
  });
});

app.get('/api/customers/:id', function(req, res) {
  const query = `
    SELECT c.*, COALESCE(SUM(p.totalAmount), 0) as totalPurchaseAmount 
    FROM customers c 
    LEFT JOIN pi p ON c.id = p.customerId 
    WHERE c.id = ? 
    GROUP BY c.id
  `;
  db.get(query, [req.params.id], function(err, customer) {
    if (err) {
      console.error('Error fetching customer:', err);
      res.status(500).json({ error: err.message });
    } else if (customer) {
      res.json(customer);
    } else {
      res.status(404).json({ error: '客户不存在' });
    }
  });
});

app.post('/api/customers', function(req, res) {
  const companyName = req.body.companyName || '';
  const contact = req.body.contact || '';
  const country = req.body.country || '中国';
  const countryCode = countryCodes[country] || 'CN';
  const companySize = req.body.companySize || '';
  const website = req.body.website || '';
  const email = req.body.email || '';
  const phone = req.body.phone || '';
  const paymentMethod = req.body.paymentMethod || '';
  const otherContact = req.body.otherContact || '';
  const note = req.body.note || '';
  const interestProducts = req.body.interestProducts || '';
  const taxId = req.body.taxId || '';
  const source = req.body.source || '';
  
  db.get('SELECT COUNT(*) as count FROM customers WHERE countryCode = ?', [countryCode], function(err, result) {
    if (err) {
      console.error('Error counting customers:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    const nextNumber = (result.count || 0) + 1;
    const customerId = countryCode + String(nextNumber).padStart(4, '0');
    
    const now = new Date().toISOString();
    db.run('INSERT INTO customers (id, companyName, country, website, contact, email, companySize, created_at, updated_at, countryCode, phone, paymentMethod, otherContact, note, interestProducts, taxId, source, totalPurchaseAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [customerId, companyName, country, website, contact, email, companySize, now, now, countryCode, phone, paymentMethod, otherContact, note, interestProducts, taxId, source, 0],
      function(err) {
        if (err) {
          console.error('Error inserting customer:', err);
          res.status(500).json({ success: false, error: err.message });
        } else {
          res.json({ success: true, id: customerId });
        }
      }
    );
  });
});

app.put('/api/customers/:id', function(req, res) {
  const customerId = req.params.id;
  const countryCode = countryCodes[req.body.country] || 'CN';
  
  db.run('UPDATE customers SET companyName = ?, country = ?, website = ?, contact = ?, email = ?, companySize = ?, countryCode = ?, phone = ?, paymentMethod = ?, otherContact = ?, note = ?, interestProducts = ?, taxId = ?, source = ?, updated_at = ? WHERE id = ?', 
    [req.body.companyName, req.body.country, req.body.website, req.body.contact, req.body.email || '', req.body.companySize, countryCode, req.body.phone || '', req.body.paymentMethod || '', req.body.otherContact || '', req.body.note || '', req.body.interestProducts || '', req.body.taxId || '', req.body.source || '', new Date().toISOString(), customerId], 
    function(err) {
      if (err) {
        console.error('Error updating customer:', err);
        res.status(500).json({ success: false, error: err.message });
      } else if (this.changes > 0) {
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: '客户不存在' });
      }
    }
  );
});

app.delete('/api/customers/:id', function(req, res) {
  const customerId = req.params.id.trim();
  
  db.run('DELETE FROM customers WHERE id = ?', [customerId], function(err) {
    if (err) {
      console.error('Error deleting customer from DB:', err);
      res.status(500).json({ success: false, error: '删除失败：' + err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ success: false, error: '客户不存在' });
      return;
    }
    
    // 更新内存数组
    const customerIndex = customers.findIndex(function(c) { return c.id === customerId; });
    if (customerIndex !== -1) {
      customers.splice(customerIndex, 1);
      saveData();
    }
    
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
      // 解析attachments字段为数组
      const result = suppliers.map(function(supplier) {
        let attachments = [];
        if (supplier.attachments) {
          try {
            attachments = JSON.parse(supplier.attachments);
          } catch (e) {
            // 如果解析失败，可能是旧格式（逗号分隔）
            const oldFiles = supplier.attachments.split(',');
            attachments = oldFiles.filter(f => f.trim()).map(f => ({
              originalName: f,
              storedName: f
            }));
          }
        }
        return Object.assign({}, supplier, { attachments });
      });
      res.json(result);
    }
  });
});

app.get('/api/suppliers/:id', function(req, res) {
  db.get('SELECT * FROM suppliers WHERE id = ?', [req.params.id], function(err, supplier) {
    if (err) {
      console.error('Error fetching supplier:', err);
      res.status(500).json({ error: err.message });
    } else if (supplier) {
      // 解析attachments字段为数组
      let attachments = [];
      if (supplier.attachments) {
        try {
          attachments = JSON.parse(supplier.attachments);
        } catch (e) {
          // 如果解析失败，可能是旧格式（逗号分隔）
          const oldFiles = supplier.attachments.split(',');
          attachments = oldFiles.filter(f => f.trim()).map(f => ({
            originalName: f,
            storedName: f
          }));
        }
      }
      res.json(Object.assign({}, supplier, { attachments }));
    } else {
      res.status(404).json({ error: '供应商不存在' });
    }
  });
});

function getPinyinInitials(text) {
  const pinyinMap = {
    '阿': 'A', '爱': 'A', '安': 'A', '艾': 'A', '奥': 'A',
    '八': 'B', '白': 'B', '百': 'B', '北': 'B', '本': 'B', '博': 'B', '宝': 'B', '保': 'B', '贝': 'B',
    '长': 'C', '常': 'C', '成': 'C', '创': 'C', '春': 'C', '重': 'C', '川': 'C', '慈': 'C',
    '大': 'D', '达': 'D', '东': 'D', '都': 'D', '德': 'D', '点': 'D', '定': 'D', '多': 'D',
    '恩': 'E', '尔': 'E', '二': 'E',
    '发': 'F', '方': 'F', '飞': 'F', '丰': 'F', '福': 'F', '法': 'F', '凡': 'F', '范': 'F',
    '高': 'G', '广': 'G', '国': 'G', '贵': 'G', '光': 'G', '冠': 'G', '管': 'G', '桂': 'G',
    '海': 'H', '杭': 'H', '和': 'H', '恒': 'H', '宏': 'H', '华': 'H', '惠': 'H', '豪': 'H', '合': 'H', '衡': 'H',
    '吉': 'J', '佳': 'J', '建': 'J', '江': 'J', '金': 'J', '精': 'J', '京': 'J', '聚': 'J', '嘉': 'J', '杰': 'J', '捷': 'J', '锦': 'J',
    '康': 'K', '科': 'K', '开': 'K', '凯': 'K', '昆': 'K', '快': 'K', '跨': 'K',
    '来': 'L', '蓝': 'L', '乐': 'L', '力': 'L', '立': 'L', '联': 'L', '龙': 'L', '路': 'L', '雷': 'L', '理': 'L', '利': 'L', '良': 'L', '亮': 'L', '辽': 'L', '鲁': 'L', '陆': 'L', '旅': 'L',
    '美': 'M', '民': 'M', '明': 'M', '马': 'M', '迈': 'M', '茂': 'M', '贸': 'M', '蒙': 'M', '闽': 'M', '名': 'M', '摩': 'M', '墨': 'M',
    '南': 'N', '宁': 'N', '内': 'N', '能': 'N', '年': 'N', '纽': 'N', '诺': 'N',
    '欧': 'O', '偶': 'O',
    '普': 'P', '平': 'P', '鹏': 'P', '蓬': 'P', '浦': 'P', '葡': 'P', '普': 'P',
    '奇': 'Q', '启': 'Q', '强': 'Q', '青': 'Q', '全': 'Q', '千': 'Q', '前': 'Q', '钱': 'Q', '乔': 'Q', '庆': 'Q', '秋': 'Q', '曲': 'Q', '权': 'Q',
    '瑞': 'R', '润': 'R', '日': 'R', '荣': 'R', '融': 'R', '软': 'R',
    '三': 'S', '山': 'S', '上': 'S', '深': 'S', '盛': 'S', '世': 'S', '顺': 'S', '思': 'S', '四': 'S', '松': 'S', '赛': 'S', '森': 'S', '沙': 'S', '厦': 'S', '汕': 'S', '韶': 'S', '邵': 'S', '申': 'S', '神': 'S', '沈': 'S', '什': 'S', '石': 'S', '时': 'S', '市': 'S', '书': 'S', '术': 'S', '树': 'S', '双': 'S', '水': 'S', '顺': 'S', '说': 'S', '司': 'S', '私': 'S', '思': 'S', '斯': 'S', '丝': 'S', '四': 'S', '寺': 'S', '松': 'S', '颂': 'S', '苏': 'S', '速': 'S', '宿': 'S', '肃': 'S', '隋': 'S', '随': 'S', '绥': 'S', '穗': 'S', '孙': 'S', '圳': 'Z',
    '天': 'T', '通': 'T', '台': 'T', '泰': 'T', '太': 'T', '谭': 'T', '汤': 'T', '唐': 'T', '陶': 'T', '腾': 'T', '提': 'T', '体': 'T', '天': 'T', '田': 'T', '铁': 'T', '同': 'T', '童': 'T', '图': 'T', '土': 'T', '拓': 'T',
    '万': 'W', '威': 'W', '维': 'W', '文': 'W', '五': 'W', '王': 'W', '旺': 'W', '网': 'W', '伟': 'W', '位': 'W', '味': 'W', '卫': 'W', '温': 'W', '闻': 'W', '问': 'W', '沃': 'W', '乌': 'W', '无': 'W', '吴': 'W', '武': 'W', '物': 'W', '务': 'W',
    '西': 'X', '喜': 'X', '新': 'X', '信': 'X', '兴': 'X', '星': 'X', '夏': 'X', '仙': 'X', '先': 'X', '贤': 'X', '咸': 'X', '湘': 'X', '襄': 'X', '翔': 'X', '祥': 'X', '想': 'X', '向': 'X', '项': 'X', '萧': 'X', '晓': 'X', '小': 'X', '孝': 'X', '校': 'X', '协': 'X', '携': 'X', '谢': 'X', '心': 'X', '辛': 'X', '欣': 'X', '信': 'X', '兴': 'X', '行': 'X', '星': 'X', '性': 'X', '熊': 'X', '雄': 'X', '休': 'X', '修': 'X', '秀': 'X', '徐': 'X', '许': 'X', '宣': 'X', '玄': 'X', '选': 'X', '学': 'X', '雪': 'X', '寻': 'X', '巡': 'X', '迅': 'X', '逊': 'X',
    '雅': 'Y', '亚': 'Y', '阳': 'Y', '一': 'Y', '益': 'Y', '永': 'Y', '优': 'Y', '宇': 'Y', '元': 'Y', '远': 'Y', '云': 'Y', '延': 'Y', '言': 'Y', '严': 'Y', '研': 'Y', '盐': 'Y', '炎': 'Y', '沿': 'Y', '演': 'Y', '验': 'Y', '雁': 'Y', '燕': 'Y', '央': 'Y', '扬': 'Y', '羊': 'Y', '阳': 'Y', '洋': 'Y', '腰': 'Y', '瑶': 'Y', '药': 'Y', '叶': 'Y', '业': 'Y', '夜': 'Y', '一': 'Y', '伊': 'Y', '衣': 'Y', '医': 'Y', '依': 'Y', '仪': 'Y', '宜': 'Y', '怡': 'Y', '移': 'Y', '遗': 'Y', '乙': 'Y', '已': 'Y', '以': 'Y', '艺': 'Y', '易': 'Y', '邑': 'Y', '益': 'Y', '逸': 'Y', '意': 'Y', '毅': 'Y', '忆': 'Y', '亿': 'Y', '义': 'Y', '议': 'Y', '亦': 'Y', '异': 'Y', '艺': 'Y', '译': 'Y', '驿': 'Y', '谊': 'Y', '逸': 'Y', '翼': 'Y', '因': 'Y', '阴': 'Y', '音': 'Y', '银': 'Y', '引': 'Y', '饮': 'Y', '印': 'Y', '英': 'Y', '樱': 'Y', '鹰': 'Y', '应': 'Y', '缨': 'Y', '影': 'Y', '映': 'Y', '硬': 'Y', '拥': 'Y', '永': 'Y', '勇': 'Y', '用': 'Y', '优': 'Y', '忧': 'Y', '悠': 'Y', '尤': 'Y', '由': 'Y', '犹': 'Y', '油': 'Y', '游': 'Y', '友': 'Y', '有': 'Y', '右': 'Y', '佑': 'Y', '诱': 'Y', '于': 'Y', '余': 'Y', '鱼': 'Y', '娱': 'Y', '渔': 'Y', '雨': 'Y', '语': 'Y', '玉': 'Y', '域': 'Y', '育': 'Y', '郁': 'Y', '遇': 'Y', '御': 'Y', '愈': 'Y', '欲': 'Y', '裕': 'Y', '预': 'Y', '元': 'Y', '园': 'Y', '原': 'Y', '圆': 'Y', '援': 'Y', '源': 'Y', '远': 'Y', '愿': 'Y', '怨': 'Y', '院': 'Y', '约': 'Y', '越': 'Y', '跃': 'Y', '粤': 'Y', '云': 'Y', '运': 'Y', '韵': 'Y', '允': 'Y', '孕': 'Y', '在': 'Z', '再': 'Z', '载': 'Z', '宰': 'Z', '灾': 'Z', '栽': 'Z', '哉': 'Z', '宰': 'Z', '咱': 'Z', '暂': 'Z', '赞': 'Z', '攒': 'Z', '葬': 'Z', '糟': 'Z', '早': 'Z', '枣': 'Z', '澡': 'Z', '藻': 'Z', '灶': 'Z', '造': 'Z', '噪': 'Z', '燥': 'Z', '责': 'Z', '择': 'Z', '则': 'Z', '泽': 'Z', '贼': 'Z', '怎': 'Z', '曾': 'Z', '增': 'Z', '憎': 'Z', '赠': 'Z', '扎': 'Z', '渣': 'Z', '乍': 'Z', '诈': 'Z', '摘': 'Z', '宅': 'Z', '窄': 'Z', '债': 'Z', '占': 'Z', '战': 'Z', '栈': 'Z', '张': 'Z', '章': 'Z', '樟': 'Z', '彰': 'Z', '漳': 'Z', '掌': 'Z', '涨': 'Z', '账': 'Z', '仗': 'Z', '杖': 'Z', '障': 'Z', '招': 'Z', '昭': 'Z', '找': 'Z', '沼': 'Z', '赵': 'Z', '照': 'Z', '罩': 'Z', '肇': 'Z', '遮': 'Z', '折': 'Z', '哲': 'Z', '辄': 'Z', '蛰': 'Z', '者': 'Z', '这': 'Z', '浙': 'Z', '珍': 'Z', '真': 'Z', '甄': 'Z', '臻': 'Z', '针': 'Z', '枕': 'Z', '诊': 'Z', '震': 'Z', '振': 'Z', '镇': 'Z', '争': 'Z', '征': 'Z', '整': 'Z', '正': 'Z', '证': 'Z', '郑': 'Z', '支': 'Z', '知': 'Z', '之': 'Z', '芝': 'Z', '枝': 'Z', '织': 'Z', '职': 'Z', '直': 'Z', '植': 'Z', '值': 'Z', '执': 'Z', '侄': 'Z', '指': 'Z', '止': 'Z', '只': 'Z', '旨': 'Z', '纸': 'Z', '志': 'Z', '制': 'Z', '治': 'Z', '致': 'Z', '智': 'Z', '中': 'Z', '忠': 'Z', '钟': 'Z', '终': 'Z', '种': 'Z', '重': 'Z', '仲': 'Z', '众': 'Z', '舟': 'Z', '周': 'Z', '州': 'Z', '洲': 'Z', '咒': 'Z', '宙': 'Z', '昼': 'Z', '珠': 'Z', '株': 'Z', '蛛': 'Z', '朱': 'Z', '诸': 'Z', '猪': 'Z', '竹': 'Z', '烛': 'Z', '逐': 'Z', '主': 'Z', '助': 'Z', '住': 'Z', '注': 'Z', '祝': 'Z', '著': 'Z', '筑': 'Z', '铸': 'Z', '抓': 'Z', '爪': 'Z', '专': 'Z', '砖': 'Z', '转': 'Z', '撰': 'Z', '赚': 'Z', '篆': 'Z', '庄': 'Z', '装': 'Z', '壮': 'Z', '状': 'Z', '撞': 'Z', '追': 'Z', '椎': 'Z', '锥': 'Z', '坠': 'Z', '缀': 'Z', '准': 'Z', '卓': 'Z', '桌': 'Z', '琢': 'Z', '灼': 'Z', '酌': 'Z', '着': 'Z', '浊': 'Z', '兹': 'Z', '资': 'Z', '姿': 'Z', '滋': 'Z', '子': 'Z', '紫': 'Z', '字': 'Z', '自': 'Z', '仔': 'Z', '走': 'Z', '奏': 'Z', '租': 'Z', '足': 'Z', '族': 'Z', '祖': 'Z', '阻': 'Z', '组': 'Z', '钻': 'Z', '纂': 'Z', '醉': 'Z', '最': 'Z', '罪': 'Z', '尊': 'Z', '遵': 'Z', '昨': 'Z', '左': 'Z', '佐': 'Z', '作': 'Z', '坐': 'Z', '座': 'Z', '做': 'Z'
  };
  
  let initials = '';
  for (let i = 0; i < Math.min(text.length, 2); i++) {
    const char = text[i];
    initials += pinyinMap[char] || 'X';
  }
  return initials;
}

app.post('/api/suppliers', function(req, res) {
  const id = req.body.id || '';
  const name = req.body.name || '';
  
  // 验证必填字段
  if (!name) {
    res.status(400).json({ success: false, error: '供应商名称不能为空' });
    return;
  }
  
  if (!id) {
    res.status(400).json({ success: false, error: '供应商编号不能为空' });
    return;
  }
  
  // 检查编号是否已存在
  db.get('SELECT * FROM suppliers WHERE id = ?', [id], function(err, existing) {
    if (err) {
      console.error('Error checking supplier:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    
    if (existing) {
      res.status(400).json({ success: false, error: '供应商编号已存在' });
      return;
    }
    
    db.run('INSERT INTO suppliers (id, name, companyType, englishName, mainProducts, contact, contactInfo, contactPerson, canInvoice, invoiceThreshold, paymentTerms, website, attachments, note, invoiceStatus, invoiceTax, paymentLink, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [id, name, req.body.companyType || '', req.body.englishName || '', req.body.mainProducts || '', req.body.contact || '', req.body.contactInfo || '', req.body.contactPerson || '', req.body.canInvoice || '', req.body.invoiceThreshold || 0, req.body.paymentTerms || '', req.body.website || '', req.body.attachments || '[]', req.body.note || '', '未开票', req.body.invoiceTax || '', req.body.paymentLink || '', new Date().toISOString()], 
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
  db.run('UPDATE suppliers SET name = ?, companyType = ?, englishName = ?, mainProducts = ?, contact = ?, contactInfo = ?, contactPerson = ?, canInvoice = ?, invoiceThreshold = ?, paymentTerms = ?, website = ?, attachments = ?, note = ?, invoiceTax = ?, paymentLink = ? WHERE id = ?', 
    [req.body.name, req.body.companyType || '', req.body.englishName || '', req.body.mainProducts || '', req.body.contact || '', req.body.contactInfo || '', req.body.contactPerson || '', req.body.canInvoice || '', req.body.invoiceThreshold || 0, req.body.paymentTerms || '', req.body.website || '', req.body.attachments || '[]', req.body.note || '', req.body.invoiceTax || '', req.body.paymentLink || '', req.params.id], 
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
  
  db.run('DELETE FROM suppliers WHERE id = ?', [supplierId], function(err) {
    if (err) {
      console.error('Error deleting supplier from DB:', err);
      res.status(500).json({ success: false, error: '删除失败：' + err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ success: false, error: '供应商不存在' });
      return;
    }
    
    // 更新内存数组
    const supplierIndex = suppliers.findIndex(function(s) { return s.id === supplierId; });
    if (supplierIndex !== -1) {
      suppliers.splice(supplierIndex, 1);
      saveData();
    }
    
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
        originalName: fixFileNameEncoding(f.originalname),
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
  const originalName = fixFileNameEncoding(decodeURIComponent(req.query.originalName || fileName));
  const filePath = path.join(__dirname, 'uploads', fileName);
  
  fs.exists(filePath, function(exists) {
    if (!exists) {
      res.status(404).json({ success: false, error: '文件不存在' });
      return;
    }
    
    res.download(filePath, originalName, function(err) {
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
  const search = req.query.search || '';
  let query = 'SELECT p.*, s.name as supplierName FROM products p LEFT JOIN suppliers s ON p.supplierId = s.id';
  let params = [];
  
  if (search) {
    query += ' WHERE p.id LIKE ? OR p.englishName LIKE ? OR p.chineseName LIKE ?';
    params = ['%' + search + '%', '%' + search + '%', '%' + search + '%'];
  }
  
  db.all(query, params, function(err, products) {
    if (err) {
      console.error('Error fetching products:', err);
      res.status(500).json({ error: err.message });
    } else {
      res.json(products);
    }
  });
});

app.get('/api/products/:id', function(req, res) {
  db.get('SELECT p.*, s.name as supplierName FROM products p LEFT JOIN suppliers s ON p.supplierId = s.id WHERE p.id = ?', [req.params.id], function(err, product) {
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
    const headers = ['产品ID', '英文名称', '中文名称', '销售价(≤100)', '销售价(>100)', '供应商', '采购价', '采购链接', '采购渠道', '描述', '通信方式', '尺寸'];
    
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
    const headers = ['客户ID', '公司名称', '国家', '国家代码', '网站', '联系人', '电子邮箱', '电话', '公司规模', '支付方式', '其他联系方式', '来源', '感兴趣的产品', '税号', '累计采购额', '备注', '创建时间'];
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
    const headers = ['供应商名称', '供应商编号', '公司性质', '公司英文名', '主营产品', '联系人及身份', '联系方式', '供应商负责人', '是否能免费开普票', '开票起点及税点', '付款条款', '网站链接', '备注信息'];
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

// 导入供应商数据
app.post('/api/import/suppliers', upload.single('file'), function(req, res) {
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
      const name = row['供应商名称'] || row['name'] || '';
      const id = row['供应商编号'] || row['id'] || '';
      const companyType = row['公司性质'] || row['companyType'] || '';
      const englishName = row['公司英文名'] || row['englishName'] || '';
      const mainProducts = row['主营产品'] || row['mainProducts'] || '';
      const contact = row['联系人及身份'] || row['contact'] || '';
      const contactInfo = row['联系方式'] || row['contactInfo'] || '';
      const contactPerson = row['供应商负责人'] || row['contactPerson'] || '';
      const canInvoice = row['是否能免费开普票'] || row['canInvoice'] || '';
      const invoiceThreshold = row['开票起点及税点'] || row['invoiceThreshold'] || 0;
      const paymentTerms = row['付款条款'] || row['paymentTerms'] || '';
      const website = row['网站链接'] || row['website'] || '';
      const note = row['备注信息'] || row['note'] || '';
      
      if (!name) {
        errors.push(`第${index + 2}行：供应商名称不能为空`);
        failCount++;
        completed++;
        checkComplete();
        return;
      }
      
      if (!id) {
        errors.push(`第${index + 2}行：供应商编号不能为空`);
        failCount++;
        completed++;
        checkComplete();
        return;
      }
      
      db.get('SELECT * FROM suppliers WHERE id = ?', [id], function(err, existing) {
        if (err) {
          errors.push(`第${index + 2}行：数据库查询错误: ${err.message}`);
          failCount++;
          completed++;
          checkComplete();
        } else if (existing) {
          db.run('UPDATE suppliers SET name = ?, companyType = ?, englishName = ?, mainProducts = ?, contact = ?, contactInfo = ?, contactPerson = ?, canInvoice = ?, invoiceThreshold = ?, paymentTerms = ?, website = ?, note = ? WHERE id = ?',
            [name, companyType, englishName, mainProducts, contact, contactInfo, contactPerson, canInvoice, invoiceThreshold, paymentTerms, website, note, id],
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
          db.run('INSERT INTO suppliers (id, name, companyType, englishName, mainProducts, contact, contactInfo, contactPerson, canInvoice, invoiceThreshold, paymentTerms, website, attachments, note, invoiceStatus, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, name, companyType, englishName, mainProducts, contact, contactInfo, contactPerson, canInvoice, invoiceThreshold, paymentTerms, website, '[]', note, '未开票', new Date().toISOString()],
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
        fs.unlinkSync(req.file.path);
        res.json({ success: true, successCount: successCount, failCount: failCount, errors: errors });
      }
    }
    
    data.forEach((row, index) => {
      processRow(row, index);
    });
    
  } catch (err) {
    console.error('Error importing suppliers:', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
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
      const id = row['客户ID'] || row['id'] || '';
      const companyName = row['公司名称'] || row['companyName'] || '';
      const country = row['国家'] || row['country'] || '中国';
      const countryCode = row['国家代码'] || row['countryCode'] || '';
      const website = row['网站'] || row['website'] || '';
      const contact = row['联系人'] || row['contact'] || '';
      const email = row['电子邮箱'] || row['email'] || '';
      const phone = row['电话'] || row['phone'] || '';
      const companySize = row['公司规模'] || row['companySize'] || '';
      const paymentMethod = row['支付方式'] || row['paymentMethod'] || '';
      const otherContact = row['其他联系方式'] || row['otherContact'] || '';
      const source = row['来源'] || row['source'] || '';
      const interestProducts = row['感兴趣的产品'] || row['interestProducts'] || '';
      const taxId = row['税号'] || row['taxId'] || '';
      const totalPurchaseAmount = parseFloat(row['累计采购额'] || row['totalPurchaseAmount'] || 0);
      const note = row['备注'] || row['note'] || '';
      const created_at = row['创建时间'] || row['created_at'] || '';
      
      if (!companyName) {
        errors.push(`第${index + 2}行：公司名称不能为空`);
        failCount++;
        completed++;
        checkComplete();
        return;
      }
      
      const finalCountryCode = countryCode || (countryCodes[country] || 'CN');
      db.get('SELECT * FROM customers WHERE companyName = ?', [companyName], function(err, existing) {
        if (err) {
          errors.push(`第${index + 2}行：数据库查询错误: ${err.message}`);
          failCount++;
          completed++;
          checkComplete();
        } else if (existing) {
          db.run('UPDATE customers SET country = ?, website = ?, contact = ?, email = ?, companySize = ?, countryCode = ?, phone = ?, paymentMethod = ?, otherContact = ?, note = ?, interestProducts = ?, taxId = ?, source = ?, totalPurchaseAmount = ? WHERE id = ?',
            [country, website, contact, email, companySize, finalCountryCode, phone, paymentMethod, otherContact, note, interestProducts, taxId, source, totalPurchaseAmount, existing.id],
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
          const finalId = id || (() => {
            const nextNumber = 1;
            return finalCountryCode + String(nextNumber).padStart(4, '0');
          })();
          db.run('INSERT INTO customers (id, companyName, country, website, contact, email, companySize, created_at, countryCode, phone, paymentMethod, otherContact, note, interestProducts, taxId, source, totalPurchaseAmount) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [finalId, companyName, country, website, contact, email, companySize, created_at || new Date().toISOString(), finalCountryCode, phone, paymentMethod, otherContact, note, interestProducts, taxId, source, totalPurchaseAmount],
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
      const description = row['描述'] || row['description'] || '';
      const communication = row['通信方式'] || row['communication'] || '';
      const dimensions = row['尺寸'] || row['dimensions'] || '';
      
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
          db.run('UPDATE products SET englishName = ?, chineseName = ?, salesPriceLess100 = ?, salesPriceMore100 = ?, supplierName = ?, purchasePriceLess100 = ?, purchasePriceMore100 = ?, purchaseLink = ?, purchaseChannel = ?, description = ?, communication = ?, dimensions = ? WHERE id = ?',
            [englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierName, purchasePrice, purchasePrice, purchaseLink, purchaseChannel, description, communication, dimensions, existing.id],
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
          db.run('INSERT INTO products (id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierName, purchasePriceLess100, purchasePriceMore100, purchaseLink, purchaseChannel, description, communication, dimensions, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierName, purchasePrice, purchasePrice, purchaseLink, purchaseChannel, description, communication, dimensions, new Date().toISOString()],
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
  const id = req.body.id || ('P' + Date.now());
  db.run('INSERT INTO products (id, chineseName, englishName, salesPriceLess100, salesPriceMore100, supplierId, purchasePrice, purchaseLink, purchaseChannel, description, communication, dimensions, features, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
    [id, req.body.chineseName, req.body.englishName, req.body.salesPriceLess100 || 0, req.body.salesPriceMore100 || 0, req.body.supplierId || '', req.body.purchasePrice || 0, req.body.purchaseLink || '', req.body.purchaseChannel || '', req.body.description || '', req.body.communication || '', req.body.dimensions || '', req.body.features || '', new Date().toISOString()], 
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

app.put('/api/products/:id', function(req, res) {
  db.run('UPDATE products SET englishName = ?, chineseName = ?, salesPriceLess100 = ?, salesPriceMore100 = ?, supplierId = ?, purchasePrice = ?, purchaseLink = ?, purchaseChannel = ?, features = ?, description = ?, communication = ?, dimensions = ? WHERE id = ?', 
    [req.body.englishName, req.body.chineseName, req.body.salesPriceLess100, req.body.salesPriceMore100, req.body.supplierId || '', req.body.purchasePrice || 0, req.body.purchaseLink || '', req.body.purchaseChannel || '', req.body.features || '', req.body.description || '', req.body.communication || '', req.body.dimensions || '', req.params.id], 
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
  
  db.run('DELETE FROM products WHERE id = ?', [productId], function(err) {
    if (err) {
      console.error('Error deleting product from DB:', err);
      res.status(500).json({ success: false, error: '删除失败：' + err.message });
      return;
    }
    
    if (this.changes === 0) {
      res.status(404).json({ success: false, error: '产品不存在' });
      return;
    }
    
    // 更新内存数组
    const productIndex = products.findIndex(function(p) { return p.id === productId; });
    if (productIndex !== -1) {
      products.splice(productIndex, 1);
      saveData();
    }
    
    res.json({ success: true });
  });
});

// 销售报价单（PI）相关接口
app.get('/api/pi', function(req, res) {
  db.all('SELECT * FROM pi ORDER BY COALESCE(updated_at, created_at) DESC', function(err, piOrders) {
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
  
  console.log('PI Creation Request:', req.body);
  
  // 生成日期部分：年月日
  const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  
  // 查询当天已创建的PI数量
  db.get('SELECT COUNT(*) as count FROM pi WHERE id LIKE ?', ['PI' + dateStr + '%'], function(err, result) {
    if (err) {
      console.error('Error counting PI:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    
    // 生成四位流水号
    const seq = String((result.count || 0) + 1).padStart(4, '0');
    const piId = 'PI' + dateStr + seq;
    
    const nowStr = now.toISOString();
    db.run('INSERT INTO pi (id, customerId, customerName, products, totalAmount, note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [piId, req.body.customerId, req.body.customerName, products, req.body.totalAmount, req.body.note, req.body.status || '待处理', nowStr, nowStr], 
      function(err) {
        if (err) {
          console.error('Error inserting PI:', err);
          res.status(500).json({ success: false, error: err.message });
        } else {
          res.json({ success: true, id: piId });
        }
      }
    );
  });
});

app.put('/api/pi/:id', function(req, res) {
  const products = JSON.stringify(req.body.products || []);
  db.run('UPDATE pi SET customerId = ?, customerName = ?, products = ?, totalAmount = ?, note = ?, status = ?, updated_at = ? WHERE id = ?', 
    [req.body.customerId, req.body.customerName, products, req.body.totalAmount, req.body.note, req.body.status, new Date().toISOString(), req.params.id], 
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
  
  // 生成日期部分：年月日
  const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  
  // 查询当天已创建的PI数量
  db.get('SELECT COUNT(*) as count FROM pi WHERE id LIKE ?', ['PI' + dateStr + '%'], function(err, result) {
    if (err) {
      console.error('Error counting PI:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    
    // 生成四位流水号
    const seq = String((result.count || 0) + 1).padStart(4, '0');
    const piId = 'PI' + dateStr + seq;
    
    const nowStr = now.toISOString();
    db.run('INSERT INTO pi (id, customerId, customerName, products, totalAmount, note, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [piId, req.body.customerId, req.body.customerName, products, req.body.totalAmount, req.body.note, req.body.status || '待处理', nowStr, nowStr], 
      function(err) {
        if (err) {
          console.error('Error inserting PI:', err);
          res.status(500).json({ success: false, error: err.message });
        } else {
          res.json({ success: true, id: piId });
        }
      }
    );
  });
});

app.put('/api/pi-orders/:id', function(req, res) {
  const products = JSON.stringify(req.body.products || []);
  db.run('UPDATE pi SET customerId = ?, customerName = ?, products = ?, totalAmount = ?, note = ?, status = ?, updated_at = ? WHERE id = ?', 
    [req.body.customerId, req.body.customerName, products, req.body.totalAmount, req.body.note, req.body.status, new Date().toISOString(), req.params.id], 
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
      let products = [];
      if (order.products) {
        try {
          products = JSON.parse(order.products);
        } catch (e) {
          products = [];
        }
      }
      
      // 解析trackingNumbers字段为数组
      let trackingNumbers = [];
      if (order.trackingNumbers) {
        try {
          trackingNumbers = JSON.parse(order.trackingNumbers);
        } catch (e) {
          trackingNumbers = [];
        }
      }
      
      // 构建新对象，确保所有字段正确序列化（只返回数据库中存在的字段）
      const result = {
        id: order.id,
        piId: order.piId,
        supplierId: order.supplierId,
        supplierName: order.supplierName,
        products: products,
        totalAmount: order.totalAmount,
        status: order.status,
        created_at: order.created_at,
        note: order.note || '',
        piCustomerName: order.piCustomerName || '',
        piTotalAmount: order.piTotalAmount || '',
        piCreatedAt: order.piCreatedAt || '',
        dataSource: order.dataSource || '',
        trackingNumbers: trackingNumbers
      };
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
  
  // 从数据库中查找PI订单
  db.get('SELECT * FROM pi WHERE id = ?', [piId], function(err, piOrder) {
    if (err) {
      console.error('Error fetching PI order:', err);
      res.status(500).json({ success: false, error: '查询PI订单失败：' + err.message });
      return;
    }
    
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
      const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
      
      // 查询当天已创建的采购单，获取最大流水号
      db.get('SELECT id FROM purchaseOrders WHERE id LIKE ? ORDER BY id DESC LIMIT 1', ['CG' + dateStr + '%'], function(err, result) {
        if (err) {
          callback(err);
          return;
        }
        
        let seq = 1;
        if (result && result.id) {
          // 提取流水号部分
          const seqStr = result.id.slice(-3);
          seq = parseInt(seqStr, 10) + 1;
        }
        
        const poId = 'CG' + dateStr + String(seq).padStart(3, '0');
        
        // 查找产品信息
        db.get('SELECT * FROM products WHERE id = ?', [product.productId], function(err, productInfo) {
          if (err) {
            callback(err);
            return;
          }
          
          const purchasePrice = product.purchasePrice || (productInfo ? (productInfo.purchasePriceLess100 || productInfo.purchasePriceMore100 || productInfo.purchasePrice) : 0);
          const productName = productInfo ? (productInfo.chineseName || productInfo.englishName || product.productId) : product.productId;
          const chineseName = productInfo ? productInfo.chineseName : '';
          
          const poProducts = [{
            productId: product.productId,
            productName: productName,
            chineseName: chineseName,
            quantity: product.quantity,
            purchasePrice: purchasePrice
          }];
          
          const totalAmount = product.quantity * purchasePrice;
          
          // 从产品表中获取供应商信息
          const supplierId = productInfo ? productInfo.supplierId : '';
          const productSupplierName = productInfo ? productInfo.supplierName : '';
          
          if (supplierId) {
            db.get('SELECT name FROM suppliers WHERE id = ?', [supplierId], function(err, supplier) {
              // 优先使用供应商表中的名称，如果查询不到则使用产品表中的名称
              const supplierName = supplier ? supplier.name : (productSupplierName || '');
              
              // 创建采购订单
              db.run('INSERT INTO purchaseOrders (id, piId, supplierId, supplierName, products, totalAmount, status, note, created_at, piCustomerName, piTotalAmount, piCreatedAt, dataSource) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                [poId, piId, supplierId, supplierName, JSON.stringify(poProducts), totalAmount, '待处理', '', now.toISOString(), piOrder.customerName || '', piOrder.totalAmount || 0, piOrder.created_at || '', '从PI单中生成'], 
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
          } else {
            // 如果没有supplierId，使用产品表中的supplierName
            const supplierName = productSupplierName || '';
            
            // 创建采购订单
            db.run('INSERT INTO purchaseOrders (id, piId, supplierId, supplierName, products, totalAmount, status, note, created_at, piCustomerName, piTotalAmount, piCreatedAt, dataSource) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
              [poId, piId, supplierId || '', supplierName, JSON.stringify(poProducts), totalAmount, '待处理', '', now.toISOString(), piOrder.customerName || '', piOrder.totalAmount || 0, piOrder.created_at || '', '从PI单中生成'], 
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
          }
        });
      });
    }
    
    // 串行创建每个产品的采购订单
    if (piProducts.length === 0) {
      res.json({ success: true, count: 0 });
      return;
    }
    
    // 串行执行采购单创建，确保ID唯一性
    function processNext(index) {
      if (index >= piProducts.length) {
        res.json({ success: true, count: generatedCount });
        return;
      }
      
      createPurchaseOrder(piProducts[index], index, function(err) {
        if (err) {
          res.status(500).json({ success: false, error: '生成采购单失败：' + err.message });
        } else {
          processNext(index + 1);
        }
      });
    }
    
    processNext(0);
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

// 添加快递单号
app.put('/api/purchase-orders/:id/tracking', function(req, res) {
  const id = req.params.id;
  const trackingInfo = req.body.trackingInfo;
  
  if (!trackingInfo || !trackingInfo.company || !trackingInfo.number) {
    res.status(400).json({ success: false, error: '快递信息不完整' });
    return;
  }
  
  db.get('SELECT trackingNumbers FROM purchaseOrders WHERE id = ?', [id], function(err, order) {
    if (err) {
      console.error('Error fetching purchase order:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    
    if (!order) {
      res.status(404).json({ success: false, error: '采购单不存在' });
      return;
    }
    
    let trackingNumbers = [];
    try {
      trackingNumbers = JSON.parse(order.trackingNumbers || '[]');
    } catch (e) {
      trackingNumbers = [];
    }
    
    trackingNumbers.push({
      company: trackingInfo.company,
      number: trackingInfo.number,
      addedAt: new Date().toISOString()
    });
    
    db.run('UPDATE purchaseOrders SET trackingNumbers = ? WHERE id = ?', 
      [JSON.stringify(trackingNumbers), id], 
      function(err) {
        if (err) {
          console.error('Error updating tracking numbers:', err);
          res.status(500).json({ success: false, error: err.message });
        } else if (this.changes > 0) {
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: '采购单不存在' });
        }
      }
    );
  });
});

// 删除快递单号
app.delete('/api/purchase-orders/:id/tracking/:index', function(req, res) {
  const id = req.params.id;
  const index = parseInt(req.params.index);
  
  if (isNaN(index)) {
    res.status(400).json({ success: false, error: '无效的索引' });
    return;
  }
  
  db.get('SELECT trackingNumbers FROM purchaseOrders WHERE id = ?', [id], function(err, order) {
    if (err) {
      console.error('Error fetching purchase order:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    
    if (!order) {
      res.status(404).json({ success: false, error: '采购单不存在' });
      return;
    }
    
    let trackingNumbers = [];
    try {
      trackingNumbers = JSON.parse(order.trackingNumbers || '[]');
    } catch (e) {
      trackingNumbers = [];
    }
    
    if (index < 0 || index >= trackingNumbers.length) {
      res.status(400).json({ success: false, error: '索引超出范围' });
      return;
    }
    
    trackingNumbers.splice(index, 1);
    
    db.run('UPDATE purchaseOrders SET trackingNumbers = ? WHERE id = ?', 
      [JSON.stringify(trackingNumbers), id], 
      function(err) {
        if (err) {
          console.error('Error updating tracking numbers:', err);
          res.status(500).json({ success: false, error: err.message });
        } else if (this.changes > 0) {
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: '采购单不存在' });
        }
      }
    );
  });
});

// 更新快递单号
app.put('/api/purchase-orders/:id/tracking/:index', function(req, res) {
  const id = req.params.id;
  const index = parseInt(req.params.index);
  const trackingInfo = req.body.trackingInfo;
  
  if (isNaN(index)) {
    res.status(400).json({ success: false, error: '无效的索引' });
    return;
  }
  
  if (!trackingInfo || !trackingInfo.company || !trackingInfo.number) {
    res.status(400).json({ success: false, error: '快递信息不完整' });
    return;
  }
  
  db.get('SELECT trackingNumbers FROM purchaseOrders WHERE id = ?', [id], function(err, order) {
    if (err) {
      console.error('Error fetching purchase order:', err);
      res.status(500).json({ success: false, error: err.message });
      return;
    }
    
    if (!order) {
      res.status(404).json({ success: false, error: '采购单不存在' });
      return;
    }
    
    let trackingNumbers = [];
    try {
      trackingNumbers = JSON.parse(order.trackingNumbers || '[]');
    } catch (e) {
      trackingNumbers = [];
    }
    
    if (index < 0 || index >= trackingNumbers.length) {
      res.status(400).json({ success: false, error: '索引超出范围' });
      return;
    }
    
    trackingNumbers[index] = {
      company: trackingInfo.company,
      number: trackingInfo.number,
      addedAt: trackingNumbers[index].addedAt || new Date().toISOString()
    };
    
    db.run('UPDATE purchaseOrders SET trackingNumbers = ? WHERE id = ?', 
      [JSON.stringify(trackingNumbers), id], 
      function(err) {
        if (err) {
          console.error('Error updating tracking numbers:', err);
          res.status(500).json({ success: false, error: err.message });
        } else if (this.changes > 0) {
          res.json({ success: true });
        } else {
          res.status(404).json({ success: false, error: '采购单不存在' });
        }
      }
    );
  });
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
  const { purchaseOrderId, reminderTime, content, email, fromEmail } = req.body;
  db.run('INSERT INTO reminders (purchaseOrderId, reminderTime, content, email, fromEmail, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 
    [purchaseOrderId, reminderTime, content, email, fromEmail, '待提醒', new Date().toISOString()], 
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
  const { reminderTime, content, email, fromEmail } = req.body;
  db.run('UPDATE reminders SET reminderTime = ?, content = ?, email = ?, fromEmail = ?, updated_at = ? WHERE id = ?', 
    [reminderTime, content, email, fromEmail, new Date().toISOString(), id], 
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
    
    pendingReminders.forEach(function(reminder) {
      // 根据提醒的 fromEmail 查找对应的邮箱配置
      const emailConfig = reminder.fromEmail 
        ? emailConfigs.find(config => config.email === reminder.fromEmail) 
        : emailConfigs[0];
      
      if (!emailConfig) {
        console.error('Email configuration not found for:', reminder.fromEmail);
        updateReminderStatus(reminder, '发送失败', '未找到对应的邮箱配置');
        return;
      }
      
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
            db.run('INSERT INTO reminderLogs (reminderId, purchaseOrderId, sentTime, fromEmail, email, content, status, errorMessage, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
              [reminder.id, reminder.purchaseOrderId, sentTime, reminder.fromEmail, reminder.email, reminder.content, status, errorMessage, sentTime],
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
            
            // 关闭transporter
            transporter.close();
          });
        }
      });
  });
}

function updateReminderStatus(reminder, status, errorMessage) {
  const sentTime = new Date().toISOString();
  db.run('INSERT INTO reminderLogs (reminderId, purchaseOrderId, sentTime, fromEmail, email, content, status, errorMessage, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
    [reminder.id, reminder.purchaseOrderId, sentTime, reminder.fromEmail || '', reminder.email, reminder.content || '', status, errorMessage, sentTime],
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
