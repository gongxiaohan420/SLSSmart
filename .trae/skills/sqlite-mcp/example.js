const SQLiteMCPServer = require('./server');

async function exampleUsage() {
  const mcp = new SQLiteMCPServer('./test_database.db');

  try {
    await mcp.connect();

    console.log('\n=== 1. 创建表 ===');
    await mcp.createTable('users', [
      { name: 'id', type: 'INTEGER', primaryKey: true },
      { name: 'name', type: 'TEXT', notNull: true },
      { name: 'email', type: 'TEXT', notNull: true },
      { name: 'age', type: 'INTEGER' }
    ]);

    console.log('\n=== 2. 插入数据 (Create) ===');
    await mcp.insert('users', { name: '张三', email: 'zhangsan@example.com', age: 25 });
    await mcp.insert('users', { name: '李四', email: 'lisi@example.com', age: 30 });
    await mcp.insert('users', { name: '王五', email: 'wangwu@example.com', age: 28 });
    console.log('插入成功');

    console.log('\n=== 3. 查询所有数据 (Read) ===');
    const allUsers = await mcp.select('users');
    console.log('所有用户:', JSON.stringify(allUsers.data, null, 2));

    console.log('\n=== 4. 条件查询 ===');
    const youngUsers = await mcp.select('users', '*', 'age < ?', [30]);
    console.log('年龄小于30的用户:', JSON.stringify(youngUsers.data, null, 2));

    console.log('\n=== 5. 更新数据 (Update) ===');
    await mcp.update('users', { age: 26 }, 'name = ?', ['张三']);
    console.log('更新成功');

    console.log('\n=== 6. 查询更新后的数据 ===');
    const updatedUser = await mcp.select('users', '*', 'name = ?', ['张三']);
    console.log('更新后的用户:', JSON.stringify(updatedUser.data, null, 2));

    console.log('\n=== 7. 查看表结构 ===');
    const schema = await mcp.getTableSchema('users');
    console.log('表结构:', JSON.stringify(schema, null, 2));

    console.log('\n=== 8. 执行自定义 SQL 查询 ===');
    const customQuery = await mcp.query('SELECT name, email FROM users WHERE age > ? ORDER BY age DESC', [25]);
    console.log('自定义查询结果:', JSON.stringify(customQuery.data, null, 2));

    console.log('\n=== 9. 删除数据 (Delete) ===');
    await mcp.delete('users', 'name = ?', ['王五']);
    console.log('删除成功');

    console.log('\n=== 10. 查询所有表 ===');
    const tables = await mcp.getTables();
    console.log('所有表:', tables);

    console.log('\n=== 11. 事务操作示例 ===');
    await mcp.runTransaction([
      { sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)', params: ['赵六', 'zhaoliu@example.com', 35] },
      { sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)', params: ['钱七', 'qianqi@example.com', 32] }
    ]);
    console.log('事务执行成功');

    console.log('\n=== 12. 最终数据 ===');
    const finalUsers = await mcp.select('users');
    console.log('最终所有用户:', JSON.stringify(finalUsers.data, null, 2));

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await mcp.disconnect();
    console.log('\n数据库连接已关闭');
  }
}

if (require.main === module) {
  exampleUsage();
}

module.exports = { exampleUsage };
