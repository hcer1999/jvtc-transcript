const http = require('http');
const fs = require('fs');
const net = require('net');
const url = require('url');
const path = require('path');

const server = http.createServer((req, res) => {
    if(req.url.includes('/captcha.jpg')) {
        http.get('http://218.65.5.214:2001/jwweb/sys/ValidateCode.aspx', function(coming) {
            coming.pipe(res);
        });
    } else if(req.url === '/' || req.url.includes('/index.html')) {
        res.end(fs.readFileSync('index.html'));
    } else {
        try {
            res.end(fs.readFileSync(path.join('.', req.url)));
        } catch(e) {
            res.end();
        }
    }
});

server.listen(3000);