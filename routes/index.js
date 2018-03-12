const express = require('express');
const router = express.Router();
const path = require('path');
const Cache = require('../lib/Cache');
const User = require('../lib/jwweb');
const Log = require('../lib/Log');
const actionLog = new Log((path.join(__dirname, '..', 'public', 'action.log')));
const Captcha = require('../lib/Captcha');
const Jimp = require('jimp');
const sampleData = require('../lib/sample-data');
const Recognizer = require('../lib/Recognizer');

const recognizer = new Recognizer();

// 加载样本数据
for(let {char, sampleVal} of sampleData) {
    recognizer.addSampleData(char, sampleVal);
}

const sessionCachingTime = 10 * 60 * 1000;    // 用户会话记录缓存十分钟
const sessionCache = new Cache(sessionCachingTime);

let loginTimes = Object.create(null);    // 记录ip对应的尝试登录次数
setInterval(() => loginTimes = Object.create(null), 30 * 60 * 1000)     // 每三十分钟清除一次ip登录次数记录

router.use(function(req, res, next) {
    let uid  = req.cookies.uid;
    let user = sessionCache.get(uid);
    if(uid && user) {
        sessionCache.refresh(uid);  // 重置会话记录过期时间
        req.user = user;
    }
    next();
});

router.get('/', function(req, res, next) {
    let message = req.getEchoMessage();
    res.render('index', {message});
});

async function getCaptchaCode(user) {
    let code = '';
    while(1) {
        let imageData = await user.getCaptcha();
        let captcha = await new Captcha(imageData);
        let slicedChars = await captcha.dispose().sliceCharacter();
        if(slicedChars.length !== 4) {
            continue;
        }
        for(let slicedChar of slicedChars) {
            let sampleString = slicedChar.resize(24, 24).getSampleString();
            let matchedChar = recognizer.matchSample(sampleString);
            code += matchedChar;
        }
        break;
    }
    return code;
}

router.post('/', function(req, res, next) {
    let ip = req.ip;

    loginTimes[ip] = loginTimes[ip] ? loginTimes[ip] + 1 : 1;

    // 该ip尝试登录次数过多，拒绝访问
    if(loginTimes[ip] > 20) {
        res.status(429);
        next(new Error('Login Frequently'));
    }
    next();
});

router.post('/', function(req, res, next) {
    let {userid, password} = req.body;
    // 必填字段不存在
    if(!(userid && password)) {
        return next(new Error('Login Failed'));
    }
    // 学号存在非数字字符
    if(Array.from(userid).every(c => /\d/.test(c)) === false) {
        return next(new Error('Login Failed'));
    }
    next();
});

router.post('/', function(req, res, next) {
    let {userid, password, range} = req.body;
    let user = new User();
    
    user.init().then(getCaptchaCode).then(code => {
        return user.login({userid, password, captcha: code});
    }).then(logined => {
        if(logined) return Promise.resolve(logined);
        return getCaptchaCode(user).then(code => user.login({userid, password, captcha: code}));   // 登录失败时重新尝试一次，因为偶尔可能验证码识别错误
    }).then(logined => {
        if(!logined) throw new Error('Login Failed');
        sessionCache.set(user.id, user, (user) => user.logout());     // User实例成功登录后将User实例存入sessionCache，并在cache过期时调用logout注销登录
        res.cookie('uid', user.id);     // 在cookie中存储sessionCache的key
        res.redirect(303, `/transcript/${userid}/${range}`);
        actionLog.log(`[${user.userid}][${user.username}]登录成功`);
    }).catch(err => {
        actionLog.log(`[${userid}]登录失败[${err.message}]`);
        throw err;
    }).catch(next);
});

async function getLastResult(user) {
    let year = new Date().getFullYear();
    let month = new Date().getMonth();
    let semesters = [];

    month >= 0  && semesters.unshift(year - 2 + '1');
    month >= 0  && semesters.unshift(year - 1 + '0');   // 一月起
    month >= 4  && semesters.unshift(year - 1 + '1');   // 五月起
    month >= 10 && semesters.unshift(year + '0');       // 十一月起

    for(let semester of semesters) {
        let result = await user.getResults(semester);
        if(result.transcript.length !== 0) {
            return result;
        }
    }

    throw new Error('No Result');   // 没有成绩的新生
}

// 查询最后一个有成绩的学期的成绩的路由
router.get('/transcript/:id/latest', function(req, res, next) {
    if(!req.user) throw new Error('UID Not Exist');
    
    getLastResult(req.user).then(result => {
        actionLog.log(`[${result.userid}][${result.username}]成功查询[${result.semester}]学期的成绩`);        
        res.render('result', result);
    }).catch(next);
});

// 查询所有有成绩的学期的成绩的路由
router.get('/transcript/:id/all', async function(req, res, next) {
    if(!req.user) next(new Error('UID Not Exist'));

    try {
        let results = [];
        let result = await getLastResult(req.user);
        while(result.transcript.length !== 0) {
            actionLog.log(`[${result.userid}][${result.username}]成功查询[${result.semester}]学期的成绩`);
            results.push(result);
            let semester = result.semester;
            if(semester[semester.length - 1] === '0') {
                semester = +semester.slice(0, 4) - 1 + '1';
            } else {
                semester = +semester.slice(0, 4) + '0';
            }
            result = await req.user.getResults(semester);
        }
        res.render('results', {results: results});
    } catch (err) {
        next(err);
    }
});

router.get('/transcript/:id/:semester', function(req, res, next) {
    if(!req.user) throw new Error('UID Not Exist');

    let user = req.user;
    let semester = req.params.semester;
    let message = '';

    user.getResults(semester).then(result => {
        if(result.transcript.length === 0) {
            let year = new Date().getFullYear();
            message = `没有该学期的成绩，注意：${year - 1}-${year}学年是指${year - 1}年9月到${year}年7月的学年`;
            actionLog.log(`[${user.userid}][${user.username}]尝试查询[${semester}]学期的成绩，发现并没有该学期的成绩`);
        } else {
            actionLog.log(`[${user.userid}][${user.username}]成功查询[${semester}]学期的成绩`);            
        }
        res.render('result', {
            transcript: result.transcript, 
            semester: result.semester, 
            userid: result.userid, 
            username: result.username,
            message: message
        });
    }).catch(next);
});

module.exports = router;