const md5 = require('md5');
const iconv = require('iconv-lite');
const nanoid = require('nanoid');
const TIMEOUT = 16000;
const request = require('./request')({timeout: TIMEOUT});

class JwwebUser {

    constructor() {
        this.id = nanoid();
        this.resultCache = {};  // 已查询的学期成绩缓存
    }

    async init() {
        let getHiddenFields = function (html) {
            let regexp = /<input type="hidden" name="(__.*)".*?value="(.*)" \/>/g;     // 匹配所有name为__开头的表单隐藏字段，如: __VIEWSTATE
            let fileds = {};
            let result;
            while (result = regexp.exec(html)) {
                fileds[result[1]] = result[2];
            }
            return fileds;
        }

        let {response, body} = await request(JwwebUser.URL_LOGIN);
        let sessionVal;
        try {
            let cookies = response.headers['set-cookie'];
            for(let cookie of cookies) {
                let result = /ASP\.NET_SessionId=(.*?)(?:; |$)/.exec(cookie);
                result && (sessionVal = result[1]);
            }
            if(!sessionVal) throw(new Error());
        } catch (err) {
            throw new Error('获取会话Cookie失败');
        }

        let sessionCookie = 'ASP.NET_SessionId=' + sessionVal;

        if(!this.loginPageHTML) {
            this.loginPageHTML = iconv.decode(body, 'gbk');
        }

        // 记录登录所需的数据
        this.sessionCookie = sessionCookie;
        this.hiddenFields = getHiddenFields(this.loginPageHTML);

        return this;
    }

    async getCaptcha() {
        let {body: imageData} = await request(JwwebUser.URL_CAPTCHA, {
            headers: {
                Cookie: this.sessionCookie
            }
        });

        return imageData;
    }

    async isLogin() {
        let {body} = await request(JwwebUser.URL_VIEW_SCORE, { 
            headers: {
                Cookie: this.sessionCookie
            }
        });

        let html = iconv.decode(body, 'gbk');
        this._isLogin = html.includes('您无权访问此页') === false;
        return this._isLogin;
    }

    async login({captcha = undefined, userid = undefined, password = undefined}) {

        if(!this._chkcode) {

            // 从登录页的chkpwd/chkyzm函数中提取出chkcode，chkcode不同学校会不同，九职为11785
            // loginPageHTML在第一次成功调用this.init时会缓存下来
            this._chkcode = /md5\(obj.value\)\.substring\(0,30\)\.toUpperCase\(\)\+'(\d{5})'\)/.exec(this.loginPageHTML)[1];
        }

        let getChkpwdString = (stuId, stuPwd) => {
            return md5(stuId + md5(stuPwd).substring(0, 30).toUpperCase() + this._chkcode).substring(0, 30).toUpperCase();
        }
    
        let getChkyzmString = (captcha) => {
            return md5(md5(captcha.toUpperCase()).substring(0, 30).toUpperCase() + this._chkcode).substring(0, 30).toUpperCase();
        }
    
        let form = {
            Sel_Type: 'STU',
            txt_asmcdefsddsd: userid,
            txt_pewerwedsdfsdff: captcha,
            dsdsdsdsdxcxdfgfg: getChkpwdString(userid, password),
            fgfggfdgtyuuyyuuckjg: getChkyzmString(captcha),
            ...this.hiddenFields
        };
    
        await request(JwwebUser.URL_LOGIN, {
            method: 'POST',
            form: form, 
            headers: {
                Cookie: this.sessionCookie, 
                Referer: JwwebUser.URL_LOGIN
            }
        });

        let isLogin = await this.isLogin();
        if(isLogin === true) {
            this.userid = userid;   // 获取学生学号
            this.username = await this.getStudentName();  // 获取学生姓名
        }
        return isLogin;
    }

    async getStudentName() {
        let {body} = await request(JwwebUser.URL_FOOTER, {
            headers: {
                Cookie: this.sessionCookie
            }
        });

        let html = iconv.decode(body, 'gbk');

        try {
            return /<span id="lbl_userinfo">.*?\[\d+\](.*)<\/span>/.exec(html)[1];
        } catch (err) {
            throw new Error('获取学生姓名失败');
        }
    }

    async getResults(semester) {
        if(typeof semester !== 'string' || /^20\d\d(0|1)$/.test(semester) === false) {
            throw new Error('学号格式错误');
        }

        if(this.resultCache[semester]) {
            return this.resultCache[semester];
        }
    
        let {body} = await request(JwwebUser.URL_POST_SCORE, { 
            method: 'POST', 
            form: {
                sel_xnxq: semester, 
                radCx: '1'
            }, 
            headers: {
                Cookie: this.sessionCookie, 
                Referer: JwwebUser.URL_VIEW_SCORE
            }
        });
        
        try {
            let html = iconv.decode(body, 'gbk');
            let transcript = getHandledTranscript(html);    // 如果查询的学年没有任何课程的成绩，transcript.length === 0
            this.resultCache[semester] = {
                transcript: transcript,
                userid: this.userid,
                username: this.username,
                semester: semester
            };
        } catch(err) {
            throw new Error('解析成绩页面失败');
        }

        return this.resultCache[semester];        
    }

    async logout() {
        this._isLogin && await request(JwwebUser.URL_LOGOUT, {
            headers: {
                Cookie: this.sessionCookie
            }
        });
    }
}

JwwebUser.setRootUrl = function(url) {
    url = url[url.length - 1] !== '/' ? url + '/' : url;
    this.URL_LOGIN      = url + '_data/index_LOGIN.aspx';
    this.URL_VIEW_SCORE = url + 'xscj/c_ydcjrdjl.aspx';
    this.URL_POST_SCORE = url + 'xscj/c_ydcjrdjl_rpt.aspx';
    this.URL_CAPTCHA    = url + 'sys/ValidateCode.aspx';
    this.URL_LOGOUT     = url + 'sys/Logout.aspx';
    this.URL_FOOTER     = url + 'PUB/foot.aspx';
}

function getHandledTranscript(html) {
    let courseHTML, courseRegexp = /<tr class=(B|H)>(.*?)<\/tr>/g;
    let columnHTML, columnRegexp = /<td .*?>(.*?)<br><\/td>/g;
    let transcript = [];
    let result = {};

    while ((courseHTML = courseRegexp.exec(html)) != null) {
        let course = {};
        let matchArr = [];
        courseHTML = courseHTML[2];
        while ((columnHTML = columnRegexp.exec(courseHTML)) != null) {
            matchArr.push(columnHTML);
        }
        course['name'] = matchArr[0][1];
        course['name'] = course['name'].replace(/\[.*?\]/, '');  // 去除课程代号
        course['credit'] = matchArr[1][1];
        course['type'] = matchArr[4][1].trim();
        course['score'] = matchArr[7][1];
        transcript.push(course);
    }
    return transcript;
}

module.exports = JwwebUser;