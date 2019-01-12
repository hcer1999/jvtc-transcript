const request = require('./request');
const Base64 = require('js-base64').Base64;

class JwwebUser {

    constructor(id) {
        this.id = id;
    }

    async init() {
        const {res, body} = await request('http://jiaowu.jvtc.jx.cn/jsxsd/');
        let sessionVal;
        let cookies = res.headers['set-cookie'];

        for(let cookie of cookies) {
            let result = /JSESSIONID=(.*?)(?:; |$)/.exec(cookie);
            result && (sessionVal = result[1]);
        }

        if(!sessionVal) throw new Error('获取会话Cookie失败');
        this.sessionCookie = 'JSESSIONID=' + sessionVal;    // 记录cookie

        return this;
    }

    async isLogin() {
        const {res, body} = await request(
            'http://jiaowu.jvtc.jx.cn/jsxsd/framework/xsMain.jsp', 
            {headers: {Cookie: this.sessionCookie}}
        );

        return (this._isLogin = res.statusCode === 200);
    }

    // 通过学号和身份证号重置账号密码，成功后密码会被重置为 qwe + 身份证后6位
    async resetPassword(userid, idnumber) {
        const {res, body} = await request('http://jiaowu.jvtc.jx.cn/jsxsd/system/resetPasswd.do', {
            method: 'POST',
            followAllRedirects: true,
            form: {
                account: userid,
                accounttype: 2,
                sfzjh: idnumber
            }
        });
        if(res.statusCode !== 200) {
            return {
                message: "学号不存在或其他异常情况",
                success: false
            }
        } else {
            const {success, message} = JSON.parse(body);
            if(!success) return JSON.parse(body);

            const defaultPassword = idnumber.slice(-6);
            const newPassword = 'qwe' + defaultPassword;

            // 重置成功后密码为身份证后六位，但是使用这个密码登录会跳转到修改密码界面
            await this.login({userid, password: defaultPassword});

            // 将密码修改为 qwe + 身份证后六位
            await request('http://jiaowu.jvtc.jx.cn/jsxsd/grsz/grsz_xgmm_beg.do', {
                method: 'POST',
                form: {
                    id: '',
                    oldpassword: defaultPassword,
                    password1: newPassword,
                    password2: newPassword,
                    upt: 1
                },
                headers: {
                    'Cookie': this.sessionCookie,
                    'Referer': 'http://jiaowu.jvtc.jx.cn/jsxsd/grsz/grsz_xgmm_beg.do'
                }
            });

            return {success: true, message: '密码修改完成，新密码为：' + newPassword};
        }
    }

    async login({userid = undefined, password = undefined}) {
        const {res, body} = await request('http://jiaowu.jvtc.jx.cn/jsxsd/xk/LoginToXk', {
            method: 'POST',
            followAllRedirects: true,
            form: {
                userAccount: userid,
                userPassword: password,
                encoded: Base64.encode(userid) + '%%%' + Base64.encode(password)
            }, 
            headers: {
                'Cookie': this.sessionCookie,
                'Referer': 'http://jiaowu.jvtc.jx.cn/jsxsd/xk/LoginToXk'
            }
        });

        const result = /<span class="glyphicon-class">(.*?)<\/span>/.exec(body);
        this.userid = userid;                // 获取学生学号
        this.username = result && result[1]  // 获取学生姓名

        return !!this.username;
    }

    async getResults() {

        // 使用上次调用getResults缓存的结果
        if(this.resultCache) {
            return this.resultCache;
        }
    
        const {res, body} = await request('http://jiaowu.jvtc.jx.cn/jsxsd/kscj/cjcx_list', { 
            method: 'POST', 
            form: {
                kksj: '',
                kcxz: '',
                kcmc: '',
                xsfs: 'all'
            }, 
            headers: { Cookie: this.sessionCookie }
        });

        const transcript = getHandledTranscript(body);    // 如果查询的学年没有任何课程的成绩，transcript.length === 0
        this.resultCache = {
            transcript: transcript,
            userid: this.userid,
            username: this.username
        };

        return this.resultCache;
    }

    async logout() {
        this._isLogin && 1/* logout */;
    }
}

function getHandledTranscript(html) {
    let courseHTML, courseRegexp = /<tr>((?:\s|\S)*?)<\/tr>/g;
    let columnHTML, columnRegexp = /<td.*?>(.*?)<\/td>/g;
    let transcript = [];

    while ((courseHTML = courseRegexp.exec(html)) != null) {
        let matchArr = [];
        courseHTML = courseHTML[1];
        while ((columnHTML = columnRegexp.exec(courseHTML)) != null) {
            matchArr.push(columnHTML[1]);
        }
        if(matchArr.length === 11) {
            let course = {};
            course['semester'] = matchArr[1];
            course['name'] = matchArr[3];
            course['score'] = /<a.*>(.*)<\/a>/.exec(matchArr[4])[1];
            course['credit'] = matchArr[5];
            course['type'] = matchArr[8];
            transcript.unshift(course);
        }
    }
    return transcript;
}

module.exports = JwwebUser;