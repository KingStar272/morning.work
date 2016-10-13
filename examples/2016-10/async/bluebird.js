'use strict';

const Promise = require('bluebird');

const test = Promise.coroutine(function* (n, ms) {
  for (let i = 0; i < n; i++) {
    console.log('i=%s', i);
    yield Promise.delay(ms);
  }
  return n;
});

test(10, 500)
  .then(n => console.log('执行结束，n=%s', n))
  .catch(err => console.error('执行出错：', err));
