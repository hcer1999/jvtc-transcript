const express = require('express');
const router = express.Router();
const path = require('path');
const User = require('../lib/jwweb');
const logUser = require('../lib/log-user')(path.join(__dirname, '..', 'public', 'user.log'));

const userStore = {};

router.use(function(req, res, next) {
    let uid = req.cookies.uid;
    if(uid && userStore[uid]) {
        req.user = userStore[uid];
    }
    next();
});

router.get('/', function(req, res, next) {
    if(req.user) {
        req.user.logout();
        delete userStore[req.user.id];
    }
    next();
});

router.get('/', function(req, res, next) {
    let message = req.getEchoMessage();
    let user = new User();

    userStore[user.id] = user;
    setTimeout(function() {
        delete userStore[user.id];
    }, 600000);     // 用户实例保存10分钟

    user.init().then(function() {
        res.cookie('uid', user.id);
        res.render('index', {message});
    }).catch(next);
});

router.post('/', function(req, res, next) {
    if(!req.user) throw new Error('UID Not Exist');
    
    let form = req.body;
    let info = {
        userid: form.stuId, 
        password: form.stuPwd, 
        captcha: form.code
    }

    req.user.login(info).then(logined => {
        if(!logined) throw new Error('Login Failed');
        res.redirect(303, `/transcript/${form.stuId}/${form.date}`);
    }).catch(next);
});

router.get('/transcript/:id/:date', function(req, res, next) {
    if(!req.user) throw new Error('UID Not Exist');

    let date = req.params.date;
    let message = '';

    req.user.getResults(date).then(result => {
        logUser(result.id, result.name, date);
        if(result.transcript.length === 0) {
            let year = new Date().getFullYear();
            message = `没有该学期的成绩，注意：${year - 1}-${year}学年是指${year - 1}年9月到${year}年7月的学年`;
        }

        // 三分钟内重复查询直接使用浏览器缓存结果
        res.set('Cache-Control', 'max-age=180');
        res.render('result', {result, date, message});
    }).catch(next);
});

// 获取验证码
router.get('/captcha', function(req, res, next) {
    if(!req.user) throw new Error('UID Not Exist');
    
    req.user.getCaptcha().then(imgData => {
        res.set('Cache-Control', 'no-cache');
        res.end(imgData);
    }).catch(next);
});

module.exports = router;