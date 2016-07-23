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


## 不仅仅是个玩具




## 相关链接

+ [Node.js Stream - 基础篇](http://tech.meituan.com/stream-basics.html)

