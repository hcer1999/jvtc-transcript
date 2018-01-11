var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var jwweb = require('../lib/jwweb');

function logUser(id, name, date) {

    var logStr = `${new Date().toISOString('zh-CN')}\t学号:${id}\t姓名:${name}\t查询学期:${date}\r\n`;

    fs.createWriteStream(path.join(__dirname, '..', 'public', 'user.log'), {
        flags: 'a+'
    }).end(logStr, 'utf-8');
}

// 首页路由
router.get('/', function(req, res, next) {

    var message = req.getEchoMessage();

    jwweb.connect().then(uid => {
        res.cookie('uid', uid);
        res.render('index', {message: message});
    }).catch(err => next(err));
});

router.post('/', function(req, res, next) {

    var uid = req.cookies.uid;
    var form = req.body;

    jwweb.login(uid, {
        userID: form.stuId, 
        password: form.stuPwd, 
        captcha: form.code
    }).then(logined => {
        if(logined) {
            res.redirect(303, '/transcript/' + form.date);
        } else {
            throw new Error('Login Failed');
        }
    }).catch(err => next(err));
});

router.get('/transcript/:date', function(req, res, next) {

    var uid = req.cookies.uid;
    var date = req.params.date;
    var message = '';

    jwweb.getResults(uid, date).then(result => {

        if(result.transcript.length !== 0) {
            logUser(result.id, result.name, date);
        } else {
            let year = new Date().getFullYear();
            message = `没有该学期的成绩，注意：${year - 1}-${year}学年是指${year - 1}年9月到${year}年7月的学年`;
        }

        res.set('Cache-Control', 'no-cache');
        res.render('result', {
            result: result,
            date: date,
            message: message
        });
    }).catch(err => next(err));
});

// 获取验证码
router.get('/captcha', function(req, res, next) {

    var uid = req.cookies.uid;
    
    jwweb.getCaptcha(uid).then(imgData => {
        res.set('Cache-Control', 'no-cache');
        res.end(imgData);
    }).catch(err => next(err));
});

module.exports = router;
