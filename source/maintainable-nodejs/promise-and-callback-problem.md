```
title: 如何让异步接口同时支持 callback 和 promise
date: 2016-08-03
author: 老雷
```

## 避免 unhandledRejection 事件

随着 ES6 的普及，越来越多的异步接口都开始同时支持`callback`和`promise`两种方式，我在最近的两篇文章[《如何用 Node.js 编写一个 API 客户端》](http://morning.work/page/2016-05/how-to-write-a-nodejs-api-client-package.html)和[《如何编写一个简单的 Redis 客户端》](http://morning.work/page/2016-05/how-to-write-a-nodejs-redis-client.html)中也使用**一个简单的小技巧**来实现这样的功能：

```javascript
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

    // 以下部分不变
    // ...
  });
}
```

上文的代码使得`request()`函数可以返回一个`Promise`对象，同时如果传入了一个`callback`参数它也能工作良好，这似乎已经能满足了前文的目标。

但这样的做法带来的一个问题是，**如果我们使用`callback`方式，当`request()`函数在执行时回调了一个错误对象（即执行了`callback(err)`和`reject(err)`），此时会触发一个`unhandledRejection`事件**。大多数情况下这样也并不会影响到我们程序的功能，它还是能够正常的工作，但是这些本该可以避免的`unhandledRejection`事件会对我们调试程序时造成很大的干扰。

究其原因，正确的**实现同时支持 callback 和 promise**必须做到，当使用者传入`callback`参数时不应该返回一个 Promise 对象。如果返回了一个 Promise 对象，而使用者并不会调用`.catch()`去捕捉可能发生的错误，这样就会导致触发`unhandledRejection`事件。

所以，针对上文的例子我们可以改成这样：

```javascript
request(method, path, params, callback) {
  if (callback) {
    doRequest(method, path, params, callback);
  } else {
    return new Promise((resolve, reject) => {
      doRequest(method, path, params, (err, ret) => {
        err ? reject(err) : resolve(ret);
      });
    });
  }

  function doRequest(method, path, params, callback) {
    // 以下部分不变
    // ...
  }
}
```

或者我们可以写成这样：

```javascript
request(method, path, params, callback) {
  if (!callback) {
    return new Promise((resolve, reject) => {
      // 重新调用当前函数
      request(method, path, params, (err, ret) => {
        err ? reject(err) : resolve(ret);
      });
    });
  }

  // 以下部分不变
  // ...
}
```

## 重复执行 callback 的坑

也许以上的写法并没有那么直观，我们更希望有这么一个`promiseToCallback`函数（代码来自[《callback 和 promise 的错误捕获
》](http://www.plusman.cn/2016/05/09/b7-error-catch/)]，有删改）：

```javascript
function promiseToCallback(fn) {
  return function () {
    const args = Array.prototype.slice.apply(arguments);
    const callback = args.pop();
    fn.apply(null, args)
      .then(function (result) {
        callback(null, result);
      })
      .catch(function (err) {
        console.error(err);
        callback(err);
      });
  };
}
```

正如该文章所说的那样，上文这个代码在`callback`执行出错时，会被`.catch()`捕捉到，从而又重复执行了一次`callback`，这样往往会将我们带入一个更大的坑里面。

我们可以通过以下代码来测试这个`promiseToCallback()`所存在的问题：

```javascript
'use strict';

process.on('unhandledRejection', err => {
  console.log('unhandledRejection', err);
});

function hello(msg) {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      resolve(`hello, ${ msg }`);
    });
  });
}

promiseToCallback(hello)('test', (err, ret) => {
  console.log(err, ret);
  throw new Error('haha');
});
```

执行程序后输出结果如下：

```
null 'hello, test'
[Error: haha]
[Error: haha] undefined
unhandledRejection [Error: haha]
```

其中第一行的输出是正常回调时的输出，但是在回调里面有抛出了一个`haha`错误，被`promiseToCallback`的`.catch()`捕捉到，然后它先把这个`err`对象打印出来，再重复执行了一遍回调函数，在回调函数中又输出了一遍。同时，在这次的回调函数中，有抛出了一个`haha`错误，此时`promiseToCallback`中的`.catch()`已经不能再捕捉到这个错误了，然后被注册的`unhandledRejection`事件监听器监听到，并将其打印了出来。

在此先不讨论这个`promiseToCallback()`是否满足了**同时支持 callback 和 promise 这个前提**，就重复执行`callback`的问题我们是万万不能使用它的。

当然我们也可以有办法使得它不会重复执行回调函数：

```javascript
function promiseToCallback(fn) {
  return function () {
    const args = Array.prototype.slice.apply(arguments);
    const callback = args.pop();

    // 包装callback，在此函数中保证callback只会调用一次
    // 再次调用会直接忽略
    const cb = (err, ret) => {
      if (cb.isCalled) return;
      cb.isCalled = true;
      callback(err, ret);
    };

    fn.apply(null, args)
      .then(function (result) {
        cb(null, result);
      })
      .catch(function (err) {
        console.error(err);
        cb(err);
      });
  };
}
```

我们通过一个`isCalled`属性来保证了回调函数只会被执行一次，它确实保证了`callback`不被重复执行，但同时它也悄悄地将`callback`发生的错误藏了起来，说不定这又成了将来某一天困扰你多时的坑。


## 也许这是最佳的解决方案

说了这么一大堆，要使得很好地同时支持 callback 和 promise，关键是要处理好这两个问题：

+ 避免`unhandledRejection`事件（一定要使用`promise.catch()`捕捉错误）
+ 避免多次执行`callback`

而我觉得处理好这两个问题其实只需要记住这一个原则：**「原始函数使用 callback 实现，仅在必要时才返回 promise」**。下面是根据这一原则实现的`promiseOrCallback`函数：

```javascript
function promiseOrCallback(fn, argc) {
  return function () {
    const args = Array.prototype.slice.apply(arguments);
    // 判断调用函数时实际传过来的参数数量
    if (args.length > argc) {
      // 这是callback方式调用的
      return fn.apply(null, args);
    }
    // 这是promise方式调用的
    return new Promise((resolve, reject) => {
      // 创建一个callback函数用来对接promise的resolve和reject
      args.push((err, ret) => {
        err ? reject(err) : resolve(ret);
      });
      fn.apply(null, args);
    });
  };
}
```

说明：在包装函数时，**需要明确知道这个函数会接收多少个参数**，假设`argc = 1`，那么当调用包装后的函数时传入了`2`个参数，则会认为它是以`callback`方式调用的，否则会返回一个`promise`。

我们可以使用以下程序来测试：

```javascript
'use strict';

process.on('unhandledRejection', err => {
  console.log('unhandledRejection', err);
});

function hello(msg, callback) {
  setImmediate(() => {
    callback(null, `hello, ${ msg }`);
  });
}

promiseOrCallback(hello, 1)('test', (err, ret) => {
  console.log(err, ret);
  throw new Error('haha');
});
```

其执行结果应该是这样的：

```
null 'hello, test'
/tmp/test.js:45
  throw new Error('haha');
  ^

Error: haha
    at /tmp/test.js:45:9
    at Immediate._onImmediate (/tmp/test.js:39:5)
    at processImmediate [as _immediateCallback] (timers.js:383:17)
```

说明：在回调函数中，先执行`console.log(err, ret)`输出了结果，然后`throw new Error('haha')`再抛出一个错误，这时因为外层没有捕捉到，使得进程因为异常而退出了，这正是我们所期望的。

如果我们改用`promise`的方式去调用：

```javascript
promiseOrCallback(hello, 1)('test').then(ret => {
  console.log(null, ret);
  throw new Error('haha');
}).catch(err => {
  console.log(err);
});
```

则其执行结果是这样的：

```
null 'hello, test'
[Error: haha]
```

说明：在`.then()`的回调函数内，我们先输出结果，在`throw`出一个错误时，并`.catch()`捕捉到并打印了出来，这符合`promise`的行为。

**如果你要问「原始函数是基于 promise 实现的，想支持 callback 怎么办」，我建议你最好放弃这个想法。**


## 接口设计的哲学

在本文发出去之后，得到了大神[@Hax](http://weibo.com/haxy)的点评：

> 有些代码直接调，不传`cb`因为它想触发副作用，结果你改成了`p`，然后还是掉坑了……

结合上下文我们可以理解为，在上文我们通过判断是否传入了一个`callback`参数来判断异步方式，在合适的时候再返回`promise`。但是，假如我们仅仅是想触发一个副作用（执行异步函数，但并不关心它的回调结果），由于没有传入`callback`参数，此时会被自动识别为`promise`方式调用，于是它返回了一个`promise`对象。而当函数执行时回调了一个`err`对象时，我们又重新掉进了前文所说的`unhandledRejection`的坑里面。

通过判断参数数量这样的方式来实现不同异步方式的转换并**不严谨**。所以，针对**不同的异步方式应该使用不同的接口**，比如我们可以规定所有异步方法默认都是`callback`方式（如`request`），而`promise`方式都有`P`后缀（如`requestP`）。

[@Hax](http://weibo.com/haxy)继续评论道：

> 是的，这是为啥 Node.js 的人最后决定把`promise`化的 API 单独分开
>
> 我个人觉得`xxxP`名字也不是很友好。其实用不同的包就好了。
>
> ```javascript
> import xxx from 'api/callback'
> import xxx from 'api/promise'
> ```

所以，封装成单独的包才是更优雅的方式。最后还有一句话，**切勿混用`callback`和`promise`**。


## 总结

大多数时候，我们只需要一点点小技巧就能使得程序看起来正常地工作起来。然而要写出**完美**的程序却并不是一件简单的事情。


## 相关链接

+ [callback 和 promise 的错误捕获](http://www.plusman.cn/2016/05/09/b7-error-catch/)
+ [Promise 陷阱](http://www.jianshu.com/p/9e4026614fbe)
+ [JavaScript Promise迷你书（中文版）](http://liubin.org/promises-book)