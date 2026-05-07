# SQLite MCP Server

一个功能完整的 SQLite 数据库 MCP (Model Context Protocol) 服务器，提供基础的 CRUD 操作和数据库管理功能。

## 功能特性

- ✅ 数据库连接管理
- ✅ 表的创建、修改和删除
- ✅ 完整的 CRUD 操作（创建、读取、更新、删除）
- ✅ 模式检查和分析
- ✅ 自定义 SQL 查询执行
- ✅ 事务支持
- ✅ 参数化查询（防止 SQL 注入）

## 安装

```bash
cd .trae/skills/sqlite-mcp
npm install
```

## 快速开始

### 1. 基本使用

```javascript
const SQLiteMCPServer = require('./server');

const mcp = new SQLiteMCPServer('./my_database.db');

async function main() {
  await mcp.connect();
  
  // 查询所有表
  const tables = await mcp.getTables();
  console.log('表:', tables);
  
  await mcp.disconnect();
}

main();
```

### 2. 创建表

```javascript
await mcp.createTable('users', [
  { name: 'id', type: 'INTEGER', primaryKey: true },
  { name: 'name', type: 'TEXT', notNull: true },
  { name: 'email', type: 'TEXT', notNull: true },
  { name: 'age', type: 'INTEGER' }
]);
```

### 3. 插入数据 (Create)

```javascript
await mcp.insert('users', {
  name: '张三',
  email: 'zhangsan@example.com',
  age: 25
});
```

### 4. 查询数据 (Read)

```javascript
// 查询所有数据
const allUsers = await mcp.select('users');

// 条件查询
const youngUsers = await mcp.select('users', '*', 'age < ?', [30]);

// 带排序和限制的查询
const sortedUsers = await mcp.select('users', '*', null, [], {
  orderBy: 'age DESC',
  limit: 10
});
```

### 5. 更新数据 (Update)

```javascript
await mcp.update('users', 
  { age: 26 }, 
  'name = ?', 
  ['张三']
);
```

### 6. 删除数据 (Delete)

```javascript
await mcp.delete('users', 'name = ?', ['王五']);
```

### 7. 自定义 SQL 查询

```javascript
const result = await mcp.query(
  'SELECT * FROM users WHERE age > ? ORDER BY age DESC LIMIT ?',
  [25, 5]
);
```

### 8. 查看表结构

```javascript
const schema = await mcp.getTableSchema('users');
console.log('表结构:', schema);
```

### 9. 事务操作

```javascript
await mcp.runTransaction([
  { sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)', params: ['赵六', 'zhaoliu@example.com', 35] },
  { sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)', params: ['钱七', 'qianqi@example.com', 32] }
]);
```

## API 文档

### 构造函数

```javascript
new SQLiteMCPServer(dbPath)
```

- `dbPath`: 数据库文件路径

### 方法

#### `connect()`
连接到数据库

#### `disconnect()`
断开数据库连接

#### `getTables()`
获取数据库中所有表的名称

#### `getTableSchema(tableName)`
获取指定表的结构信息

#### `query(sql, params = [])`
执行自定义 SQL 查询

#### `insert(tableName, data)`
插入新记录

#### `update(tableName, data, where, whereParams = [])`
更新记录

#### `delete(tableName, where, params = [])`
删除记录

#### `select(tableName, columns = '*', where = null, params = [], options = {})`
查询记录

- `options.orderBy`: 排序字段
- `options.limit`: 限制返回数量
- `options.offset`: 偏移量

#### `createTable(tableName, schema)`
创建新表

#### `dropTable(tableName)`
删除表

#### `runTransaction(operations)`
执行事务操作

## 运行示例

```bash
node example.js
```

## 安全注意事项

1. **使用参数化查询**：始终使用参数化查询来防止 SQL 注入
2. **验证输入**：在执行查询前验证用户输入
3. **权限控制**：确保数据库文件有适当的文件系统权限
4. **错误处理**：妥善处理所有可能的错误

## 错误处理

所有方法都返回 Promise，使用 try-catch 处理错误：

```javascript
try {
  await mcp.insert('users', { name: '张三', email: 'test@example.com' });
} catch (error) {
  console.error('插入失败:', error.message);
}
```

## 项目结构

```
sqlite-mcp/
├── SKILL.md          # 技能描述文件
├── server.js         # MCP 服务器实现
├── package.json      # 项目配置
├── example.js        # 使用示例
└── README.md         # 本文档
```

## 依赖

- `sqlite3`: ^5.1.6

## 许可证

MIT
