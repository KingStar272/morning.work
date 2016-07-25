```
title: Node.js 的 Readable Stream 与日志文件处理
date: 2016-07-24
author: 老雷
```

> 在上一篇文章[《如何实时监听文件的新增内容：一个简单 tailf 命令的实现》](http://morning.work/page/2016-07/how-to-implement-a-tail-f-command-in-nodejs.html)里面，我们已经实现了一个`tailf`函数用来监听文件的新增内容，看起来它也工作良好。然而当我想把它应用到手头正要做的日志文件处理时，却发现这样一个**非标准的接口很难与之前编写的模块愉快地合作**。
>
> 我在去年的文章[《在 Node.js 中读写大文件》](http://morning.work/page/2015-07/read_and_write_big_file_in_nodejs.html)中实现了一个`readLine(stream)`函数，其接收的参数是一个`Readable Stream`对象，能按照给定的规则（比如使用`\n`换行）来`emit`出每一行的内容，再结合`tailf`来监听文件的新增内容，我们就可以很轻易地对新增的内容进行按行切分。
>
> 所以，我们要实现一个实现了`Readable Stream`接口的`tailf`，在本文中我给它起了个名字叫`TailStream`。
>
> 本文所实现的`TailStream`已加入`lei-stream`模块，使用方法为：
>
> ```javascript
> // 使用前先执行 npm install lei-stream 安装模块
> const stream = require('lei-stream').tailStream(file, {position: 'end'});
>```
>
> `lei-stream`模块详细介绍请参考这里：https://github.com/leizongmin/node-lei-stream

## 关于 Readable Stream

Node.js 的`stream`模块提供了四种形式的流，分别适用于不同的场景：

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

假如将上面的代码保存为文件`tail_stream.js`，而我们要监听的文件名为`test.log`，可以执行以下命令先新建一个`test.log`文件：

```bash
$ echo "" > test.log
```

在可以执行以下命令启动监听程序：

```bash
$ node tail_stream test.log
```

然后再在另一个控制台窗口下执行命令测试：

```bash
$ echo "$(date) hello, world" >> test.log
```

如果一切顺利，我们所写的程序应该是能很好地工作的。


## 不止于玩具

当你兴高采烈地开始使用上面的代码时，**「我跟你讲，你会踩坑的」**。我都不好意思说当我不小心掉坑里的时候，整整花了一个多小时才回过神来。

我先来上文的代码存在的一些问题吧：

+ 在`_read(size)`里，由于`fs.read()`是使用异步读取的，`_position`只会在读取完成后的回调函数中更新，当读取过程中`_watchFile()`所监听的文件有被更改的事件触发时，假如此时有一个`fs.read()`读取还未完成，再进行一个`fs.read()`就会导致数据错乱
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

由于**在注册`data`事件监听器后，Readable Stream 立刻执行`_read()`尝试从底层读取数据**，而此时我们的异步打开文件的操作可能还没有执行回调，还没有获得文件操作句柄`this._fd`，所以程序报错了。

我们可以尝试使用一个`this._ready`标记来表示是否准备就绪，在`_read(size)`方法内首先判断如果`this._ready = true`才正在调用`fs.read()`读取文件。由于改动的位置较多，以下直接贴出完整的代码：

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
    // stats.size即为文件末尾的位置
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
      // 定位完成后开始监听文件变化和尝试读取数据
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


## 停止

上文我们实现的`TailStream`一旦开始就会源源不断地读取文件新增的内容，有时候就像没了脚刹的汽车，一旦加了油飙了车就根本停不下来了，想想还是很危险的。所以，接下来我们实现一个`close()`方法，这样就可以在合适的时候停车了：

```javascript
// 关闭
close() {
  // 关闭文件watcher
  this._watcher.close();
  // 关闭文件操作句柄
  fs.close(this._fd, err => {
    if (err) return this.emit('error', err);
    // 结束stream
    this.push(null);
  });
}
```


## 暂停

当文章读到这里的时候，你会想，现在已经完美地实现`TailStream`了吧？毕竟该有的功能都有了。可是，既然我们有了`close()`用来停止监听，为什么不能有一个暂停功能呢？

熟悉`Stream`的同学都知道，`readable.pause()`和`readable.resume()`这两个方法就可以用来暂停和继续，实际上，上文的代码不经任何修改也可以在各种使用`pause()`和`resume()`良好地工作。

在经过详细阅读 Node.js 相关的API文档之后，我们发现这三个概念：

+ [缓冲](https://nodejs.org/api/stream.html#stream_buffering)
+ [Readable Stream 的两种模式](https://nodejs.org/api/stream.html#stream_two_modes)
+ [Readable Stream 的三种状态](https://nodejs.org/api/stream.html#stream_three_states)

从文档得知，`Readable Stream`有两种模式：流动（**flowing**）和暂停（**paused**）。初始状态下，`readable._readableState.flowing = null`，此时流处于暂停状态，并不会主动调用`readable._read(size)`来请求读取数据。

当执行以下操作时才切换到流动（**flowing**）状态：

+ 添加了一个`data`事件的监听器
+ 执行了`readable.resume()`
+ 执行了`readable.pipe()`

如果执行了以上的任一操作，此时`readable._readableState.flowing = true`，流开始尝试调用`readable._read(size)`从底层资源中读取数据，并通过触发`data`事件消费这些数据，或者将其`pipe`到另一个流中。

当使用`readable.pause()`暂停之后，此时`readable._readableState.flowing = false`，如果我们还继续使用`readable.push()`来推送数据，数据实际上是被存储到缓冲区`readable._readableState.buffer`里面。当程序执行`readable.resume()`后，此时`readable._readableState.flowing = true`才会继续消费缓冲区内的数据。

在暂停状态下，我们也可以通过`readable.read()`去手动消费数据。

好了，我们现在来说说上文的程序存在的问题。在`_read()`里面，我们已经可以通过一个`this._ready`标记来判断流是否处于就绪状态从而决定是否要从文件中读取数据，而在暂停的情况下`Readable Stream`也不会胡乱调用`_read()`请求读取数据。

当文件内容改变时，会执行`_tryRead()`，在这个方法里面我们主动去调用`_read()`请求读取数据了。假如此时流正处于暂停状态，我们**读取资源的操作还是不会被暂停，数据仍然会不停地推送到缓冲区，尽管从外表上看流还是处于暂停状态**。

所以我们还要做的修改是，在调用`_read()`之前先判断一下`this._readableState.flowing`的状态：

```javascript
// 尝试读取数据
_tryRead() {
  if (this._readableState.flowing) {
    // 仅当flowing=true时才读取数据
    this._read(this._getHighWaterMark());
  }
}
```


## 日志文件处理

前面铺垫了那么多，终于要说到日志文件处理了。一般情况下，日志都是按行存储到文件里面的，在本文的例子中，我们要监听一个日志文件，把它新增的日志内容按行读取出来，简单处理之后实时地打印到屏幕上。

假如每一行都是一个JSON字符串，我们借助`lei-stream`模块编写一个用于模拟生成日志的程序`make_logs.js`：

```javascript
'use strict';

const os = require('os');
const writeLine = require('lei-stream').writeLine;

// 创建写日志文件流
const s = writeLine('test.log', {encoding: 'json'});

// 模拟日志输出
function nextLog() {
  s.write({
    time: new Date(),
    loadavg: os.loadavg(),
    memoryUsage: process.memoryUsage(),
  });
}
setInterval(nextLog, 1000);
```

在执行程序之前，我们还要安装`lei-stream`模块：

```bash
$ npm install lei-stream
```

然后执行程序：

```bash
$ node make_logs
```

此时程序已经在给我们生成日志了。现在开始编写处理日志的程序`watch_logs.js`：

```javascript
'use strict';

const readLine = require('lei-stream').readLine;
const TailStream = require('./tail_stream');

// 创建按行读取日志文件流
const s = readLine(new TailStream({
  file: 'test.log',  // 日志文件名
  position: 'end',   // 定位到尾部
}), {
  encoding: 'json',  // 使用JSON编码
  autoNext: false,   // 不自动读下一行
});

s.on('data', data => {
  // 将日志打印到屏幕
  console.log(data);
  // 处理完后调用next()继续读取下一行
  s.next();
});
```

执行以下命令启动日志监听程序：

```bash
$ node watch_logs
```

稍等几秒，应该会看到屏幕不断地打印出这样的信息出来：

```
{ time: '2016-07-24T02:18:11.325Z',
  loadavg: [ 2.31494140625, 2.4052734375, 2.19775390625 ],
  memoryUsage: { rss: 22818816, heapTotal: 8384512, heapUsed: 5224824 } }
{ time: '2016-07-24T02:18:12.331Z',
  loadavg: [ 2.31494140625, 2.4052734375, 2.19775390625 ],
  memoryUsage: { rss: 22818816, heapTotal: 8384512, heapUsed: 5226688 } }
```

**注意：在这个实例中，我们是直接定位到日志文件末尾开始，在新增日志数据量较大的情况下，有可能定位到的位置是在一行日志数据的中间部分，也就是说可能出现读取出来的第一条日志是不完整的（只有后半部分），因此要根据实际情况做相应的容错处理。**


## 谁更机智

当我编写完文章[《如何实时监听文件的新增内容：一个简单 tailf 命令的实现》](http://morning.work/page/2016-07/how-to-implement-a-tail-f-command-in-nodejs.html)之后，机智的小伙伴指出，要完成这样的功能最简单的方法是用`child_process`，我想象出来的代码应该是这样的：

```javascript
'use strict';

const stream = require('stream');
const child_process = require('child_process');

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
    // 执行tail命令
    this._process = child_process.spawn('tail', ['-c', '0', '-f', options.file], {
      cwd: __dirname,
    });
    this._process.on('error', err => this.emit('error', err));
    // 将收到的数据推送到缓冲区
    this._process.stdout.on('data', data => {
      this.push(data);
    });
    // 如果进程执行结束则关闭流
    this._process.on('exit', () => {
      this.push(null);
    });
  }

  // 读取数据
  _read(size) {
    // 不需要做任何事情
  }

  // 关闭
  close() {
    this._process.kill();
  }

}

module.exports = TailStream;
```

说明：

+ 使用`child_process.spawn()`来执行`tail`命令监听文件，并将进程的输出作为`TailStream`的数据推送出去
+ 这种实现方式只适用于有`tail`命令的系统，比如 Windows 这种是没有自动该命令的
+ 这种方式看起来简单，但是程序执行的开销会比完全使用 Node.js 来实现要大


## 总结

本文首先实现了一个简单的`TailStream`来监听文件的新增内容，另外针对可能存在的问题给出了相应的解决方案，最后结合`lei-stream`实现了一个处理日志文件的例子。对于实现一个`Readable Stream`而言，简单地实现一个`_read(size)`方法即可，但是为了让这个`Stream`表现的更好，我们可能还有根据各自不同的场景去做一些处理。

**实现一个`Readable Stream`的重要意义是，通过这些已被大家熟知的标准来让不同系统模块之间的协作变得更简单，而不是实现各自五花八门的接口。**


## 相关链接

+ [Node.js Stream - 基础篇](http://tech.meituan.com/stream-basics.html)
+ [Stream - Node.js API](https://nodejs.org/api/stream.html)
+ [如何实时监听文件的新增内容：一个简单 tailf 命令的实现](http://morning.work/page/2016-07/how-to-implement-a-tail-f-command-in-nodejs.html)
+ [在 Node.js 中读写大文件](http://morning.work/page/2015-07/read_and_write_big_file_in_nodejs.html)
