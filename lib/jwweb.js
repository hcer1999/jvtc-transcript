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

function sendRequest(url, userOptions) {

    return new Promise(function(resolve, reject) {
        let options = Object.assign({timeout: 45000, url}, userOptions);
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
        course['name'] = course['name'].replace(/\[.*?\]/,'');  // 去除课程代号
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

function connect() {

    let getViewStateField = function(html) {
        let reg = /input.*name=\"__VIEWSTATE\".*value=\"(.*)\"/g;
        let result = RegExp(reg).exec(html);
        return (result && result[1]) || false;
    }

    return sendRequest(LOGIN_PAGE_URL).then(function({response, body}) {
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

            // 10分钟后删除记录
            setTimeout(_ => delete dataStore[uid], 600000);
            
            return uid;
        } else {
            throw new Error('Data Incomplete');
        }
    })
}

function getCaptcha(uid) {
    let record = dataStore[uid];

    if(record == null) {
        return Promise.reject(new Error('UID Not Exist'));
    }

    return sendRequest(VALIDATE_CODE_URL, {
        headers: {
            Cookie: record.sessionCookie
        }
    }).then(function({response, body}) {
        return body;
    });
}

function isLogin(uid) {
    let record = dataStore[uid];

    if(record == null) {
        return Promise.reject(new Error('UID Not Exist'));
    }

    return sendRequest(VIEW_SCORE_PAGE_URL, { 
        headers: {
            Cookie: record.sessionCookie
        }
    }).then(function({response, body}) {
        let html = iconv.decode(body, 'gbk');
        return html.search('您无权访问此页') === -1;
    });
}

function login(uid, {captcha = '', userID = '', password = ''}) {

    let getChkpwdString = function(stuId, stuPwd) {
        return md5(stuId + md5(stuPwd).substring(0, 30).toUpperCase() + '11785').substring(0, 30).toUpperCase();
    }

    let getChkyzmString = function(captcha) {
        return md5(md5(captcha.toUpperCase()).substring(0, 30).toUpperCase() + '11785').substring(0, 30).toUpperCase();
    }

    let record = dataStore[uid];
    if(record == null) {
        return Promise.reject(new Error('UID Not Exist'));
    }

    let form = {
        __VIEWSTATE: record.viewState,
        Sel_Type: 'STU',
        txt_asmcdefsddsd: userID,
        txt_pewerwedsdfsdff: captcha,
        dsdsdsdsdxcxdfgfg: getChkpwdString(userID, password),
        fgfggfdgtyuuyyuuckjg: getChkyzmString(captcha)
    };

    return sendRequest(LOGIN_PAGE_URL, {
        method: 'POST',
        form: form, 
        headers: {
            Cookie: record.sessionCookie, 
            Referer: LOGIN_PAGE_URL
        }
    }).then(_ => isLogin(uid));
}

function getResults(uid, semester) {
    let record = dataStore[uid];
    if(record == null) {
        return Promise.reject(new Error('UID Not Exist'));
    }

    return sendRequest(INQUIRE_SCORE_URL, { 
        method: 'POST', 
        form: {
            sel_xnxq: semester, 
            radCx: '1'
        }, 
        headers: {
            Cookie: record.sessionCookie, 
            Referer: VIEW_SCORE_PAGE_URL
        }
    }).then(function({response, body}) {
        let html = iconv.decode(body, 'gbk');

        // 确认是否成功获取成绩页面
        if(html.search('成绩认定记录') !== -1) {

            // 如果没有提取到成绩记录，result.transcript.length === 0
            return getHandledTranscript(html);

        } else {
            throw new Error('Unexpected Page');
        }
    });
}

module.exports = {
    connect,
    getCaptcha,
    login,
    isLogin,
    getResults
}