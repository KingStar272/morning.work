```
title: Node.js 的 Readable Stream 与日志文件处理
date: 2016-07-23
author: 老雷
draft
```

> 在上一篇文章[《如何实时监听文件的新增内容：一个简单 tailf 命令的实现》](http://morning.work/page/2016-07/how-to-implement-a-tail-f-command-in-nodejs.html)里面，我们已经实现了一个`tailf`函数用来监听文件的新增内容，看起来它也工作良好。然而当我想把它应用到手头正要做的日志文件处理时，却发现这样一个**非标准的接口很难与之前编写的模块愉快地合作**。
>
> 我在去年的文章[《在 Node.js 中读写大文件》](http://morning.work/page/2015-07/read_and_write_big_file_in_nodejs.html)中实现了一个`readLine(stream)`函数，其接收的参数是一个`Readable Stream`对象，能按照给定的规则（比如使用`\n`换行）来`emit`出每一行的内容，再结合`tailf`来监听文件的新增内容，我们就可以很轻易地对新增的内容进行按行切分。
>
> 所以，我们要实现一个实现了`Readable Stream`接口的`tailf`，在本文中我给它起了个名字叫`TailStream`。




## 相关链接

