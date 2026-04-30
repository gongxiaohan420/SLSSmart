const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

try {
  console.log('数据库连接成功');
  
  // 创建表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('表创建成功');
  
  // 插入测试数据
  try {
    const stmt = db.prepare('INSERT OR IGNORE INTO users (name, email) VALUES (?, ?)');
    stmt.run('测试用户', 'test@example.com');
    console.log('测试数据插入成功');
  } catch (err) {
    console.error('插入数据失败:', err.message);
  }
} catch (err) {
  console.error('数据库操作失败:', err.message);
} finally {
  db.close();
}
