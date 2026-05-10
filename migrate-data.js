const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('/Users/gongxiaohan/Documents/trae_projects/database.db');
const data = {
  users: [],
  customers: [],
  suppliers: [],
  products: [],
  piOrders: [],
  purchaseOrders: [],
  inventory: [],
  reminders: []
};

db.serialize(() => {
  db.all('SELECT * FROM users', (err, rows) => {
    data.users = rows;
    
    db.all('SELECT * FROM customers', (err, rows) => {
      data.customers = rows.map((c, idx) => ({
        ...c,
        id: c.countryCode ? c.countryCode + String(idx + 1).padStart(4, '0') : 'CN' + String(idx + 1).padStart(4, '0'),
        countryCode: c.countryCode || 'CN'
      }));
      
      db.all('SELECT * FROM suppliers', (err, rows) => {
        data.suppliers = rows.map(s => ({ 
          ...s, 
          invoiceStatus: s.invoiceStatus || '未开票',
          attachments: s.attachments || ''
        }));
        
        db.all('SELECT * FROM products', (err, rows) => {
          data.products = rows.map(p => ({
            ...p,
            purchaseLink: p.purchaseLink || '',
            purchaseChannel: p.purchaseChannel || ''
          }));
          
          db.all('SELECT * FROM pi', (err, rows) => {
            data.piOrders = rows.map(p => ({ 
              ...p, 
              id: 'PI' + p.id 
            }));
            
            db.all('SELECT * FROM purchaseOrders', (err, rows) => {
              data.purchaseOrders = rows.map(p => ({ 
                ...p, 
                id: 'CG' + p.id, 
                dataSource: p.piId ? '从PI单中生成' : '手动新增' 
              }));
              
              db.all('SELECT * FROM inventory', (err, rows) => {
                data.inventory = rows;
                
                db.all('SELECT * FROM reminders', (err, rows) => {
                  data.reminders = rows;
                  
                  fs.writeFileSync('/Users/gongxiaohan/Documents/trae_projects/data.json', JSON.stringify(data, null, 2));
                  console.log('Data exported successfully!');
                  db.close();
                });
              });
            });
          });
        });
      });
    });
  });
});
