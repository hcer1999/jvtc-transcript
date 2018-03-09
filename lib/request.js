const request = require('request');

module.exports = function (url, userOptions) {
    return new Promise(function (resolve, reject) {
        let options = Object.assign({timeout: 24000, url}, userOptions);
        let response;
        let data = Buffer.alloc(0);

        request(options, function (err) {
            if (err) return reject(err);
        }).on('response', function (res) {
            response = res;
        }).on('data', function (chunk) {
            data = Buffer.concat([data, chunk]);
        }).on('end', function () {
            return resolve({response, body: data});
        });
    });
}