const tr = {
    '登录成功': ['userid', 'username'],
    '通过缓存登录成功': ['userid', 'username'],
    '登录失败': ['userid', 'reason'],
    '查询成绩': ['userid', 'username', 'semester']
}

/**
 * 将事件日志文本解析为事件对象数组
 * @param {string} 一条或多条事件日志字符串，每条日志都以换行符结尾
 * @returns {Array} 包含一个或多个事件对象的数组
 */
function parseLog(str) {
    
    function f(date, event, ...args) {
        const extraArr = tr[event];
        const o = {date, event};
        if(!extraArr) throw new Error();
        for(let i = 0; i < extraArr.length; i++) {
            o[extraArr[i]] = args[i];
        }
        return o;
    }

    let arr = str.split(/(?:\r\n)|\n/);
    arr.pop();

    arr = arr
        .map(s => s.slice(1, -1)
        .split(']['))
        .map(a => f(...a));

    return arr;
}

module.exports = parseLog;