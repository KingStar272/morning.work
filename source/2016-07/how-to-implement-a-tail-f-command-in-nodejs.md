```
title: 如何实时监听文件的新增内容：一个简单 tailf 命令的实现
date: 2016-07-23
author: 老雷
```

> 在 Linux/Uinx 系统上，有一个`tail`命令，它可以用来显示一个文件尾部的内容，比如执行`tail large_file.txt`仅仅显示该文件最后的 10 行内容（通过`-n`参数可以指定显示的行数）。
>
> `tail`命令还有一个`-f`选项，可以监听文件内容的变化，当有新增的内容时会继续打印到屏幕上，因此在处理日志文件时常常会使用到它来跟踪文件变化。

前段时间在研究 Node.js 上的日志文件的处理时，偶然得知`tail -f`命令（下文简称`tailf`）的用法，因此十分好奇，**Node.js 的 fs 模块是否有一种 API 可以实时监听文件内容的变化，并可以从中不断地读出新增的内容？**，当然答案是否定的。后来经过网上查找资料，发现其实原理很简单，无非是不断地尝试`read()`文件的内容，如果能读取到就输出，仅此而已。

首先从网上找到一段[使用 Java 实现 tail -f 的代码](http://stackoverflow.com/questions/557844/java-io-implementation-of-unix-linux-tail-f?answertab=active#tab-top)：

```java
BufferedReader br = new BufferedReader(...);
String line;
while (keepReading) {
    line = reader.readLine();
    if (line == null) {
        //wait until there is more of the file for us to read
        Thread.sleep(1000);
    }
    else {
        //do something interesting with the line
    }
}
```

从上面的程序逻辑可以看出，在`while`循环里面，不断地尝试`readLine()`来读取一行内容，如果读取成功就继续，不成功则先`sleep(1000)`等待 1 秒钟。

## 实现一个简单的 tailf

因此我们可以使用以下 Node.js 代码实现相似的功能：

```javascript
'use strict';

const fs = require('fs');

/**
 * tailf
 *
 * @param {String} filename 文件名
 * @param {Number} delay 读取不到内容时等待的时间，ms
 */
function tailf(filename, delay) {

  // 每次读取文件块大小，16K
  const CHUNK_SIZE = 16 * 1024;
  // 打开文件，获取文件句柄
  const fd = fs.openSync(filename, 'r');
  // 文件开始位置
  let position = 0;
  // 循环读取
  const loop = () => {

    const buf = new Buffer(CHUNK_SIZE);
    const bytesRead = fs.readSync(fd, buf, 0, CHUNK_SIZE, position);
    // 实际读取的内容长度以bytesRead为准，并且更新position位置
    position += bytesRead;
    process.stdout.write(buf.slice(0, bytesRead));

    if (bytesRead < CHUNK_SIZE) {
      // 如果当前已到达文件末尾，则先等待一段时间再继续
      setTimeout(loop, delay);
    } else {
      loop();
    }
  };
  loop();
}
```

说明：

+ 首先使用`fs.openSync()`来打开文件，得到文件句柄之后，再通过`fs.readSync()`读取文件内容
+ 由于 Node.js 中并没有阻塞的`sleep()`方法，我们只能使用`setTimeout()`来模拟，不能直接使用`while`死循环，否则程序会占满整个 CPU 资源

将以上的代码保存为文件`tailf.js`，并且在文件末尾增加以下代码：

```javascript
const filename = process.argv[2];
if (filename) {
  tailf(filename, 100);
} else {
  console.log('使用方法： node tailf <文件名>');
}
```

现在我们来测试一下。首先执行以下命令新建一个日志文件：

```bash
$ echo "hello" > test.log
```

然后再开始监听文件的变化：

```bash
$ node tailf test.log
```

执行以上命令后，可以看到屏幕上打印出内容`hello`，但是程序还没有结束。再尝试在另一个控制台窗口下执行以下命令：

```bash
$ echo "$(date) hello, world" >> test.log
```

如果能看到`tailf`屏幕上打印出`Sat Jul 23 01:46:05 CST 2016 hello, world`这样的内容，说明我们实现的这个`tailf`命令已经基本上能用了。我们也不妨多执行几次上面的命令，还可以把`hello, world`改成其他的内容，好好感受一下，有木有一股很强的成就感迎面吹来呢……


## 从文件末尾开始

上面的程序有一个小问题：每次执行`tailf`时都会先从头读取一遍文件，然后才开始监听，假如我们是用来处理很大的日志文件，每次都重头读取一遍似乎不太好，也对不起`tail`这个单词。所以呢，我们机智地修改一行代码解决它吧：

```javascript
// 文件开始位置
let position = fs.fstatSync(fd).size;
```

说明：通过`fs.fstatSync()`读取文件的属性，然后得到当前文件的尺寸，直接把`position`设置到文件最末尾就行啦。


## 使用异步方法

为了使得程序简单清晰，上文的程序用的都是`Sync`后缀的方法，这在只处理一个任务的`tailf`命令是最简单直接的。假如我们要实现一个`tailf`函数，将它嵌入到我们编写的项目里面处理多个监听文件内容的任务，那就得使用非阻塞的方法来操作文件了：

```javascript
'use strict';

const fs = require('fs');

/**
 * tailf
 *
 * @param {String} filename 文件名
 * @param {Number} delay 读取不到内容时等待的时间，ms
 * @param {Function} onError 操作出错时的回调函数，onError(err)
 * @param {Function} onData 读取到文件内容时的回调函数，onData(data)
 */
function tailf(filename, delay, onError, onData) {

  // 每次读取文件块大小，16K
  const CHUNK_SIZE = 16 * 1024;
  // 打开文件，获取文件句柄
  fs.open(filename, 'r', (err, fd) => {
    if (err) return onError(err);

    // 文件开始位置
    fs.fstat(fd, (err, stats) => {
      if (err) return onError(err);

      // 文件开始位置
      let position = stats.size;
      // 循环读取
      const loop = () => {

        const buf = new Buffer(CHUNK_SIZE);
        fs.read(fd, buf, 0, CHUNK_SIZE, position,
        (err, bytesRead, buf) => {
          if (err) return onError(err);

          // 实际读取的内容长度以bytesRead为准
          // 并且更新position位置
          position += bytesRead;
          onData(buf.slice(0, bytesRead));

          if (bytesRead < CHUNK_SIZE) {
            // 如果当前已到达文件末尾，则先等待一段时间再继续
            setTimeout(loop, delay);
          } else {
            loop();
          }
        });
      };
      loop();
    });
  });
}
```

说明：

+ 所以操作文件的方法去掉`Sync`后缀，改用回调函数获取结果
+ `tailf`新增了两个参数`onError`和`onData`，分别用来回调操作时发生错误和检测到文件内容更新，其中`onData`会被执行多次

现在可以这样使用`tailf()`：

```javascript
const filename = process.argv[2];
if (filename) {
  tailf(filename, 100, err => {
    if (err) console.error(err);
  }, data => {
    process.stdout.write(data);
  });
} else {
  console.log('使用方法： node tailf <文件名>');
}
```

测试方法还是跟上文的一样，当然这么简单的场景根本看不出区别啦。


## 更好的性能？

在本文初稿完成后，很多机智的读者指出，Linux 的`tailf`是使用`inotify`来实现的，以下文字是摘自[百度百科关于 Inotify 的介绍](http://baike.baidu.com/view/2645027.htm)：

> Inotify 是一个 Linux 内核特性，它监控文件系统，并且及时向专门的应用程序发出相关的事件警告，比如删除、读、写和卸载操作等。您还可以跟踪活动的源头和目标等细节。
>
> 使用 inotify 很简单：创建一个文件描述符，附加一个或多个监视器（一个监视器 是一个路径和一组事件），然后使用 read 方法从描述符获取事件。read 并不会用光整个周期，它在事件发生之前是被阻塞的。
>
> 更好的是，因为 inotify 通过传统的文件描述符工作，您可以利用传统的 select 系统调用来被动地监控监视器和许多其他输入源。两种方法 — 阻塞文件描述符和使用 select— 都避免了繁忙轮询。

简而言之，在本文实现的例子中，我们可以借助 Inotify 来监听文件的变化，如果文件内容有改变就立即尝试取读取，从而避免通过`setTimeout(loop, delay)`来轮询，这样看起来会更高效一些吧。

在 NPM 上有有一个 [inotify 模块](https://www.npmjs.com/package/inotify)，其简介为**inotify bindings for v8 javascript engine**，由此可以确定这正式我们需要的一个模块。

但当尝试在我的 Mac 上安装此模块时并未成功，有出错信息判断应该是这个模块并不兼容 Mac 系统：

```
npm ERR! notsup Not compatible with your operating system or architecture: inotify@1.4.1
npm ERR! notsup Valid OS:    linux
npm ERR! notsup Valid Arch:  any
npm ERR! notsup Actual OS:   darwin
npm ERR! notsup Actual Arch: x64
```

所幸的是 Node.js API 提供了`fs.watch(filename[, options][, listener])`可以让我们监听文件的变化，因此我们可以使用它来代替轮询实现更高效率的监听读取。

基于上文异步版本的`tailf()`，我们可以将`loop()`函数改成这样：

```javascript
const loop = () => {

  const buf = new Buffer(CHUNK_SIZE);
  fs.read(fd, buf, 0, CHUNK_SIZE, position,
  (err, bytesRead, buf) => {
    if (err) return onError(err);

    // 实际读取的内容长度以bytesRead为准，并且更新position位置
    position += bytesRead;
    onData(buf.slice(0, bytesRead));

    if (bytesRead < CHUNK_SIZE) {
      // 如果当前已到达文件末尾，则等待change事件再尝试读取
    } else {
      loop();
    }
  });
};
loop();

// 监听文件变化，如果收到change事件则尝试读取文件内容
fs.watch(filename, (event, filename) => {
  if (event === 'change') {
    loop();
  }
});
```

说明：

+ 去掉了读取到文件末尾后的`setTimeout(loop, delay)`
+ 增加`fs.watch()`来监听文件的变化，如果发现有`change`事件则调用`loop()`尝试读取文件

再重新按照上文的方法来测试时，发现新的程序在我的 Mac 系统上也能工作良好。


## 小结

在文章前半部分，我们使用最简单的轮询方法实现了`tailf`，但是在效率上可能并不能满足我们对效率的要求。此时我们可以尝试使用一些系统 API 来监听到文件被修改的事件，从而代替低效的轮询。但是使用这些高级的 API 可能在不同的操作系统上得不到完整的支持，当然使用 Node.js 内置的 API 应该是兼容性最好的，本文的例子并没有在 Windows 上运行测试过。


## 相关链接

+ [Java IO implementation of unix/linux “tail -f”](http://stackoverflow.com/questions/557844/java-io-implementation-of-unix-linux-tail-f)
+ [How to implement a pythonic equivalent of tail -F?](http://stackoverflow.com/questions/1703640/how-to-implement-a-pythonic-equivalent-of-tail-f)
+ [我使用过的Linux命令之tailf - 跟踪日志文件/更好的tail -f版本](http://codingstandards.iteye.com/blog/832760)
+ [inotify API - Linux man page](http://linux.die.net/man/7/inotify)
+ [Inotify: 高效、实时的Linux文件系统事件监控框架](http://www.infoq.com/cn/articles/inotify-linux-file-system-event-monitoring/)
