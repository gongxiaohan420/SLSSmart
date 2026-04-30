const express = require('express');
const XLSX = require('xlsx');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: '/tmp/uploads/' });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let db = null;

function initDb() {
  return new Promise((resolve, reject) => {
    const dbDir = path.join(process.cwd(), 'backend');
    const dbPath = path.join(dbDir, 'database.db');
    
    if (!fs.existsSync(dbDir)) {
      try {
        fs.mkdirSync(dbDir, { recursive: true });
      } catch (e) {
        console.error('Cannot create backend directory:', e);
      }
    }
    
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err);
        reject(err);
        return;
      }
      console.log('Database connected at:', dbPath);
      resolve();
    });
  });
}

function initDatabase() {
  return new Promise((resolve, reject) => {
    if (!db) {
      reject(new Error('Database not initialized'));
      return;
    }
    
    db.serialize(() => {
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
      )`, () => {
        db.run(`CREATE TABLE IF NOT EXISTS suppliers (
          id TEXT PRIMARY KEY,
          name TEXT,
          companyType TEXT,
          mainProducts TEXT,
          contact TEXT,
          contactInfo TEXT,
          canInvoice TEXT,
          invoiceThreshold REAL,
          paymentLink TEXT,
          invoiceNote TEXT,
          createdAt TEXT
        )`, () => {
          db.run(`CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            englishName TEXT,
            chineseName TEXT,
            salesPriceLess100 REAL,
            salesPriceMore100 REAL,
            supplierId TEXT,
            supplierName TEXT,
            purchasePriceLess100 REAL,
            purchasePriceMore100 REAL,
            purchasePrice REAL,
            purchaseLink TEXT,
            features TEXT,
            created_at TEXT
          )`, () => {
            db.run(`CREATE TABLE IF NOT EXISTS customers (
              id TEXT PRIMARY KEY,
              companyName TEXT,
              companyShortName TEXT,
              contact TEXT,
              country TEXT,
              companySize TEXT,
              createdAt TEXT
            )`, () => {
              db.run(`CREATE TABLE IF NOT EXISTS inventory (
                productId TEXT PRIMARY KEY,
                englishName TEXT,
                chineseName TEXT,
                quantity INTEGER,
                warehouse TEXT
              )`, () => {
                db.run(`CREATE TABLE IF NOT EXISTS purchaseOrders (
                  id TEXT PRIMARY KEY,
                  piId TEXT,
                  supplierId TEXT,
                  supplierName TEXT,
                  products TEXT,
                  totalAmount REAL,
                  status TEXT,
                  trackingNumbers TEXT,
                  purchaseNote TEXT,
                  invoiceNote TEXT,
                  created_at TEXT,
                  piCustomerName TEXT,
                  piTotalAmount REAL,
                  piCreatedAt TEXT
                )`, () => {
                  db.run(`CREATE TABLE IF NOT EXISTS piOrders (
                    id TEXT PRIMARY KEY,
                    customerId TEXT,
                    customerName TEXT,
                    products TEXT,
                    totalAmount REAL,
                    status TEXT,
                    shipDate TEXT,
                    note TEXT,
                    created_at TEXT
                  )`, () => {
                    db.run(`CREATE TABLE IF NOT EXISTS reminders (
                      id TEXT PRIMARY KEY,
                      purchaseOrderId TEXT,
                      reminderTime TEXT,
                      status TEXT,
                      email TEXT,
                      content TEXT,
                      created_at TEXT
                    )`, () => {
                      db.run(`CREATE TABLE IF NOT EXISTS reminderLogs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        purchaseOrderId TEXT,
                        sentTime TEXT,
                        status TEXT,
                        email TEXT,
                        content TEXT,
                        error TEXT,
                        created_at TEXT
                      )`, () => {
                        db.run(`CREATE TABLE IF NOT EXISTS supplierAttachments (
                          id INTEGER PRIMARY KEY AUTOINCREMENT,
                          supplierId TEXT,
                          fileName TEXT,
                          filePath TEXT,
                          uploadedAt TEXT
                        )`, () => {
                          db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('sales', 'sales123', '业务员')`, () => {
                            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('purchase', 'purchase123', '采购员')`, resolve);
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

app.use(async (req, res, next) => {
  if (!db) {
    try {
      await initDb();
      await initDatabase();
    } catch (err) {
      console.error('Database initialization failed:', err);
    }
  }
  next();
});

function checkPermission(allowedRoles) {
  return (req, res, next) => {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }
    const username = req.headers.username;
    const password = req.headers.password;
    
    db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
      if (err || !user || user.password !== password) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.user = user;
      next();
    });
  };
}

app.post('/api/login', (req, res) => {
  if (!db) return res.status(500).json({ error: 'Database not available' });
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, user) => {
    if (err || !user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    res.json({ username: user.username, role: user.role });
  });
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: '服务器运行正常', timestamp: new Date().toISOString() });
});

app.get('/api/suppliers', checkPermission(['业务员', '采购员']), (req, res) => {
  db.all('SELECT * FROM suppliers ORDER BY createdAt DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/suppliers/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM suppliers WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row);
  });
});

app.post('/api/suppliers', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, invoiceNote } = req.body;
  const createdAt = new Date().toISOString();
  db.run('INSERT INTO suppliers (id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, invoiceNote, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold || 0, paymentLink, invoiceNote, createdAt], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Supplier created successfully' });
    });
});

app.put('/api/suppliers/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const { name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, invoiceNote } = req.body;
  db.run('UPDATE suppliers SET name = ?, companyType = ?, mainProducts = ?, contact = ?, contactInfo = ?, canInvoice = ?, invoiceThreshold = ?, paymentLink = ?, invoiceNote = ? WHERE id = ?',
    [name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold || 0, paymentLink, invoiceNote, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Supplier updated successfully' });
    });
});

app.delete('/api/suppliers/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM suppliers WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Supplier deleted successfully' });
  });
});

app.get('/api/products', checkPermission(['业务员', '采购员']), (req, res) => {
  db.all('SELECT * FROM products ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/products', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, purchasePrice, purchaseLink, features } = req.body;
  const created_at = new Date().toISOString();
  
  db.get('SELECT name FROM suppliers WHERE id = ?', [supplierId], (err, supplier) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('INSERT INTO products (id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName, purchasePriceLess100, purchasePriceMore100, purchasePrice, purchaseLink, features, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplier ? supplier.name : '', purchasePrice || 0, purchasePrice || 0, purchasePrice || 0, purchaseLink, features, created_at], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: 'Product created successfully' });
      });
  });
});

app.put('/api/products/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const { englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, purchasePrice, purchaseLink, features } = req.body;
  
  db.get('SELECT name FROM suppliers WHERE id = ?', [supplierId], (err, supplier) => {
    if (err) return res.status(500).json({ error: err.message });
    db.run('UPDATE products SET englishName = ?, chineseName = ?, salesPriceLess100 = ?, salesPriceMore100 = ?, supplierId = ?, supplierName = ?, purchasePriceLess100 = ?, purchasePriceMore100 = ?, purchasePrice = ?, purchaseLink = ?, features = ? WHERE id = ?',
      [englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplier ? supplier.name : '', purchasePrice || 0, purchasePrice || 0, purchasePrice || 0, purchaseLink, features, id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Product updated successfully' });
      });
  });
});

app.delete('/api/products/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM products WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Product deleted successfully' });
  });
});

app.get('/api/customers', checkPermission(['业务员', '采购员']), (req, res) => {
  db.all('SELECT * FROM customers ORDER BY createdAt DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/customers', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id, companyName, companyShortName, contact, country, companySize } = req.body;
  const createdAt = new Date().toISOString();
  db.run('INSERT INTO customers (id, companyName, companyShortName, contact, country, companySize, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, companyName, companyShortName, contact, country, companySize, createdAt], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Customer created successfully' });
    });
});

app.put('/api/customers/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const { companyName, companyShortName, contact, country, companySize } = req.body;
  db.run('UPDATE customers SET companyName = ?, companyShortName = ?, contact = ?, country = ?, companySize = ? WHERE id = ?',
    [companyName, companyShortName, contact, country, companySize, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Customer updated successfully' });
    });
});

app.delete('/api/customers/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM customers WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Customer deleted successfully' });
  });
});

app.get('/api/inventory', checkPermission(['业务员', '采购员']), (req, res) => {
  db.all('SELECT * FROM inventory', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/inventory', checkPermission(['业务员', '采购员']), (req, res) => {
  const { productId, englishName, chineseName, quantity, warehouse } = req.body;
  db.run('INSERT OR REPLACE INTO inventory (productId, englishName, chineseName, quantity, warehouse) VALUES (?, ?, ?, ?, ?)',
    [productId, englishName, chineseName, quantity, warehouse], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Inventory created successfully' });
    });
});

app.put('/api/inventory/:productId', checkPermission(['业务员', '采购员']), (req, res) => {
  const { productId } = req.params;
  const { quantity, warehouse } = req.body;
  db.run('UPDATE inventory SET quantity = ?, warehouse = ? WHERE productId = ?',
    [quantity, warehouse, productId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Inventory updated successfully' });
    });
});

app.delete('/api/inventory/:productId', checkPermission(['业务员', '采购员']), (req, res) => {
  const { productId } = req.params;
  db.run('DELETE FROM inventory WHERE productId = ?', [productId], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Inventory deleted successfully' });
  });
});

app.get('/api/purchase-orders', checkPermission(['业务员', '采购员']), (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM purchaseOrders ORDER BY created_at DESC';
  let params = [];
  
  if (search) {
    query = 'SELECT * FROM purchaseOrders WHERE id LIKE ? OR supplierName LIKE ? ORDER BY created_at DESC';
    params = [`%${search}%`, `%${search}%`];
  }
  
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(row => {
      try { row.products = JSON.parse(row.products); } catch (e) { row.products = []; }
    });
    res.json(rows);
  });
});

app.get('/api/purchase-orders/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM purchaseOrders WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      try { row.products = JSON.parse(row.products); } catch (e) { row.products = []; }
    }
    res.json(row);
  });
});

app.post('/api/purchase-orders', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id, piId, supplierId, supplierName, products, totalAmount, status, purchaseNote, piCustomerName, piTotalAmount, piCreatedAt } = req.body;
  const created_at = new Date().toISOString();
  
  db.run('INSERT INTO purchaseOrders (id, piId, supplierId, supplierName, products, totalAmount, status, trackingNumbers, purchaseNote, invoiceNote, created_at, piCustomerName, piTotalAmount, piCreatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, piId, supplierId, supplierName, JSON.stringify(products), totalAmount, status || '已生成', '[]', purchaseNote, '', created_at, piCustomerName, piTotalAmount, piCreatedAt], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Purchase order created successfully' });
    });
});

app.put('/api/purchase-orders/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const { supplierId, note } = req.body;
  
  if (supplierId) {
    db.get('SELECT name FROM suppliers WHERE id = ?', [supplierId], (err, supplier) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run('UPDATE purchaseOrders SET supplierId = ?, supplierName = ?, purchaseNote = ? WHERE id = ?',
        [supplierId, supplier ? supplier.name : '', note, id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: 'Purchase order updated successfully' });
        });
    });
  } else {
    db.run('UPDATE purchaseOrders SET purchaseNote = ? WHERE id = ?', [note, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Purchase order updated successfully' });
    });
  }
});

app.put('/api/purchase-orders/:id/status', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  db.run('UPDATE purchaseOrders SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Status updated successfully' });
  });
});

app.delete('/api/purchase-orders/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM purchaseOrders WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Purchase order deleted successfully' });
  });
});

app.get('/api/purchase-orders/by-pi/:piId', checkPermission(['业务员', '采购员']), (req, res) => {
  const { piId } = req.params;
  db.all('SELECT * FROM purchaseOrders WHERE piId = ?', [piId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(row => {
      try { row.products = JSON.parse(row.products); } catch (e) { row.products = []; }
    });
    res.json(rows);
  });
});

app.get('/api/pi-orders', checkPermission(['业务员', '采购员']), (req, res) => {
  db.all('SELECT * FROM piOrders ORDER BY created_at DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    rows.forEach(row => {
      try { row.products = JSON.parse(row.products); } catch (e) { row.products = []; }
    });
    res.json(rows);
  });
});

app.get('/api/pi-orders/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  db.get('SELECT * FROM piOrders WHERE id = ?', [id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (row) {
      try { row.products = JSON.parse(row.products); } catch (e) { row.products = []; }
    }
    res.json(row);
  });
});

app.post('/api/pi-orders', checkPermission(['业务员']), (req, res) => {
  const { id, customerId, customerName, products, totalAmount, status, shipDate, note } = req.body;
  const created_at = new Date().toISOString();
  
  db.run('INSERT INTO piOrders (id, customerId, customerName, products, totalAmount, status, shipDate, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, customerId, customerName, JSON.stringify(products), totalAmount, status || '已生成', shipDate, note, created_at], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'PI order created successfully' });
    });
});

app.put('/api/pi-orders/:id', checkPermission(['业务员']), (req, res) => {
  const { id } = req.params;
  const { customerId, customerName, products, totalAmount, status, shipDate, note } = req.body;
  
  db.run('UPDATE piOrders SET customerId = ?, customerName = ?, products = ?, totalAmount = ?, status = ?, shipDate = ?, note = ? WHERE id = ?',
    [customerId, customerName, JSON.stringify(products), totalAmount, status, shipDate, note, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'PI order updated successfully' });
    });
});

app.delete('/api/pi-orders/:id', checkPermission(['业务员']), (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM piOrders WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'PI order deleted successfully' });
  });
});

app.get('/api/reminders/:purchaseOrderId', checkPermission(['业务员', '采购员']), (req, res) => {
  const { purchaseOrderId } = req.params;
  db.all('SELECT * FROM reminders WHERE purchaseOrderId = ?', [purchaseOrderId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/reminders', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id, purchaseOrderId, reminderTime, email, content } = req.body;
  const created_at = new Date().toISOString();
  
  db.run('INSERT INTO reminders (id, purchaseOrderId, reminderTime, status, email, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, purchaseOrderId, reminderTime, '待提醒', email, content, created_at], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: 'Reminder created successfully' });
    });
});

app.put('/api/reminders/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  const { reminderTime, email, content } = req.body;
  
  db.run('UPDATE reminders SET reminderTime = ?, email = ?, content = ? WHERE id = ?',
    [reminderTime, email, content, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Reminder updated successfully' });
    });
});

app.delete('/api/reminders/:id', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM reminders WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Reminder deleted successfully' });
  });
});

app.get('/api/purchase-orders/:id/reminder-logs', checkPermission(['业务员', '采购员']), (req, res) => {
  const { id } = req.params;
  db.all('SELECT * FROM reminderLogs WHERE purchaseOrderId = ? ORDER BY created_at DESC', [id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/import/suppliers', upload.single('file'), checkPermission(['业务员', '采购员']), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: ['id', 'name', 'companyType', 'mainProducts', 'contact', 'contactInfo', 'canInvoice', 'invoiceThreshold', 'paymentLink', 'invoiceNote'] });
    
    rows.shift();
    let successCount = 0, errorCount = 0;
    
    const insertRow = (index) => {
      if (index >= rows.length) {
        fs.unlinkSync(req.file.path);
        return res.json({ success: successCount, error: errorCount });
      }
      
      const row = rows[index];
      if (!row.id || !row.name) {
        errorCount++;
        return insertRow(index + 1);
      }
      
      const createdAt = new Date().toISOString();
      db.run('INSERT OR REPLACE INTO suppliers (id, name, companyType, mainProducts, contact, contactInfo, canInvoice, invoiceThreshold, paymentLink, invoiceNote, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [row.id, row.name, row.companyType || '', row.mainProducts || '', row.contact || '', row.contactInfo || '', row.canInvoice || '是', row.invoiceThreshold || 0, row.paymentLink || '', row.invoiceNote || '', createdAt], (err) => {
          if (err) errorCount++; else successCount++;
          insertRow(index + 1);
        });
    };
    
    insertRow(0);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import/products', upload.single('file'), checkPermission(['业务员', '采购员']), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: ['id', 'englishName', 'chineseName', 'salesPriceLess100', 'salesPriceMore100', 'supplierId', 'purchasePrice', 'purchaseLink', 'features'] });
    
    rows.shift();
    let successCount = 0, errorCount = 0;
    const created_at = new Date().toISOString();
    
    const insertRow = (index) => {
      if (index >= rows.length) {
        fs.unlinkSync(req.file.path);
        return res.json({ success: successCount, error: errorCount });
      }
      
      const row = rows[index];
      if (!row.id) {
        errorCount++;
        return insertRow(index + 1);
      }
      
      db.get('SELECT name FROM suppliers WHERE id = ?', [row.supplierId], (err, supplier) => {
        const supplierName = supplier ? supplier.name : '';
        const purchasePrice = row.purchasePrice || row.purchasePriceLess100 || 0;
        
        db.run('INSERT OR REPLACE INTO products (id, englishName, chineseName, salesPriceLess100, salesPriceMore100, supplierId, supplierName, purchasePriceLess100, purchasePriceMore100, purchasePrice, purchaseLink, features, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [row.id || '', row.englishName || '', row.chineseName || '', row.salesPriceLess100 || 0, row.salesPriceMore100 || 0, row.supplierId || '', supplierName, purchasePrice, purchasePrice, purchasePrice, row.purchaseLink || '', row.features || '', created_at], (err) => {
            if (err) errorCount++; else successCount++;
            insertRow(index + 1);
          });
      });
    };
    
    insertRow(0);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import/customers', upload.single('file'), checkPermission(['业务员', '采购员']), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: ['id', 'companyName', 'companyShortName', 'contact', 'country', 'companySize'] });
    
    rows.shift();
    let successCount = 0, errorCount = 0;
    const createdAt = new Date().toISOString();
    
    const insertRow = (index) => {
      if (index >= rows.length) {
        fs.unlinkSync(req.file.path);
        return res.json({ success: successCount, error: errorCount });
      }
      
      const row = rows[index];
      if (!row.id || !row.companyName) {
        errorCount++;
        return insertRow(index + 1);
      }
      
      db.run('INSERT OR REPLACE INTO customers (id, companyName, companyShortName, contact, country, companySize, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [row.id, row.companyName, row.companyShortName || '', row.contact || '', row.country || '', row.companySize || '', createdAt], (err) => {
          if (err) errorCount++; else successCount++;
          insertRow(index + 1);
        });
    };
    
    insertRow(0);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import/inventory', upload.single('file'), checkPermission(['业务员', '采购员']), (req, res) => {
  try {
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: ['productId', 'englishName', 'chineseName', 'quantity', 'warehouse'] });
    
    rows.shift();
    let successCount = 0, errorCount = 0;
    
    const insertRow = (index) => {
      if (index >= rows.length) {
        fs.unlinkSync(req.file.path);
        return res.json({ success: successCount, error: errorCount });
      }
      
      const row = rows[index];
      if (!row.productId) {
        errorCount++;
        return insertRow(index + 1);
      }
      
      db.run('INSERT OR REPLACE INTO inventory (productId, englishName, chineseName, quantity, warehouse) VALUES (?, ?, ?, ?, ?)',
        [row.productId, row.englishName || '', row.chineseName || '', row.quantity || 0, row.warehouse || ''], (err) => {
          if (err) errorCount++; else successCount++;
          insertRow(index + 1);
        });
    };
    
    insertRow(0);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/download/template/:type', checkPermission(['业务员', '采购员']), (req, res) => {
  const { type } = req.params;
  const templatePath = path.join(process.cwd(), `backend/templates/${type}_import_template.xlsx`);
  
  if (fs.existsSync(templatePath)) {
    res.download(templatePath);
  } else {
    res.status(404).json({ error: 'Template not found' });
  }
});

module.exports = app;