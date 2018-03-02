const express = require('express');
const router = express.Router();
const path = require('path');
const Cache = require('../lib/Cache');
const User = require('../lib/jwweb');
const logUser = require('../lib/log-user')(path.join(__dirname, '..', 'public', 'user.log'));
const Captcha = require('../lib/Captcha');
const Jimp = require("jimp");
const sampleData = require('../lib/sample-data');
const Recognizer = require('../lib/Recognizer');

const recognizer = new Recognizer();

// 加载样本数据
for(let {char, sampleVal} of sampleData) {
    recognizer.addSampleData(char, sampleVal);
}

const sessionCachingTime = 10 * 60 * 1000;    // 用户会话记录缓存十分钟
const sessionCache = new Cache(sessionCachingTime);

router.use(function(req, res, next) {
    let uid  = req.cookies.uid;
    let user = sessionCache.get(uid);
    if(uid && user) {
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
    let form = req.body;
    let user = new User();
    
    user.init().then(getCaptchaCode).then(code => {
        form.captcha = code;
        return user.login(form);
    }).then(logined => {
        if(!logined) throw new Error('Login Failed');
        sessionCache.set(user.id, user);        
        res.cookie('uid', user.id, {maxAge: sessionCachingTime - 2 * 60 * 1000});     // 在cookie中存储会话id
        res.redirect(303, `/transcript/${form.userid}/${form.semester}`);
    }).catch(next);
});

router.get('/transcript/:id/:semester', function(req, res, next) {
    if(!req.user) throw new Error('UID Not Exist');

    let semester = req.params.semester;
    let message = '';

    req.user.getResults(semester).then(result => {
        logUser(result.id, result.name, semester);
        if(result.transcript.length === 0) {
            let year = new Date().getFullYear();
            message = `没有该学期的成绩，注意：${year - 1}-${year}学年是指${year - 1}年9月到${year}年7月的学年`;
        }
        res.render('result', {result, semester, message});
    }).catch(next);
});

module.exports = router;