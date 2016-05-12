```
title: Node.js 面试题： 编写一个 Redis 客户端
date: 2016-05-12
author: 老雷
```

> 首先我要吐槽一下，**招聘 Node.js 工程师真心累**，虽然近两年来 Node.js 已经越来越火了，但发个招聘信息出去，投简历的也没几个。这几天好不容易连坑带拐终于勾搭上了一个，小心脏扑通扑通的久久不能平静下来，不过因为对方简历显示的主要项目经验还是前端方面的，而我们需要招的是后端，机智的我特意设计了下文这样一道面试题。
>
> 这样一道面试题也是临时想到的，为了确定这道题目可以在一定时间内做出来，我自己先写了一个基本可用的版本，从开始到结束约耗时两个小时（中途还去撒了两泡尿），考虑到面试者在陌生环境下可能影响正常发挥，一个下午的时间应该能应付下来。另外，我们定这样一个题目时也明确了：不要求必须完成，**主要考察思路、实现逻辑、代码风格和一些可能存在的问题或错误的预判**。
>
> 以下开始进入主题。


前几天写了篇文章[《如何用 Node.js 编写一个 API 客户端》](http://morning.work/page/2016-05/how-to-write-a-nodejs-api-client-package.html)（http://morning.work/page/2016-05/how-to-write-a-nodejs-api-client-package.html ），有人说这_不能算是一个 API 客户端，顶多是一个支持 GET / POST 操作的模块_，羞得我老脸微微一红，故作镇静地自然自语道，简单是简单点了，好歹也是个 API 客户端嘛。

这次要写的这个 Redis 客户端应该算是个客户端了，需要直接发起`TCP/IP`连接去跟服务器通讯，需要自己解析客户端返回的结果，还要做一些简单的容错处理，如果要做到足够健壮也不容易，不过就本文要实现一个基本可用的例子来说，还是简单了点。

无论是实现 REST 的 API 客户端还是这样一个 Redis 客户端，虽然具体实现的细节不同，但是，**套路**还是一样的。二十一世纪行走江湖最重要的是什么？套路！套路！套路！所以呢，本文还是跟之前一样的套路。


## Redis 协议

Redis 协议的详细介绍可以参考这里：http://redis.cn/topics/protocol.html

假如我要执行命令`KEYS *`，只要往服务器发送`KEYS *\r\n`即可，这时服务器会直接响应结果，返回的结果格式如下：

+ 用单行回复，回复的第一个字节将是`+`
+ 错误消息，回复的第一个字节将是`-`
+ 整型数字，回复的第一个字节将是`:`
+ 批量回复，回复的第一个字节将是`$`
+ 多个批量回复，回复的第一个字节将是`*`

为了查看具体的返回结果是怎样的，我们可以用`telnet`客户端来测试。假定本机已经运行了 Redis 服务，其监听端口为`6379`，我们可以执行以下命令连接：

```bash
$ nc 127.0.0.1 6379
```

或者：

```bash
$ telnet 127.0.0.1 6379
```

下面我们分别测试各个命令返回的结果（其中第一行表示客户端输入的命令，行尾的`↵`表示按回车发送，第二行开始表示服务器端返回的内容）：

1、返回错误

```
help ↵
-ERR unknown command 'help'
```

2、操作成功

```
set abc 123456 ↵
+OK
```

3、得到结果

```
get abc ↵
$6
123456
```

4、得不到结果

```
get aaa ↵
$-1
```

5、得到的结果是整形数字

```
hlen aaa ↵
:5
```

6、多个批量回复

```
keys a* ↵
*3
$3
abc
$3
aa1
$1
a
```

7、多命令执行

```
multi ↵
+OK
get a ↵
+QUEUED
get b ↵
+QUEUED
get c ↵
+QUEUED
exec ↵
*3
$5
hello
$-1
$5
world
```


## 解析结果

实现一个 Redis 客户端大概的原理是，客户端依次把需要执行的命令发送给服务器，而服务器会按照先后顺序把结果返回给用户。在本文我们使用 Node.js 内置的`net`模块来操作，通过`data`事件来接收结果。然而并不能一次性拿到一次请求的结果，有时可能是一个`data`事件中包含了几条命令的执行结果，也有可能当前命令的结果还没有传输完，剩下一半的结果在下一个`data`事件中。

为了方便调试，我们将解析结果的部分独立封装成一个函数，接口如下：

```javascript
const proto = new RedisProto();

// 接受到数据
proto.push('*3\r\n$3\r\nabc\r\n$3\r\naa1\r\n$1\r\na\r\n');
proto.push('$6\r\n123456\r\n');
proto.push('-ERR unknown command \'help\'\r\n');
proto.push('+OK\r\n');
proto.push(':5\r\n');
proto.push('*3\r\n$5\r\nhe');
proto.push('llo\r\n$-');
proto.push('1\r\n$5\r\nworld\r\n');

while (proto.next()) {
  // proto.next() 如果有解析出完整的结果则返回结果，没有则返回false
  // 另外可以通过 proto.result 获得
  console.log(proto.result);
}
```

接下来开始编写相应的代码。

按照套路，我们先初始化项目：

```bash
$ mkdir redis_client
$ cd redis_client
$ git init
$ npm init
```

新建文件`proto.js`：

```javascript
'use strict';

/**
 * 简单Redis客户端
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

class RedisProto {

  constructor() {

    this._lines = []; // 已初步解析出来的行
    this._text = '';  // 剩余不能构成一行的文本

  }

  push(text) {

    const lines = (this._text + text).split('\r\n');
    this._text = lines.pop();
    this._lines = this._lines.concat(lines);

  }

  next() {

    const lines = this._lines;
    const first = lines[0];

    const popResult = (lineNumber, result) => {
      this._lines = this._lines.slice(lineNumber);
      return this.result = result;
    };

    const popEmpty = () => {
      return this.result = false;
    };

    if (lines.length < 1) return popEmpty();

    switch (first[0]) {

      case '+':
        return popResult(1, {data: first.slice(1)});

      case '-':
        return popResult(1, {error: first.slice(1)});

      case ':':
        return popResult(1, {data: Number(first.slice(1))});

      case '$': {
        const n = Number(first.slice(1));
        if (n === -1) {
          return popResult(1, {data: null});
        } else {
          const second = lines[1];
          if (typeof second !== 'undefined') {
            return popResult(2, {data: second});
          } else {
            return popEmpty();
          }
        }
      }

      case '*': {
        const n = Number(first.slice(1));
        if (n === 0) {
          return popResult(1, {data: []});
        } else {
          const array = [];
          let i = 1;
          for (; i < lines.length && array.length < n; i++) {
            const a = lines[i];
            const b = lines[i + 1];
            if (a.slice(0, 3) === '$-1') {
              array.push(null);
            } else if (a[0] === ':') {
              array.push(Number(a.slice(1)));
            } else {
              if (typeof b !== 'undefined') {
                array.push(b);
                i++;
              } else {
                return popEmpty();
              }
            }
          }
          if (array.length === n) {
            return popResult(i, {data: array});
          } else {
            return popEmpty();
          }
        }
      }

      default:
        return popEmpty();

    }

  }

}

module.exports = RedisProto;
```

执行上文中的测试代码可得到如下结果：

```javascript
{ data: '123456' }
{ data: [ 'abc', 'aa1', 'a' ] }
{ error: 'ERR unknown command \'help\'' }
{ data: 'OK' }
{ data: 5 }
{ data: [ 'hello', null, 'world' ] }
```


## 实现 Redis 客户端

新建文件`index.js`：

```javascript
'use strict';

/**
 * 简单Redis客户端
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

const events = require('events');
const net = require('net');
const RedisProto = require('./proto');

class Redis extends events.EventEmitter {

  constructor(options) {
    super();

    options = options || {};
    options.host = options.host || '127.0.0.1';
    options.port = options.port || 6379;

    this.options = options;

    this._isClosed = false;
    this._isConnected = false;
    this._callbacks = [];

    this._proto = new RedisProto();

    this.connection = net.createConnection(options.port, options.host, () => {
      this._isConnected = true;
      this.emit('connect');
    });

    this.connection.on('error', err => {
      this.emit('error', err);
    });

    this.connection.on('close', () => {
      this._isClosed = true;
      this.emit('close');
    });

    this.connection.on('end', () => {
      this.emit('end');
    });

    this.connection.on('data', data => {
      this._pushData(data);
    });

  }

  sendCommand(cmd, callback) {
    return new Promise((resolve, reject) => {

      const cb = (err, ret) => {
        callback && callback(err, ret);
        err ? reject(err) : resolve(ret);
      };

      if (this._isClosed) {
        return cb(new Error('connection has been closed'));
      }

      this._callbacks.push(cb);
      this.connection.write(`${cmd}\r\n`);

    });
  }

  _pushData(data) {

    this._proto.push(data);

    while (this._proto.next()) {

      const result = this._proto.result;
      const cb = this._callbacks.shift();

      if (result.error) {
        cb(new Error(result.error));
      } else {
        cb(null, result.data);
      }

    }

  }

  end() {
    this.connection.destroy();
  }

}

module.exports = Redis;
```

新建测试文件`test.js`：

```javascript
'use strict';

const Redis = require('./simple');
const client = new Redis();

client.sendCommand('GET a', (err, ret) => {
  console.log('a=%s, err=%s', ret, err);
});

client.sendCommand('GET b', (err, ret) => {
  console.log('b=%s, err=%s', ret, err);
});

client.sendCommand('KEYS *IO*', (err, ret) => {
  console.log('KEYS *IO*=%s, err=%s', ret, err);
});

client.sendCommand('OOXX', (err, ret) => {
  console.log('OOXX=%s, err=%s', ret, err);
});

client.sendCommand('SET a ' + Date.now())
  .then(ret => console.log('success', ret))
  .catch(err => console.log('error', err))
  .then(() => client.end());
```

执行测试文件`node test.js`可看到类似如下的结果：

```
a=1463041835231, err=null
b=null, err=null
KEYS *IO*=sess:cz5F-npwOnw0FmesT6JjqJPL13IO8AzV,sess:NS90IkF6uZNAm-FPEAWXHuh3JrIW1-IO, err=null
OOXX=undefined, err=Error: ERR unknown command 'OOXX'
success OK
```

从结果中可以看出我们这个 Redis 客户端已经基本能用了。


## 更友好的接口

上文我们实现了一个`sendCommand()`方法，理论上可以通过该方法执行任意的 Redis 命令，但是我们可能更希望每条命令有一个对应的方法，比如`sendCommand('GET a')`我们可以写出`get('a')`，这样看起来会更直观。

首先在`index.js`文件头部载入`fs`和`path`模块：

```javascript
const fs = require('fs');
const path = require('path');
```

然后给`Redis`类增加`_bindCommands()`方法：

```
_bindCommands() {

  const self = this;
  const bind = (cmd) => {
    return function () {

      let args = Array.prototype.slice.call(arguments);
      let callback;
      if (typeof args[args.length - 1] === 'function') {
        callback = args.pop();
      }

      args = args.map(item => Array.isArray(item) ? item.join(' ') : item).join(' ');

      return self.sendCommand(`${cmd} ${args}`, callback);

    };
  };

  const cmdList = fs.readFileSync(path.resolve(__dirname, 'cmd.txt')).toString().split('\n');
  for (const cmd of cmdList) {

    this[cmd.toLowerCase()] = bind(cmd);
    this[cmd.toUpperCase()] = bind(cmd);

  }

}
```

然后在`Redis`类的`constructor()`方法尾部增加以下代码：

```javascript
this._bindCommands();
```

由于在`_bindCommands()`中通过读取`cmd.txt`文件来读取 Redis 的命令列表，所以还需要新建文件`cmd.txt`，内容格式为每条命令一行（由于篇幅限制，本文只列出需要用到的几条命令）：

```
GET
SET
AUTH
MULTI
EXEC
KEYS
```

把测试文件`test.js`改为以下代码：

```
'use strict';

const Redis = require('./simple');
const client = new Redis();

client.get('a', (err, ret) => {
  console.log('a=%s, err=%s', ret, err);
});

client.get('b', (err, ret) => {
  console.log('b=%s, err=%s', ret, err);
});

client.keys('*IO*', (err, ret) => {
  console.log('KEYS *IO*=%s, err=%s', ret, err);
});

client.set('a', Date.now())
  .then(ret => console.log('success', ret))
  .catch(err => console.log('error', err))
  .then(() => client.end())
```

重新执行`node test.js`可看到结果跟上文还是一致的。


## 简单容错处理

假如将测试文件`test.js`改为这样：

```javascript
'use strict';

const Redis = require('./simple');
const client = new Redis();

client.get('a', (err, ret) => {
  console.log('a=%s, err=%s', ret, err);

  client.end();

  client.get('b', (err, ret) => {
    console.log('b=%s, err=%s', ret, err);
  });
});
```

在完成`get('a')`的时候，我们执行`client.end()`关闭了连接，然后再执行`get('b')`，大多数情况下将会得到如下的结果：

```
a=1463042964235, err=null
```

而`get('b')`的回调函数并没有被执行，因为我们在关闭连接后，再也没有收到服务端返回的结果。另外也有可能是因为其他原因，客户端与服务端的连接断开了，此时我们应该能执行回调并返回一个错误。

在文件`index.js`中给`Redis`类增加一个方法`_callbackAll()`：

```javascript
_callbackAll() {

  for (const cb of this._callbacks) {
    cb(new Error('connection has been closed'));
  }
  this._callbacks = [];

}
```

另外，在`constructor()`方法内，将监听连接的`close`事件部分代码改成这样：

```javascript
this.connection.on('close', () => {
  this._isClosed = true;
  this.emit('close');
  this._callbackAll();
});
```

重新执行`node test.js`，从执行结果可看出所有回调函数均已被执行：

```
a=1463042964235, err=null
b=undefined, err=Error: connection has been closed
```


## 还存在的问题

不支持更复杂的数据结构


-----

## 参考链接

+ [Redis协议](http://redis.cn/topics/protocol.html)（http://redis.cn/topics/protocol.html）
