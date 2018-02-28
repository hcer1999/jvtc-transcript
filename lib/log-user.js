const fs = require('fs');

module.exports = path => (id, name, semester) => {
  let logStr = `${new Date().toISOString('zh-CN')}\t学号:${id}\t姓名:${name}\t查询学期:${semester}\r\n`;
  
  fs.createWriteStream(path, {
      flags: 'a+'
  }).end(logStr, 'utf-8');
}