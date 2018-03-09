const fs = require('fs');

module.exports = class {
    constructor(path) {
        this._path = path;
    }

    log(str) {
        str = `[${new Date().toISOString('zh-CN')}]` + str + '\r\n';
        fs.createWriteStream(this._path, {
            flags: 'a+'
        }).end(str);
    }
}