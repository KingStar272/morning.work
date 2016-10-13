// sleep函数，返回一个Promise对象
function sleep(ms) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve(ms), ms);
  });
}

// 通过coroutine来包装异步函数
const test = coroutine(function* () {
  // 循环100次
  for (let i = 0; i < 100; i++) {
    // 等待100ms再返回
    const ms = yield sleep(100);
    console.log('i=%s, ms=%s', i, ms);
  }
  // 返回执行sleep次数
  return 100;
});

 // 执行函数，其返回一个Promise对象
test()
  .then(i => console.log('执行了%s次sleep', i))
  .catch(err => console.error('出错', err));













function isPromise(p) {
  return typeof p.then === 'function' && typeof p.catch === 'function';
}

function coroutine(genFn) {
  return function () {
    return new Promise((resolve, reject) => {
      const gen = genFn.apply(null, arguments);
      let ret;
      function next(value) {
        ret = gen.next(value);
        // 如果done=true则表示结束
        if (ret.done) {
          return resolve(ret.value);
        }
        // 如果不是promise则报错
        if (!isPromise(ret.value)) {
          return reject(new TypeError('You may only yield a promise, but the following object was passed: ' + String(ret.value)));
        }
        // 等待promise执行结果
        ret.value.then(next).catch(reject);
      }
      // 开始执行
      next();
    });
  };
}
