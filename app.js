const express = require('express');
const path = require('path');
const os = require('os');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const compression = require('compression');
const zlib = require('zlib');
const fs = require('fs');
const app = express();
const index = require('./routes/index');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.set('view cache', false);

app.use(compression({level: zlib.Z_BEST_SPEED}));

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

if (app.get('env') === 'development') {
    app.use(logger('dev'));
} else {
    // create a write stream (in append mode)
    const EOL = os.EOL == '\r\n' ? '\\r\\n' : '\\n';
    const accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'});
    const logFormat = `[:remote-addr] :method :status :url [:response-time[0] ms] (:date[iso])${EOL}:user-agent${EOL}`;
    app.use(logger(logFormat, {stream: accessLogStream}));
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false, limit: '1kb'}));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 一次性消息中间件
app.use(function (req, res, next) {
    res.setEchoMessage = (value) => {
        res.cookie('messgae', value);
    }
    req.getEchoMessage = () => {
        res.clearCookie('messgae');
        return req.cookies.messgae;
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

// 生产环境下的错误处理
app.use(function(err, req, res, next) {
    if(req.app.get('env') === 'development') return next(err);

    // connect ETIMEDOUT 218.65.5.214:2001、ETIMEDOUT、ESOCKETTIMEDOUT等情况
    err.message = err.message.toLowerCase().includes('timedout') ? 'TIMEDOUT' : err.message;
    let messageTrans = {
        'Not Found'       : '你访问了一个不存在的页面，我们将你带回了主页',
        'UID Not Exist'   : '你的会话已过期，请重新登录',
        'Login Failed'    : '登录失败，请检查账号密码是否输入正确，注意需要使用教务系统密码而非学工系统密码',
        'Login Frequently': '登录过于频繁，请稍后再试。该问题也可能是你所在网络环境内其他用户频繁登录导致的',
        'No Result'       : '没有查询到有效成绩，可能你不是在校生或是没有任何成绩的新生',
        'TIMEDOUT'        : '与学校教务系统连接超时，可能是教务系统暂时无法访问，请稍后再试'
    }

    res.setEchoMessage(messageTrans[err.message] || err.message);
    res.redirect(303, '/'); // 返回主页
});

// error handler
app.use(function(err, req, res, next) {
    res.locals.message = err.message;
    res.locals.error = err;

    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;
