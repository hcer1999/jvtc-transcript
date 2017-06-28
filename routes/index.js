var EventEmitter = require('events');
var express = require('express');
var router = express.Router();
var request = require('request');
var iconv = require('iconv-lite');
var md5 = require('md5');

function getViewStateField(html) {
    var reg = /input.*name=\"__VIEWSTATE\".*value=\"(.*)\"/g;
    return RegExp(reg).exec(html)[1];
}

function getChkpwdString(stuId, stuPwd) {
    return md5(stuId + md5(stuPwd).substring(0,30).toUpperCase() + '11785').substring(0,30).toUpperCase();
}

function getChkyzmString(captcha) {
    return md5(md5(captcha.toUpperCase()).substring(0,30).toUpperCase() + '11785').substring(0,30).toUpperCase();
}

function sendRequest(option) {
    var evObj = new EventEmitter();
    var wholeData = new Uint8Array(0);
    request(option)
    .on('data', function(data) {
        var tmp = new Uint8Array(wholeData.length + data.length);
        tmp.set(wholeData);
        tmp.set(data, wholeData.length);
        wholeData = tmp;
    })
    .on('end', function() {
        evObj.emit('over', wholeData);
    })
    .on('response', function(response) {
        evObj.emit('response', response);
    });
    return evObj;
}

function isGetTranscriptSuccessfully(html) {
    return html.search('成绩认定记录') !== -1;
}

function getHandledTranscript(html) {
    var studentNameRegexp = /姓名：(.*?)<\/td>/
    var courseRegexp = /<tr class=(B|H)>(.*?)<\/tr>/g;
    var courseHTML;
    var columnRegexp = /<td .*?>(.*?)<br><\/td>/g;
    var columnHTML;
    var transcript = [];
    var result = {};
    var studentName;
    while((courseHTML = courseRegexp.exec(html)) != null) {
        let course = {};
        let matchArr = [];
        courseHTML = courseHTML[2];
        while((columnHTML = columnRegexp.exec(courseHTML)) != null) {
            matchArr.push(columnHTML);
        }
        course['name'] = matchArr[0][1];
        course['credit'] = matchArr[1][1];
        course['type'] = matchArr[4][1];
        course['score'] = matchArr[7][1];
        transcript.push(course);
    }
    studentName = studentNameRegexp.exec(html);
    result['name'] = (studentName && studentName[1]) || '';
    result['transcript'] = transcript;
    return result;
}

const LOGIN_PAGE_URL = 'http://218.65.5.214:2001/jwweb/_data/index_LOGIN.aspx';
const VIEW_SCORE_PAGE_URL = 'http://218.65.5.214:2001/jwweb/xscj/c_ydcjrdjl.aspx';
const INQUIRE_SCORE_URL = 'http://218.65.5.214:2001/jwweb/xscj/c_ydcjrdjl_rpt.aspx';
const VALIDATE_CODE_URL = 'http://218.65.5.214:2001/jwweb/sys/ValidateCode.aspx';

// 首页路由
router.get('/', function(req, res, next) {
    var sessionCookie;

    sendRequest({
        method: 'GET',
        url: LOGIN_PAGE_URL
    })
    .on('response', function(response) {
        sessionCookie = response.headers['set-cookie'][0];
    })
    .on('over', function(htmlData) {
        var html = iconv.decode(htmlData, 'gbk');
        var VIEWSTATE = getViewStateField(html);
        res.render('index', { sessionCookie: sessionCookie, captchaURI: '/captcha/' + sessionCookie, VIEWSTATE: VIEWSTATE });
    });
});

// 提交表单路由
router.post('/', function(req, res, next) {
    var form = req.body;
    var sendForm = {
        '__VIEWSTATE': form.VIEWSTATE,
        'Sel_Type': 'STU',
        'txt_asmcdefsddsd': form.stuId,
        'txt_pewerwedsdfsdff': form.code,
        'dsdsdsdsdxcxdfgfg': getChkpwdString(form.stuId, form.stuPwd),
        'fgfggfdgtyuuyyuuckjg': getChkyzmString(form.code)
    };

    // 模拟登录
    sendRequest({
        url: LOGIN_PAGE_URL, method: 'POST',
        form: sendForm, 
        headers: {
            Cookie: form.session, 
            Referer: LOGIN_PAGE_URL
        }
    })
    .on('over', function(redirectionPageData) {

        // 获取成绩
        sendRequest({
            url: INQUIRE_SCORE_URL, 
            method: 'POST', 
            form: {
                sel_xnxq: form.date, 
                radCx: '1'
            }, 
            headers: {
                Cookie: form.session, 
                Referer: VIEW_SCORE_PAGE_URL
            }
        })
        .on('over', function(transcriptPageData) {
            var html = iconv.decode(transcriptPageData, 'gbk');

            // 确认是否成功获取成绩页面
            if(isGetTranscriptSuccessfully(html)) {
                let result = getHandledTranscript(html);
                res.render('result', result);
            } else {
                res.render('index', { 
                    sessionCookie: form.session, 
                    captchaURI: '/captcha/' + form.session, 
                    VIEWSTATE: form.VIEWSTATE, 
                    message: '你没有成功登录，请检查学号、密码以及验证码是否输入正确，注意密码为教务系统密码'
                });
            }
        });
    });
});

// 获取验证码
router.get('/captcha/:session', function(req, res, next) {
    var sessionCookie = req.params.session;
    sendRequest({
        method: 'GET',
        url: VALIDATE_CODE_URL,
        headers: {
            Cookie: sessionCookie
        }
    })
    .on('over', function(imageData) {
        res.end(new Buffer(imageData))
    });
});

module.exports = router;
