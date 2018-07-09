const fs = require('fs');
const os = require('os');

class Log {
    /**
     * 
     * @param {string} path 日志存储路径
     * @param {array} defaultFields 在每条记录开头插入的默认字段，数组元素可以是字符串或返回字符串的函数
     * @param {string} delimiter 字段间分隔符，传入字符串长度必须为2
     */
    constructor(path, defaultFields = [], delimiter = '[]') {
        this._path = path;
        this._dlimiter = delimiter;
        this._defaultFields = defaultFields;
    }

    /**
     * @returns {string} 返回本次记录的日志字符串
     */
    log(...fields) {
        let [l, f] = this._dlimiter;

        let str = [...this._defaultFields, ...fields].map(
            fd => l + (typeof fd === 'function' ? fd() : fd) + f
        ).join('') + os.EOL;

        fs.appendFileSync(this._path, str);

        return str;
    }
}

module.exports = Log;