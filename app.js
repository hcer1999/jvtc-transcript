const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
const zlib = require('zlib');
const fs = require('fs');

const index = require('./routes/index');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('view cache', false);

app.use(compression({level: zlib.Z_BEST_COMPRESSION}));

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

if (app.get('env') === 'development') {
    app.use(logger('dev'));
} else {
    // create a write stream (in append mode)
    let accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), { flags: 'a' })
    let logFormat = '[:remote-addr] :method :status :url [:response-time[0] ms] (:date[iso]) \\r\\n:user-agent\\r\\n\\r\\n';
    app.use(logger(logFormat, { stream: accessLogStream }));
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 一次性消息中间件
app.use(function (req, res, next) {

    req.getEchoMessage = function () {
        let message = req.cookies.messgae;
        if (message) {
            res.clearCookie('messgae');
        }
        return message;
    }

    res.setEchoMessage = function (value) {
        res.cookie('messgae', value);
    }

    next();
});

app.use('/', index);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
    let err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.use(function(err, req, res, next) {

    if(req.app.get('env') === 'development') {
        return next(err);
    }

    let messageTrans = {
        'Not Found'      : '你访问了一个根本不存在的页面，我们将你带回了主页',
        'Data Incomplete': '学校教务系统返回的数据不完整，无法正常解析',
        'UID Not Exist'  : '你的会话已过期，请重新登录',
        'Unexpected Page': '学校教务系统返回了预期之外的数据，请尝试重新登录',
        'Login Failed'   : '登录失败，请检查学号、密码及验证码是否输入正确，注意需要使用教务系统密码而非学工系统密码'
    }

    let message = messageTrans[err.message];

    if(message) {

        res.setEchoMessage(message);

        // 返回主页
        res.redirect(303, '/');

    } else {

        // 这里处理 messageTrans 中列出的错误信息以外的情况
        // 由于请求主页会对教务系统服务器发出请求，所以有些情况下不能直接跳转到首页显示错误信息
        // 比如与学校服务器连接超时，这时如果跳转到首页显示错误消息，可能出现死循环
        // 所以对于 messageTrans 中列出的错误信息以外的情况，应该渲染错误页面，防止造成意外情况

        res.locals.message = err.message;
        res.locals.error = {};

        let description = '';
        if(err.message === 'ETIMEDOUT' || err.message === 'ESOCKETTIMEDOUT') {
            err.status = 503;
            description = '与学校教务系统连接超时，可能是教务系统暂时无法访问（你懂的，学校服务器经常挂），请稍后再试';
        }

        res.status(err.status || 500);

        // 渲染错误页
        res.render('error', {description: description});
    }
});

// error handler
app.use(function(err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = err;

    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
