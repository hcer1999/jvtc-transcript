const request = require('request');

module.exports = function (url, options) {
    return new Promise(function (resolve, reject) {
        let response;
        let data = Buffer.alloc(0);

        request(url, options, function (err) {
            if (err) return reject(err);
        }).on('response', function (res) {
            response = res;
        }).on('data', function (chunk) {
            data = Buffer.concat([data, chunk]);
        }).on('end', function () {
            return resolve({res: response, body: data});
        });
    });
}