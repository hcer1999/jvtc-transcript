var EventEmitter = require('events');
var request = require('request');
var iconv = require('iconv-lite');
var md5 = require('md5');
var nanoid = require('nanoid');

const LOGIN_PAGE_URL = 'http://218.65.5.214:2001/jwweb/_data/index_LOGIN.aspx';
const VIEW_SCORE_PAGE_URL = 'http://218.65.5.214:2001/jwweb/xscj/c_ydcjrdjl.aspx';
const INQUIRE_SCORE_URL = 'http://218.65.5.214:2001/jwweb/xscj/c_ydcjrdjl_rpt.aspx';
const VALIDATE_CODE_URL = 'http://218.65.5.214:2001/jwweb/sys/ValidateCode.aspx';


let dataStore = {};

function sendRequest(userOptions) {

    return new Promise(function(resolve, reject) {
        let options = Object.assign({timeout: 6000}, userOptions);
        let response;
        let data = Buffer.alloc(0);

        request(options, function(err) {
            if(err) return reject(err);
        }).on('response', function(res) {
            response = res;
        }).on('data', function(chunk) {
            data = Buffer.concat([data, chunk]);
        }).on('end', function() {
            return resolve({response, body: data});
        });

    });
}

function getHandledTranscript(html) {
    let studentName, studentNameRegexp = /姓名：(.*?)<\/td>/;
    let studentID, studentIDRegexp = /学号：(.*?)<\/td>/;
    let courseHTML, courseRegexp = /<tr class=(B|H)>(.*?)<\/tr>/g;
    let columnHTML, columnRegexp = /<td .*?>(.*?)<br><\/td>/g;
    let transcript = [];
    let result = {};

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

    let getViewStateField = function(html) {
        let reg = /input.*name=\"__VIEWSTATE\".*value=\"(.*)\"/g;
        let result = RegExp(reg).exec(html);
        return (result && result[1]) || false;
    }

    sendRequest({
        url: LOGIN_PAGE_URL
    })
    .then(function({response, body}) {
        let sessionCookie = response.headers['set-cookie'] && response.headers['set-cookie'][0];

        let html = iconv.decode(body, 'gbk');
        
        let viewState = getViewStateField(html);

        if(sessionCookie && viewState) {
            let uid = nanoid();

            // 记录本次连接数据
            dataStore[uid] = {
                sessionCookie: sessionCookie,
                viewState: viewState
            }

            // 15分钟后删除记录
            setTimeout(_ => delete dataStore[uid], 900000);
            
            cb(null, uid);
        } else {
            cb(new Error('Data incomplete'));
        }
    })
    .catch(function(err) {
        cb(err);
    });
}

exports.getCaptcha = function(uid, cb) {
    let record = dataStore[uid];

    if(record == null) {
        cb(new Error('UID not exist'));
        return;
    }

    sendRequest({
        url: VALIDATE_CODE_URL,
        headers: {
            Cookie: record.sessionCookie
        }
    })
    .then(function({response, body}) {
        cb(null, body);
    })
    .catch(function(err) {
        cb(err);
    });

}

exports.isLogin = function(uid, cb) {
    let record = dataStore[uid];

    if(record == null) {
        cb(new Error('UID not exist'));
        return;
    }

    sendRequest({
        url: VIEW_SCORE_PAGE_URL, 
        headers: {
            Cookie: record.sessionCookie
        }
    })
    .then(function({response, body}) {
        let html = iconv.decode(body, 'gbk');
        cb(null, html.search('您无权访问此页') === -1);
    })
    .catch(function(err) {
        cb(err);
    });
 }

exports.login = function(uid, {captcha = '', userID = '', password = ''}, cb) {

    let getChkpwdString = function(stuId, stuPwd) {
        return md5(stuId + md5(stuPwd).substring(0, 30).toUpperCase() + '11785').substring(0, 30).toUpperCase();
    }

    let getChkyzmString = function(captcha) {
        return md5(md5(captcha.toUpperCase()).substring(0, 30).toUpperCase() + '11785').substring(0, 30).toUpperCase();
    }

    let record = dataStore[uid];
    if(record == null) {
        cb(new Error('UID not exist'));
        return;
    }

    let form = {
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
    })
    .then(function({response, body}) {
        exports.isLogin(uid, function(err, logined) {
            cb(err, logined);
        });
    })
    .catch(function(err) {
        cb(err);
    });
}

exports.getResults = function(uid, semester, cb) {
    let record = dataStore[uid];
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
    })
    .then(function({response, body}) {
        let html = iconv.decode(body, 'gbk');

        // 确认是否成功获取成绩页面
        if(html.search('成绩认定记录') !== -1) {

            // 如果没有提取到成绩记录，result.transcript.length === 0
            let result = getHandledTranscript(html);
            cb(null, result);
        } else {
            cb(new Error('Unexpected page'));
        }
    })
    .catch(function(err) {
        cb(err);
    });
}