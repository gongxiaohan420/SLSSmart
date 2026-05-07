const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

class SQLiteMCPServer {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.db = null;
    this.connected = false;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      if (this.connected && this.db) {
        resolve(this.db);
        return;
      }

      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.connected = true;
          console.log('SQLite MCP Server connected to:', this.dbPath);
          resolve(this.db);
        }
      });
    });
  }

  async disconnect() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.connected = false;
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  async getTables() {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        [],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(r => r.name));
        }
      );
    });
  }

  async getTableSchema(tableName) {
    return new Promise((resolve, reject) => {
      this.db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async query(sql, params = []) {
    return new Promise((resolve, reject) => {
      const isSelect = sql.trim().toLowerCase().startsWith('select');
      
      if (isSelect) {
        this.db.all(sql, params, (err, rows) => {
          if (err) reject(err);
          else resolve({ success: true, data: rows, count: rows.length });
        });
      } else {
        this.db.run(sql, params, function(err) {
          if (err) reject(err);
          else resolve({ success: true, changes: this.changes, lastID: this.lastID });
        });
      }
    });
  }

  async insert(tableName, data) {
    const columns = Object.keys(data);
    const placeholders = columns.map(() => '?').join(', ');
    const values = Object.values(data);
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
    
    return this.query(sql, values);
  }

  async update(tableName, data, where, whereParams = []) {
    const setClause = Object.keys(data).map(k => `${k} = ?`).join(', ');
    const values = [...Object.values(data), ...whereParams];
    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${where}`;
    
    return this.query(sql, values);
  }

  async delete(tableName, where, params = []) {
    const sql = `DELETE FROM ${tableName} WHERE ${where}`;
    return this.query(sql, params);
  }

  async select(tableName, columns = '*', where = null, params = [], options = {}) {
    let sql = `SELECT ${columns} FROM ${tableName}`;
    
    if (where) {
      sql += ` WHERE ${where}`;
    }
    
    if (options.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }
    
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    
    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }
    
    return this.query(sql, params);
  }

  async createTable(tableName, schema) {
    const columns = schema.map(col => 
      `${col.name} ${col.type}${col.primaryKey ? ' PRIMARY KEY' : ''}${col.notNull ? ' NOT NULL' : ''}${col.default ? ' DEFAULT ' + col.default : ''}`
    ).join(', ');
    
    const sql = `CREATE TABLE IF NOT EXISTS ${tableName} (${columns})`;
    return this.query(sql);
  }

  async dropTable(tableName) {
    const sql = `DROP TABLE IF EXISTS ${tableName}`;
    return this.query(sql);
  }

  async runTransaction(operations) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            reject(err);
            return;
          }
          
          const results = [];
          let hasError = false;
          
          for (const op of operations) {
            try {
              const result = this.db.prepare(op.sql).run(op.params);
              results.push({ changes: result.changes, lastID: result.lastID });
            } catch (e) {
              hasError = true;
              this.db.run('ROLLBACK', () => reject(e));
              return;
            }
          }
          
          if (!hasError) {
            this.db.run('COMMIT', (err) => {
              if (err) reject(err);
              else resolve({ success: true, results });
            });
          }
        });
      });
    });
  }
}

module.exports = SQLiteMCPServer;
