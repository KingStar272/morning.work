'use strict';

// 生成器函数，可以生成指定数量的数字
function* genNumbers(n) {
  for (let i = 1; i <= n; i++) {
    yield i;
  }
  return 'ok';
}

// 执行生成器函数
const gen = genNumbers(10);

function next() {
  // 执行next()方法取下一个数字
  const ret = gen.next();
  // 打印结果
  console.log(ret);
  if (ret.done) {
    // 如果done=true则表示生成器执行结束
    console.log('done');
  } else {
    // 500ms后继续执行
    setTimeout(next, 500);
  }
}

next();
