var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var jwweb = require('../lib/jwweb');

function logUser(id, name, date) {
    var logStr = '';
    logStr += new Date().toLocaleString('zh-CN');
    logStr += '  学号:' + id;
    logStr += '  姓名:' + name;
    logStr += '  查询学期:' + date;
    logStr += '\r\n';

    fs.createWriteStream(path.join(__dirname, '..', 'user.log'), {
        flags: 'a+'
    })
    .end(logStr, 'utf-8');
}

// 首页路由
router.get('/', function(req, res, next) {
    var message = req.getEchoMessage();

    jwweb.connect(function(err, uid) {
        if(err) return next(err);
        res.cookie('uid', uid);
        res.render('index', {message: message});
    });
});

router.post('/', function(req, res, next) {
    var uid = req.cookies.uid;
    var form = req.body;

    jwweb.login(uid, {
        userID: form.stuId, 
        password: form.stuPwd, 
        captcha: form.code
    }, 
    function(err, logined) {
        if(err) return next(err);
        if(logined) {
            res.redirect(303, '/transcript/' + form.date);
        } else {
            res.setEchoMessage('你没有成功登录，请检查学号、密码以及验证码是否输入正确，注意密码为教务系统密码');
            res.redirect(303, '/');
        }
    })
});

router.get('/transcript/:date', function(req, res, next) {
    var uid = req.cookies.uid;
    var date = req.params.date;
    var message = '';

    jwweb.getResults(uid, date, function(err, result) {
        if(err) return next(err);
        if(result.transcript.length !== 0) {
            logUser(result.id, result.name, date);
        } else {
            message = '没有该学期的成绩，注意：2016-2017学年是指2016年9月到2017年9月';
        }
        res.set('Cache-Control', 'no-cache');        
        res.render('result', {
            result: result,
            date: date,
            message: message
        });
    })
});

// 获取验证码
router.get('/captcha', function(req, res, next) {
    var uid = req.cookies.uid;
    
    jwweb.getCaptcha(uid, function(err, imgData) {
        if(err) return next(err);
        res.set('Cache-Control', 'no-cache');
        res.end(Buffer.from(imgData));
    })
});

module.exports = router;
