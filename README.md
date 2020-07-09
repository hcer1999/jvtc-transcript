2018年9月学校使用了新的教务系统，旧的教务系统已于2018年10月停止使用，原先的成绩查询系统代码归档在[kingo](https://github.com/Chocolatl/jvtc-transcript/tree/kingo)标签中

## 更新日志
- 2020/07/09
    - 修复成绩获取失败的BUG
    - 部分提示改为中文
    - 更换部署地址

## 部署

请确保已安装最新版本的Node.js

```
# 全局安装pm2
$ npm install pm2 -g

# 安装依赖项
$ npm install

# 设置环境变量
# 可以通过设置'PORT'环境变量修改监听端口，默认监听3050端口
$ export NODE_ENV=production

# 使用pm2运行程序
$ pm2 start npm -n jvtctr -- start
```

## 日志

- access.log：HTTP访问日志

- action.log：用户行为记录

## 网站

<http://cj.wcnm.kim/>

