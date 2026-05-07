const express = require('express');
const XLSX = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

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

// 创建数据库连接 - 使用相对于脚本位置的路径，确保始终使用backend目录下的数据库
const dbPath = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database at:', dbPath);
  }
});

// 数据库初始化函数
function initDatabase(callback) {
  // 创建用户表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      role TEXT
    )
  `, () => {
    // 创建供应商表
    db.run(`
      CREATE TABLE IF NOT EXISTS suppliers (
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
        created_at TEXT
      )
    `, () => {
      // 创建产品表
      db.run(`
        CREATE TABLE IF NOT EXISTS products (
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
        )
      `, () => {
        // 创建客户表
        db.run(`
          CREATE TABLE IF NOT EXISTS customers (
            id TEXT PRIMARY KEY,
            companyName TEXT UNIQUE,
            companyShortName TEXT,
            contact TEXT,
            country TEXT,
            countryCode TEXT,
            website TEXT,
            companySize TEXT,
            created_at TEXT
          )
        `, () => {
          // 创建库存表
          db.run(`
            CREATE TABLE IF NOT EXISTS inventory (
              productId TEXT PRIMARY KEY,
              englishName TEXT,
              chineseName TEXT,
              quantity INTEGER,
              warehouse TEXT,
              created_at TEXT
            )
          `, () => {
            // 创建PI表
            db.run(`
              CREATE TABLE IF NOT EXISTS pi (
                id TEXT PRIMARY KEY,
                customerId TEXT,
                customerName TEXT,
                products TEXT,
                totalAmount REAL,
                note TEXT,
                status TEXT,
                created_at TEXT
              )
            `, () => {
              // 创建采购单表
              db.run(`
                CREATE TABLE IF NOT EXISTS purchaseOrders (
                  id TEXT PRIMARY KEY,
                  piId TEXT,
                  supplierId TEXT,
                  supplierName TEXT,
                  products TEXT,
                  totalAmount REAL,
                  status TEXT,
                  created_at TEXT,
                  updated_at TEXT
                )
              `, () => {
                // 为供应商添加开票状态字段
                db.run(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS invoiceStatus TEXT`, () => {
                  // 添加供应商附件字段
                  db.run(`ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS attachments TEXT`, () => {
                    // 添加新列（如果不存在）
                    db.run(`ALTER TABLE purchaseOrders ADD COLUMN IF NOT EXISTS purchaseNote TEXT`, () => {
                      db.run(`ALTER TABLE purchaseOrders ADD COLUMN IF NOT EXISTS invoiceNote TEXT`, () => {
                        db.run(`ALTER TABLE purchaseOrders ADD COLUMN IF NOT EXISTS trackingNumbers TEXT`, () => {
                          // 创建提醒表
                          db.run(`
                            CREATE TABLE IF NOT EXISTS reminders (
                              id INTEGER PRIMARY KEY AUTOINCREMENT,
                              purchaseOrderId TEXT,
                              reminderTime TEXT,
                              content TEXT,
                              email TEXT,
                              status TEXT,
                              created_at TEXT,
                              updated_at TEXT
                            )
                          `, () => {
                            // 插入默认用户数据
                            db.run(`
                              INSERT OR IGNORE INTO users (username, password, role) VALUES
                              ('sales', 'sales123', '业务员'),
                              ('purchase', 'purchase123', '采购员')
                            `, () => {
                              // 插入默认供应商数据
                              db.run(`
                                INSERT OR IGNORE INTO suppliers (id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note, created_at) VALUES
                                ('SUP001', '测试供应商', '工厂', '电子产品', '张三', '13800138000', '是', 1000, '', '测试供应商', datetime('now'))
                              `, () => {
                                // 插入默认产品数据
                                db.run(`
                                  INSERT OR IGNORE INTO products (id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName, purchasePriceLess100, purchasePriceMore100, purchaseLink, features, created_at) VALUES
                                  ('PRO001', 'Test Product', '测试产品', 100, 95, 'SUP001', '测试供应商', 80, 75, '', '测试产品特性', datetime('now'))
                                `, () => {
                                  // 插入默认客户数据
                                  db.run(`
                                    INSERT OR IGNORE INTO customers (id, companyName, companyShortName, contact, country, website, companySize, created_at) VALUES
                                    ('CUS001', '测试客户公司', '测试客户', '李四', '中国', '', '中型', datetime('now'))
                                  `, () => {
                                    // 插入默认库存数据
                                    db.run(`
                                      INSERT OR IGNORE INTO inventory (productId, englishName, chineseName, quantity, warehouse, created_at) VALUES
                                      ('PRO001', 'Test Product', '测试产品', 100, '主仓库', datetime('now'))
                                    `, () => {
                                      // 所有表创建完成后调用回调函数
                                      if (callback) {
                                        callback();
                                      }
                                    });
                                  });
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}

const app = express();
const PORT = 4000;




// 中间件
app.use(express.static(path.join(__dirname, '..')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS 支持
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, username, password');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// 数据库操作封装
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
}

// 加载数据到内存（可选，用于提高性能）
let suppliers = [];
let products = [];
let customers = [];
let inventory = [];
let piList = [];
let purchaseOrders = [];

// ISO 3166-1 Alpha-2 国家代码与中文名称映射
const countryCodes = {
  'AF': '阿富汗',
  'AX': '奥兰群岛',
  'AL': '阿尔巴尼亚',
  'DZ': '阿尔及利亚',
  'AS': '美属萨摩亚',
  'AD': '安道尔',
  'AO': '安哥拉',
  'AI': '安圭拉',
  'AQ': '南极洲',
  'AG': '安提瓜和巴布达',
  'AR': '阿根廷',
  'AM': '亚美尼亚',
  'AW': '阿鲁巴',
  'AU': '澳大利亚',
  'AT': '奥地利',
  'AZ': '阿塞拜疆',
  'BS': '巴哈马',
  'BH': '巴林',
  'BD': '孟加拉国',
  'BB': '巴巴多斯',
  'BY': '白俄罗斯',
  'BE': '比利时',
  'BZ': '伯利兹',
  'BJ': '贝宁',
  'BM': '百慕大',
  'BT': '不丹',
  'BO': '玻利维亚',
  'BQ': '博奈尔岛',
  'BA': '波斯尼亚和黑塞哥维那',
  'BW': '博茨瓦纳',
  'BV': '布维岛',
  'BR': '巴西',
  'IO': '英属印度洋领地',
  'BN': '文莱',
  'BG': '保加利亚',
  'BF': '布基纳法索',
  'BI': '布隆迪',
  'KH': '柬埔寨',
  'CM': '喀麦隆',
  'CA': '加拿大',
  'CV': '佛得角',
  'KY': '开曼群岛',
  'CF': '中非共和国',
  'TD': '乍得',
  'CL': '智利',
  'CN': '中国',
  'CX': '圣诞岛',
  'CC': '科科斯群岛',
  'CO': '哥伦比亚',
  'KM': '科摩罗',
  'CG': '刚果共和国',
  'CD': '刚果民主共和国',
  'CK': '库克群岛',
  'CR': '哥斯达黎加',
  'CI': '科特迪瓦',
  'HR': '克罗地亚',
  'CU': '古巴',
  'CW': '库拉索',
  'CY': '塞浦路斯',
  'CZ': '捷克',
  'DK': '丹麦',
  'DJ': '吉布提',
  'DM': '多米尼克',
  'DO': '多米尼加共和国',
  'EC': '厄瓜多尔',
  'EG': '埃及',
  'SV': '萨尔瓦多',
  'GQ': '赤道几内亚',
  'ER': '厄立特里亚',
  'EE': '爱沙尼亚',
  'ET': '埃塞俄比亚',
  'FK': '福克兰群岛',
  'FO': '法罗群岛',
  'FJ': '斐济',
  'FI': '芬兰',
  'FR': '法国',
  'GF': '法属圭亚那',
  'PF': '法属波利尼西亚',
  'TF': '法属南部领地',
  'GA': '加蓬',
  'GM': '冈比亚',
  'GE': '格鲁吉亚',
  'DE': '德国',
  'GH': '加纳',
  'GI': '直布罗陀',
  'GR': '希腊',
  'GL': '格陵兰',
  'GD': '格林纳达',
  'GP': '瓜德罗普',
  'GU': '关岛',
  'GT': '危地马拉',
  'GG': '根西岛',
  'GN': '几内亚',
  'GW': '几内亚比绍',
  'GY': '圭亚那',
  'HT': '海地',
  'HM': '赫德岛和麦克唐纳群岛',
  'VA': '梵蒂冈',
  'HN': '洪都拉斯',
  'HK': '中国香港',
  'HU': '匈牙利',
  'IS': '冰岛',
  'IN': '印度',
  'ID': '印度尼西亚',
  'IR': '伊朗',
  'IQ': '伊拉克',
  'IE': '爱尔兰',
  'IM': '马恩岛',
  'IL': '以色列',
  'IT': '意大利',
  'JM': '牙买加',
  'JP': '日本',
  'JE': '泽西岛',
  'JO': '约旦',
  'KZ': '哈萨克斯坦',
  'KE': '肯尼亚',
  'KI': '基里巴斯',
  'KP': '朝鲜',
  'KR': '韩国',
  'KW': '科威特',
  'KG': '吉尔吉斯斯坦',
  'LA': '老挝',
  'LV': '拉脱维亚',
  'LB': '黎巴嫩',
  'LS': '莱索托',
  'LR': '利比里亚',
  'LY': '利比亚',
  'LI': '列支敦士登',
  'LT': '立陶宛',
  'LU': '卢森堡',
  'MO': '中国澳门',
  'MG': '马达加斯加',
  'MW': '马拉维',
  'MY': '马来西亚',
  'MV': '马尔代夫',
  'ML': '马里',
  'MT': '马耳他',
  'MH': '马绍尔群岛',
  'MQ': '马提尼克',
  'MR': '毛里塔尼亚',
  'MU': '毛里求斯',
  'YT': '马约特',
  'MX': '墨西哥',
  'FM': '密克罗尼西亚',
  'MD': '摩尔多瓦',
  'MC': '摩纳哥',
  'MN': '蒙古',
  'ME': '黑山',
  'MS': '蒙特塞拉特',
  'MA': '摩洛哥',
  'MZ': '莫桑比克',
  'MM': '缅甸',
  'NA': '纳米比亚',
  'NR': '瑙鲁',
  'NP': '尼泊尔',
  'NL': '荷兰',
  'NC': '新喀里多尼亚',
  'NZ': '新西兰',
  'NI': '尼加拉瓜',
  'NE': '尼日尔',
  'NG': '尼日利亚',
  'NU': '纽埃',
  'NF': '诺福克岛',
  'MK': '北马其顿',
  'MP': '北马里亚纳群岛',
  'NO': '挪威',
  'OM': '阿曼',
  'PK': '巴基斯坦',
  'PW': '帕劳',
  'PS': '巴勒斯坦',
  'PA': '巴拿马',
  'PG': '巴布亚新几内亚',
  'PY': '巴拉圭',
  'PE': '秘鲁',
  'PH': '菲律宾',
  'PN': '皮特凯恩',
  'PL': '波兰',
  'PT': '葡萄牙',
  'PR': '波多黎各',
  'QA': '卡塔尔',
  'RE': '留尼汪',
  'RO': '罗马尼亚',
  'RU': '俄罗斯',
  'RW': '卢旺达',
  'BL': '圣巴泰勒米',
  'SH': '圣赫勒拿',
  'KN': '圣基茨和尼维斯',
  'LC': '圣卢西亚',
  'MF': '圣马丁',
  'PM': '圣皮埃尔和密克隆',
  'VC': '圣文森特和格林纳丁斯',
  'WS': '萨摩亚',
  'SM': '圣马力诺',
  'ST': '圣多美和普林西比',
  'SA': '沙特阿拉伯',
  'SN': '塞内加尔',
  'RS': '塞尔维亚',
  'SC': '塞舌尔',
  'SL': '塞拉利昂',
  'SG': '新加坡',
  'SX': '圣马丁',
  'SK': '斯洛伐克',
  'SI': '斯洛文尼亚',
  'SB': '所罗门群岛',
  'SO': '索马里',
  'ZA': '南非',
  'GS': '南乔治亚和南桑威奇群岛',
  'SS': '南苏丹',
  'ES': '西班牙',
  'LK': '斯里兰卡',
  'SD': '苏丹',
  'SR': '苏里南',
  'SJ': '斯瓦尔巴和扬马延',
  'SZ': '斯威士兰',
  'SE': '瑞典',
  'CH': '瑞士',
  'SY': '叙利亚',
  'TW': '中国台湾',
  'TJ': '塔吉克斯坦',
  'TZ': '坦桑尼亚',
  'TH': '泰国',
  'TL': '东帝汶',
  'TG': '多哥',
  'TK': '托克劳',
  'TO': '汤加',
  'TT': '特立尼达和多巴哥',
  'TN': '突尼斯',
  'TR': '土耳其',
  'TM': '土库曼斯坦',
  'TC': '特克斯和凯科斯群岛',
  'TV': '图瓦卢',
  'UG': '乌干达',
  'UA': '乌克兰',
  'AE': '阿联酋',
  'GB': '英国',
  'US': '美国',
  'UM': '美国本土外小岛屿',
  'UY': '乌拉圭',
  'UZ': '乌兹别克斯坦',
  'VU': '瓦努阿图',
  'VE': '委内瑞拉',
  'VN': '越南',
  'VG': '英属维尔京群岛',
  'VI': '美属维尔京群岛',
  'WF': '瓦利斯和富图纳',
  'EH': '西撒哈拉',
  'YE': '也门',
  'ZM': '赞比亚',
  'ZW': '津巴布韦'
};

// 获取国家代码
function getCountryCode(countryName) {
  for (const [code, name] of Object.entries(countryCodes)) {
    if (name === countryName) {
      return code;
    }
  }
  return 'XX';
}

// 获取国家名称
function getCountryName(code) {
  return countryCodes[code] || '未知';
}

// 从数据库加载数据
async function loadData() {
  try {
    // 创建邮箱配置表（如果不存在）
    try {
      await run(`CREATE TABLE IF NOT EXISTS emailConfigs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE,
        smtpServer TEXT,
        smtpPort INTEGER,
        authCode TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT,
        updated_at TEXT
      )`);
      console.log('已创建邮箱配置表');
    } catch (e) {
      // 表可能已存在，忽略错误
    }
    
    // 插入默认邮箱配置
    try {
      await run(`INSERT OR IGNORE INTO emailConfigs (email, smtpServer, smtpPort, authCode, status, created_at, updated_at) 
        VALUES ('gxhan0420@163.com', 'smtp.163.com', 465, 'RGhwVqeQbTxVXTeE', 'active', ?, ?)`, 
        [new Date().toISOString(), new Date().toISOString()]);
      console.log('已插入默认邮箱配置');
    } catch (e) {
      // 数据可能已存在，忽略错误
    }
    
    // 检查并添加采购单的 dataSource 字段
    try {
      await run('ALTER TABLE purchaseOrders ADD COLUMN dataSource TEXT');
      console.log('已添加采购单 dataSource 字段');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }
    
    // 检查并添加采购单的 updated_at 字段
    try {
      await run('ALTER TABLE purchaseOrders ADD COLUMN updated_at TEXT');
      console.log('已添加采购单 updated_at 字段');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }
    
    // 检查并添加供应商开票状态字段
    try {
      await run('ALTER TABLE suppliers ADD COLUMN invoiceStatus TEXT');
      console.log('已添加供应商开票状态字段');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }
    
    // 检查并添加供应商附件字段
    try {
      await run('ALTER TABLE suppliers ADD COLUMN attachments TEXT');
      console.log('已添加供应商附件字段');
    } catch (e) {
      // 字段可能已存在，忽略错误
    }
    
    suppliers = await query('SELECT * FROM suppliers');
    products = await query('SELECT * FROM products');
    global.products = products;
    customers = await query('SELECT * FROM customers');
    inventory = await query('SELECT * FROM inventory');
    piList = await query('SELECT * FROM pi');
    // 解析JSON字段
    piList.forEach(pi => {
      pi.products = JSON.parse(pi.products);
    });
    purchaseOrders = await query('SELECT * FROM purchaseOrders');
    // 解析JSON字段
    purchaseOrders.forEach(po => {
      po.products = JSON.parse(po.products);
    });
    console.log('数据加载完成');
  } catch (error) {
    console.error('加载数据失败:', error);
  }
}

// 权限控制中间件
function checkPermission(requiredRoles) {
  return async (req, res, next) => {
    const { username, password } = req.headers;
    if (!username || !password) {
      return res.status(401).json({ error: '请提供用户名和密码' });
    }
    
    try {
      const users = await query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
      if (users.length === 0) {
        return res.status(401).json({ error: '用户名或密码错误' });
      }
      const user = users[0];
      if (!requiredRoles.includes(user.role)) {
        return res.status(403).json({ error: '权限不足' });
      }
      req.user = user;
      next();
    } catch (error) {
      console.error('权限检查失败:', error);
      res.status(500).json({ error: '服务器内部错误' });
    }
  };
}

// 登录 API
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = await query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    if (users.length === 0) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }
    const user = users[0];
    res.json({ success: true, user: { id: user.id, username: user.username, role: user.role } });
  } catch (error) {
    console.error('登录失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// API 路由
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: '服务器运行正常', timestamp: new Date().toISOString() });
});

// 模板下载 API
app.get('/api/templates/:type', checkPermission(['业务员', '采购员']), (req, res) => {
  const { type } = req.params;
  const templatesDir = path.join(__dirname, 'templates');
  
  // 确保templates目录存在
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  
  const templateMap = {
    'customers': 'customer_import_template.xlsx',
    'products': 'product_import_template.xlsx',
    'suppliers': 'supplier_import_template.xlsx',
    'inventory': 'inventory_import_template.xlsx'
  };
  
  const fileName = templateMap[type];
  if (!fileName) {
    return res.status(400).json({ error: '无效的模板类型' });
  }
  
  const filePath = path.join(templatesDir, fileName);
  
  // 如果模板文件不存在，自动生成
  if (!fs.existsSync(filePath)) {
    generateTemplate(type, filePath);
  }
  
  res.download(filePath, fileName, (err) => {
    if (err) {
      console.error('下载模板失败:', err);
      res.status(500).json({ error: '下载模板失败' });
    }
  });
});

// 生成模板函数
function generateTemplate(type, filePath) {
  const workbook = XLSX.utils.book_new();
  let data = [];
  
  switch (type) {
    case 'customers':
      data = [
        ['客户编号', '公司名称', '公司简称', '联系人', '国家地区', '公司官网', '公司规模'],
        ['CUS001', '示例公司', '示例', '张三', '中国', 'https://example.com', '中型']
      ];
      break;
    case 'products':
      data = [
        ['产品ID', '英文品名', '中文品名', '销售阶梯价(<100)', '销售阶梯价(>=100)', '供应商ID', '采购价', '采购链接', '特性'],
        ['PRO001', 'Product 1', '产品1', '100', '95', 'SUP001', '80', 'https://example.com', '特性说明']
      ];
      break;
    case 'suppliers':
      data = [
        ['供应商ID', '供应商名称', '公司性质', '主营产品', '联系人', '联系方式', '是否能开票', '开票起点', '付款链接', '备注'],
        ['SUP001', '示例供应商', '工厂', '电子产品', '李四', '13800138000', '是', '1000', 'https://example.com', '备注信息']
      ];
      break;
    case 'inventory':
      data = [
        ['产品ID', '英文品名', '中文品名', '库存数量', '仓库'],
        ['PRO001', 'Product 1', '产品1', '100', '主仓库']
      ];
      break;
  }
  
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  
  // 设置列宽
  const cols = data[0].map(() => ({ wch: 15 }));
  worksheet['!cols'] = cols;
  
  XLSX.utils.book_append_sheet(workbook, worksheet, '导入模板');
  XLSX.writeFile(workbook, filePath);
}

// 初始化时生成所有模板
function initializeTemplates() {
  const templatesDir = path.join(__dirname, 'templates');
  if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir, { recursive: true });
  }
  
  const templates = ['customers', 'products', 'suppliers', 'inventory'];
  templates.forEach(type => {
    const templateMap = {
      'customers': 'customer_import_template.xlsx',
      'products': 'product_import_template.xlsx',
      'suppliers': 'supplier_import_template.xlsx',
      'inventory': 'inventory_import_template.xlsx'
    };
    const filePath = path.join(templatesDir, templateMap[type]);
    if (!fs.existsSync(filePath)) {
      console.log(`生成模板: ${templateMap[type]}`);
      generateTemplate(type, filePath);
    }
  });
}

// 导入数据 API
app.post('/api/import/:type', checkPermission(['业务员', '采购员']), upload.single('file'), async (req, res) => {
  const { type } = req.params;
  const file = req.file;
  
  if (!file) {
    return res.status(400).json({ error: '请上传文件' });
  }
  
  try {
    const workbook = XLSX.readFile(file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    // 跳过标题行
    const rows = data.slice(1);
    let successCount = 0;
    let failCount = 0;
    const errors = [];
    
    const created_at = new Date().toISOString();
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        switch (type) {
          case 'suppliers':
            if (row[0] && row[1]) {
              // 检查供应商ID是否已存在
              const existing = await query('SELECT * FROM suppliers WHERE id = ?', [row[0]]);
              if (existing.length > 0) {
                // 更新现有供应商
                await run('UPDATE suppliers SET name = ?, companyType = ?, mainProducts = ?, contact = ?, contactInfo = ?, canInvoice = ?, invoiceThreshold = ?, paymentLink = ?, note = ? WHERE id = ?', 
                  [row[1] || '', row[2] || '', row[3] || '', row[4] || '', row[5] || '', row[6] || '', row[7] || 0, row[8] || '', row[9] || '', row[0]]);
              } else {
                // 插入新供应商
                await run('INSERT INTO suppliers (id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                  [row[0] || '', row[1] || '', row[2] || '', row[3] || '', row[4] || '', row[5] || '', row[6] || '', row[7] || 0, row[8] || '', row[9] || '', created_at]);
              }
              successCount++;
            }
            break;
          case 'products':
            if (row[0] && row[2]) {
              // 获取供应商名称
              let supplierName = '';
              if (row[5]) {
                const suppliers = await query('SELECT * FROM suppliers WHERE id = ?', [row[5]]);
                if (suppliers.length > 0) {
                  supplierName = suppliers[0].name;
                }
              }
              
              // 检查产品ID是否已存在
              const existing = await query('SELECT * FROM products WHERE id = ?', [row[0]]);
              const purchasePrice = row[6] || 0;
              if (existing.length > 0) {
                await run('UPDATE products SET englishName = ?, chineseName = ?, salesPriceLess100 = ?, salesPriceMore100 = ?, supplierId = ?, supplierName = ?, purchasePriceLess100 = ?, purchasePriceMore100 = ?, purchasePrice = ?, purchaseLink = ?, features = ? WHERE id = ?', 
                  [row[1] || '', row[2] || '', row[3] || 0, row[4] || 0, row[5] || '', supplierName, purchasePrice, purchasePrice, purchasePrice, row[7] || '', row[8] || '', row[0]]);
              } else {
                await run('INSERT INTO products (id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName, purchasePriceLess100, purchasePriceMore100, purchasePrice, purchaseLink, features, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
                  [row[0] || '', row[1] || '', row[2] || '', row[3] || 0, row[4] || 0, row[5] || '', supplierName, purchasePrice, purchasePrice, purchasePrice, row[7] || '', row[8] || '', created_at]);
              }
              successCount++;
            }
            break;
          case 'customers':
            if (row[0] && row[1]) {
              // 检查客户ID是否已存在
              const existing = await query('SELECT * FROM customers WHERE id = ?', [row[0]]);
              if (existing.length > 0) {
                await run('UPDATE customers SET companyName = ?, companyShortName = ?, contact = ?, country = ?, website = ?, companySize = ? WHERE id = ?', 
                  [row[1] || '', row[2] || '', row[3] || '', row[4] || '', row[5] || '', row[6] || '', row[0]]);
              } else {
                await run('INSERT INTO customers (id, companyName, companyShortName, contact, country, website, companySize, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                  [row[0] || '', row[1] || '', row[2] || '', row[3] || '', row[4] || '', row[5] || '', row[6] || '', created_at]);
              }
              successCount++;
            }
            break;
          case 'inventory':
            if (row[0]) {
              // 检查库存是否已存在
              const existing = await query('SELECT * FROM inventory WHERE productId = ?', [row[0]]);
              if (existing.length > 0) {
                await run('UPDATE inventory SET englishName = ?, chineseName = ?, quantity = ?, warehouse = ? WHERE productId = ?', 
                  [row[1] || '', row[2] || '', row[3] || 0, row[4] || '', row[0]]);
              } else {
                await run('INSERT INTO inventory (productId, englishName, chineseName, quantity, warehouse, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
                  [row[0] || '', row[1] || '', row[2] || '', row[3] || 0, row[4] || '', created_at]);
              }
              successCount++;
            }
            break;
        }
      } catch (error) {
        failCount++;
        errors.push(`第${i + 2}行: ${error.message}`);
      }
    }
    
    // 删除临时文件
    fs.unlinkSync(file.path);
    
    // 重新加载数据
    await loadData();
    
    res.json({ 
      success: true, 
      successCount, 
      failCount, 
      errors: errors.slice(0, 10) // 只返回前10个错误
    });
    
  } catch (error) {
    console.error('导入失败:', error);
    // 清理临时文件
    if (file && file.path) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    res.status(500).json({ error: '导入失败: ' + error.message });
  }
});

// 供应商 API
app.get('/api/suppliers', checkPermission(['业务员', '采购员']), async (req, res) => {
  try {
    const { search } = req.query;
    let suppliers;
    if (search) {
      suppliers = await query(`
        SELECT * FROM suppliers 
        WHERE id LIKE ? OR name LIKE ? OR contact LIKE ? OR contactInfo LIKE ?
        ORDER BY created_at DESC
      `, [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]);
    } else {
      suppliers = await query('SELECT * FROM suppliers ORDER BY created_at DESC');
    }
    res.json(suppliers);
  } catch (error) {
    console.error('获取供应商列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单个供应商
app.get('/api/suppliers/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  try {
    const suppliers = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (suppliers.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    res.json(suppliers[0]);
  } catch (error) {
    console.error('获取供应商失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/suppliers', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note } = req.body;
  try {
    // 检查供应商ID是否已存在
    const existing = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: '供应商ID已存在，请重新输入' });
    }
    const created_at = new Date().toISOString();
    await run('INSERT INTO suppliers (id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note, created_at]);
    const newSupplier = { id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note, created_at };
    // 重新加载数据
    await loadData();
    res.json(newSupplier);
  } catch (error) {
    console.error('添加供应商失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.put('/api/suppliers/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note } = req.body;
  try {
    // 检查供应商是否存在
    const existing = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    await run('UPDATE suppliers SET name = ?, companyType = ?, mainProducts = ?, contact = ?, contactInfo = ?, canInvoice = ?, invoiceThreshold = ?, paymentLink = ?, note = ? WHERE id = ?', 
      [name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note, id]);
    const updatedSupplier = { ...existing[0], name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note };
    // 重新加载数据
    await loadData();
    res.json(updatedSupplier);
  } catch (error) {
    console.error('更新供应商失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.delete('/api/suppliers/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  try {
    // 检查供应商是否存在
    const existing = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    await run('DELETE FROM suppliers WHERE id = ?', [id]);
    // 重新加载数据
    await loadData();
    res.json({ message: '供应商删除成功' });
  } catch (error) {
    console.error('删除供应商失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 产品 API
app.get('/api/products', checkPermission(['业务员', '采购员']), async (req, res) => {
  try {
    const { search } = req.query;
    let products;
    if (search) {
      products = await query(`
        SELECT * FROM products 
        WHERE id LIKE ? OR englishName LIKE ? OR chineseName LIKE ? OR supplierName LIKE ?
        ORDER BY created_at DESC
      `, [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]);
    } else {
      products = await query('SELECT * FROM products ORDER BY created_at DESC');
    }
    res.json(products);
  } catch (error) {
    console.error('获取产品列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/products/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  try {
    const products = await query('SELECT * FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({ error: '产品不存在' });
    }
    res.json(products[0]);
  } catch (error) {
    console.error('获取产品信息失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/products', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, purchasePrice, purchaseLink, purchaseChannel, features } = req.body;
  try {
    // 检查产品ID是否已存在
    const existing = await query('SELECT * FROM products WHERE id = ?', [id]);
    if (existing.length > 0) {
      return res.status(400).json({ error: '产品ID已存在，请重新输入' });
    }
    // 查找供应商信息
    const supplier = await query('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
    if (supplier.length === 0) {
      return res.status(400).json({ error: '供应商ID不存在，请选择正确的供应商' });
    }
    const created_at = new Date().toISOString();
    await run('INSERT INTO products (id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName, purchasePriceLess100, purchasePriceMore100, purchasePrice, purchaseLink, purchaseChannel, features, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplier[0].name, purchasePrice, purchasePrice, purchasePrice, purchaseLink, purchaseChannel, features, created_at]);
    const newProduct = { id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName: supplier[0].name, purchasePrice, purchaseLink, purchaseChannel, features, created_at };
    // 重新加载数据
    await loadData();
    res.json(newProduct);
  } catch (error) {
    console.error('添加产品失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.put('/api/products/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, purchasePrice, purchaseLink, purchaseChannel, features } = req.body;
  try {
    // 检查产品是否存在
    const existing = await query('SELECT * FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '产品不存在' });
    }
    // 查找供应商信息
    const supplier = await query('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
    if (supplier.length === 0) {
      return res.status(400).json({ error: '供应商ID不存在，请选择正确的供应商' });
    }
    await run('UPDATE products SET englishName = ?, chineseName = ?, salesPriceLess100 = ?, salesPriceMore100 = ?, supplierId = ?, supplierName = ?, purchasePriceLess100 = ?, purchasePriceMore100 = ?, purchaseLink = ?, purchaseChannel = ?, features = ? WHERE id = ?', 
      [englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplier[0].name, purchasePrice, purchasePrice, purchaseLink || '', purchaseChannel || '', features || '', id]);
    const updatedProduct = { ...existing[0], englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName: supplier[0].name, purchasePrice, purchaseLink: purchaseLink || '', purchaseChannel: purchaseChannel || '', features: features || '' };
    // 重新加载数据
    await loadData();
    res.json(updatedProduct);
  } catch (error) {
    console.error('更新产品失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.delete('/api/products/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  try {
    // 检查产品是否存在
    const existing = await query('SELECT * FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '产品不存在' });
    }
    await run('DELETE FROM products WHERE id = ?', [id]);
    // 重新加载数据
    await loadData();
    res.json({ message: '产品删除成功' });
  } catch (error) {
    console.error('删除产品失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 客户 API
// 获取国家列表（支持模糊搜索）
app.get('/api/countries', checkPermission(['业务员', '采购员']), (req, res) => {
  const { search } = req.query;
  let countries = Object.entries(countryCodes).map(([code, name]) => ({ code, name }));
  
  if (search) {
    countries = countries.filter(c => c.name.includes(search) || c.code.toLowerCase().includes(search.toLowerCase()));
  }
  
  countries.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  res.json(countries);
});

app.get('/api/customers', checkPermission(['业务员', '采购员']), async (req, res) => {
  try {
    const { search } = req.query;
    let customers;
    if (search) {
      customers = await query(`
        SELECT * FROM customers 
        WHERE id LIKE ? OR companyName LIKE ? OR companyShortName LIKE ? OR contact LIKE ? OR country LIKE ?
        ORDER BY created_at DESC
      `, [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]);
    } else {
      customers = await query('SELECT * FROM customers ORDER BY created_at DESC');
    }
    res.json(customers);
  } catch (error) {
    console.error('获取客户列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/customers/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  try {
    const customers = await query('SELECT * FROM customers WHERE id = ?', [id]);
    if (customers.length === 0) {
      return res.status(404).json({ error: '客户不存在' });
    }
    res.json(customers[0]);
  } catch (error) {
    console.error('获取客户信息失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/customers', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { companyName, companyShortName, contact, country, website, companySize } = req.body;
  try {
    // 检查公司名称是否已存在
    const existingName = await query('SELECT * FROM customers WHERE companyName = ?', [companyName]);
    if (existingName.length > 0) {
      return res.status(400).json({ error: '公司名称已存在，请重新输入' });
    }
    
    // 获取国家代码
    const countryCode = getCountryCode(country);
    
    // 生成客户ID：国家代码 + 4位流水号
    const existingCustomers = await query('SELECT * FROM customers WHERE countryCode = ?', [countryCode]);
    const nextNumber = existingCustomers.length + 1;
    const id = countryCode + String(nextNumber).padStart(4, '0');
    
    const created_at = new Date().toISOString();
    await run('INSERT INTO customers (id, companyName, companyShortName, contact, country, countryCode, website, companySize, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', 
      [id, companyName, companyShortName, contact, country, countryCode, website, companySize, created_at]);
    const newCustomer = { id, companyName, companyShortName, contact, country, countryCode, website, companySize, created_at };
    // 重新加载数据
    await loadData();
    res.json(newCustomer);
  } catch (error) {
    console.error('添加客户失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.put('/api/customers/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { companyName, companyShortName, contact, country, website, companySize } = req.body;
  try {
    // 检查客户是否存在
    const existing = await query('SELECT * FROM customers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '客户不存在' });
    }
    // 检查公司名称是否已被其他客户使用
    const existingName = await query('SELECT * FROM customers WHERE companyName = ? AND id != ?', [companyName, id]);
    if (existingName.length > 0) {
      return res.status(400).json({ error: '公司名称已存在，请重新输入' });
    }
    await run('UPDATE customers SET companyName = ?, companyShortName = ?, contact = ?, country = ?, website = ?, companySize = ? WHERE id = ?', 
      [companyName, companyShortName, contact, country, website, companySize, id]);
    const updatedCustomer = { ...existing[0], companyName, companyShortName, contact, country, website, companySize };
    // 重新加载数据
    await loadData();
    res.json(updatedCustomer);
  } catch (error) {
    console.error('更新客户失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.delete('/api/customers/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  try {
    // 检查客户是否存在
    const existing = await query('SELECT * FROM customers WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '客户不存在' });
    }
    await run('DELETE FROM customers WHERE id = ?', [id]);
    // 重新加载数据
    await loadData();
    res.json({ message: '客户删除成功' });
  } catch (error) {
    console.error('删除客户失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 库存 API
app.get('/api/inventory', checkPermission(['业务员', '采购员']), async (req, res) => {
  try {
    const { search } = req.query;
    let inventory;
    if (search) {
      inventory = await query(`
        SELECT * FROM inventory 
        WHERE productId LIKE ? OR englishName LIKE ? OR chineseName LIKE ? OR warehouse LIKE ?
        ORDER BY created_at DESC
      `, [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]);
    } else {
      inventory = await query('SELECT * FROM inventory ORDER BY created_at DESC');
    }
    res.json(inventory);
  } catch (error) {
    console.error('获取库存列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/inventory/:productId', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { productId } = req.params;
  try {
    const inventory = await query('SELECT * FROM inventory WHERE productId = ?', [productId]);
    if (inventory.length === 0) {
      return res.status(404).json({ error: '库存记录不存在' });
    }
    res.json(inventory[0]);
  } catch (error) {
    console.error('获取库存信息失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.post('/api/inventory', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { productId, quantity, warehouse } = req.body;
  try {
    // 检查产品ID是否已存在于库存中
    const existing = await query('SELECT * FROM inventory WHERE productId = ?', [productId]);
    if (existing.length > 0) {
      return res.status(400).json({ error: '产品ID已存在于库存中，请使用编辑功能更新' });
    }
    // 查找产品信息
    const product = await query('SELECT * FROM products WHERE id = ?', [productId]);
    if (product.length === 0) {
      return res.status(400).json({ error: '产品ID不存在，请选择正确的产品' });
    }
    const created_at = new Date().toISOString();
    await run('INSERT INTO inventory (productId, englishName, chineseName, quantity, warehouse, created_at) VALUES (?, ?, ?, ?, ?, ?)', 
      [productId, product[0].englishName, product[0].chineseName, quantity, warehouse, created_at]);
    const newInventory = { productId, englishName: product[0].englishName, chineseName: product[0].chineseName, quantity, warehouse, created_at };
    // 重新加载数据
    await loadData();
    res.json(newInventory);
  } catch (error) {
    console.error('添加库存失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.put('/api/inventory/:productId', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { productId } = req.params;
  const { quantity, warehouse } = req.body;
  try {
    // 检查库存记录是否存在
    const existing = await query('SELECT * FROM inventory WHERE productId = ?', [productId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '库存记录不存在' });
    }
    await run('UPDATE inventory SET quantity = ?, warehouse = ? WHERE productId = ?', 
      [quantity, warehouse, productId]);
    const updatedInventory = { ...existing[0], quantity, warehouse };
    // 重新加载数据
    await loadData();
    res.json(updatedInventory);
  } catch (error) {
    console.error('更新库存失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.delete('/api/inventory/:productId', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { productId } = req.params;
  try {
    // 检查库存记录是否存在
    const existing = await query('SELECT * FROM inventory WHERE productId = ?', [productId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: '库存记录不存在' });
    }
    await run('DELETE FROM inventory WHERE productId = ?', [productId]);
    // 重新加载数据
    await loadData();
    res.json({ message: '库存记录删除成功' });
  } catch (error) {
    console.error('删除库存失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 生成PI编号
function generatePINumber() {
  const today = new Date();
  const dateStr = today.getFullYear().toString() + 
                 (today.getMonth() + 1).toString().padStart(2, '0') + 
                 today.getDate().toString().padStart(2, '0');
  
  const todayPIs = piList.filter(pi => pi.id.startsWith(`PI${dateStr}`));
  const serialNumber = (todayPIs.length + 1).toString().padStart(3, '0');
  
  return `PI${dateStr}${serialNumber}`;
}

// 计算产品价格
function calculateProductPrice(product, quantity) {
  if (quantity < 100) {
    return parseFloat(product.salesPriceLess100) || 0;
  } else {
    return parseFloat(product.salesPriceMore100) || 0;
  }
}

// PI API
app.get('/api/pi', checkPermission(['业务员', '采购员']), async (req, res) => {
  try {
    const { search } = req.query;
    let piRecords;
    if (search) {
      piRecords = await query(`
        SELECT * FROM pi 
        WHERE id LIKE ? OR customerName LIKE ? OR status LIKE ?
        ORDER BY created_at DESC
      `, [`%${search}%`, `%${search}%`, `%${search}%`]);
    } else {
      piRecords = await query('SELECT * FROM pi ORDER BY created_at DESC');
    }
    
    // 解析products字段
    piRecords.forEach(pi => {
      pi.products = JSON.parse(pi.products);
    });
    
    res.json(piRecords);
  } catch (error) {
    console.error('获取PI列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

app.get('/api/pi/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const pi = piList.find(p => p.id === id);
  if (!pi) {
    return res.status(404).json({ error: 'PI不存在' });
  }
  res.json(pi);
});

app.post('/api/pi', checkPermission(['业务员', '采购员']), (req, res) => {
  const { customerId, products, note } = req.body;
  
  // 检查客户是否存在
  const customer = customers.find(c => c.id === customerId);
  if (!customer) {
    return res.status(400).json({ error: '客户不存在' });
  }
  
  // 计算产品价格和总金额
  let totalAmount = 0;
  const piProducts = [];
  
  for (const item of products) {
    const product = global.products.find(p => p.id === item.productId);
    if (!product) {
      return res.status(400).json({ error: `产品 ${item.productId} 不存在` });
    }
    
    const unitPrice = calculateProductPrice(product, item.quantity);
    const productTotal = unitPrice * item.quantity;
    totalAmount += productTotal;
    
    piProducts.push({
      productId: item.productId,
      productName: product.chineseName,
      quantity: item.quantity,
      unitPrice: unitPrice.toFixed(2),
      totalPrice: productTotal.toFixed(2)
    });
  }
  
  // 生成PI编号
  const piId = generatePINumber();
  
  const newPI = {
    id: piId,
    customerId,
    customerName: customer.companyName,
    products: piProducts,
    totalAmount: totalAmount.toFixed(2),
    note,
    status: '已生成',
    created_at: new Date().toISOString()
  };
  
  // 保存到数据库
  db.run('INSERT INTO pi (id, customerId, customerName, products, totalAmount, note, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [piId, customerId, customer.companyName, JSON.stringify(piProducts), totalAmount.toFixed(2), note, '已生成', new Date().toISOString()], (err) => {
      if (err) {
        console.error('保存PI到数据库失败:', err);
        return res.status(500).json({ error: '保存PI失败' });
      }
      
      piList.push(newPI);
      res.json(newPI);
    });
});

app.put('/api/pi/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const { products, note } = req.body;
  
  const pi = piList.find(p => p.id === id);
  if (!pi) {
    return res.status(404).json({ error: 'PI不存在' });
  }
  
  if (pi.status === '已完成') {
    return res.status(400).json({ error: '已完成的PI不可编辑' });
  }
  
  // 重新计算产品价格和总金额
  let totalAmount = 0;
  const piProducts = [];
  
  for (const item of products) {
    const product = global.products.find(p => p.id === item.productId);
    if (!product) {
      return res.status(400).json({ error: `产品 ${item.productId} 不存在` });
    }
    
    const unitPrice = calculateProductPrice(product, item.quantity);
    const productTotal = unitPrice * item.quantity;
    totalAmount += productTotal;
    
    piProducts.push({
      productId: item.productId,
      productName: product.chineseName,
      quantity: item.quantity,
      unitPrice: unitPrice.toFixed(2),
      totalPrice: productTotal.toFixed(2)
    });
  }
  
  // 更新PI
  pi.products = piProducts;
  pi.totalAmount = totalAmount.toFixed(2);
  pi.note = note;
  
  // 保存到数据库
  db.run('UPDATE pi SET products = ?, totalAmount = ?, note = ? WHERE id = ?', 
    [JSON.stringify(piProducts), totalAmount.toFixed(2), note, id], (err) => {
      if (err) {
        console.error('更新PI到数据库失败:', err);
        return res.status(500).json({ error: '更新PI失败' });
      }
      
      res.json(pi);
    });
});

app.delete('/api/pi/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const pi = piList.find(p => p.id === id);
  if (!pi) {
    return res.status(404).json({ error: 'PI不存在' });
  }
  
  if (pi.status === '已完成') {
    return res.status(400).json({ error: '已完成的PI不可删除' });
  }
  
  // 从数据库删除
  db.run('DELETE FROM pi WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('从数据库删除PI失败:', err);
      return res.status(500).json({ error: '删除PI失败' });
    }
    
    const index = piList.indexOf(pi);
    piList.splice(index, 1);
    
    res.json({ message: 'PI删除成功' });
  });
});

app.put('/api/pi/status/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const pi = piList.find(p => p.id === id);
  if (!pi) {
    return res.status(404).json({ error: 'PI不存在' });
  }
  
  if (pi.status === '已完成') {
    return res.status(400).json({ error: 'PI已经是已完成状态' });
  }
  
  if (status !== '已完成') {
    return res.status(400).json({ error: '只能将PI状态修改为已完成' });
  }
  
  pi.status = status;
  
  // 自动触发采购单生成（如果需要）
  // 这里可以添加采购单生成逻辑
  
  res.json(pi);
});

app.get('/api/pi/export/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const pi = piList.find(p => p.id === id);
  if (!pi) {
    return res.status(404).json({ error: 'PI不存在' });
  }
  
  // 创建固定格式的Excel工作簿
  const workbook = XLSX.utils.book_new();
  
  // 创建PI信息工作表
  const piInfoData = [
    // 标题行
    ['', '', '', '', '', '', '', 'PROFORMA INVOICE (PI) 形式发票'],
    [],
    // 发票号
    ['INVOICE NO.: (发票号)', pi.id],
    [],
    // 公司信息
    ['Company:', 'SmartSys-tech'],
    ['Address:', 'Demi gros lane, plaine magnien'],
    ['', '51516'],
    ['', 'Grand port'],
    ['', 'Mauritius 473910'],
    ['Email:', 'luvnish.daby@smartsys-tech.com'],
    [],
    // 产品表格标题
    ['Picture', 'Item #', 'Description of Goods', 'QTY (Pcs)', 'Unit Price (US$)', 'Amount (US$)'],
    []
  ];
  
  // 添加产品数据
  let itemNumber = 5;
  pi.products.forEach(product => {
    piInfoData.push([
      '',  // Picture列留空
      `SLS${itemNumber}`,
      product.productName || '',
      product.quantity || 0,
      `$${(product.unitPrice || 0).toFixed(2)}`,
      `$${(product.totalPrice || 0).toFixed(2)}`
    ]);
    itemNumber++;
  });
  
  // 添加空行和运输信息
  piInfoData.push([]);
  piInfoData.push(['Shipping', '', '', '', '', '']);
  piInfoData.push(['', '', '', '', '', '']);
  piInfoData.push(['', '', '', '', '', '$50.00']);
  piInfoData.push([]);
  
  // 添加总金额
  piInfoData.push(['', '', '', '', 'TOTAL', `$${(pi.totalAmount || 0).toFixed(2)}`]);
  piInfoData.push([]);
  
  // 添加付款条款
  piInfoData.push(['* Payment terms:', '100% deposit to start order.']);
  piInfoData.push(['* Lead time:', '7 days after payment received.']);
  piInfoData.push([]);
  
  // 添加银行账户信息
  piInfoData.push(['Bank Account (USD):']);
  piInfoData.push(['Bank Account (USD):']);
  piInfoData.push(['Beneficiary Bank:', 'BANK OF NINGBO']);
  piInfoData.push(['Address:', 'NO. 345 NINGDONG ROAD, YINZHOU DISTRICT, P.R.CHINA, 315042']);
  piInfoData.push(['SWIFT address:', 'BKCNCN2NXXX']);
  piInfoData.push(['Beneficiary Name:', 'Salingsi (wenzhou) Electronics Co., Ltd.']);
  piInfoData.push(['Beneficiary A/C No:', '860111000000000007542']);
  piInfoData.push([]);
  
  // 添加PayPal账户
  piInfoData.push(['PayPal Account:', 'SLSELE@163.COM']);
  piInfoData.push([]);
  
  // 添加签名区域
  piInfoData.push(['The Buyer Signature:', '', '', '', '', 'The Seller Signature:']);
  piInfoData.push(['', '', '', '', '', '']);
  piInfoData.push(['', '', '', '', '', '赛灵思（温州）电子有限公司']);
  piInfoData.push(['', '', '', '', '', 'Salingsi(Wenzhou)ElectronicsCo.,Ltd.']);
  
  // 创建工作表并添加到工作簿
  const worksheet = XLSX.utils.aoa_to_sheet(piInfoData);
  
  // 设置列宽
  worksheet['!cols'] = [
    { wch: 10 },  // Picture
    { wch: 10 },  // Item #
    { wch: 45 },  // Description of Goods
    { wch: 12 },  // QTY (Pcs)
    { wch: 18 },  // Unit Price (US$)
    { wch: 15 }   // Amount (US$)
  ];
  
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PI');
  
  // 生成Excel文件
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
  
  // 设置响应头
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=PI_${id}.xlsx`);
  
  // 发送Excel文件
  res.send(excelBuffer);
});

// 采购单相关API

// 生成采购单编号
async function generatePurchaseOrderId() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `CG${date}`;
  
  try {
    const existingOrders = await query('SELECT id FROM purchaseOrders WHERE id LIKE ?', [`${prefix}%`]);
    const existingIds = existingOrders
      .map(po => parseInt(po.id.slice(prefix.length), 10))
      .filter(num => !isNaN(num))
      .sort((a, b) => b - a);
    
    const sequence = existingIds.length > 0 ? existingIds[0] + 1 : 1;
    return `${prefix}${sequence.toString().padStart(3, '0')}`;
  } catch (error) {
    console.error('生成采购单编号失败:', error);
    // 出错时使用时间戳作为备选
    return `${prefix}${Date.now().toString().slice(-3)}`;
  }
}

// 按供应商分组生成采购单
async function generatePurchaseOrdersFromPI(pi) {
  if (!pi) {
    throw new Error('PI不存在');
  }
  
  // 按供应商分组产品
  const productsBySupplier = pi.products.reduce((groups, product) => {
    const productInfo = products.find(p => p.id === product.productId);
    if (!productInfo) return groups;
    
    const supplierId = productInfo.supplierId;
    if (!groups[supplierId]) {
      groups[supplierId] = {
        supplierId,
        supplierName: productInfo.supplierName,
        products: []
      };
    }
    groups[supplierId].products.push({
      ...product,
      supplierId: productInfo.supplierId,
      supplierName: productInfo.supplierName
    });
    return groups;
  }, {});
  
  // 为每个供应商生成采购单
  const newPurchaseOrders = [];
  for (const group of Object.values(productsBySupplier)) {
    // 计算每个产品的采购价格和总价
    const poProducts = group.products.map(product => {
      const productInfo = products.find(p => p.id === product.productId);
      const unitPrice = product.quantity < 100 
        ? productInfo.purchasePriceLess100 
        : productInfo.purchasePriceMore100;
      const totalPrice = (parseFloat(unitPrice) * product.quantity).toFixed(2);
      
      return {
        productId: product.productId,
        productName: product.productName,
        quantity: product.quantity,
        unitPrice,
        totalPrice
      };
    });
    
    // 计算采购单总金额
    const totalAmount = poProducts.reduce((sum, product) => {
      return sum + parseFloat(product.totalPrice);
    }, 0).toFixed(2);
    
    // 创建采购单
    const purchaseOrderId = await generatePurchaseOrderId();
    const created_at = new Date().toISOString();
    
    const purchaseOrder = {
      id: purchaseOrderId,
      piId: pi.id,
      supplierId: group.supplierId,
      supplierName: group.supplierName,
      products: poProducts,
      totalAmount,
      status: '已生成',
      purchaseNote: '',
      invoiceNote: '',
      trackingNumbers: '',
      created_at,
      updated_at: created_at
    };
    
    // 保存到数据库
    await run('INSERT INTO purchaseOrders (id, piId, supplierId, supplierName, products, totalAmount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [purchaseOrderId, pi.id, group.supplierId, group.supplierName, JSON.stringify(poProducts), totalAmount, '已生成', created_at]);
    
    newPurchaseOrders.push(purchaseOrder);
  }
  
  // 重新加载数据
  await loadData();
  return newPurchaseOrders;
}

// 生成采购单
app.post('/api/purchase-orders/generate', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { piId } = req.body;
  
  try {
    // 从数据库获取PI
    const piList = await query('SELECT * FROM pi WHERE id = ?', [piId]);
    if (piList.length === 0) {
      return res.status(404).json({ error: 'PI不存在' });
    }
    const pi = piList[0];
    pi.products = JSON.parse(pi.products);
    
    if (pi.status !== '已生成' && pi.status !== '已完成') {
      return res.status(400).json({ error: '只能选择已生成或已完成状态的PI' });
    }
    
    const newPurchaseOrders = await generatePurchaseOrdersFromPI(pi);
    res.json({ count: newPurchaseOrders.length, purchaseOrders: newPurchaseOrders });
  } catch (error) {
    console.error('生成采购单失败:', error);
    res.status(400).json({ error: error.message });
  }
});

// 新增采购单
app.post('/api/purchase-orders', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { piId, supplierId, note, products } = req.body;
  
  try {
    // 验证供应商是否存在
    const suppliers = await query('SELECT * FROM suppliers WHERE id = ?', [supplierId]);
    if (suppliers.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    const supplierName = suppliers[0].name;
    
    // 验证产品信息
    if (!products || products.length === 0) {
      return res.status(400).json({ error: '请至少添加一个商品' });
    }
    
    // 计算总价
    let totalAmount = 0;
    const processedProducts = products.map(product => {
      const totalPrice = (parseFloat(product.unitPrice) * product.quantity).toFixed(2);
      totalAmount += parseFloat(totalPrice);
      return {
        productId: product.productId,
        productName: product.productName || '',
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        totalPrice,
        purchaseLink: product.purchaseLink || ''
      };
    });
    
    // 生成采购单号
    const now = new Date();
    const orderId = 'CG' + now.getFullYear().toString().slice(2) + 
                   String(now.getMonth() + 1).padStart(2, '0') + 
                   String(now.getDate()).padStart(2, '0') + 
                   String(Date.now()).slice(-3);
    
    // 获取关联PI的客户信息（如果有）
    let customerName = '';
    if (piId) {
      const piList = await query('SELECT * FROM pi WHERE id = ?', [piId]);
      if (piList.length > 0) {
        customerName = piList[0].customerName;
      }
    }
    
    // 根据是否有PI单号设置数据来源
    const dataSource = piId ? '从PI单中生成' : '手动新增';
    
    // 插入数据库
    await run(`INSERT INTO purchaseOrders 
      (id, piId, supplierId, supplierName, products, totalAmount, status, created_at, dataSource)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderId, piId || '', supplierId, supplierName, JSON.stringify(processedProducts), 
       totalAmount.toFixed(2), '已生成', now.toISOString(), dataSource]
    );
    
    // 重新加载数据
    await loadData();
    
    // 返回创建的采购单
    const newPurchaseOrder = {
      id: orderId,
      piId: piId || '',
      supplierId,
      supplierName,
      products: processedProducts,
      totalAmount: totalAmount.toFixed(2),
      status: '已生成',
      created_at: now.toISOString(),
      dataSource
    };
    
    res.json(newPurchaseOrder);
  } catch (error) {
    console.error('保存采购单失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除采购单
app.delete('/api/purchase-orders/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  
  try {
    // 检查采购单是否存在
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    // 检查采购单状态，只有"已生成"状态可以删除
    const purchaseOrder = purchaseOrders[0];
    if (purchaseOrder.status !== '已生成') {
      return res.status(400).json({ error: '只有"已生成"状态的采购单才能删除' });
    }
    
    // 删除采购单
    await run('DELETE FROM purchaseOrders WHERE id = ?', [id]);
    
    // 重新加载数据
    await loadData();
    
    res.json({ success: true });
  } catch (error) {
    console.error('删除采购单失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取采购单列表
app.get('/api/purchase-orders', checkPermission(['业务员', '采购员']), async (req, res) => {
  try {
    const { search } = req.query;
    console.log('查询采购单列表，search:', search);
    let purchaseOrders;
    if (search) {
      purchaseOrders = await query(`
        SELECT * FROM purchaseOrders 
        WHERE id LIKE ? OR piId LIKE ? OR supplierName LIKE ? OR status LIKE ?
        ORDER BY created_at DESC
      `, [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`]);
    } else {
      purchaseOrders = await query('SELECT * FROM purchaseOrders ORDER BY created_at DESC');
    }
    console.log('查询结果数量:', purchaseOrders.length);
    
    // 获取所有PI信息
    const piRecords = await query('SELECT * FROM pi');
    const piMap = {};
    piRecords.forEach(pi => {
      piMap[pi.id] = {
        customerName: pi.customerName,
        totalAmount: pi.totalAmount,
        created_at: pi.created_at
      };
    });
    
    // 解析JSON字段并添加PI信息
    purchaseOrders.forEach(po => {
      po.products = JSON.parse(po.products);
      if (po.trackingNumbers && po.trackingNumbers !== '') {
        try {
          po.trackingNumbers = JSON.parse(po.trackingNumbers);
        } catch (e) {
          po.trackingNumbers = [];
        }
      } else {
        po.trackingNumbers = [];
      }
      // 添加PI信息
      if (po.piId && piMap[po.piId]) {
        po.piCustomerName = piMap[po.piId].customerName;
        po.piTotalAmount = piMap[po.piId].totalAmount;
        po.piCreatedAt = piMap[po.piId].created_at;
      }
    });
    res.json(purchaseOrders);
  } catch (error) {
    console.error('获取采购单列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 根据PI单号获取采购单列表（必须在 /:id 路由之前）
app.get('/api/purchase-orders/by-pi/:piId', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { piId } = req.params;
  
  try {
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE piId = ?', [piId]);
    
    const result = purchaseOrders.map(order => {
      let products = [];
      try {
        products = order.products ? JSON.parse(order.products) : [];
      } catch (e) {
        products = [];
      }
      return {
        ...order,
        products
      };
    });
    
    res.json(result);
  } catch (error) {
    console.error('获取采购单列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取单个采购单
app.get('/api/purchase-orders/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  try {
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    const purchaseOrder = purchaseOrders[0];
    purchaseOrder.products = JSON.parse(purchaseOrder.products);
    if (purchaseOrder.trackingNumbers && purchaseOrder.trackingNumbers !== '') {
      purchaseOrder.trackingNumbers = JSON.parse(purchaseOrder.trackingNumbers);
    } else {
      purchaseOrder.trackingNumbers = [];
    }
    res.json(purchaseOrder);
  } catch (error) {
    console.error('获取采购单失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 编辑采购单
app.put('/api/purchase-orders/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { supplierId, note, products } = req.body;
  
  try {
    // 检查采购单是否存在
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    // 重新计算产品总价和总金额
    let totalAmount = 0;
    const updatedProducts = products.map(product => {
      const totalPrice = (parseFloat(product.unitPrice) * product.quantity).toFixed(2);
      totalAmount += parseFloat(totalPrice);
      return {
        ...product,
        totalPrice
      };
    });
    
    // 更新数据库 - 支持更新供应商ID和产品
    await run('UPDATE purchaseOrders SET supplierId = ?, products = ?, totalAmount = ? WHERE id = ?', 
      [supplierId, JSON.stringify(updatedProducts), totalAmount.toFixed(2), id]);
    
    const updatedPurchaseOrder = { ...purchaseOrders[0], supplierId, products: updatedProducts, totalAmount: totalAmount.toFixed(2) };
    // 重新加载数据
    await loadData();
    res.json(updatedPurchaseOrder);
  } catch (error) {
    console.error('更新采购单失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除采购单
app.delete('/api/purchase-orders/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  try {
    // 检查采购单是否存在
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    await run('DELETE FROM purchaseOrders WHERE id = ?', [id]);
    // 重新加载数据
    await loadData();
    res.json({ message: '采购单删除成功' });
  } catch (error) {
    console.error('删除采购单失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 采购单状态更新
app.put('/api/purchase-orders/:id/status', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  try {
    // 检查采购单是否存在
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    const updated_at = new Date().toISOString();
    
    // 如果状态更新为已完成，自动更新库存
    if (status === '已完成') {
      const purchaseOrder = purchaseOrders[0];
      purchaseOrder.products = JSON.parse(purchaseOrder.products);
      
      // 更新库存
      for (const product of purchaseOrder.products) {
        const inventoryList = await query('SELECT * FROM inventory WHERE productId = ?', [product.productId]);
        if (inventoryList.length > 0) {
          const currentQuantity = inventoryList[0].quantity;
          const newQuantity = currentQuantity + product.quantity;
          await run('UPDATE inventory SET quantity = ? WHERE productId = ?', [newQuantity, product.productId]);
        }
      }
    }
    
    // 更新采购单状态
    await run('UPDATE purchaseOrders SET status = ? WHERE id = ?', [status, id]);
    
    // 重新加载数据
    await loadData();
    
    // 返回更新后的采购单
    const updatedPurchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    const updatedPurchaseOrder = updatedPurchaseOrders[0];
    updatedPurchaseOrder.products = JSON.parse(updatedPurchaseOrder.products);
    if (updatedPurchaseOrder.trackingNumbers) {
      updatedPurchaseOrder.trackingNumbers = JSON.parse(updatedPurchaseOrder.trackingNumbers);
    }
    
    res.json(updatedPurchaseOrder);
  } catch (error) {
    console.error('更新采购单状态失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 历史采购价格查询
app.get('/api/purchase-orders/history/:productId', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { productId } = req.params;
  
  try {
    // 查询所有已完成的采购单，包含该产品
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE status = ?', ['已完成']);
    
    const history = [];
    purchaseOrders.forEach(po => {
      const products = JSON.parse(po.products);
      const product = products.find(p => p.productId === productId);
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
    });
    
    // 按采购时间倒序排列
    history.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
    
    res.json(history);
  } catch (error) {
    console.error('查询历史采购价格失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 采购备注管理
app.put('/api/purchase-orders/:id/note', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { purchaseNote, invoiceNote } = req.body;
  
  try {
    // 检查采购单是否存在
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    const updated_at = new Date().toISOString();
    
    // 更新备注
    await run('UPDATE purchaseOrders SET purchaseNote = ?, invoiceNote = ?, updated_at = ? WHERE id = ?', 
      [purchaseNote || '', invoiceNote || '', updated_at, id]);
    
    // 重新加载数据
    await loadData();
    
    // 返回更新后的采购单
    const updatedPurchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    const updatedPurchaseOrder = updatedPurchaseOrders[0];
    updatedPurchaseOrder.products = JSON.parse(updatedPurchaseOrder.products);
    if (updatedPurchaseOrder.trackingNumbers) {
      updatedPurchaseOrder.trackingNumbers = JSON.parse(updatedPurchaseOrder.trackingNumbers);
    }
    
    res.json(updatedPurchaseOrder);
  } catch (error) {
    console.error('更新采购单备注失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 快递单号管理
app.put('/api/purchase-orders/:id/tracking', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { trackingInfo } = req.body;
  
  try {
    // 检查采购单是否存在
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    const updated_at = new Date().toISOString();
    
    // 获取现有的快递信息
    let currentTracking = [];
    if (purchaseOrders[0].trackingNumbers && purchaseOrders[0].trackingNumbers !== '') {
      try {
        currentTracking = JSON.parse(purchaseOrders[0].trackingNumbers);
      } catch (e) {
        currentTracking = [];
      }
    }
    
    // 添加新的快递信息
    if (trackingInfo && trackingInfo.company && trackingInfo.number) {
      currentTracking.push({
        company: trackingInfo.company,
        number: trackingInfo.number,
        addedAt: updated_at
      });
    }
    
    // 更新快递单号
    await run('UPDATE purchaseOrders SET trackingNumbers = ?, updated_at = ? WHERE id = ?', 
      [JSON.stringify(currentTracking), updated_at, id]);
    
    // 重新加载数据
    await loadData();
    
    // 返回更新后的采购单
    const updatedPurchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    const updatedPurchaseOrder = updatedPurchaseOrders[0];
    updatedPurchaseOrder.products = JSON.parse(updatedPurchaseOrder.products);
    updatedPurchaseOrder.trackingNumbers = JSON.parse(updatedPurchaseOrder.trackingNumbers);
    
    res.json(updatedPurchaseOrder);
  } catch (error) {
    console.error('更新快递单号失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除快递单号
app.delete('/api/purchase-orders/:id/tracking/:index', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id, index } = req.params;
  
  try {
    // 检查采购单是否存在
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    const updated_at = new Date().toISOString();
    
    // 获取现有的快递信息
    let currentTracking = [];
    if (purchaseOrders[0].trackingNumbers && purchaseOrders[0].trackingNumbers !== '') {
      try {
        currentTracking = JSON.parse(purchaseOrders[0].trackingNumbers);
      } catch (e) {
        currentTracking = [];
      }
    }
    
    // 删除指定索引的快递信息
    const idx = parseInt(index);
    if (idx >= 0 && idx < currentTracking.length) {
      currentTracking.splice(idx, 1);
    }
    
    // 更新快递单号
    await run('UPDATE purchaseOrders SET trackingNumbers = ?, updated_at = ? WHERE id = ?', 
      [JSON.stringify(currentTracking), updated_at, id]);
    
    // 重新加载数据
    await loadData();
    
    // 返回更新后的采购单
    const updatedPurchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    const updatedPurchaseOrder = updatedPurchaseOrders[0];
    updatedPurchaseOrder.products = JSON.parse(updatedPurchaseOrder.products);
    updatedPurchaseOrder.trackingNumbers = JSON.parse(updatedPurchaseOrder.trackingNumbers);
    
    res.json(updatedPurchaseOrder);
  } catch (error) {
    console.error('删除快递单号失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新供应商开票状态
app.put('/api/suppliers/:id/invoice-status', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { invoiceStatus } = req.body;
  
  try {
    // 检查供应商是否存在
    const suppliers = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (suppliers.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    
    // 更新开票状态（只更新存在的字段）
    await run('UPDATE suppliers SET invoiceStatus = ? WHERE id = ?', 
      [invoiceStatus, id]);
    
    // 返回更新后的供应商
    const updatedSuppliers = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    res.json({ ...updatedSuppliers[0], invoiceStatus });
  } catch (error) {
    console.error('更新开票状态失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 上传供应商附件
const supplierAttachmentsUpload = multer({
  dest: 'uploads/supplier-attachments/',
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5 // 最多5个文件
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword' // .doc
    ];
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.endsWith('.pdf') ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls') ||
        file.originalname.endsWith('.docx') ||
        file.originalname.endsWith('.doc')) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'));
    }
  }
});

app.post('/api/suppliers/:id/attachments', checkPermission(['业务员', '采购员']), supplierAttachmentsUpload.array('files', 5), async (req, res) => {
  const { id } = req.params;
  const files = req.files;
  
  if (!files || files.length === 0) {
    return res.status(400).json({ error: '请上传文件' });
  }
  
  if (files.length > 5) {
    return res.status(400).json({ error: '最多只能上传5个文件' });
  }
  
  try {
    // 检查供应商是否存在
    const suppliers = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (suppliers.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    
    // 获取现有的附件
    let existingAttachments = [];
    if (suppliers[0].attachments) {
      try {
        existingAttachments = JSON.parse(suppliers[0].attachments);
      } catch (e) {
        existingAttachments = [];
      }
    }
    
    // 添加新上传的附件
    const newAttachments = files.map(file => ({
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      originalName: file.originalname,
      fileName: file.filename,
      filePath: file.path,
      fileSize: file.size,
      mimeType: file.mimetype,
      uploadedAt: new Date().toISOString()
    }));
    
    const allAttachments = [...existingAttachments, ...newAttachments];
    
    // 限制最多5个附件
    const attachmentsToSave = allAttachments.slice(-5);
    
    // 更新数据库
    await run('UPDATE suppliers SET attachments = ? WHERE id = ?', 
      [JSON.stringify(attachmentsToSave), id]);
    
    res.json({ 
      success: true, 
      message: '附件上传成功',
      attachments: attachmentsToSave
    });
  } catch (error) {
    console.error('上传附件失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除供应商附件
app.delete('/api/suppliers/:id/attachments/:attachmentId', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id, attachmentId } = req.params;
  
  try {
    // 检查供应商是否存在
    const suppliers = await query('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (suppliers.length === 0) {
      return res.status(404).json({ error: '供应商不存在' });
    }
    
    // 获取现有的附件
    let existingAttachments = [];
    if (suppliers[0].attachments) {
      try {
        existingAttachments = JSON.parse(suppliers[0].attachments);
      } catch (e) {
        existingAttachments = [];
      }
    }
    
    // 找到要删除的附件
    const attachmentToDelete = existingAttachments.find(a => a.id === attachmentId);
    if (!attachmentToDelete) {
      return res.status(404).json({ error: '附件不存在' });
    }
    
    // 删除文件
    const fs = require('fs');
    if (fs.existsSync(attachmentToDelete.filePath)) {
      fs.unlinkSync(attachmentToDelete.filePath);
    }
    
    // 从列表中移除
    const updatedAttachments = existingAttachments.filter(a => a.id !== attachmentId);
    const updated_at = new Date().toISOString();
    
    // 更新数据库
    await run('UPDATE suppliers SET attachments = ?, updated_at = ? WHERE id = ?', 
      [JSON.stringify(updatedAttachments), updated_at, id]);
    
    res.json({ 
      success: true, 
      message: '附件删除成功',
      attachments: updatedAttachments
    });
  } catch (error) {
    console.error('删除附件失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 查询商品历史采购记录
app.get('/api/purchase-orders/history/:productId', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { productId } = req.params;
  
  try {
    // 查询所有已完成的采购单，包含该产品
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE status = ?', ['已完成']);
    
    const history = [];
    purchaseOrders.forEach(po => {
      const products = JSON.parse(po.products);
      const product = products.find(p => p.productId === productId);
      if (product) {
        history.push({
          purchaseOrderId: po.id,
          productName: product.productName || product.chineseName || product.englishName || productId,
          supplierId: po.supplierId,
          supplierName: po.supplierName,
          quantity: product.quantity,
          unitPrice: product.unitPrice,
          totalPrice: product.totalPrice,
          purchaseDate: po.created_at
        });
      }
    });
    
    // 按采购时间倒序排列
    history.sort((a, b) => new Date(b.purchaseDate) - new Date(a.purchaseDate));
    
    res.json(history);
  } catch (error) {
    console.error('查询历史采购价格失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 商品信息更新
app.put('/api/purchase-orders/:id/products', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { products } = req.body;
  
  try {
    // 检查采购单是否存在
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    const purchaseOrder = purchaseOrders[0];
    let existingProducts = [];
    try {
      existingProducts = JSON.parse(purchaseOrder.products);
    } catch (e) {
      existingProducts = [];
    }
    
    // 更新商品信息
    products.forEach(productUpdate => {
      if (existingProducts[productUpdate.index]) {
        if (productUpdate.unitPrice !== undefined) {
          existingProducts[productUpdate.index].unitPrice = productUpdate.unitPrice;
        }
        if (productUpdate.shippingFee !== undefined) {
          existingProducts[productUpdate.index].shippingFee = productUpdate.shippingFee;
        }
        // 更新小计
        existingProducts[productUpdate.index].totalPrice = 
          (existingProducts[productUpdate.index].unitPrice || 0) * (existingProducts[productUpdate.index].quantity || 0) + 
          (existingProducts[productUpdate.index].shippingFee || 0);
      }
    });
    
    // 计算总金额
    const totalAmount = existingProducts.reduce((sum, p) => sum + (p.totalPrice || 0), 0);
    
    const updated_at = new Date().toISOString();
    
    // 更新采购单
    await run('UPDATE purchaseOrders SET products = ?, totalAmount = ?, updated_at = ? WHERE id = ?', 
      [JSON.stringify(existingProducts), totalAmount, updated_at, id]);
    
    // 更新库存（如果需要）
    for (const productUpdate of products) {
      if (productUpdate.inventory !== undefined && existingProducts[productUpdate.index]) {
        const productId = existingProducts[productUpdate.index].productId;
        await run('UPDATE inventory SET quantity = ?, updated_at = ? WHERE productId = ?', 
          [productUpdate.inventory, updated_at, productId]);
      }
    }
    
    // 重新加载数据
    await loadData();
    
    res.json({ success: true, message: '商品信息更新成功' });
  } catch (error) {
    console.error('更新商品信息失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取邮箱配置列表
app.get('/api/email-configs', checkPermission(['业务员', '采购员']), async (req, res) => {
  try {
    const emailConfigs = await query('SELECT id, email, status FROM emailConfigs WHERE status = "active"');
    res.json(emailConfigs);
  } catch (error) {
    console.error('获取邮箱配置列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 提醒管理
app.post('/api/reminders', checkPermission(['业务员', '采购员']), async (req, res) => {
  try {
    const { purchaseOrderId, reminderTime, content, email } = req.body;
    console.log('收到创建提醒请求:', { purchaseOrderId, reminderTime, content, email });
    
    // 检查采购单是否存在
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [purchaseOrderId]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    const created_at = new Date().toISOString();
    
    // 创建提醒
    const result = await run('INSERT INTO reminders (purchaseOrderId, reminderTime, content, email, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', 
      [purchaseOrderId, reminderTime, content, email, '待提醒', created_at, created_at]);
    
    // 返回创建的提醒
    const reminder = await query('SELECT * FROM reminders WHERE id = ?', [result.lastID]);
    res.json(reminder[0]);
  } catch (error) {
    console.error('创建提醒失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取提醒列表
app.get('/api/reminders/:purchaseOrderId', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { purchaseOrderId } = req.params;
  
  try {
    const reminders = await query('SELECT * FROM reminders WHERE purchaseOrderId = ?', [purchaseOrderId]);
    res.json(reminders);
  } catch (error) {
    console.error('获取提醒列表失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 更新提醒
app.put('/api/reminders/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { reminderTime, content, status } = req.body;
  
  try {
    // 检查提醒是否存在
    const reminders = await query('SELECT * FROM reminders WHERE id = ?', [id]);
    if (reminders.length === 0) {
      return res.status(404).json({ error: '提醒不存在' });
    }
    
    const updated_at = new Date().toISOString();
    
    // 更新提醒
    await run('UPDATE reminders SET reminderTime = ?, content = ?, status = ?, updated_at = ? WHERE id = ?', 
      [reminderTime, content, status || '待提醒', updated_at, id]);
    
    // 返回更新后的提醒
    const updatedReminders = await query('SELECT * FROM reminders WHERE id = ?', [id]);
    res.json(updatedReminders[0]);
  } catch (error) {
    console.error('更新提醒失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 删除提醒
app.delete('/api/reminders/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  
  try {
    // 检查提醒是否存在
    const reminders = await query('SELECT * FROM reminders WHERE id = ?', [id]);
    if (reminders.length === 0) {
      return res.status(404).json({ error: '提醒不存在' });
    }
    
    // 删除提醒
    await run('DELETE FROM reminders WHERE id = ?', [id]);
    
    res.json({ message: '提醒删除成功' });
  } catch (error) {
    console.error('删除提醒失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 获取采购单的提醒日志
app.get('/api/purchase-orders/:id/reminder-logs', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  
  try {
    // 检查采购单是否存在
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    
    // 获取提醒日志
    const logs = await query('SELECT * FROM reminderLogs WHERE purchaseOrderId = ? ORDER BY sentTime DESC', [id]);
    
    res.json(logs);
  } catch (error) {
    console.error('获取提醒日志失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 导出采购单
app.get('/api/purchase-orders/export/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  try {
    // 从数据库获取采购单
    const purchaseOrders = await query('SELECT * FROM purchaseOrders WHERE id = ?', [id]);
    if (purchaseOrders.length === 0) {
      return res.status(404).json({ error: '采购单不存在' });
    }
    const purchaseOrder = purchaseOrders[0];
    purchaseOrder.products = JSON.parse(purchaseOrder.products);
    
    // 创建固定格式的Excel工作簿
    const workbook = XLSX.utils.book_new();
    
    // 创建采购单信息工作表
    const poInfoData = [
      ['采购单'],
      [],
      ['采购单编号', purchaseOrder.id],
      ['关联PI编号', purchaseOrder.piId],
      ['供应商', purchaseOrder.supplierName],
      ['状态', purchaseOrder.status],
      ['日期', new Date(purchaseOrder.created_at).toLocaleDateString()],
      [],
      ['产品', '数量', '单价', '总价']
    ];
    
    // 添加产品数据
    purchaseOrder.products.forEach(product => {
      poInfoData.push([product.productName, product.quantity, product.unitPrice, product.totalPrice]);
    });
    
    // 添加总金额
    poInfoData.push([]);
    poInfoData.push(['总金额', '', '', purchaseOrder.totalAmount]);
    
    // 创建工作表并添加到工作簿
    const worksheet = XLSX.utils.aoa_to_sheet(poInfoData);
    
    // 设置列宽
    worksheet['!cols'] = [
      { wch: 30 }, // 产品列
      { wch: 10 }, // 数量列
      { wch: 10 }, // 单价列
      { wch: 15 }  // 总价列
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, '采购单信息');
    
    // 生成Excel文件
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
    
    // 设置响应头
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=CG${purchaseOrder.id}.xlsx`);
    
    // 发送Excel文件
    res.send(excelBuffer);
  } catch (error) {
    console.error('导出采购单失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 当PI状态变为已完成时自动生成采购单
app.put('/api/pi/status/:id', checkPermission(['业务员', '采购员']), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  try {
    // 检查PI是否存在
    const piList = await query('SELECT * FROM pi WHERE id = ?', [id]);
    if (piList.length === 0) {
      return res.status(404).json({ error: 'PI不存在' });
    }
    const pi = piList[0];
    
    if (pi.status === '已完成') {
      return res.status(400).json({ error: 'PI已经是已完成状态' });
    }
    
    if (status !== '已完成') {
      return res.status(400).json({ error: '只能将PI状态修改为已完成' });
    }
    
    // 更新PI状态
    await run('UPDATE pi SET status = ? WHERE id = ?', [status, id]);
    
    // 解析产品数据
    pi.products = JSON.parse(pi.products);
    pi.status = status;
    
    // 自动生成采购单
    const newPurchaseOrders = await generatePurchaseOrdersFromPI(pi);
    res.json({ ...pi, purchaseOrders: newPurchaseOrders });
  } catch (error) {
    console.error('更新PI状态失败:', error);
    res.status(500).json({ error: '服务器内部错误' });
  }
});

// 发送邮件函数
async function sendEmail(to, subject, text, reminderId, purchaseOrderId) {
  console.log('开始发送邮件到:', to);
  console.log('邮件主题:', subject);
  console.log('邮件内容:', text);
  
  const sentTime = new Date().toISOString();
  let status = '发送成功';
  let errorMessage = null;
  
  try {
    const info = await transporter.sendMail({
      from: 'gxhan0420@163.com', // 发件人邮箱
      to: to, // 收件人邮箱
      subject: subject, // 邮件主题
      text: text // 邮件内容
    });
    console.log('邮件发送成功:', info.messageId);
  } catch (error) {
    console.error('邮件发送失败:', error);
    status = '发送失败';
    errorMessage = error.message;
  }
  
  // 记录提醒日志
  db.run('INSERT INTO reminderLogs (reminderId, purchaseOrderId, sentTime, email, content, status, errorMessage, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
    [reminderId, purchaseOrderId, sentTime, to, text, status, errorMessage, sentTime], (err) => {
      if (err) {
        console.error('记录提醒日志失败:', err);
      } else {
        console.log('提醒日志记录成功');
      }
    });
}

// 获取当前北京时间（UTC+8）
function getBeijingTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const beijingTime = new Date(utc + 8 * 3600000);
  return beijingTime.toISOString().slice(0, 16); // 返回格式：YYYY-MM-DDTHH:mm
}

// 检查提醒任务
function checkReminders() {
  const now = getBeijingTime();
  console.log('检查提醒开始，当前北京时间:', now);
  
  // 先获取所有提醒记录，看看数据库中的实际数据
  db.all('SELECT * FROM reminders', (err, allReminders) => {
    if (err) {
      console.error('获取所有提醒记录失败:', err);
      return;
    }
    
    console.log('所有提醒记录:', allReminders);
    
    // 查找所有需要提醒的记录
    db.all('SELECT * FROM reminders WHERE status = "待提醒" AND reminderTime <= ?', [now], (err, reminders) => {
      if (err) {
        console.error('检查提醒失败:', err);
        return;
      }
      
      console.log('找到需要提醒的记录数:', reminders.length);
      console.log('需要提醒的记录:', reminders);
      
      reminders.forEach(reminder => {
        console.log('处理提醒记录:', reminder.id);
        // 查询采购单信息以获取供应商名称
        db.get('SELECT supplierName FROM purchaseOrders WHERE id = ?', [reminder.purchaseOrderId], (err, purchaseOrder) => {
          if (err) {
            console.error('获取采购单信息失败:', err);
            return;
          }
          
          const supplierName = purchaseOrder ? purchaseOrder.supplierName : '未知供应商';
          console.log('获取供应商名称:', supplierName);
          
          // 发送提醒邮件
          if (reminder.email) {
            console.log('发送邮件到:', reminder.email);
            sendEmail(
              reminder.email,
              '采购单提醒',
              `提醒内容：${reminder.content}\n\n采购单号：${reminder.purchaseOrderId}\n供应商：${supplierName}\n提醒时间：${reminder.reminderTime}`,
              reminder.id,
              reminder.purchaseOrderId
            );
          }
          
          // 更新提醒状态为已提醒
          console.log('更新提醒状态为已提醒:', reminder.id);
          db.run('UPDATE reminders SET status = "已提醒", updated_at = ? WHERE id = ?', [now, reminder.id]);
        });
      });
    });
  });
}

// 启动服务器
function startServer() {
  // 创建上传目录
  const uploadsDir = path.join(__dirname, 'uploads', 'supplier-attachments');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('已创建上传目录:', uploadsDir);
  }
  
  app.listen(PORT, () => {
    console.log(`后端服务器运行在 http://localhost:${PORT}`);
    
    // 每1分钟检查一次提醒（减少延迟）
    setInterval(checkReminders, 1 * 60 * 1000);
    
    // 启动时检查一次
    checkReminders();
  });
}

// 当数据库初始化完成后启动服务器
initDatabase(() => {
  loadData().then(() => {
    // 初始化模板
    initializeTemplates();
    startServer();
  }).catch(error => {
    console.error('启动服务器失败:', error);
  });
});

// 导出应用供Vercel Serverless使用
module.exports = app;
