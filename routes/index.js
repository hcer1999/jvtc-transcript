const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const path = require('path');
const parseLog = require('../lib/parseLog');
const Cache = require('../lib/Cache');
const User = require('../lib/jwweb');
const Log = require('../lib/Log');
const actionLogPath = path.join(__dirname, '..', 'action.log');
const actionLog = new Log(actionLogPath, [() => Date.now().toString()]);
const accessFrequencyLimit = require('../lib/accessFrequencyLimit');

const sessionCache = new Cache(10 * 60 * 1000);     // 用户会话记录缓存十分钟

const actionLogs = fs.existsSync(actionLogPath) ? parseLog(fs.readFileSync(actionLogPath, 'utf8')) : [];

function log(...args) {
    const str = actionLog.log(...args);
    actionLogs.push(...parseLog(str));
}

router.use(function(req, res, next) {
    let uid  = req.cookies.uid;
    let user = sessionCache.get(uid);
    if(uid && user) {
        sessionCache.refresh(uid);  // 重置会话记录过期时间
        req.user = user;
    }
    next();
});

router.get('/reset', function(req, res, next) {
    res.render('reset');
});

router.post('/reset', async function(req, res, next) {
    const userid = req.body.userid.trim()
    const idnumber = req.body.idnumber.trim();
    const user = await new User().init();
    const {success, message} = await user.resetPassword(userid, idnumber);
    res.json({success, message});
});

router.get('/', function(req, res, next) {
    let message = req.getEchoMessage();
    res.render('index', {message});
});

router.post('/', accessFrequencyLimit(30 * 60 * 1000, 20));    // 每个IP每30分钟只能尝试登录20次

router.post('/', async function(req, res, next) {

    let {userid, password, range} = req.body;

    try {
        // 根据用户名和密码创建hash
        const userHash = (userid, password) => crypto.createHash('sha256').update(userid + password).digest('hex');

        const id = userHash(userid, password);
        let user = sessionCache.get(id);    // 尝试从会话缓存中获取

        if(!user) {     // 缓存中没有该用户
            user = await new User(id).init();   // 创建用户实例     
            if(!await user.login({userid, password})) {
                throw new Error('Login Failed');
            }
            sessionCache.set(user.id, user, (user) => user.logout());     // User实例成功登录后将User实例存入sessionCache，并在cache过期时调用logout注销登录
            log('登录成功', user.userid, user.username);
        } else {
            sessionCache.refresh(id);   // 刷新缓存有效期
            log('通过缓存登录成功', user.userid, user.username);
        }

        res.cookie('uid', user.id);     // 在cookie中存储sessionCache的key
        res.redirect(303, '/transcript/' + range);
        
    } catch (err) {
        log('登录失败', userid, err.message);
        return next(err);
    }
});

async function getResults(user) {

    const result = await user.getResults();

    if(result.transcript.length === 0) {
        throw new Error('No Result');   // 没有成绩的新生
    }

    const transcript = new Map();

    for(const i of result.transcript) {
        let {semester, ...item} = i;
        semester = semester.replace(/-20\d\d-(\d)/, (m, p1) => p1 - 1);        // 2017-2018-1 => 20170
        if(transcript.has(semester)) {
            transcript.get(semester).transcript.push(item);
        } else {
            transcript.set(semester, {
                semester, 
                username: result.username, 
                userid: result.userid,
                transcript: [item]
            });
        }
    }

    return [...transcript.values()];
}

// 查询最后一个有成绩的学期的成绩的路由
router.get('/transcript/latest', function(req, res, next) {
    if(!req.user) throw new Error('UID Not Exist');
    
    getResults(req.user).then(results => {
        const result = results[0];
        log('查询成绩', result.userid, result.username, result.semester);        
        res.render('results', {results: [result]});
    }).catch(next);
});

// 查询所有有成绩的学期的成绩的路由
router.get('/transcript/all', async function(req, res, next) {
    if(!req.user) return next(new Error('UID Not Exist'));

    const results = await getResults(req.user);
    for(const i of results) {
        log('查询成绩', i.userid, i.username, i.semester);
    }
    res.render('results', {results: results});
});


// 下面是统计路由

router.get('/statistics', function(req, res, next) {
    res.sendFile(path.resolve(__dirname, '../public/statistics.html'));
});

const countCache = {
    content: '',
    date: 0
}
router.get('/statistics/count', function(req, res, next) {
    const itemTmpl = {
        '登录成功': 0,
        '通过缓存登录成功': 0,
        '登录失败': 0,
        '查询成绩': 0
    };
    let o = {};

    // 统计一次时间要几百毫秒以上，做个缓存凑合着用
    if(Date.now() < countCache.date + 10 * 1000) {      // 10秒内请求过
        return res.type('json').send(countCache.content);
    }

    for(let ac of actionLogs) {
        let date = new Date(+ac.date + 8 * 60 * 60 * 1000);    // UTC + 8
        let year = date.getUTCFullYear(),
            mon  = date.getUTCMonth() + 1,
            day  = date.getUTCDate();

        o[year]           || (o[year] = {});
        o[year][mon]      || (o[year][mon] = {});
        o[year][mon][day] || (o[year][mon][day] = {...itemTmpl});
        
        o[year][mon][day][ac.event]++;
    }

    // 填充数据，使得每年的每个月每一天都有数据
    for(let year of Object.keys(o)) {
        for(let mon = 1; mon <= 12; mon++) {
            o[year][mon] || (o[year][mon] = {});
            let days = new Date(year, mon, 0).getDate();  // 获取这个月的天数
            for(let day = 1; day <= days; day++) {
                o[year][mon][day] || (o[year][mon][day] = {...itemTmpl});
            }
        }
    }

    // 更新缓存
    countCache.content = JSON.stringify(o);
    countCache.date = Date.now();

    res.type('json').send(countCache.content);
});

module.exports = router;