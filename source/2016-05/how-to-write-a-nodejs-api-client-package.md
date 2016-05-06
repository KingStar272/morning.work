```
title: 如果编写一个 Node.js API 客户端
date: 2016-05-06
author: 老雷
draft: true
```


尽管这几年来 Node.js 已经得到越来越多的关注，连市场卖菜的老太婆都能分别得出哪个是写 Node.js
的，那个是写 PHP 的。然而，终究是不能跟老大哥 Java 比的。我们在使用一些第三方服务时常常会
碰到一时半会还没有官方的 Node.js SDK 的问题，所以能自己随手撸一个刚好够用的 API 客户端来应急
成了必备技能。

说到这里，我忍不住要先吐槽一下：

> 前几天在 CNodeJS 上看到一个帖子，[拥抱ES6——阿里云OSS推出JavaScript SDK](https://cnodejs.org/topic/56ab1c0526d02fc6626bb383)
> 对其中的滥用 `generator` 还**洋洋自得**的行为有点不满，之前也遇到过该厂的 SDK 强行返回
> `generator` 而放弃使用，我想说我 **已经忍了很久** 了。
>
> **「我自己写得爽，也希望把这种“爽”带给用户」** -- *该 SDK 的维护者如是说*
>
> **作为一个 SDK（尤其是官方出品的），应该使用最 common 的技术或规范来实现**。比如在
> Node.js 中的异步问题，应该使用传统的 `callback` 或者 ES6 里面的 `promise`，而不是使用
> 比较奇葩的 `generator` 来做。`generator` 来做不妥的地方是：
>
> 1、`generator` 的出现不是为了解决异步问题
>
> 2、使用 `generator` 是会传染的，当你尝试 `yield` 一下的时候，它要求你也必须在一个
> `generator function` 内
>
> 当然，如果这是一个内部项目，使用各种花式都是没问题的，只要定好规范就行。而如果这是要给别人使用
> 的东西，应该照顾其他人的感受。
>
> 好了，我吐槽完了。


## 运行环境

最近一年来，Node.js 相继发布了 4.0、5.0、6.0（前几天），7.0 也已经蓄势待发，但目前来看主流
还是 4.x 版本。Node.js 4.x 支持一部分的 ES6 语法，比如箭头函数、`let` 和 `const`等，解决
异步问题也可以直接使用 ES6 的 `promise`。

如果没有特殊情况，新写的程序可以不用考虑在 0.12 或者更早的 0.10 上运行，如果以后确实需要在这些
版本上执行，可以借用 Babel 来编译成 ES5 语法的程序。

API 接口将同时支持 `callback` 和 `promise` 两种回调方式。`promise` 直接使用 ES6 原生的
`Promise` 对象而不是使用 `bluebird` 模块。尽管使用 `bluebird` 会有更多的功能和更好的性能，
但在这样一个需要网络 IO 的场景下，那么一点性能差别基本可以忽略不计，而作为一个极简主义者，觉得
没太大必要引入这么一个依赖库。


## 功能设计

本文将以 [CNodeJS 提供的 API](https://cnodejs.org/api) 为例。CNodeJS 的API分两种：

+ 公共接口，比如获取主题列表和详情等
+ 用户接口，需要提供 `accesstoken` 参数来验证用户权限（`accessToken` 可以在个人设置界面中
  得到）

程序的使用方法如下：

```javascript
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
