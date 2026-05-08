const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
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

// 内存数据存储
let customers = [];
let suppliers = [];
let products = [];
let purchaseOrders = [];
let inventory = [];
let piList = [];

// 国家代码映射（完整的ISO 3166-1 Alpha-2）
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

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 国家列表
app.get('/api/countries', (req, res) => {
  const countries = Object.entries(countryCodes).map(([code, name]) => ({ code, name }));
  res.json(countries);
});

// 客户接口
app.get('/api/customers', (req, res) => {
  const { search } = req.query;
  let result = customers;
  if (search) {
    result = customers.filter(c => c.id.includes(search) || c.companyName.includes(search));
  }
  res.json(result);
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
    console.error('Error creating customer:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.put('/api/customers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { companyName, companyShortName, contact, country, website, companySize } = req.body;
    const index = customers.findIndex(c => c.id === id);
    if (index === -1) {
      return res.json({ success: false, error: '客户不存在' });
    }
    const countryCode = getCountryCode(country);
    customers[index] = {
      ...customers[index],
      companyName,
      companyShortName: companyShortName || '',
      contact,
      country,
      countryCode,
      website: website || '',
      companySize: companySize || ''
    };
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating customer:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.delete('/api/customers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const index = customers.findIndex(c => c.id === id);
    if (index === -1) {
      return res.json({ success: false, error: '客户不存在' });
    }
    customers.splice(index, 1);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting customer:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 供应商接口
app.get('/api/suppliers', (req, res) => {
  const { search } = req.query;
  let result = suppliers;
  if (search) {
    result = suppliers.filter(s => s.id.includes(search) || s.name.includes(search));
  }
  res.json(result);
});

app.post('/api/suppliers', (req, res) => {
  try {
    const { name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, note } = req.body;
    const supplierId = 'SUP' + String(suppliers.length + 1).padStart(3, '0');
    
    suppliers.push({
      id: supplierId,
      name,
      companyType,
      mainProducts,
      contact,
      contactInfo,
      canInvoice,
      invoiceThreshold: parseFloat(invoiceThreshold) || 0,
      paymentLink: paymentLink || '',
      note: note || '',
      created_at: new Date().toISOString()
    });
    
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
    const index = suppliers.findIndex(s => s.id === id);
    if (index === -1) {
      return res.json({ success: false, error: '供应商不存在' });
    }
    suppliers[index] = {
      ...suppliers[index],
      name,
      companyType,
      mainProducts,
      contact,
      contactInfo,
      canInvoice,
      invoiceThreshold: parseFloat(invoiceThreshold) || 0,
      paymentLink: paymentLink || '',
      note: note || '',
      invoiceStatus: invoiceStatus || ''
    };
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating supplier:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.delete('/api/suppliers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const index = suppliers.findIndex(s => s.id === id);
    if (index === -1) {
      return res.json({ success: false, error: '供应商不存在' });
    }
    suppliers.splice(index, 1);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting supplier:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 产品接口
app.get('/api/products', (req, res) => {
  const { search } = req.query;
  let result = products;
  if (search) {
    result = products.filter(p => p.id.includes(search) || p.englishName.includes(search) || p.chineseName.includes(search));
  }
  res.json(result);
});

app.post('/api/products', (req, res) => {
  try {
    const { englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName, purchasePriceLess100, purchasePriceMore100, purchaseLink, purchaseChannel, features } = req.body;
    const productId = 'PRO' + String(products.length + 1).padStart(3, '0');
    
    products.push({
      id: productId,
      englishName,
      chineseName,
      salesPriceLess100: parseFloat(salesPriceLess100) || 0,
      salesPriceMore100: parseFloat(salesPriceMore100) || 0,
      supplierId,
      supplierName,
      purchasePriceLess100: parseFloat(purchasePriceLess100) || 0,
      purchasePriceMore100: parseFloat(purchasePriceMore100) || 0,
      purchaseLink: purchaseLink || '',
      purchaseChannel: purchaseChannel || '',
      features: features || '',
      created_at: new Date().toISOString()
    });
    
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
    const index = products.findIndex(p => p.id === id);
    if (index === -1) {
      return res.json({ success: false, error: '产品不存在' });
    }
    products[index] = {
      ...products[index],
      englishName,
      chineseName,
      salesPriceLess100: parseFloat(salesPriceLess100) || 0,
      salesPriceMore100: parseFloat(salesPriceMore100) || 0,
      supplierId,
      supplierName,
      purchasePriceLess100: parseFloat(purchasePriceLess100) || 0,
      purchasePriceMore100: parseFloat(purchasePriceMore100) || 0,
      purchaseLink: purchaseLink || '',
      purchaseChannel: purchaseChannel || '',
      features: features || ''
    };
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating product:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

app.delete('/api/products/:id', (req, res) => {
  try {
    const { id } = req.params;
    const index = products.findIndex(p => p.id === id);
    if (index === -1) {
      return res.json({ success: false, error: '产品不存在' });
    }
    products.splice(index, 1);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting product:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 采购单接口
app.get('/api/purchase-orders', (req, res) => {
  const { search } = req.query;
  let result = purchaseOrders;
  if (search) {
    result = purchaseOrders.filter(p => p.id.includes(search) || p.supplierName.includes(search));
  }
  res.json(result);
});

app.post('/api/purchase-orders', (req, res) => {
  try {
    const { piId, supplierId, supplierName, products, totalAmount, purchaseNote, dataSource } = req.body;
    const now = new Date();
    const orderId = 'CG' + now.toISOString().slice(0, 10).replace(/-/g, '') + String(purchaseOrders.length + 1).padStart(3, '0');
    
    purchaseOrders.push({
      id: orderId,
      piId: piId || '',
      supplierId,
      supplierName,
      products: JSON.stringify(products),
      totalAmount: parseFloat(totalAmount) || 0,
      status: '待确认',
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      purchaseNote: purchaseNote || '',
      invoiceNote: '',
      trackingNumbers: JSON.stringify([]),
      dataSource: dataSource || '手动新增'
    });
    
    res.json({ success: true, id: orderId });
  } catch (err) {
    console.error('Error creating purchase order:', err.message);
    res.json({ success: false, error: '服务器内部错误' });
  }
});

// 库存接口
app.get('/api/inventory', (req, res) => {
  res.json(inventory);
});

// PI接口
app.get('/api/pi', (req, res) => {
  res.json(piList);
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

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('Server is ready to accept requests');
});