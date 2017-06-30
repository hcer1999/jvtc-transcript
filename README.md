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

### Linux下后台运行
1. SSH登录远程主机
2. 在程序目录下执行 `nohup npm start > node.out 2>&1 &`
3. 退出SSH

## ~~演示~~地址

<http://139.199.67.186:3050/>