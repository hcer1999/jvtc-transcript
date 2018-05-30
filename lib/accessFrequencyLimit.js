/**
 * 限制一段时间内每个IP地址的访问次数
 * @param {number} refreshInterval 重置IP记录的周期, 单位毫秒
 * @param {number} accessFrequency 每次重置IP记录后每个IP地址可尝试访问的次数
 */
function accessFrequencyLimit(refreshInterval, accessFrequency = 0) {
    let loginTimes = Object.create(null);    // 记录ip对应的尝试登录次数
    setInterval(() => loginTimes = Object.create(null), refreshInterval)     // 每到refreshInterval清除一次ip登录次数记录

    return function(req, res, next) {
        let ip = req.ip;
    
        loginTimes[ip] = loginTimes[ip] ? loginTimes[ip] + 1 : 1;
    
        // 该ip尝试登录次数过多，拒绝访问
        if(loginTimes[ip] > accessFrequency) {
            res.status(429);
            next(new Error('Login Frequently'));
        }
        next();
    }
}

module.exports = accessFrequencyLimit;