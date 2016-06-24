```
title: ES2015 & babel 实战：开发NPM模块
date: 2015-11-20 to 2015-11-30
update: 2016-06-24
author: 老雷
```


## 前言

近一年来，JavaScript界关于ES6（ECMAScript 6，本文简称ES6）的讨论越来激烈，作为未来要统一全宇宙的语言（**PHP是世界上最好的语言，但JavaScript终将统一全宇宙**），JavaScript的运行环境众多，对ECMAScript标准的支持程度不一，所以对于ES6我一直处于观望状态。

前不久ES6标准正式发布，而Node.js也在最近刚刚发布了5.1.0版本，对ES6标准的支持也越来越完善，babel（一个将ES6/ES7写的代码转换为ES5代码的编译器）也发布了6.0版本，近期也涌现出了不少好文章（比如[小问](http://lifemap.in/)写的[「给 JavaScript 初心者的 ES2015 实战」](http://gank.io/post/564151c1f1df1210001c9161)），种种迹象表明ES6真的要火了，而我也终于按耐不住了……

这几天正在写一个[方便下载文件的模块](https://github.com/leizongmin/node-lei-download)（可以得到下载进度信息），正好可以使用ES6新语法特性来改写，作为我写下的第一个使用ES6语法的NPM模块。本文内容将分为以下几部分：

+ 配置babel编译环境
+ 编写模块
+ 单元测试
+ 发布模块

本文的重点是介绍借助babel开发Node.js项目的基本方法，同时会简略介绍文中出现的ES2015新语法，具体介绍可阅读[阮一峰](http://www.ruanyifeng.com)所著的[「ECMAScript 6 入门」](http://es6.ruanyifeng.com/)或babel官方文档中的[「Learn ES2015」](http://babeljs.io/docs/learn-es2015/)。

babel官方提供了一个[在线REPL](http://babeljs.io/repl)，可以实时输出转换后的JavaScript代码，并且看到其运行结果，对于初学者尤为有用。访问网址http://babeljs.io/repl ，其界面如下：

![babel online repl](../../images/2015-11/babel_online_repl.jpg)

说明：使用时勾选左边的`Experimental`可使用最新的语法特性。


## 软件环境

由于相关软件和模块正处于高速发展期，无法保证你阅读这篇文章的时候还能照着一步一步**准确无误**地运行下去，以下列出在编写本文时所用到的软件和模块的版本：

+ **Node.js** `v5.1.0`
+ **npm** `3.3.12`
+ **babel** `6.2.0 (babel-core 6.2.1)`
+ **mocha** `2.3.4`

## 配置babel编译环境

### 1、安装babel

> Babel is a JavaScript compiler. Use next generation JavaScript, today

目前最新版的Node.js（v5.1.0）还未完全支持ES2015的新语法特性，而且我们编写的模块可能要在Node v0.12.x或更低版本下运行，因此需要借助babel将ES2015标准的JavaScript程序转换成ES5标准的。

执行以下命令安装babel：

```bash
$ npm i -g babel-cli
```

由于babel依赖的模块比较多，可能会花费比较长的时间甚至安装不成功，可以尝试使用cnpmjs的NPM镜像，比如（简单在安装命令末尾添加`--registry=http://registry.npm.taobao.org`）：

```bash
$ npm i -g babel-cli --registry=http://registry.npm.taobao.org
```

[cnpmjs](http://cnpmjs.org/)镜像的详细介绍可访问其官网：http://cnpmjs.org/

安装完成后，系统将获得以下两个命令：

+ `babel` 编译器
+ `babel-node` 可以直接运行ES2015程序的Node命令

`babel-cli`的详细用法可以参考其文档：https://babeljs.io/docs/usage/cli/

### 2、初始化项目

执行以下命令初始化项目（执行`npm init`时需要按提示输入相应信息，可直接按回车跳过）：

```bash
$ mkdir es2015_demo && cd es2015_demo && git init && npm init
```

现在我们新建一个文件`test.js`试试是否能正常运行：

```javascript
function sleep(ms = 0) {
  return new Promise((resolve, reject) => setTimeout(resolve, ms));
}

async function test() {
  for (let i = 0; i < 10; i++) {
    await sleep(500);
    console.log(`i=${i}`);
  }
}

test().then(() => console.log('done'));
```

执行以下命令运行`test.js`：

```bash
$ babel-node test.js
```

在我本机的环境下显示以下错误信息：

```
/usr/local/lib/node_modules/babel-cli/node_modules/babel-core/lib/transformation/file/index.js:540
      throw err;
      ^

SyntaxError: /private/tmp/es2015_demo/test.js: Unexpected token (5:6)
  3 | }
  4 |
> 5 | async function test() {
    |       ^
  6 |   for (let i = 0; i < 10; i++) {
  7 |     await sleep(500);
  8 |     console.log(`i=${i}`);

...
```

由提示信息可判断出，应该是不支持`async function`导致的，因为这是ES7标准中定义的新语法，需要配置相应的babel插件才能支持它。本文为了方面使用最新的JavaScript语法，暂时不考虑babel的编译性能，直接开启所有可能用到的插件，具体可以自行研究babel的官方文档。

新建文件`.babelrc`：

```json
{
  "presets": ["es2015", "stage-0"]
}
```

`.babelrc`为babel的配置文件，保存在项目的根目录下，其中`presets`用于设置开启的语法特性集合，详细介绍可参考官方文档：https://babeljs.io/docs/usage/babelrc/ 和 http://babeljs.io/docs/plugins/#presets

接下来我们还需要安装插件依赖的模块，执行以下命令安装并保存到`package.json`的`devDependencies`中：

```bash
$ npm i babel-preset-es2015 babel-preset-stage-0 --save-dev
```

现在再重新执行`test.js`，可看到控制台每隔500ms打印出一行，直到输出`done`时结束：

```bash
$ babel-node test.js

i=0
i=1
i=2
i=3
i=4
i=5
i=6
i=7
i=8
i=9
done
```

### 3、编译程序

在发布项目时，要求可以在不依赖babel编译器的环境下运行，因此我们需要将ES2015的程序编译成ES5的：

```bash
$ babel test.js --out-file test.compiled.js
```

执行上面的命令后，生成了编译后的文件`test.compiled.js`，我们尝试执行它看看：

```bash
$ node test.compiled.js
```

在我的系统环境下提示以下出错信息：

```
/private/tmp/es2015_demo/test.compiled.js:4
  var ref = _asyncToGenerator(regeneratorRuntime.mark(function _callee() {
                              ^

ReferenceError: regeneratorRuntime is not defined
    at /private/tmp/es2015_demo/test.compiled.js:4:31

...
```

经阅读官方文档可知，编译后的JavaScript程序有时候需要依赖一些运行时`polyfill`，通过安装`babel-polyfill`模块来获得：

```bash
$ npm i babel-polyfill --save
```

然后，我们需要修改编译后的文件`test.compiled.js`，在其首行加上以下代码来载入`babel-polyfill`：

```javascript
require('babel-polyfill');
```

再次执行`test.compiled.js`便可看到与`$ babel-node test.js`一样的结果。

`polyfill`的详细介绍可参考官方文档：http://babeljs.io/docs/usage/polyfill/

至此，我们已经配置了一个能使用ES2015语法的Node.js运行环境了。

### 4、重要提示

在一个Node.js进程中只能载入一个版本的`babel-polyfill`，不同的模块所`require('babel-polyfill')`很可能不是同一个版本，此时进程会抛出一个异常并退出，所以一般建议在打包的NPM模块中不要有`require('babel-polyfill')`，而是要求在使用该模块的最终项目自行编写`require('babel-polyfill')`，这样可以保证一个进程中只会有一个`babel-polyfill`版本。


## 编写模块

### 1、功能描述

本文以[lei-download](https://github.com/leizongmin/node-lei-download)模块为例，该模块是一个主要功能是根据一个URL来下载文件到本地，或者本地直接文件的复制，同时提供下载/复制进度信息。其使用方法如下：

```javascript
let download = require('lei-download');

let source = '一个URL或者本地文件名';
let target = '要存储到的本地位置，null|false|undefined表示自动生成一个临时文件';
// 用于获取进度通知的函数，可以省略
let progress = (size, total) => console.log(`进度：${size}/${total}`);

download(source, target, progress)
  .then(filename => console.log(`已保存到：${filename}`))
  .catch(err => console.log(`出错：${err}`));

// 也可以使用callback模式
download(source, target, progress, (err, filename) => {
  if (err) console.log(`出错：${err}`);
  else console.log(`已保存到：${filename}`);
});
```

在编写模块时，我们首先要实现以下两个函数的功能：

+ `downloadFile(source, target, progress)` 从一个URL下载文件并保存到本地
+ `copyFile(source, target, progress)` 复制一个本地文件

然后再编写一个`download()`函数来判断`source`参数，并选择使用`downloadFile()`或者`copyFile()`来完成请求。

### 2、编写程序

在本项目中，所有的ES2015源程序均保存在`src`目录下，发布项目时会执行相应的命令将其编译并输出到`lib`目录，具体方法在 **「发布模块」** 小节中介绍。

实现`copyFile()`函数，新建文件`src/copy.js`：

```javascript
import fs from 'fs';

export default function copyFile(source, target, progress) {
  return new Promise((resolve, reject) => {

    fs.stat(source, (err, stats) => {
      if (err) return reject(err);

      let ss = fs.createReadStream(source);
      let ts = fs.createWriteStream(target);
      ss.on('error', reject);
      ts.on('error', reject);

      let copySize = 0;
      ss.on('data', data => {
        copySize += data.length;
        progress && progress(copySize, stats.size);
      });

      ss.on('end', () => resolve(target));

      ss.pipe(ts);
    });

  });
}
```

说明：

+ `import fs from 'fs'`为ES2015模块系统加载模块的方式，可理解为`var fs = require('fs')`，具体在下文「模块系统」一节中介绍。
+ 通过`fs.createReadStream(source)`和`fs.createWriteStream(target)`来创建读取文件流和写入文件流，并监听读取文件流的`data`事件获得当前进度信息。
+ `export default function copyFile() {}`将函数`copyFile()`作为模块输出，相当于`module.exports = function copyFile() {}`，具体在下文「模块系统」一节中介绍。
+ 函数执行后返回一个`Promise`对象，通过其`.then()`和`.catch()`来获取执行结果，关于Promise的详细介绍可阅读[阮一峰](http://www.ruanyifeng.com)所著的[「ECMAScript 6 入门 」](http://es6.ruanyifeng.com/)中[「 Promise对象」](http://es6.ruanyifeng.com/#docs/promise)一章。

为了测试该代码能否正常工作，可在文件末尾增加以下测试程序（在编写单元测试时将删除）：

```javascript
copyFile(__filename, '/tmp/copy.js', (size, total) => console.log(`进度${size}/${total}`))
  .then(filename => console.log(`已保存到${filename}`))
  .catch(err => console.log(`出错：${err}`));
```

以上程序的作用是将当前JavaScript文件复制到`/tmp/copy.js`，使用`babel-node`执行该文件将得到以下结果：

```bash
$ babel-node src/copy.js

进度749/749
已保存到/tmp/copy.js
```

实现`downloadFile()`函数，新建文件`src/download.js`：

```javascript
import fs from 'fs';
import request from 'request';

export default function downloadFile(url, target, progress) {
  return new Promise((resolve, reject) => {

    let s = fs.createWriteStream(target);
    s.on('error', reject);

    let totalSize = 0;
    let downloadSize = 0;
    let req = request
      .get({
        url: url,
        encoding: null
      })
      .on('response', res => {
        if (res.statusCode !== 200) {
          return reject(new Error('status #' + res.statusCode));
        }
        totalSize = Number(res.headers['content-length']) || null;

        res.on('data', data => {
          downloadSize += data.length;
          progress && progress(downloadSize, totalSize);
        });
        res.on('end', () => resolve(target));
      })
      .pipe(s);

  });
}
```

说明：

+ 程序使用`request`模块来下载URL的内容，使用时执行命令`$ npm i request --save`安装该模块。
+ 通过`request`模块的`pipe()`方法将收到的数据写入到`fs.createWriteStream(target)`创建的写入文件流中，`request`模块的详细使用方法可参考其文档：https://www.npmjs.com/package/request

为了测试该代码能否正常工作，可在文件末尾增加以下测试程序（在编写单元测试时将删除）：

```javascript
let url = 'http://dn-cnodestatic.qbox.me/public/images/cnodejs_light.svg';
downloadFile(url, '/tmp/avatar.jpg', (size, total) => console.log(`进度${size}/${total}`))
  .then(filename => console.log(`已保存到${filename}`))
  .catch(err => console.log(`出错：${err}`));
```

以上程序的作用是将URL为`http://dn-cnodestatic.qbox.me/public/images/cnodejs_light.svg`的文件复制到`/tmp/avatar.jpg`，使用`babel-node`执行该文件将得到以下结果：

```bash
$ babel-node src/download.js

进度5944/5944
已保存到/tmp/avatar.jpg
```

实现`download()`函数，新建文件`src/index.js`：

```javascript
import os from 'os';
import path from 'path';
import mkdirp from 'mkdirp';
import copyFile from './copy';
import downloadFile from './download';

export default function download(source, target, progress) {
  target = target || randomFilename(download.tmpDir);
  progress = progress || noop;
  return new Promise((resolve, reject) => {

    mkdirp(path.dirname(target), err => {
      if (err) return callback(err);

      resolve((isURL(source) ? downloadFile : copyFile)
        (source, target, progress));
    });

  });
}

let getTmpDir = os.tmpdir || os.tmpDir;

function randomString(size = 6, chars = 'abcdefghijklmnopqrstuvwxyz0123456789') {
  let max = chars.length + 1;
  let str = '';
  while (size > 0) {
    str += chars.charAt(Math.floor(Math.random() * max));
    size--;
  }
  return str;
}

function randomFilename(tmpDir = getTmpDir()) {
  return path.resolve(tmpDir, randomString(20));
}

function isURL (url) {
  if (url.substr(0, 7) === 'http://') return true;
  if (url.substr(0, 8) === 'https://') return true;
  return false;
}

export function noop() { }
```

说明：

+ `import copyFile from './copy'`用于载入模块，相当于`var copyFile = require('./copy')`。
+ `download(...args)`函数中的`...args`相当于`var args = Array.prototype.call(arguments);`。
+ 程序使用`mkdirp`模块来创建目标文件的上级目录，使用时执行命令`$ npm i mkdirp --save`安装该模块。
+ `getTmpDir()`函数用于取得当前系统的临时目录，通过`os.tmpDir()`获得。
+ `randomString(size)`函数用于生成指定长度的随机字符串。
+ `randomFilename(tmpDir)`用于生成临时文件名，默认存储在系统临时目录下，可通过`tmpDir`参数指定。
+ `isURL(url)`函数用于判断参数是否为一个URL。

为了验证程序是否正确，我们可以将上文的`src/copy.js`和`src/download.js`中的测试程序放到`src/index.js`文件的末尾并执行（需要将旧的程序程序删除），比如：

```javascript
download(__filename, '/tmp/copy.js', (size, total) => console.log(`进度${size}/${total}`))
  .then(filename => console.log(`已保存到${filename}`))
  .catch(err => console.log(`出错：${err}`));
```

正常情况下，其执行结果应该跟上文中的结果是一致的。

### 3、模块系统

Node.js使用的是CommonJS模块系统，模块的输出我们一般通过给`exports`对象设置属性来做：

```javascript
// 输出变量或函数
exports.x = 123;
exports.y = function () {
  console.log('hello');
};
```

可以通过以下方式来操作：

```javascript
var mod = require('./my_module');

console.log(mod.x);
mod.y();
```

也可以通过覆盖`module.exports`来输出一个函数或者其他数据类型：

```javascript
module.exports = function () {
  console.log('hello');
};
```

通过以下方式来操作：

```javascript
var fn = require('./my_module');

fn();
```

而在ES2015中，模块通过`export`语句来输出：

```javascript
// 普通输出，相当于 exports.x = y;
export const a = 123;
export var b = 456;
export function c() { }
export class d { }

// 默认输出，相当于 module.exports = z;
export default function y() { }
```

通过`import`语句来引入模块，不同的引入方式其含义是不一样的，比如：

```javascript
// 操作 export var x = y 方式的输出
import {a, b, c, d} from './my_module';
// 通过相应的变量名称 a, b, c, d 来操作

// 或者将所有输出指向一个对象
import * as mod from './my_module';
// 通过 mod.a, mod.b, mod.c, mod.d 来操作

// 操作 export default x 方式的输出
import y from './my_module';
```

对于非ES2015程序输出的模块，`import * as mod`和`import mod`其结果是一样的，比如：

```
import * as fs1 from 'fs';
import fs2 from 'fs';

// fs1.readFile() 和 fs2.readFile() 是一样的
```

为了更容易理解ES2015的模块系统原理，我们可以通过阅读编译后的JavaScript程序来了解。访问[babel的在线REPL](http://babeljs.io/repl/)或将程序保存到本地，并执行`babel file.js`来查看编译后的程序。

以下ES2015代码：

```javascript
export const a = 123;
export var b = 456;
export function c() { }
export class d { }

export default function y() { }
```

编译后结果如下：

```javascript
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.c = c;
exports["default"] = y;

function _classCallCheck(instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
}

var a = 123;
exports.a = a;
var b = 456;
exports.b = b;

function c() {}

var d = function d() {
  _classCallCheck(this, d);
};

exports.d = d;

function y() {}
```

由上面的代码可以看出，`export var b = 456`这样的输出方式，实际上相当于`var b = exports.b = 456`，即直接设置`exports`对象的属性来完成。而`export default y`则是设置`exports`对象的`default`属性。

另外，还设置了`exports.__esModule = true`来标记这是一个ES2015输出的模块，在通过`import`来引入模块时会判断此属性来执行相应的规则，下文将详细介绍。

再看看以下的ES2015代码：

```javascript
import {a, b, c, d} from './my_module';
import * as mod from './my_module';
import y from './my_module';

a;
mod.a;
y;
```

其编译后的JavaScript代码如下：

```javascript
'use strict';

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : {
    'default': obj
  };
}

function _interopRequireWildcard(obj) {
  if (obj && obj.__esModule) {
    return obj;
  } else {
    var newObj = {};
    if (obj != null) {
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
      }
    }
    newObj['default'] = obj;
    return newObj;
  }
}

var _my_module = require('./my_module');

var mod = _interopRequireWildcard(_my_module);

var _my_module2 = _interopRequireDefault(_my_module);

_my_module.a;
mod.a;
_my_module2['default'];
```

首先，`a`是通过`import {a} from './my_module'`来引入的，编译后的代码中访问`a`使用的是`_my_module.a`，而`_my_module = require('./my_module')`，所以其对应的是`export var a = 123`这样的输出。

`mod`是通过`import * as mod from './my_module'`来引入的，其编译后的代码为`_interopRequireWildcard(require('./my_module'))`。在`_interopRequireWildcard()`函数中，如果载入的模块是由ES2015输出的，那么不做任何处理，否则会生成一个输入模块的拷贝，并且设置其`default`属性为自身。

`y`是通过`import y from './my_module'`来引入的，对`y`的访问被编译成了`_my_module2['default']`，所以`y`实际上是`export default`的输出。而`_my_module2 = _interopRequireDefault(require('./my_module'))`，函数`_interopRequireDefault()`对载入的非ES2015模块做了处理，会返回一个`default`属性指向该模块的新对象。

当然模块系统的还有更复杂的语法规则，详细说明可参考：[阮一峰](http://www.ruanyifeng.com)所著的[「ECMAScript 6 入门」](http://es6.ruanyifeng.com/)中[「Module」](http://es6.ruanyifeng.com/#docs/module)一章。

### 4、封装模块

上文例子中的`download()`函数所在的文件`src/index.js`中用到`randomFilename()`和`isURL()`这两个函数，为了使得代码结构更清晰，我们尝试把这些工具函数转移到`src/utils.js`中。

新建文件`src/utils.js`：

```javascript
import path from 'path';
import os from 'os';

let getTmpDir = os.tmpdir || os.tmpDir;

function randomString(size = 6, chars = 'abcdefghijklmnopqrstuvwxyz0123456789') {
  let max = chars.length + 1;
  let str = '';
  while (size > 0) {
    str += chars.charAt(Math.floor(Math.random() * max));
    size--;
  }
  return str;
}

export function randomFilename(tmpDir = getTmpDir()) {
  return path.resolve(tmpDir, randomString(20));
}

export function isURL (url) {
  if (url.substr(0, 7) === 'http://') return true;
  if (url.substr(0, 8) === 'https://') return true;
  return false;
}

export function noop() { }
```

说明：`getTmpDir()`和`randomString()`仅在函数`randomFilename()`函数中用到，所以不需要使用`export`输出。

修改文件`src/index.js`，将相应的代码删掉，并在文件首部`import`语句后面增加以下代码：

```javascript
import {randomFilename, isURL, noop} from './utils';
```


## 单元测试

本文将以`mocha`测试框架为例，单元测试程序也将使用ES2015来写。

首先执行以下命令安装`mocha`：

```bash
$ npm i -g mocha
```

安装完成后可执行以下命令验证是否安装成功：

```
$ mocha --version

2.3.4
```

通过阅读`babel`的官方文档（访问http://babeljs.io/docs/setup/#mocha ）可知，为了让Node.js中的`require()`函数能直接载入ES2015程序，需要依赖`babel-core`模块，执行以下命令安装：

```bash
$ npm i babel-core mocha --save-dev
```

运行`mocha`命令的时候，需要增加额外的参数`--compilers js:babel-core/register`让其使用`babel`来载入JavaScript程序。为了方便，我们可以修改`package.json`文件，增加以下内容：

```json
{
  "scripts": {
    "test": "mocha --compilers js:babel-core/register"
  }
}
```

说明：我们通过`npm init`命令生成`package.json`文件时，已经自动生成了`test`命令，其默认值为`echo \"Error: no test specified\" && exit 1`，直接将其改为`mocha --compilers js:babel-core/register`即可。

以上准备工作完成后，便可以开始写单元测试程序了。新建文件`test/test.js`：

```javascript
import assert from 'assert';
import path from 'path';
import fs from 'fs';
import download from '../src';
import {randomFilename} from '../src/utils';

let readFile = f => fs.readFileSync(f).toString();
let getFileSize = f => fs.statSync(f).size;

describe('es2015_demo', () => {

  it('复制本地文件成功', done => {

    let source = __filename;
    let target = randomFilename();
    let onProgress = false;

    download(source, target, (size, total) => {

      onProgress = true;
      assert.equal(size, total);
      assert.equal(total, getFileSize(source));

    }).then(filename => {

      assert.equal(onProgress, true);
      assert.equal(target, filename);
      assert.equal(readFile(source), readFile(target));

      done();

    }).catch(err => {
      throw err;
    });
  });

});
```

说明：本文只为了演示如何配置`mocha`和编写单元测试程序，所以没有给`download()`函数编写完整的单元测试，仅编写一个测试用例作为演示。

好了，现在执行`$ npm test`命令看看：

```bash
$ npm test

> es2015_demo@1.0.0 test /private/tmp/es2015_demo
> mocha --compilers js:babel-core/register



  es2015_demo
    ✓ 复制本地文件成功


  1 passing (51ms)

```

至此，我们已经完成了使用ES2015编写模块，并使用`mocha`来进行单元测试，下文将介绍如何通过`babel`编译程序，并发布模块。


## 发布模块

### 1、编译

上文已提到，为了让使用ES2015编写的代码能在Node.js上正常运行，需要先将其编译成ES5标准的代码，然后还需要在程序入口载入`babel-polyfill`模块。

我们可以修改文件`package.json`，为其增加`compile`命令：

```json
{
  "scripts": {
    "compile": "babel src -d lib"
  }
}
```

说明：`$ babel src -d lib`命令表示`lib`目录下的所有文件，并保存到`src`目录下。

配置完成后，可以执行`$ npm run compile`命令编译试试：

```bash
$ npm run compile

> @isnc/es2015_demo@1.0.0 compile /Users/glen/work/tmp/es2015_demo
> babel src -d lib

src/copy.js -> lib/copy.js
src/download.js -> lib/download.js
src/index.js -> lib/index.js
src/utils.js -> lib/utils.js
```

此时，我们还不能直接载入`lib/index.js`文件，因为在此之前需要载入`babel-polyfill`模块。编辑文件`package.json`，设置模块入口文件：

```json
{
  "main": "index.js"
}
```

说明：使用`$ npm init`生成`package.json`文件时，`main`的默认值即为`index.js`，可无需修改。

新建文件`index.js`：

```javascript
require('babel-polyfill');
module.exports = require('./lib').default;
```

说明：在`src/index.js`中`download()`函数使用的是`export default`输出，所以在Node.js中需要读取模块输出的`default`属性。

上文中我们的测试程序是直接载入`src`目录下的程序，但模块最终发布的却是编译后的程序，为了避免因babel的Bug而导致编译后的程序与源程序功能有差异，我们的单元测试需要改用编译后的代码。

编辑文件`test/test.js`，将引入`src`目录的模块：

```
import download from '../src';
import {randomFilename} from '../src/utils';
```

改为：

```javascript
import download from '../';
import {randomFilename} from '../lib/utils';
```

在编辑`package.json`文件，将`test`命令改为先执行`compile`编译代码后再执行`mocha`测试：

```
{
  "scripts": {
    "test": "npm run compile && mocha --compilers js:babel-core/register"
  }
}
```

重新执行`$ npm test`可看到如下结果：

```
$ npm test

> es2015_demo@1.0.0 test /private/tmp/es2015_demo
> npm run compile && mocha --compilers js:babel-core/register


> es2015_demo@1.0.0 compile /private/tmp/es2015_demo
> babel src -d lib

src/copy.js -> lib/copy.js
src/download.js -> lib/download.js
src/index.js -> lib/index.js
src/utils.js -> lib/utils.js


  es2015_demo
    ✓ 复制本地文件成功


  1 passing (42ms)

```

### 2、发布

在开发项目时，一般都会使用Git这样的源代码版本管理工具。上文例子中，`lib`目录的文件是编译生成的，可以不需要纳入到版本管理中。Node.js项目在安装模块时会将其保存到`node_modules`目录下，这些内容也是不应该纳入版本管理的。可以添加文件`.gitignore`来将其排除：

```
*.log
node_modules
lib
```

如果要将模块发布到NPM上，ES2015编写的源程序也是不需要的，可以添加文件`.npmignore`来将其排除：

```
src
```

在使用`$ npm publish`命令发布模块时，可以设置`prepublish`命令来让其自动执行编译。编辑文件`package.json`，增加以下内容：

```json
{
  "scripts": {
    "prepublish": "npm run compile"
  }
}
```

现在我们执行`$ npm publish`就可以发布模块了：

```
$ npm publish

> @leizongmin/es2015_demo@1.0.0 prepublish /Users/glen/work/tmp/es2015_demo
> npm run compile


> @leizongmin/es2015_demo@1.0.0 compile /Users/glen/work/tmp/es2015_demo
> babel src -d lib

src/copy.js -> lib/copy.js
src/download.js -> lib/download.js
src/index.js -> lib/index.js
src/utils.js -> lib/utils.js
+ @leizongmin/es2015_demo@1.0.0
```

### 3、善后

上文例子中需要依赖`mocha`和`babel`两个工具，当我们开发多个项目或将其作为开源项目发布出去时，可能不同的项目所依赖`babel`的版本是不一样的，为了开发环境一致，一般我们需要在当前项目中执行其开发时所指定的`babel`版本。

首先执行以下命令安装`babel-cli`和`mocha`：

```bash
$ npm i babel-cli mocha --save-dev
```

安装完成后，对于上文中使用的`babel`和`mocha`命令，可以使用`./node_modules/.bin/babel`和`./node_modules/.bin/mocha`来执行。编辑`package.json`文件，更改`compile`和`test`命令：

```json
{
  "scripts": {
    "compile": "babel src -d lib",
    "test": "npm run compile && mocha --compilers js:babel-core/register"
  }
}
```

说明：在`package.json`文件的`scripts`里面，要执行的命令如果是在`./node_modules/.bin`目录内，可以省略`./node_modules/.bin/`前缀，比如`./node_modules/.bin/mocha`可以简写为
`mocha`。

本文示例模块输出的`download()`函数使用的是Promise的异步模式，对于习惯使用callback模式的用户，我们也可以通过简单的修改来使其支持callback模式。

编辑文件`src/utils.js`，增加`callbackify()`函数：

```javascript
export function callbackify(fn) {
  let argc = fn.length;
  return (...args) => {
    let callback = args[argc];
    if (typeof callback !== 'function') callback = null;
    return fn(...args)
      .then(ret => {
        callback && callback(null, ret);
        return Promise.resolve(ret);
      })
      .catch(err => {
        callback && callback(err);
        return Promise.reject(err);
      });
  }
}
```

编辑文件`src/index.js`，将其改为以下内容：

```javascript
import path from 'path';
import mkdirp from 'mkdirp';
import copyFile from './copy';
import downloadFile from './download';
import {randomFilename, isURL, noop, callbackify} from './utils';

export default callbackify(function download(source, target, progress) {
  target = target || randomFilename(download.tmpDir);
  progress = progress || noop;
  return new Promise((resolve, reject) => {

    mkdirp(path.dirname(target), err => {
      if (err) return callback(err);

      resolve((isURL(source) ? downloadFile : copyFile)
        (source, target, progress));
    });

  });
});
```

说明：`callbackify()`函数的作用是返回一个新的函数，这个函数可以支持原函数的Promise模式，同时支持callback模式。

现在再给`test/test.js`增加一个测试用例：

```javascript
  it('复制本地文件成功 callback', done => {

    let source = __filename;
    let target = randomFilename();
    let onProgress = false;

    download(source, target, (size, total) => {

      onProgress = true;
      assert.equal(size, total);
      assert.equal(total, getFileSize(source));

    }, (err, filename) => {

      assert.equal(err, null);
      assert.equal(onProgress, true);
      assert.equal(target, filename);
      assert.equal(readFile(source), readFile(target));

      done();

    });
  });
```

如无意外，重新执行`$ npm test`是可以测试通过的。


## 后记

本文的初稿在一个星期之前已经完成，一开始看到ES2015的新语法特性时眼前一亮，接着又觉得使用的时候有点繁琐，比如每次运行程序都有先使用babel编译，程序运行出错时定位的位置跟ES2015源码的位置不同等等。后来经过几天的摸索，发觉新的语法特性确实可以少打了很多代码，而且程序的表现力也更强了，与babel编译所耗的那几秒时间相比还是很值得的。

本文的示例代码可通过 https://github.com/leizongmin/morning.work/blob/gh-pages/demo/es2015_npm_package 获得。


## 扩展阅读

+ [给 JavaScript 初心者的 ES2015 实战](http://gank.io/post/564151c1f1df1210001c9161)
+ [ECMAScript 6 入门](http://es6.ruanyifeng.com/)
+ [「大概可能也许是」目前最好的 JavaScript 异步方案 async/await](https://blog.leancloud.cn/3910/)
+ [Learn ES2015 - A detailed overview of ECMAScript 6 features](http://babeljs.io/docs/learn-es2015/)
+ [Using ES6 with npm today](http://mammal.io/articles/using-es6-today/)
+ [Using ES6 and ES7 in the Browser, with Babel 6 and Webpack](http://jamesknelson.com/using-es6-in-the-browser-with-babel-6-and-webpack/)
+ [Writing NPM packages with ES6 using the Babel 6 CLI](http://jamesknelson.com/writing-npm-packages-with-es6-using-the-babel-6-cli/)
+ [Set up Sublime Text for Meteor ES6 (ES2015) and JSX Syntax and Linting](http://info.meteor.com/blog/set-up-sublime-text-for-meteor-es6-es2015-and-jsx-syntax-and-linting)
+ [Exploring ES6 - Modules](http://exploringjs.com/es6/ch_modules.html)
+ [npm scripts 入门](https://www.zybuluo.com/yangfch3/note/249328)
+ [使用npm scripts构建项目](http://www.qcyoung.com/2016/02/28/%E4%BD%BF%E7%94%A8npm%20scripts%E6%9E%84%E5%BB%BA%E9%A1%B9%E7%9B%AE/)
