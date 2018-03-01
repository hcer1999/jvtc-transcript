const express = require('express');
const router = express.Router();
const path = require('path');
const Cache = require('../lib/Cache');
const User = require('../lib/jwweb');
const logUser = require('../lib/log-user')(path.join(__dirname, '..', 'public', 'user.log'));

const userCache = new Cache(10 * 60 * 1000);    // 用户会话记录缓存十分钟

router.use(function(req, res, next) {
    let uid  = req.cookies.uid;
    let user = userCache.get(uid);
    if(uid && user) {
        req.user = user;
    }
    next();
});

router.get('/', function(req, res, next) {
    if(req.user) {
        req.user.logout();
        userCache.delete(req.user.id);
    }
    next();
});

router.get('/', function(req, res, next) {
    let message = req.getEchoMessage();
    let user = new User();

    userCache.set(user.id, user);

    user.init().then(function() {
        res.cookie('uid', user.id);
        res.render('index', {message});
    }).catch(next);
});

router.post('/', function(req, res, next) {
    if(!req.user) throw new Error('UID Not Exist');
    
    let form = req.body;
    req.user.login(form).then(logined => {
        if(!logined) throw new Error('Login Failed');
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

        // 三分钟内重复查询直接使用浏览器缓存结果
        res.set('Cache-Control', 'max-age=180');
        res.render('result', {result, semester, message});
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