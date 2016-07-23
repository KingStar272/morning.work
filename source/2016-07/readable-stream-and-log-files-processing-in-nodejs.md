```
title: Node.js 的 Readable Stream 与日志文件处理
date: 2016-07-23
author: 老雷
```

> 在上一篇文章[《如何实时监听文件的新增内容：一个简单 tailf 命令的实现》](http://morning.work/page/2016-07/how-to-implement-a-tail-f-command-in-nodejs.html)里面，我们已经实现了一个`tailf`函数用来监听文件的新增内容，看起来它也工作良好。然而当我想把它应用到手头正要做的日志文件处理时，却发现这样一个**非标准的接口很难与之前编写的模块愉快地合作**。
>
> 我在去年的文章[《在 Node.js 中读写大文件》](http://morning.work/page/2015-07/read_and_write_big_file_in_nodejs.html)中实现了一个`readLine(stream)`函数，其接收的参数是一个`Readable Stream`对象，能按照给定的规则（比如使用`\n`换行）来`emit`出每一行的内容，再结合`tailf`来监听文件的新增内容，我们就可以很轻易地对新增的内容进行按行切分。
>
> 所以，我们要实现一个实现了`Readable Stream`接口的`tailf`，在本文中我给它起了个名字叫`TailStream`。


## Readable Stream

Node.js 的 stream 模块提供了四种形式的流，分别适用于不同的场景：

适用场景          | Class                        | 需要实现的方法
-----------------|------------------------------|------------
只读              | [Readable][stream_readable]  | `_read`
只写              | [Writable][stream_writable]  | `_write`, `_writev`
读写              | [Duplex][stream_duplex]      | `_read`, `_write`, `_writev`
处理写入的数据供读取 |[Transform][stream_transform] | `_transform`, `_flush`

[stream_readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable
[stream_writable]: https://nodejs.org/api/stream.html#stream_class_stream_writable
[stream_duplex]: https://nodejs.org/api/stream.html#stream_class_stream_duplex
[stream_transform]: https://nodejs.org/api/stream.html#stream_class_stream_transform

从表格可以得知，要实现一个`Readable`的流，只需要实现一个`_read()`方法即可。然后我们再来看看[_read() 的定义](https://nodejs.org/api/stream.html#stream_readable_read_size_1)：

`readable._read(size)`

+ `size` 参数表示需要异步读取的字节数
+ 当`_read(size)`被调用时，尝试从底层资源中读取指定长度的数据，如果读取到数据则使用`this.push(data)`将数据推送到队列中
+ 当底层资源已读取到末尾时，通过`this.push(null)`来表示结束
+ 如果在操作过程中发生错误，通过`this.emit('error', err)`来触发`error`事件


## 简单的 TailStream 实现

由此官方文档中对 Readable Stream 的介绍，再结合文章[《如何实时监听文件的新增内容：一个简单 tailf 命令的实现》](http://morning.work/page/2016-07/how-to-implement-a-tail-f-command-in-nodejs.html)中监控文件变化的方法，我们可以编写以下代码来实现一个`tailf`的`stream`版本：

```javascript
'use strict';

const fs = require('fs');
const stream = require('stream');

class TailStream extends stream.Readable {

  /**
   * TailStream
   *
   * @param {Object} options
   *   - {String} file 文件名
   */
  constructor(options) {
    options = options || {};
    // 调用基类的构造函数
    super(options);
    // 文件名
    this._file = options.file;
    // 起始位置
    this._position = 0;
    // 开始打开文件
    this._openFile();
  }

  // 打开文件
  _openFile() {
    this._fd = fs.openSync(this._file, 'r');
    this._watchFile();
  }

  // 监听文件内容变化
  _watchFile() {
    this._watcher = fs.watch(this._file, (event, filename) => {
      if (event === 'change') {
        this._read(this._getHighWaterMark());
      }
    });
  }

  // 获取每次合适的读取字节数
  _getHighWaterMark() {
    return this._readableState.highWaterMark;
  }

  // 读取数据
  _read(size) {
    fs.read(this._fd, new Buffer(size), 0, size, this._position,
    (err, bytesRead, buf) => {
      if (err) return this.emit('error', err);
      if (bytesRead > 0) {
        // 将数据推送到队列
        this._position += bytesRead;
        this.push(buf.slice(0, bytesRead));
      }
    });
  }

}
```

说明：

+ 为了让程序逻辑显得尽可能简单，在打开文件时是使用`fs.openSync()`这样的阻塞方法，在下文将会对此进行改造
+ `_getHighWaterMark()`用来获取每次要尝试读取的字节数，其实就是在`_read(size)`时传入的默认`size`值
+ 如果操作过程中出错，使用`this.emit('error', err)`来抛出错误

对于上面的代码，可以编写以下程序来测试：

```javascript
const file = process.argv[2];
const s = new TailStream({file});
s.on('data', data => {
  process.stdout.write(data);
});
```

假如将上面的代码保存为文件`tail_stream.js`，而我们要监听的文件名为`test.log`，可以执行以下命令启动：

```bash
$ node tail_stream test.log
```

然后再在另一个控制台窗口下执行命令测试：

```bash
$ echo "$(date) hello, world" >> test.log
```

如果一切顺利，我们上文所写的程序应该是能很好地工作的。


## 不止于玩具

当你兴高采烈地开始使用上面的代码时，**「我跟你讲，你会踩坑的」**。我都不好意思说当我不小心掉坑里的时候，整整花了一个多小时才回过神来。

我先来上文的代码存在的一些问题吧：

+ 在`_read(size)`里，由于`fs.read()`是使用异步读取的，`_position`只会在读取完成后的回调函数中更新，当读取过程中`_watchFile()`中有文件被更改的事件触发时，假如此时有一个`fs.read()`读取还未完成，再进行一个`fs.read()`就会导致数据错乱
+ 打开文件用的是`fs.openSync()`，为了保持实现的一致，还是需要使用异步方法来实现的

下面我们尝试将`_openFile()`改为异步实现：

```javascript
// 打开文件
_openFile() {
  fs.open(this._file, 'r', (err, fd) => {
    if (err) return this.emit('error', err);
    this._fd = fd;
    this._watchFile();
  });
}
```

虽然仅仅是去掉了个`Sync`，但是变化却出乎意料。当尝试运行程序时，报错了：

```
fs.js:687
  binding.read(fd, buffer, offset, length, position, req);
          ^

TypeError: fd must be a file descriptor
    at TypeError (native)
    at Object.fs.read (fs.js:687:11)
    at TailStream._read (~/tail_stream.js:49:8)
    at TailStream.Readable.read (_stream_readable.js:349:10)
    at resume_ (_stream_readable.js:738:12)
    at _combinedTickCallback (internal/process/next_tick.js:74:11)
    at process._tickCallback (internal/process/next_tick.js:98:9)
    at Module.runMain (module.js:577:11)
    at run (bootstrap_node.js:352:7)
    at startup (bootstrap_node.js:144:9)
```

由于**在注册`data`事件监听器后，Readable Stream 立刻尝试执行`_read()`从底层读取数据**，而此时我们的异步打开文件的操作可能还没有执行回调，还没有获得文件操作句柄`this._fd`，所以程序报错了。

我们可以尝试使用一个`this._ready`来标记是否准备就绪，在`_read(size)`方法内首先判断如果`this._ready = true`才正在调用`fs.read()`读取文件。由于改动的位置较多，以下直接贴出完整的代码：

```javascript
'use strict';

const fs = require('fs');
const stream = require('stream');

class TailStream extends stream.Readable {

  /**
   * TailStream
   *
   * @param {Object} options
   *   - {String} file 文件名
   */
  constructor(options) {
    options = options || {};
    // 调用基类的构造函数
    super(options);
    // 文件名
    this._file = options.file;
    // 起始位置
    this._position = 0;
    // 标记是否准备就绪
    this._ready = false;
    // 开始打开文件
    this._openFile();
  }

  // 打开文件
  _openFile() {
    fs.open(this._file, 'r', (err, fd) => {
      if (err) return this.emit('error', err);
      this._fd = fd;
      this._watchFile();
      this._ready = true;
      this._tryRead();
    });
  }

  // 监听文件内容变化
  _watchFile() {
    this._watcher = fs.watch(this._file, (event, filename) => {
      if (event === 'change') {
        this._tryRead();
      }
    });
  }

  // 获取每次合适的读取字节数
  _getHighWaterMark() {
    return this._readableState.highWaterMark;
  }

  // 尝试读取数据
  _tryRead() {
    this._read(this._getHighWaterMark());
  }

  // 读取数据
  _read(size) {
    if (this._ready) {
      // 仅当_ready=true时才尝试读取数据
      this._ready = false;
      fs.read(this._fd, new Buffer(size), 0, size, this._position,
      (err, bytesRead, buf) => {
        // 设置_ready=true以便可以再次读取数据
        this._ready = true;
        if (err) return this.emit('error', err);
        if (bytesRead > 0) {
          // 将数据推送到队列
          this._position += bytesRead;
          this.push(buf.slice(0, bytesRead));
        }
      });
    }
  }

}
```


## 直接定位到文件尾部

记得在之前实现的`tailf()`函数里，我们已经实现了打开文件时立刻定位到文件尾部，所以在`TailStream`里也希望能支持这样的选项。

首先修改构造函数`constructor`，增加了初始化选项`position`：

```javascript
/**
  * TailStream
  *
  * @param {Object} options
  *   - {String} file 文件名
  *   - {Number|String} position 位置，为"end"表示定位到尾部
  */
constructor(options) {
  options = options || {};
  // 调用基类的构造函数
  super(options);
  // 文件名
  this._file = options.file;
  // 起始位置
  this._position = options.position || 0;
  // 标记是否准备就绪
  this._ready = false;
  // 开始打开文件
  this._openFile();
}
```

然后增加一个方法用于定位文件到文件尾部：

```javascript
// 定位到文件尾部
_goToEnd(callback) {
  fs.fstat(this._fd, (err, stats) => {
    if (err) return this.emit('error', err);
    this._position = stats.size;
    callback();
  });
}
```

相应地我们还要修改`_openFile()`方法：

```javascript
// 打开文件
_openFile() {
  fs.open(this._file, 'r', (err, fd) => {
    if (err) return this.emit('error', err);
    this._fd = fd;

    const done = () => {
      this._watchFile();
      this._ready = true;
      this._tryRead();
    };

    // 判断如果this._position='end'则定位到文件尾部
    if (this._position === 'end') {
      this._goToEnd(done);
    } else {
      done();
    }
  });
}
```

说明：这里主要的改动为，打开文件后先判断如果`this._position = 'end'`，则调用`this._goToEnd()`定位到文件尾部，否则就可以直接尝试读取文件了。

如果在创建`TailStream`实例的时候指定`position = 'end'`，比如这样：

```javascript
const file = process.argv[2];
const s = new TailStream({file, position: 'end'});
```

重新运行测试程序时，我们应该能发现启动后并没有输出任何信息，因为此时已经定位到末尾，并不会输出文件前部分的内容，仅当继续往文件写入内容时测试程序才会将内容显示出来。


## 停止监听


## 还要做得更完美


## 小结


## 相关链接

+ [Node.js Stream - 基础篇](http://tech.meituan.com/stream-basics.html)

