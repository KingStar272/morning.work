'use strict';

const fs = require('fs');
const co = require('co');

const readFile = function (fileName) {
  return new Promise(function (resolve, reject) {
    fs.readFile(fileName, function (err, data) {
      if (err) reject(err);
      resolve(data);
    });
  });
};

const gen = function* () {
  const f1 = yield readFile('package.json');
  const f2 = yield readFile('.babelrc');
  return [ f1.toString(), f2.toString() ];
};

co(gen).then(ret => {
  console.log('Generator函数执行完成', ret);
}).catch(err => {
  console.error('Generator函数执行出错', err);
});
