var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var compression = require('compression');
var zlib = require('zlib');
var fs = require('fs');

var index = require('./routes/index');

var app = express();

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
        var message = req.cookies.messgae;
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
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

app.use(function(err, req, res, next) {

    if(req.app.get('env') === 'development') {
        return next(err);
    }

    var messageTrans = {
        'Not Found'      : '你访问了一个根本不存在的页面，我们将你带回了主页',
        'Data Incomplete': '学校教务系统返回的数据不完整，无法正常解析',
        'UID Not Exist'  : '你的会话已过期，请重新登录',
        'Unexpected Page': '学校教务系统返回了预期之外的数据，请尝试重新登录',
        'Login Failed'   : '登录失败，请检查学号、密码及验证码是否输入正确，注意需要使用教务系统密码而非学工系统密码'
    }

    var message = messageTrans[err.message] || err.message;

    if (message !== '') {
        res.setEchoMessage(message);
        res.redirect(303, '/');
    } else {
        let description = '';
        if(err.message === 'ETIMEDOUT' || err.message === 'ESOCKETTIMEDOUT') {
            err.status = 503;
            description = '与学校教务系统连接超时，可能是教务系统暂时无法访问（你懂的，学校服务器经常挂），请稍后再试';
        }

        res.status(err.status || 500);
        res.render('error', {description: description || err.message});
    }
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    if(req.app.get('env') === 'development') {
        // render the error page
        res.status(err.status || 500);
        res.render('error');
    }
});

module.exports = app;
