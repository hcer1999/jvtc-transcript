# 九江职业技术学院成绩查询系统

由于超级课程表常年没法刷出验证码以及学校网站没有手机页面的原因，写了一个简单的成绩查询系统。

程序通过模拟登录教务系统网站获取学生成绩信息。

## 部署

### 安装依赖项

> npm install

### 设置生产环境

Windows PowerShell:
> $env:NODE_ENV = "production"

Linux:
> export NODE_ENV=production

### 运行程序

> npm start

程序默认监听`3050`端口，现在可以访问 <http://localhost:3050/> 使用查询系统。

通过设置`PORT`环境变量可以修改监听端口号。

### 持久运行

请使用[forever](https://github.com/foreverjs/forever)、[pm2](https://github.com/Unitech/pm2)等持续运行工具部署程序

## 日志

access.log：HTTP访问日志

user.log：记录查询者的姓名、学号及查询时间等


## 自动填写验证码（2018/1/17新增

现在登录页在较新的浏览器上会自动识别并填写验证码

相关代码在`recognizer`分支中：https://github.com/Chocolatl/jvtc-transcript/tree/recognizer

当修改验证码识别相关功能时，应该在`recognizer`分支修改代码，再复制到`master`分支中

## 网站

<https://cj.choclatl.com/>