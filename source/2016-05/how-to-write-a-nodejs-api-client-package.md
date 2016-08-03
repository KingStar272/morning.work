```
title: 如何用 Node.js 编写一个 API 客户端
date: 2016-05-07
author: 老雷
```

## 说几句无关主题的话

尽管这几年来 Node.js 已经得到越来越多的关注，连市场卖菜的老太婆都能分别得出哪个是写 Node.js的，哪个是写 PHP 的。然而，终究是不能跟老大哥 Java 比的。我们在使用一些第三方服务时常常会碰到一时半会还没有官方的 Node.js SDK 的问题，所以能自己随手撸一个刚好够用的 API 客户端来应急成了必备技能。

说到这里，我忍不住要先吐槽一下：

> 前几天在 CNodeJS 上看到一个帖子[《拥抱ES6——阿里云OSS推出JavaScript SDK》](https://cnodejs.org/topic/56ab1c0526d02fc6626bb383)，对其中的滥用`generator`还**洋洋自得**的行为有点不满，之前也遇到过该厂的 SDK 强行返回`generator`而放弃使用，我想说我**已经忍了很久**了。
>
>**「我自己写得爽，也希望把这种“爽”带给用户」**-- *该 SDK 的维护者如是说*
>
>**作为一个 SDK（尤其是官方出品的），应该使用最 common 的技术或规范来实现**。比如在 Node.js 中的异步问题，应该使用传统的`callback`或者 ES6 里面的`promise`，而不是使用比较奇葩的`generator`来做。`generator`来做不妥的地方是：
>
> + `generator`的出现不是为了解决异步问题
> + 使用`generator`是会传染的，当你尝试`yield`一下的时候，它要求你也必须在一个`generator function`内
>
> 当然，如果这是一个内部项目，使用各种花式姿势都是没问题的，只要定好规范就行。而如果这是要给别人使用的东西，应该照顾其他人的感受。
>
> 所以我们要自己动手写一个 SDK 还有另外一种情况就是**对官方的 SDK 并不满意**。
>
> 好了，我吐槽完了。


## 运行环境

最近一年来，Node.js 相继发布了 4.0、5.0、6.0（前几天），7.0 也已经蓄势待发，但目前来看**主流还是 4.x 版本**。Node.js 4.x 支持一部分的 ES6 语法，比如箭头函数、`let`和`const`等，解决异步问题也可以直接使用 ES6 的`promise`。

如果没有特殊情况，新写的程序可以不用考虑在 0.12 或者更早的 0.10 上运行，如果以后确实需要在些版本上执行，可以借用 Babel 来编译成 ES5 语法的程序。

API 接口将同时支持`callback`和`promise`两种回调方式。`promise`直接使用 ES6 原生的`Promise`对象而不是使用`bluebird`模块。尽管使用`bluebird`会有更多的功能和更好的性能，但在这样一个需要网络 IO 的场景下，那么一点性能差别基本可以忽略不计，而作为一个极简主义者，觉得没太大必要引入这么一个依赖库。


## 功能设计

本文将以 [CNodeJS 提供的 API](https://cnodejs.org/api) 为例。CNodeJS 的API分两种：

+ 公共接口，比如获取主题列表和详情等
+ 用户接口，需要提供`accesstoken`参数来验证用户权限（`accessToken`可以在个人设置界面中得到）

程序的使用方法如下：

```javascript
'use strict';

const client = new CNodeJS({
  token: 'xxxxxxx', // accessToken，可为空
});

// promise 方式调用
client.getTopics({page: 1})
  .then(list => console.log(list))
  .catch(err => console.error(err));

// callback 方式调用
client.getTopics({page: 1}, (err, list) => {
  if (err) {
    console.error(err);
  } else {
    console.log(list);
  }
});
```


## 初始化项目

1、首先新建项目目录：

```bash
$ mkdir cnodejs_api_client
$ cd cnodejs_api_client
$ git init
```

2、初始化`package.json`：

```bash
$ npm init
```

3、新建文件`index.js`：

```javascript
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
    return new Promise((resolve, reject) => {

      const opts = {
        method: method.toUpperCase(),
        url: this.options.url + path,
        json: true,
      };

      if (opts.method === 'GET' || opts.method === 'HEAD') {
        opts.qs = this.baseParams(params);
      } else {
        opts.body = this.baseParams(params);
      }

      rawRequest(opts, (err, res, body) => {

        if (err) return reject(err);

        if (body.success) {
          resolve(body);
        } else {
          reject(new Error(body.error_msg));
        }

      });

    });
  }

}

module.exports = CNodeJS;
```

说明：

+ 使用`request`模块来发送 HTTP 请求，需要执行命令来安装该模块：`npm install request --save`
+ 我们实现了一个带有`request`方法的`CNodeJS`类，可以通过该方法来发送任意 API 请求，比如请求主题首页是`request('GET', 'topics', {page: 1})`
+ 如果初始化`CNodeJS`实例时传入了`token`，则每次请求都会自动带上`accesstoken`参数
+ 返回的结果`success=true`表示 API 请求成功，则直接回调该结果；如果失败则`error_msg`表示出错信息

4、新建测试文件`test.js`：

```javascript
'use strict';

const CNodeJS = require('./');
const client = new CNodeJS();

client.request('GET', 'topics', {page: 1})
  .then(ret => console.log(ret))
  .catch(err => console.error(err));
```

5、执行命令`node test.js`即可看到类似以下的结果：

```javascript
{ success: true,
  data:
   [ { id: '572afb6b15c24e592c16e1e6',
       author_id: '504c28a2e2b845157708cb61',
       tab: 'share',
       content: '.......'
...
```

至此我们已经完成了一个 API 客户端最基本的功能，接下来根据不同的 API 封装一下`request`方法即可。

## 支持 callback

前文已经提到，**「作为一个 SDK，应该使用最 common 的技术或规范来实现」**，所以除了`promise`之外还需要提供`callback`的支持。

1、修改文件`index.js`中`request(method, path, params) { }`定义部分：

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

说明：

+ 将`new Promise()`中的`resolve`和`reject`分别改名为`_resolve`和`_reject`
+ 在函数开头新建`resolve`和`reject`，其作用是调用原来的`_resolve`和`_reject`，同时判断如果有`callback`参数，则也调用该函数

2、将文件`test.js`中`client.request()`部分改为 callback 方式调用：

```javascript
client.request('GET', 'topics', {page: 1}, (err, ret) => {
  if (err) {
    console.error(err);
  } else {
    console.log(ret);
  }
});
```

3、重新执行`node test.js`可以看到结果跟之前是一样的。

通过简单的修改我们就已经实现了同时支持`promise`和`callback`两种异步回调方式。


## 封装 API

前文我们实现的`request()`方法已经可以调用任意的 API 了，但是为了是方便，一般需要为每个 API单独封装一个方法，比如：

+ `getTopics()`- 获取主题首页
+ `getTopicDetail()`- 获取主题详情
+ `testToken()`- 测试`token`是否正确

对于`getTopics()`可以这样简单地实现：

```javascript
getTopics(params, callback) {
  return this.request('GET', 'topics', params, callback);
}
```

但其返回的结果是这样结构的：

```javascript
{ success: true,
  data: []
}
```

要取得结果还要读取里面的`data`，针对这种情况我们可以改成这样：

```javascript
getTopics(params, callback) {
  return this.request('GET', 'topics', params, callback)
             .then(ret => Promise.resolve(ret.data));
}
```

`getTopicDetail()`和`testToken()`可以这样实现：

```javascript
getTopicDetail(params, callback) {
  return this.request('GET',`topic/${params.id}`, params, callback)
             .then(ret => Promise.resolve(ret.data));
}

testToken(callback) {
  return this.request('POST',`accesstoken`, {}, callback);
}
```

对于其他的 API 也可以采用类似的方法一一实现。


## 总结

由此看来编写一个简单的 API 客户端也不是一件很难的事情，本文介绍的方法已经能适用大多数的情况了。当然还有些问题是没提到的，比如阿里云 OSS 这种 SDK 还要考虑 stream 上传问题，还有断点续传。对于安全性要求较高的 SDK 可能还需要做数据签名等等。

在编写本文的时候，通过阅读`request`的 API 文档我才发现原来可以通过`json=true`选项来让它自动解析返回的结果，这样确实能少写好几行代码了。

另外我还是忍不住再吐槽一下，CNodeJS 的 API 接口设计得并不一致，响应成功时并不是所有数据都放在`data`里面（比如`testToken()`）。

发觉最近有点上火了 ^_^
