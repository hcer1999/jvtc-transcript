var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs');

var index = require('./routes/index');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));

if(app.get('env') === 'development') {
  app.use(logger('dev'));
} else {
  // create a write stream (in append mode)
  let accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'})
  let logFormat = '[:remote-addr] :method :status :url [:response-time[0] ms] (:date[iso]) \\r\\n:user-agent\\r\\n\\r\\n';
  app.use(logger(logFormat, {stream: accessLogStream}));
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 一次性消息中间件
app.use(function(req, res, next) {
  req.getEchoMessage = function() {
    var message = req.cookies.messgae;
    if(message) {
      res.clearCookie('messgae');
    }
    return message;
  }

  res.setEchoMessage = function(value) {
    res.cookie('messgae', value);
  }

  next();
});

app.use('/', index);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
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
    return;
  }

  let message = '';
  switch(err.message) {
    case 'Not Found':
      message = '你访问了一个根本不存在的页面，我们将你带回了主页';
      break;
    case 'Data incomplete':
      message = '学校教务系统返回的数据不完整，我们无法解析。出现这个问题可能是由于我们或学校的服务器网络情况不太好';
      break;
    case 'UID not exist':
      message = '你的会话已过期，当你访问首页时会开始一个新的会话，这个会话保质期为15分钟。所以请不要尝试将查询结果页面保存到书签中（应该保存主页）';
      break;
    case 'Unexpected page':
      message = '学校教务系统返回了一些我们预料之外的数据，我们不知道接下来该做什么，所以决定将你带回主页。如果你持续看到这个消息，应该考虑联系作者';
      break;
  }
  
  if(message !== '') {
    res.setEchoMessage(message);
    res.redirect(303, '/');
  } else {
    let description = '';
    switch(err.message) {
      case 'ETIMEDOUT':
        description = '与学校教务系统服务器连接超时，可能是学校教务系统暂时无法访问，请稍后再试';
    }
    res.status(err.status || 500);
    res.render('error', {description: description});
  }
});

module.exports = app;
