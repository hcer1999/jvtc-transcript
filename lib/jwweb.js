var EventEmitter = require('events');
var request = require('request');
var iconv = require('iconv-lite');
var md5 = require('md5');


const LOGIN_PAGE_URL = 'http://218.65.5.214:2001/jwweb/_data/index_LOGIN.aspx';
const VIEW_SCORE_PAGE_URL = 'http://218.65.5.214:2001/jwweb/xscj/c_ydcjrdjl.aspx';
const INQUIRE_SCORE_URL = 'http://218.65.5.214:2001/jwweb/xscj/c_ydcjrdjl_rpt.aspx';
const VALIDATE_CODE_URL = 'http://218.65.5.214:2001/jwweb/sys/ValidateCode.aspx';


var dataStore = {};

function getUID() {
    return parseInt(Math.random() * 1000000000000000).toString();
}

function sendRequest(option, errCb) {
    var evObj = new EventEmitter();
    var wholeData = new Uint8Array(0);
    var rq;
    rq = request(Object.assign({timeout: 6000}, option), function(err) {
        if(err == null) {
            return;
        }
        if(typeof errCb === 'function') {
            // 出现错误后不继续触发其他事件
            rq.removeAllListeners();
            errCb(err);
        } else {
            throw err;
        }
    })
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

function getHandledTranscript(html) {
    var studentName, studentNameRegexp = /姓名：(.*?)<\/td>/;
    var studentID, studentIDRegexp = /学号：(.*?)<\/td>/;
    var courseHTML, courseRegexp = /<tr class=(B|H)>(.*?)<\/tr>/g;
    var columnHTML, columnRegexp = /<td .*?>(.*?)<br><\/td>/g;
    var transcript = [];
    var result = {};

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
    studentID = studentIDRegexp.exec(html);
    result['name'] = (studentName && studentName[1]) || '';
    result['id'] = (studentID && studentID[1]) || '';
    result['transcript'] = transcript;
    return result;
}

exports.connect = function(cb) {

    var getViewStateField = function(html) {
        var reg = /input.*name=\"__VIEWSTATE\".*value=\"(.*)\"/g;
        var result = RegExp(reg).exec(html);
        return (result && result[1]) || false;
    }

    var sessionCookie;
    var viewState;

    sendRequest({
        method: 'GET',
        url: LOGIN_PAGE_URL
    }, function(err) {
        cb(err);
        return;
    })
    .on('response', function(response) {
        sessionCookie = response.headers['set-cookie'] && response.headers['set-cookie'][0];
    })
    .on('over', function(htmlData) {
        var html = iconv.decode(htmlData, 'gbk');

        viewState = getViewStateField(html);

        if(sessionCookie && viewState) {
            var uid = getUID();

            // 记录本次连接数据
            dataStore[uid] = {
                sessionCookie: sessionCookie,
                viewState: viewState
            }

            // 5分钟后删除记录
            setTimeout(_ => delete dataStore[uid], 300000);
            
            cb(null, uid);
        } else {
            cb(new Error('Data incomplete'));
        }
    });
}

exports.getCaptcha = function(uid, cb) {
    var record = dataStore[uid];
    if(record == null) {
        cb(new Error('UID not exist'));
        return;
    }

    sendRequest({
        method: 'GET',
        url: VALIDATE_CODE_URL,
        headers: {
            Cookie: record.sessionCookie
        }
    }, function(err) {
        cb(err);
        return;
    })
    .on('over', function(imageData) {
        cb(null, imageData);
    });

}

exports.isLogin = function(uid, cb) {
    var record = dataStore[uid];
    if(record == null) {
        cb(new Error('UID not exist'));
        return;
    }

    sendRequest({
        url: VIEW_SCORE_PAGE_URL, 
        method: 'GET',
        headers: {
            Cookie: record.sessionCookie
        }
    }, function(err) {
        cb(err);
        return;
    })
    .on('over', function(data) {
        var html = iconv.decode(data, 'gbk');
        cb(null, html.search('您无权访问此页') === -1);
    });
 }

exports.login = function(uid, {captcha = '', userID = '', password = ''}, cb) {

    var getChkpwdString = function(stuId, stuPwd) {
        return md5(stuId + md5(stuPwd).substring(0, 30).toUpperCase() + '11785').substring(0, 30).toUpperCase();
    }

    var getChkyzmString = function(captcha) {
        return md5(md5(captcha.toUpperCase()).substring(0, 30).toUpperCase() + '11785').substring(0, 30).toUpperCase();
    }

    var record = dataStore[uid];
    if(record == null) {
        cb(new Error('UID not exist'));
        return;
    }

    var form = {
        __VIEWSTATE: record.viewState,
        Sel_Type: 'STU',
        txt_asmcdefsddsd: userID,
        txt_pewerwedsdfsdff: captcha,
        dsdsdsdsdxcxdfgfg: getChkpwdString(userID, password),
        fgfggfdgtyuuyyuuckjg: getChkyzmString(captcha)
    };

    sendRequest({
        url: LOGIN_PAGE_URL, 
        method: 'POST',
        form: form, 
        headers: {
            Cookie: record.sessionCookie, 
            Referer: LOGIN_PAGE_URL
        }
    }, function(err) {
        cb(err);
        return;
    })
    .on('response', function(res) {
        exports.isLogin(uid, function(err, logined) {
            cb(err, logined);
        })
    })
}

exports.getResults = function(uid, semester, cb) {
    var record = dataStore[uid];
    if(record == null) {
        cb(new Error('UID not exist'));
        return;
    }

    sendRequest({
        url: INQUIRE_SCORE_URL, 
        method: 'POST', 
        form: {
            sel_xnxq: semester, 
            radCx: '1'
        }, 
        headers: {
            Cookie: record.sessionCookie, 
            Referer: VIEW_SCORE_PAGE_URL
        }
    }, function(err) {
        cb(err);
        return;
    })
    .on('over', function(data) {
        var html = iconv.decode(data, 'gbk');

        // 确认是否成功获取成绩页面
        if(html.search('成绩认定记录') !== -1) {

            // 如果没有提取到成绩记录，result.transcript.length === 0
            let result = getHandledTranscript(html);
            cb(null, result);
        } else {
            cb(new Error('Unexpected page'));
        }
    });
}