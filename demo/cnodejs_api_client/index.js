'use strict';

const rawRequest = require('request');

class CNodeJS {

  constructor(options) {

    this.options = options = options || {};
    options.token = options.token || null;
    options.url = options.url || 'https://cnodejs.org/api/v1/';

  }

  baseParams(params) {

    params = Object.assign({}, params || {});
    if (this.options.token) {
      params.accesstoken = this.options.token;
    }

    return params;

  }

  request(method, path, params, callback) {
    return new Promise((_resolve, _reject) => {

      const resolve = ret => {
        _resolve(ret);
        callback && callback(null, ret);
      };

      const reject = err => {
        _reject(err);
        callback && callback(err);
      };

      const opts = {
        method: method.toUpperCase(),
        url: this.options.url + path,
      };

      if (opts.method === 'GET' || opts.method === 'HEAD') {
        opts.qs = this.baseParams(params);
      } else {
        opts.formData = this.baseParams(params);
      }

      rawRequest(opts, (err, res, body) => {

        if (err) return reject(err);
        if (res.statusCode !== 200) return reject(new Error(`status ${res.statusCode}`));

        let json;
        try {
          json = JSON.parse(body.toString());
        } catch (err) {
          return reject(new Error(`parse JSON data error: ${err.message}`));
        }

        resolve(json);

      });

    });
  }

}

module.exports = CNodeJS;
