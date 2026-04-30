const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// 提供静态文件
app.use(express.static(__dirname));

// 启动服务器
app.listen(PORT, () => {
  console.log(`前端服务器运行在 http://localhost:${PORT}`);
});
