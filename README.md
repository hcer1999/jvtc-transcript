九江职业技术学院第三方成绩查询系统，程序通过模拟登录教务系统的方式从教务系统获取成绩，简化了使用教务系统查询成绩的中间步骤，并提供了移动端友好的界面，方便学生在手机端查询成绩

程序实现了自动识别教务系统验证码的功能，现在只需要输入学号和教务系统密码即可查询成绩

## 部署

请确保已安装最新版本的Node.js

安装依赖项：

```
$ npm install
```

设置生产环境：

```
# Windows PowerShell
$ $env:NODE_ENV = "production"

# Linux
$ export NODE_ENV=production
```

运行程序：

```
# 可以通过设置'PORT'环境变量修改监听端口，默认监听3050端口
$ npm start
```

---

使用[pm2](https://github.com/Unitech/pm2)后台持久运行程序：

```
# 全局安装pm2
$ npm install pm2 -g

# 设置环境变量
$ export NODE_ENV=production

# 使用pm2运行程序
$ pm2 start npm -- start
```


## 日志

- access.log：HTTP访问日志

- public/action.log：记录用户行为


## 部署到其他学校

本校的教务系统使用的是青果教务系统（就是那个辣鸡湖南青果软件有限公司做的），理论上使用该教务系统的学校都可以稍微修改源码后部署使用


## 网站

<https://cj.choclatl.com/>