const express = require('express');
const XLSX = require('xlsx');
const initSqlJs = require('sql.js');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

// 创建必要的目录
const uploadsDir = path.join(__dirname, '../uploads');
const attachmentsDir = path.join(uploadsDir, 'supplier-attachments');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
  }
  if (!fs.existsSync(attachmentsDir)) {
    fs.mkdirSync(attachmentsDir, { recursive: true });
    console.log('Created supplier-attachments directory');
  }
} catch (err) {
  console.error('Error creating directories:', err.message);
}

const upload = multer({ dest: uploadsDir });

// 创建邮件传输器
const transporter = nodemailer.createTransport({
  host: 'smtp.163.com',
  port: 465,
  secure: true,
  auth: {
    user: 'gxhan0420@163.com',
    pass: 'RGhwVqeQbTxVXTeE'
  }
});

// 数据库路径
const dbPath = path.join(__dirname, 'database.db');
console.log('Database path:', dbPath);

let db = null;

// 数据库初始化函数
async function initDatabase(callback) {
  console.log('Starting database initialization...');
  
  const SQL = await initSqlJs();
  
  // 检查数据库文件是否存在
  let fileBuffer = null;
  try {
    fileBuffer = fs.readFileSync(dbPath);
    console.log('Loading existing database');
  } catch (err) {
    console.log('Creating new database');
  }
  
  if (fileBuffer) {
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  
  // 检查表是否存在，并升级现有表结构
  function upgradeTable(tableName, columnsToAdd) {
    try {
      const result = db.exec(`PRAGMA table_info(${tableName})`);
      if (result && result.length > 0) {
        const existingColumns = result[0].values.map(row => row[1]);
        columnsToAdd.forEach(col => {
          if (!existingColumns.includes(col.name)) {
            try {
              db.run(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.type}`);
              console.log(`Added column ${col.name} to ${tableName}`);
            } catch (err) {
              console.error(`Error adding column ${col.name} to ${tableName}:`, err.message);
            }
          }
        });
      }
    } catch (err) {
      console.error(`Error checking table ${tableName}:`, err.message);
    }
  }
  
  // 升级 customers 表
  upgradeTable('customers', [
    { name: 'countryCode', type: 'TEXT' },
    { name: 'website', type: 'TEXT' }
  ]);
  
  // 升级 products 表
  upgradeTable('products', [
    { name: 'purchaseChannel', type: 'TEXT' }
  ]);
  
  // 升级 purchaseOrders 表
  upgradeTable('purchaseOrders', [
    { name: 'dataSource', type: 'TEXT' }
  ]);
  
  const tables = [
    {
      name: 'users',
      sql: `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      )`
    },
    {
      name: 'suppliers',
      sql: `CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        name TEXT,
        companyType TEXT,
        mainProducts TEXT,
        contact TEXT,
        contactInfo TEXT,
        canInvoice TEXT,
        invoiceThreshold REAL,
        paymentLink TEXT,
        note TEXT,
        created_at TEXT,
        invoiceStatus TEXT,
        attachments TEXT
      )`
    },
    {
      name: 'products',
      sql: `CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        englishName TEXT,
        chineseName TEXT,
        salesPriceLess100 REAL,
        salesPriceMore100 REAL,
        supplierId TEXT,
        supplierName TEXT,
        purchasePriceLess100 REAL,
        purchasePriceMore100 REAL,
        purchaseLink TEXT,
        purchaseChannel TEXT,
        features TEXT,
        created_at TEXT
      )`
    },
    {
      name: 'customers',
      sql: `CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        companyName TEXT UNIQUE,
        companyShortName TEXT,
        contact TEXT,
        country TEXT,
        countryCode TEXT,
        website TEXT,
        companySize TEXT,
        created_at TEXT
      )`
    },
    {
      name: 'inventory',
      sql: `CREATE TABLE IF NOT EXISTS inventory (
        productId TEXT PRIMARY KEY,
        englishName TEXT,
        chineseName TEXT,
        quantity INTEGER,
        warehouse TEXT,
        created_at TEXT
      )`
    },
    {
      name: 'pi',
      sql: `CREATE TABLE IF NOT EXISTS pi (
        id TEXT PRIMARY KEY,
        customerId TEXT,
        customerName TEXT,
        products TEXT,
        totalAmount REAL,
        note TEXT,
        status TEXT,
        created_at TEXT
      )`
    },
    {
      name: 'purchaseOrders',
      sql: `CREATE TABLE IF NOT EXISTS purchaseOrders (
        id TEXT PRIMARY KEY,
        piId TEXT,
        supplierId TEXT,
        supplierName TEXT,
        products TEXT,
        totalAmount REAL,
        status TEXT,
        created_at TEXT,
        updated_at TEXT,
        purchaseNote TEXT,
        invoiceNote TEXT,
        trackingNumbers TEXT,
        dataSource TEXT
      )`
    },
    {
      name: 'reminders',
      sql: `CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchaseOrderId TEXT,
        reminderTime TEXT,
        content TEXT,
        email TEXT,
        status TEXT,
        created_at TEXT,
        updated_at TEXT
      )`
    },
    {
      name: 'email_configs',
      sql: `CREATE TABLE IF NOT EXISTS email_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        host TEXT,
        port INTEGER,
        secure INTEGER,
        user TEXT,
        pass TEXT,
        created_at TEXT
      )`
    },
    {
      name: 'reminder_logs',
      sql: `CREATE TABLE IF NOT EXISTS reminder_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        purchaseOrderId TEXT,
        action TEXT,
        content TEXT,
        created_at TEXT
      )`
    }
  ];

  let createdCount = 0;
  
  function createTable(index) {
    if (index >= tables.length) {
      console.log('All tables created successfully');
      insertDefaultData(callback);
      return;
    }
    
    const table = tables[index];
    try {
      db.run(table.sql);
      console.log(`Created ${table.name} table`);
    } catch (err) {
      console.error(`Error creating ${table.name} table:`, err.message);
    }
    createdCount++;
    createTable(index + 1);
  }
  
  createTable(0);
}

function insertDefaultData(callback) {
  console.log('Inserting default data...');
  
  const defaultData = [
    {
      table: 'users',
      sql: `INSERT OR IGNORE INTO users (username, password, role) VALUES
        ('sales', 'sales123', '业务员'),
        ('purchase', 'purchase123', '采购员')`
    },
    {
      table: 'suppliers',
      sql: `INSERT OR IGNORE INTO suppliers (id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note, created_at) VALUES
        ('SUP001', '测试供应商', '工厂', '电子产品', '张三', '13800138000', '是', 1000, '', '测试供应商', datetime('now'))`
    },
    {
      table: 'products',
      sql: `INSERT OR IGNORE INTO products (id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName, purchasePriceLess100, purchasePriceMore100, purchaseLink, features, created_at) VALUES
        ('PRO001', 'Test Product', '测试产品', 100, 95, 'SUP001', '测试供应商', 80, 75, '', '测试产品特性', datetime('now'))`
    },
    {
      table: 'customers',
      sql: `INSERT OR IGNORE INTO customers (id, companyName, companyShortName, contact, country, countryCode, website, companySize, created_at) VALUES
        ('CN0001', '测试客户公司', '测试客户', '李四', '中国', 'CN', '', '中型', datetime('now'))`
    },
    {
      table: 'inventory',
      sql: `INSERT OR IGNORE INTO inventory (productId, englishName, chineseName, quantity, warehouse, created_at) VALUES
        ('PRO001', 'Test Product', '测试产品', 100, '主仓库', datetime('now'))`
    },
    {
      table: 'email_configs',
      sql: `INSERT OR IGNORE INTO email_configs (host, port, secure, user, pass, created_at) VALUES
        ('smtp.163.com', 465, 1, 'gxhan0420@163.com', 'RGhwVqeQbTxVXTeE', datetime('now'))`
    }
  ];
  
  let insertedCount = 0;
  
  function insertData(index) {
    if (index >= defaultData.length) {
      console.log('Default data inserted successfully');
      // 保存数据库到文件
      try {
        const data = db.export();
        fs.writeFileSync(dbPath, Buffer.from(data));
        console.log('Database saved to file');
      } catch (err) {
        console.error('Error saving database:', err.message);
      }
      if (callback) callback();
      return;
    }
    
    const data = defaultData[index];
    try {
      db.run(data.sql);
      console.log(`Inserted default data into ${data.table}`);
    } catch (err) {
      console.error(`Error inserting into ${data.table}:`, err.message);
    }
    insertedCount++;
    insertData(index + 1);
  }
  
  insertData(0);
}

const app = express();
const PORT = process.env.PORT || 4000;

// 中间件
app.use(express.static(path.join(__dirname, '..')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 支持
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, username, password');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// 数据库操作封装
function query(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    const result = stmt.getAsObject ? stmt.all(params) : stmt.run(params);
    if (result && Array.isArray(result)) {
      return result;
    }
    // sql.js 返回的是对象数组，需要处理
    const columns = stmt.getColumnNames ? stmt.getColumnNames() : [];
    const rows = [];
    let row;
    if (stmt.step) {
      while ((row = stmt.getAsObject ? stmt.getAsObject() : stmt.get())) {
        rows.push(row);
        stmt.step();
      }
    }
    stmt.free();
    return rows;
  } catch (err) {
    // 尝试简单查询
    try {
      const result = db.exec(sql, params);
      if (result && result.length > 0 && result[0].values) {
        const columns = result[0].columns || [];
        return result[0].values.map(row => {
          const obj = {};
          row.forEach((val, idx) => {
            obj[columns[idx]] = val;
          });
          return obj;
        });
      }
      return [];
    } catch (e) {
      throw e;
    }
  }
}

function run(sql, params = []) {
  try {
    db.run(sql, params);
    // 保存数据库到文件
    try {
      const data = db.export();
      fs.writeFileSync(dbPath, Buffer.from(data));
    } catch (err) {
      console.error('Error saving database:', err.message);
    }
    return { lastID: db.getRowsModified ? db.getRowsModified() : 0, changes: 1 };
  } catch (err) {
    throw err;
  }
}

// ISO 3166-1 Alpha-2 国家代码与中文名称映射
const countryCodes = {
  'AF': '阿富汗', 'AX': '奥兰群岛', 'AL': '阿尔巴尼亚', 'DZ': '阿尔及利亚',
  'AS': '美属萨摩亚', 'AD': '安道尔', 'AO': '安哥拉', 'AI': '安圭拉',
  'AQ': '南极洲', 'AG': '安提瓜和巴布达', 'AR': '阿根廷', 'AM': '亚美尼亚',
  'AW': '阿鲁巴', 'AU': '澳大利亚', 'AT': '奥地利', 'AZ': '阿塞拜疆',
  'BS': '巴哈马', 'BH': '巴林', 'BD': '孟加拉国', 'BB': '巴巴多斯',
  'BY': '白俄罗斯', 'BE': '比利时', 'BZ': '伯利兹', 'BJ': '贝宁',
  'BM': '百慕大', 'BT': '不丹', 'BO': '玻利维亚', 'BQ': '博奈尔',
  'BA': '波斯尼亚和黑塞哥维那', 'BW': '博茨瓦纳', 'BV': '布维岛',
  'BR': '巴西', 'IO': '英属印度洋领地', 'BN': '文莱', 'BG': '保加利亚',
  'BF': '布基纳法索', 'BI': '布隆迪', 'CV': '佛得角', 'KH': '柬埔寨',
  'CM': '喀麦隆', 'CA': '加拿大', 'KY': '开曼群岛', 'CF': '中非共和国',
  'TD': '乍得', 'CL': '智利', 'CN': '中国', 'CX': '圣诞岛',
  'CC': '科科斯群岛', 'CO': '哥伦比亚', 'KM': '科摩罗', 'CG': '刚果',
  'CD': '刚果（金）', 'CK': '库克群岛', 'CR': '哥斯达黎加',
  'CI': '科特迪瓦', 'HR': '克罗地亚', 'CU': '古巴', 'CW': '库拉索',
  'CY': '塞浦路斯', 'CZ': '捷克', 'DK': '丹麦', 'DJ': '吉布提',
  'DM': '多米尼克', 'DO': '多米尼加共和国', 'EC': '厄瓜多尔', 'EG': '埃及',
  'SV': '萨尔瓦多', 'GQ': '赤道几内亚', 'ER': '厄立特里亚', 'EE': '爱沙尼亚',
  'SZ': '斯威士兰', 'ET': '埃塞俄比亚', 'FK': '福克兰群岛', 'FO': '法罗群岛',
  'FJ': '斐济', 'FI': '芬兰', 'FR': '法国', 'GF': '法属圭亚那',
  'PF': '法属波利尼西亚', 'TF': '法属南部领地', 'GA': '加蓬', 'GM': '冈比亚',
  'GE': '格鲁吉亚', 'DE': '德国', 'GH': '加纳', 'GI': '直布罗陀',
  'GR': '希腊', 'GL': '格陵兰', 'GD': '格林纳达', 'GP': '瓜德罗普',
  'GU': '关岛', 'GT': '危地马拉', 'GG': '根西岛', 'GN': '几内亚',
  'GW': '几内亚比绍', 'GY': '圭亚那', 'HT': '海地', 'HM': '赫德岛和麦克唐纳群岛',
  'VA': '梵蒂冈', 'HN': '洪都拉斯', 'HK': '中国香港', 'HU': '匈牙利',
  'IS': '冰岛', 'IN': '印度', 'ID': '印度尼西亚', 'IR': '伊朗',
  'IQ': '伊拉克', 'IE': '爱尔兰', 'IM': '马恩岛', 'IL': '以色列',
  'IT': '意大利', 'JM': '牙买加', 'JP': '日本', 'JE': '泽西岛',
  'JO': '约旦', 'KZ': '哈萨克斯坦', 'KE': '肯尼亚', 'KI': '基里巴斯',
  'KP': '朝鲜', 'KR': '韩国', 'KW': '科威特', 'KG': '吉尔吉斯斯坦',
  'LA': '老挝', 'LV': '拉脱维亚', 'LB': '黎巴嫩', 'LS': '莱索托',
  'LR': '利比里亚', 'LY': '利比亚', 'LI': '列支敦士登', 'LT': '立陶宛',
  'LU': '卢森堡', 'MO': '中国澳门', 'MG': '马达加斯加', 'MW': '马拉维',
  'MY': '马来西亚', 'MV': '马尔代夫', 'ML': '马里', 'MT': '马耳他',
  'MH': '马绍尔群岛', 'MQ': '马提尼克', 'MR': '毛里塔尼亚', 'MU': '毛里求斯',
  'YT': '马约特', 'MX': '墨西哥', 'FM': '密克罗尼西亚', 'MD': '摩尔多瓦',
  'MC': '摩纳哥', 'MN': '蒙古', 'ME': '黑山', 'MS': '蒙特塞拉特',
  'MA': '摩洛哥', 'MZ': '莫桑比克', 'MM': '缅甸', 'NA': '纳米比亚',
  'NR': '瑙鲁', 'NP': '尼泊尔', 'NL': '荷兰', 'NC': '新喀里多尼亚',
  'NZ': '新西兰', 'NI': '尼加拉瓜', 'NE': '尼日尔', 'NG': '尼日利亚',
  'NU': '纽埃', 'NF': '诺福克岛', 'MK': '北马其顿', 'MP': '北马里亚纳群岛',
  'NO': '挪威', 'OM': '阿曼', 'PK': '巴基斯坦', 'PW': '帕劳',
  'PS': '巴勒斯坦', 'PA': '巴拿马', 'PG': '巴布亚新几内亚', 'PY': '巴拉圭',
  'PE': '秘鲁', 'PH': '菲律宾', 'PN': '皮特凯恩', 'PL': '波兰',
  'PT': '葡萄牙', 'PR': '波多黎各', 'QA': '卡塔尔', 'RE': '留尼汪',
  'RO': '罗马尼亚', 'RU': '俄罗斯', 'RW': '卢旺达', 'BL': '圣巴泰勒米',
  'SH': '圣赫勒拿', 'KN': '圣基茨和尼维斯', 'LC': '圣卢西亚',
  'MF': '圣马丁', 'PM': '圣皮埃尔和密克隆', 'VC': '圣文森特和格林纳丁斯',
  'WS': '萨摩亚', 'SM': '圣马力诺', 'ST': '圣多美和普林西比', 'SA': '沙特阿拉伯',
  'SN': '塞内加尔', 'RS': '塞尔维亚', 'SC': '塞舌尔', 'SL': '塞拉利昂',
  'SG': '新加坡', 'SX': '圣马丁', 'SK': '斯洛伐克', 'SI': '斯洛文尼亚',
  'SB': '所罗门群岛', 'SO': '索马里', 'ZA': '南非', 'GS': '南乔治亚岛和南桑威奇群岛',
  'SS': '南苏丹', 'ES': '西班牙', 'LK': '斯里兰卡', 'SD': '苏丹',
  'SR': '苏里南', 'SJ': '斯瓦尔巴和扬马延', 'SE': '瑞典', 'CH': '瑞士',
  'SY': '叙利亚', 'TW': '中国台湾', 'TJ': '塔吉克斯坦', 'TZ': '坦桑尼亚',
  'TH': '泰国', 'TL': '东帝汶', 'TG': '多哥', 'TK': '托克劳',
  'TO': '汤加', 'TT': '特立尼达和多巴哥', 'TN': '突尼斯', 'TR': '土耳其',
  'TM': '土库曼斯坦', 'TC': '特克斯和凯科斯群岛', 'TV': '图瓦卢',
  'UG': '乌干达', 'UA': '乌克兰', 'AE': '阿联酋', 'GB': '英国',
  'US': '美国', 'UM': '美国本土外小岛屿', 'UY': '乌拉圭', 'UZ': '乌兹别克斯坦',
  'VU': '瓦努阿图', 'VE': '委内瑞拉', 'VN': '越南', 'VG': '英属维尔京群岛',
  'VI': '美属维尔京群岛', 'WF': '瓦利斯和富图纳', 'EH': '西撒哈拉',
  'YE': '也门', 'ZM': '赞比亚', 'ZW': '津巴布韦'
};

function getCountryCode(countryName) {
  for (const [code, name] of Object.entries(countryCodes)) {
    if (name === countryName) {
      return code;
    }
  }
  return 'CN';
}

// 加载数据到内存
let suppliers = [];
let products = [];
let customers = [];
let inventory = [];
let piList = [];
let purchaseOrders = [];

function loadData() {
  console.log('Loading data into memory...');
  try {
    suppliers = query('SELECT * FROM suppliers');
    products = query('SELECT * FROM products');
    customers = query('SELECT * FROM customers');
    inventory = query('SELECT * FROM inventory');
    piList = query('SELECT * FROM pi');
    purchaseOrders = query('SELECT * FROM purchaseOrders');
    console.log('Data loaded successfully');
  } catch (err) {
    console.error('Error loading data:', err.message);
  }
}

// 模板初始化
function initializeTemplates() {
  console.log('Initializing templates...');
}

// 检查提醒函数
function checkReminders() {
  try {
    const now = new Date();
    const nowStr = now.toISOString().slice(0, 16).replace('T', ' ');
    
    const reminders = query('SELECT * FROM reminders WHERE status = "待提醒"');
    
    for (const reminder of reminders) {
      const reminderTime = new Date(reminder.reminderTime.replace(' ', 'T') + ':00');
      if (now >= reminderTime) {
        // 发送邮件提醒
        try {
          transporter.sendMail({
            from: 'gxhan0420@163.com',
            to: reminder.email,
            subject: '采购提醒',
            text: reminder.content
          }).then(() => {
            run('UPDATE reminders SET status = "已提醒", updated_at = datetime("now") WHERE id = ?', [reminder.id]);
            console.log(`Reminder sent for purchase order ${reminder.purchaseOrderId}`);
          }).catch((emailErr) => {
            console.error('Error sending email:', emailErr.message);
          });
        } catch (emailErr) {
          console.error('Error sending email:', emailErr.message);
        }
      }
    }
  } catch (err) {
    console.error('Error checking reminders:', err.message);
  }
}

// 登录接口
app.post('/api/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.json({ success: false, error: '用户名或密码不能为空' });
    }
    
    const users = query(`SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`);
    
    if (users.length === 0) {
      return res.json({ success: false, error: '用户名或密码错误' });
    }
    
    res.json({ success: true, user: users[0] });
  } catch (err) {
    console.error('Login error:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 采购单相关接口
app.get('/api/purchase-orders', (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM purchaseOrders ORDER BY created_at DESC';
    
    if (search) {
      sql = `SELECT * FROM purchaseOrders WHERE id LIKE '%${search}%' OR supplierName LIKE '%${search}%' ORDER BY created_at DESC`;
    }
    
    const orders = query(sql);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching purchase orders:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/purchase-orders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const orders = query(`SELECT * FROM purchaseOrders WHERE id = '${id}'`);
    
    if (orders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    res.json(orders[0]);
  } catch (err) {
    console.error('Error fetching purchase order:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/purchase-orders', (req, res) => {
  try {
    const { piId, supplierId, supplierName, products, totalAmount, purchaseNote, dataSource } = req.body;
    
    const now = new Date().toISOString();
    const orderId = 'CG' + now.slice(0, 10).replace(/-/g, '') + String(purchaseOrders.length + 1).padStart(3, '0');
    
    run(`INSERT INTO purchaseOrders (id, piId, supplierId, supplierName, products, totalAmount, status, created_at, updated_at, purchaseNote, dataSource) VALUES ('${orderId}', '${piId || ''}', '${supplierId}', '${supplierName}', '${JSON.stringify(products)}', ${totalAmount}, '待确认', '${now}', '${now}', '${purchaseNote || ''}', '${dataSource || '手动新增'}')`);
    
    res.json({ success: true, id: orderId });
  } catch (err) {
    console.error('Error creating purchase order:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.put('/api/purchase-orders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { supplierId, supplierName, products, totalAmount, status, purchaseNote, invoiceNote, trackingNumbers } = req.body;
    
    run(`UPDATE purchaseOrders SET supplierId = '${supplierId}', supplierName = '${supplierName}', products = '${JSON.stringify(products)}', totalAmount = ${totalAmount}, status = '${status}', updated_at = datetime('now'), purchaseNote = '${purchaseNote || ''}', invoiceNote = '${invoiceNote || ''}', trackingNumbers = '${JSON.stringify(trackingNumbers || [])}' WHERE id = '${id}'`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating purchase order:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.delete('/api/purchase-orders/:id', (req, res) => {
  try {
    const { id } = req.params;
    run(`DELETE FROM purchaseOrders WHERE id = '${id}'`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting purchase order:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 供应商相关接口
app.get('/api/suppliers', (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM suppliers ORDER BY created_at DESC';
    
    if (search) {
      sql = `SELECT * FROM suppliers WHERE id LIKE '%${search}%' OR name LIKE '%${search}%' ORDER BY created_at DESC`;
    }
    
    const suppliers = query(sql);
    res.json(suppliers);
  } catch (err) {
    console.error('Error fetching suppliers:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/suppliers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const suppliers = query(`SELECT * FROM suppliers WHERE id = '${id}'`);
    
    if (suppliers.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    
    res.json(suppliers[0]);
  } catch (err) {
    console.error('Error fetching supplier:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/suppliers', (req, res) => {
  try {
    const { name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note } = req.body;
    
    const now = new Date().toISOString();
    const supplierId = 'SUP' + String(suppliers.length + 1).padStart(3, '0');
    
    run(`INSERT INTO suppliers (id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note, created_at) VALUES ('${supplierId}', '${name}', '${companyType}', '${mainProducts}', '${contact}', '${contactInfo}', '${canInvoice}', ${invoiceThreshold}, '${paymentLink}', '${note || ''}', '${now}')`);
    
    res.json({ success: true, id: supplierId });
  } catch (err) {
    console.error('Error creating supplier:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.put('/api/suppliers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note, invoiceStatus } = req.body;
    
    run(`UPDATE suppliers SET name = '${name}', companyType = '${companyType}', mainProducts = '${mainProducts}', contact = '${contact}', contactInfo = '${contactInfo}', canInvoice = '${canInvoice}', invoiceThreshold = ${invoiceThreshold}, paymentLink = '${paymentLink}', note = '${note || ''}', invoiceStatus = '${invoiceStatus || ''}' WHERE id = '${id}'`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating supplier:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.delete('/api/suppliers/:id', (req, res) => {
  try {
    const { id } = req.params;
    run(`DELETE FROM suppliers WHERE id = '${id}'`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting supplier:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 产品相关接口
app.get('/api/products', (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM products ORDER BY created_at DESC';
    
    if (search) {
      sql = `SELECT * FROM products WHERE id LIKE '%${search}%' OR englishName LIKE '%${search}%' OR chineseName LIKE '%${search}%' ORDER BY created_at DESC`;
    }
    
    const products = query(sql);
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const products = query(`SELECT * FROM products WHERE id = '${id}'`);
    
    if (products.length === 0) {
      return res.status(404).json({ error: '产品不存在' });
    }
    
    res.json(products[0]);
  } catch (err) {
    console.error('Error fetching product:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/products', (req, res) => {
  try {
    const { englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName, purchasePriceLess100, purchasePriceMore100, purchaseLink, purchaseChannel, features } = req.body;
    
    const now = new Date().toISOString();
    const productId = 'PRO' + String(products.length + 1).padStart(3, '0');
    
    run(`INSERT INTO products (id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName, purchasePriceLess100, purchasePriceMore100, purchaseLink, purchaseChannel, features, created_at) VALUES ('${productId}', '${englishName}', '${chineseName}', ${salesPriceLess100}, ${salesPriceMore100}, '${supplierId}', '${supplierName}', ${purchasePriceLess100}, ${purchasePriceMore100}, '${purchaseLink || ''}', '${purchaseChannel || ''}', '${features || ''}', '${now}')`);
    
    res.json({ success: true, id: productId });
  } catch (err) {
    console.error('Error creating product:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.put('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName, purchasePriceLess100, purchasePriceMore100, purchaseLink, purchaseChannel, features } = req.body;
    
    run(`UPDATE products SET englishName = '${englishName}', chineseName = '${chineseName}', salesPriceLess100 = ${salesPriceLess100}, salesPriceMore100 = ${salesPriceMore100}, supplierId = '${supplierId}', supplierName = '${supplierName}', purchasePriceLess100 = ${purchasePriceLess100}, purchasePriceMore100 = ${purchasePriceMore100}, purchaseLink = '${purchaseLink || ''}', purchaseChannel = '${purchaseChannel || ''}', features = '${features || ''}' WHERE id = '${id}'`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating product:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    run(`DELETE FROM products WHERE id = '${id}'`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting product:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 客户相关接口
app.get('/api/customers', (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM customers ORDER BY created_at DESC';
    
    if (search) {
      sql = `SELECT * FROM customers WHERE id LIKE '%${search}%' OR companyName LIKE '%${search}%' ORDER BY created_at DESC`;
    }
    
    const customers = query(sql);
    res.json(customers);
  } catch (err) {
    console.error('Error fetching customers:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/customers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const customers = query(`SELECT * FROM customers WHERE id = '${id}'`);
    
    if (customers.length === 0) {
      return res.status(404).json({ error: '客户不存在' });
    }
    
    res.json(customers[0]);
  } catch (err) {
    console.error('Error fetching customer:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/customers', (req, res) => {
  try {
    const { companyName, companyShortName, contact, country, website, companySize } = req.body;
    
    const countryCode = getCountryCode(country);
    const existingCustomers = query(`SELECT * FROM customers WHERE countryCode = '${countryCode}'`);
    const nextNumber = existingCustomers.length + 1;
    const customerId = countryCode + String(nextNumber).padStart(4, '0');
    
    const now = new Date().toISOString();
    
    run(`INSERT INTO customers (id, companyName, companyShortName, contact, country, countryCode, website, companySize, created_at) VALUES ('${customerId}', '${companyName}', '${companyShortName || ''}', '${contact}', '${country}', '${countryCode}', '${website || ''}', '${companySize || ''}', '${now}')`);
    
    res.json({ success: true, id: customerId });
  } catch (err) {
    console.error('Error creating customer:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.put('/api/customers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, companyShortName, contact, country, website, companySize } = req.body;
    
    const countryCode = getCountryCode(country);
    
    run(`UPDATE customers SET companyName = '${companyName}', companyShortName = '${companyShortName || ''}', contact = '${contact}', country = '${country}', countryCode = '${countryCode}', website = '${website || ''}', companySize = '${companySize || ''}' WHERE id = '${id}'`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating customer:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.delete('/api/customers/:id', (req, res) => {
  try {
    const { id } = req.params;
    run(`DELETE FROM customers WHERE id = '${id}'`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting customer:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 国家列表接口
app.get('/api/countries', (req, res) => {
  const countries = Object.entries(countryCodes).map(([code, name]) => ({
    code,
    name
  }));
  res.json(countries);
});

// 库存相关接口
app.get('/api/inventory', (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM inventory ORDER BY productId';
    
    if (search) {
      sql = `SELECT * FROM inventory WHERE productId LIKE '%${search}%' OR englishName LIKE '%${search}%' OR chineseName LIKE '%${search}%' ORDER BY productId`;
    }
    
    const inventory = query(sql);
    res.json(inventory);
  } catch (err) {
    console.error('Error fetching inventory:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/inventory/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    const inventory = query(`SELECT * FROM inventory WHERE productId = '${productId}'`);
    
    if (inventory.length === 0) {
      return res.status(404).json({ error: '库存不存在' });
    }
    
    res.json(inventory[0]);
  } catch (err) {
    console.error('Error fetching inventory:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/inventory', (req, res) => {
  try {
    const { productId, englishName, chineseName, quantity, warehouse } = req.body;
    
    const now = new Date().toISOString();
    
    run(`INSERT INTO inventory (productId, englishName, chineseName, quantity, warehouse, created_at) VALUES ('${productId}', '${englishName}', '${chineseName}', ${quantity}, '${warehouse || '主仓库'}', '${now}')`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating inventory:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.put('/api/inventory/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    const { quantity, warehouse } = req.body;
    
    run(`UPDATE inventory SET quantity = ${quantity}, warehouse = '${warehouse || '主仓库'}' WHERE productId = '${productId}'`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating inventory:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.delete('/api/inventory/:productId', (req, res) => {
  try {
    const { productId } = req.params;
    run(`DELETE FROM inventory WHERE productId = '${productId}'`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting inventory:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// PI相关接口
app.get('/api/pi', (req, res) => {
  try {
    const { search } = req.query;
    let sql = 'SELECT * FROM pi ORDER BY created_at DESC';
    
    if (search) {
      sql = `SELECT * FROM pi WHERE id LIKE '%${search}%' OR customerName LIKE '%${search}%' ORDER BY created_at DESC`;
    }
    
    const piList = query(sql);
    res.json(piList);
  } catch (err) {
    console.error('Error fetching PI:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/pi/:id', (req, res) => {
  try {
    const { id } = req.params;
    const piList = query(`SELECT * FROM pi WHERE id = '${id}'`);
    
    if (piList.length === 0) {
      return res.status(404).json({ error: 'PI单不存在' });
    }
    
    res.json(piList[0]);
  } catch (err) {
    console.error('Error fetching PI:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/pi', (req, res) => {
  try {
    const { customerId, customerName, products, totalAmount, note } = req.body;
    
    const now = new Date();
    const piId = 'PI' + now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + String(piList.length + 1).padStart(3, '0');
    
    run(`INSERT INTO pi (id, customerId, customerName, products, totalAmount, note, status, created_at) VALUES ('${piId}', '${customerId}', '${customerName}', '${JSON.stringify(products)}', ${totalAmount}, '${note || ''}', '待处理', '${now.toISOString()}')`);
    
    res.json({ success: true, id: piId });
  } catch (err) {
    console.error('Error creating PI:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.put('/api/pi/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, customerName, products, totalAmount, note, status } = req.body;
    
    run(`UPDATE pi SET customerId = '${customerId}', customerName = '${customerName}', products = '${JSON.stringify(products)}', totalAmount = ${totalAmount}, note = '${note || ''}', status = '${status}' WHERE id = '${id}'`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating PI:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.delete('/api/pi/:id', (req, res) => {
  try {
    const { id } = req.params;
    run(`DELETE FROM pi WHERE id = '${id}'`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting PI:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 提醒相关接口
app.get('/api/reminders/:purchaseOrderId', (req, res) => {
  try {
    const { purchaseOrderId } = req.params;
    const reminders = query(`SELECT * FROM reminders WHERE purchaseOrderId = '${purchaseOrderId}' ORDER BY created_at DESC`);
    res.json(reminders);
  } catch (err) {
    console.error('Error fetching reminders:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/reminders', (req, res) => {
  try {
    const { purchaseOrderId, reminderTime, content, email } = req.body;
    
    const now = new Date().toISOString();
    
    run(`INSERT INTO reminders (purchaseOrderId, reminderTime, content, email, status, created_at, updated_at) VALUES ('${purchaseOrderId}', '${reminderTime}', '${content}', '${email}', '待提醒', '${now}', '${now}')`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating reminder:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.put('/api/reminders/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { reminderTime, content, email, status } = req.body;
    
    run(`UPDATE reminders SET reminderTime = '${reminderTime}', content = '${content}', email = '${email}', status = '${status}', updated_at = datetime('now') WHERE id = ${id}`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating reminder:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.delete('/api/reminders/:id', (req, res) => {
  try {
    const { id } = req.params;
    run(`DELETE FROM reminders WHERE id = ${id}`);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting reminder:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 邮箱配置接口
app.get('/api/email-configs', (req, res) => {
  try {
    const configs = query('SELECT * FROM email_configs');
    res.json(configs);
  } catch (err) {
    console.error('Error fetching email configs:', err.message);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/email-configs', (req, res) => {
  try {
    const { host, port, secure, user, pass } = req.body;
    
    const now = new Date().toISOString();
    
    run(`INSERT INTO email_configs (host, port, secure, user, pass, created_at) VALUES ('${host}', ${port}, ${secure ? 1 : 0}, '${user}', '${pass}', '${now}')`);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error creating email config:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 启动服务器
function startServer() {
  app.listen(PORT, () => {
    console.log(`后端服务器运行在 http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // 每1分钟检查一次提醒
    setInterval(checkReminders, 1 * 60 * 1000);
    
    // 启动时检查一次
    checkReminders();
  });
}

// 当数据库初始化完成后启动服务器
initDatabase(() => {
  loadData();
  initializeTemplates();
  startServer();
});