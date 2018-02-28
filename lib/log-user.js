const fs = require('fs');

module.exports = path => (id, name, date) => {
  let logStr = `${new Date().toISOString('zh-CN')}\t学号:${id}\t姓名:${name}\t查询学期:${date}\r\n`;
  
  fs.createWriteStream(path, {
      flags: 'a+'
  }).end(logStr, 'utf-8');
}