```
date: 2015-10-31
title: Node.js定制REPL的妙用
author: 老雷
```


相信在学习Node.js的时候，对Node.js的REPL并不陌生。我们可以在REPL里面输入JavaScript代码并立刻看到效果，常常用来试用一些新的模块，甚至直接把REPL当计算器来用。

最近在修改以前使用Node.js写的[中文分词模块](https://github.com/leizongmin/node-segment)时，想要看到代码修改后的效果，但是又不方便马上写测试代码，自然想到使用REPL来测试。比如执行以下命令启动Node.js的REPL界面：

```bash
$ node
```

然后在控制台界面中输入要测试的代码（其中`> `开头的行是手工输入并按回车的代码，其他部分为REPL的输出结果）：

```
> var Segment = require('./')
undefined
> var s = new Segment()
undefined
> s.useDefault(); 1
1
> s.doSegment('神奇的REPL')
[ { w: '神奇的', p: 1073741824 }, { w: 'REPL', p: 16 } ]
>
```

但当我修改了模块的代码后，要看效果时又要重复输入上面的代码，这种**做重复无意义工作的行为绝非是一名有理想的程序员想要的**。于是，我决定自己**定制一个REPL**，这样就可以预先执行一些初始化代码，一启动程序就可以进入主题了。

看了一下[REPL模块的文档](https://nodejs.org/api/repl.html)之后，大概搞清了怎么个用法，接下来开始写代码了。

首先在项目的根目录下新建名为`repl`的文件，代码如下：

```javascript
#!/usr/bin/env node

var repl = require('repl');

// 创建一个REPL
var r = repl.start('> ');
// context即为REPL中的上下文环境
var c = r.context;

// 测试用的初始化代码
// 在REPL中可以通过Segment和segment来访问以下两个变量
c.Segment = require('./');
c.segment = new c.Segment();
c.segment.useDefault();

// 精简函数名，方便手工输入，在REPL中可以通过s来访问此函数
c.s = function () {
  return c.segment.doSegment.apply(c.segment, arguments);
};
```

文件第一行的`#!/usr/bin/env node`表示这是一个脚本文件，使用`node`命令来执行它，所以还要给这个文件加上可执行权限：

```bash
$ chmod +x repl
```

现在就可以试试这个定制的REPL了：

```
$ ./repl
> s('神奇的REPL')
[ { w: '神奇的', p: 1073741824 }, { w: 'REPL', p: 16 } ]
>
```

之后每次更改了代码，只要按两下`CTRL+C`来退出当前REPL，再执行`./repl`来启动程序，然后输入`s('神奇的REPL')`就可以看到分词的效果了，如果要执行其他函数，也可以直接操作`segment`变量来做。

**但是，一名有理想的程序员绝不会满足于此的。**

当我修改了模块代码，为什么要重启REPL呢，难道不能重新加载一次这个模块，然后该干嘛还干嘛？

从[Node.js的模块系统文档](https://nodejs.org/api/modules.html#modules_caching)可知，在使用`require()`来加载模块后，相关的文件内容会被缓存到`require.cache[filename]`中，当再次`require()`此文件的时候并不会重新加载。所以要想在不重启进程的情况下重新加载模块，我们就要清理这个模块相关的所有缓存。

把`repl`文件改成以下代码：

```javascript
#!/usr/bin/env node

var fs = require('fs');
var path = require('path');
var repl = require('repl');


var r = repl.start('> ');
var c = r.context;

// 原来的初始化代码放到此函数内
c._load = function () {
  c.Segment = require('./');
  c.segment = new c.Segment();
  c.segment.useDefault();
  c.s = function () {
    return c.segment.doSegment.apply(c.segment, arguments);
  };
};

// 在REPL中执行reload()可重新加载模块
c.reload = function () {
  var t = Date.now();

  // 清空当前项目根目录下所有文件的缓存
  var dir = path.resolve(__dirname) + path.sep;
  for (var i in require.cache) {
    if (i.indexOf(dir) === 0) {
      delete require.cache[i];
    }
  }

  // 重新执行初始化
  c._load();
  console.log('OK. (spent %sms)', Date.now() - t);
}

c._load();
```

好了，在修改了模块的代码后，只要在REPL中执行`reload()`函数就能重新载入最新的代码了：

```
> reload()
OK. (spent 458ms)
undefined
> s('神奇的REPL')
[ { w: '神奇的', p: 1073741824 }, { w: 'REPL', p: 16 } ]
>
```


## 总结

本文所介绍的定制REPL的方法并不高深，如果在合适的场景中使用，却也能省不少事情。我目前能想到的应用场景有以下几个：

+ 开发时需要在交互界面下查看测试结果
+ 在演示代码时不需要录入一系列初始化代码而快速进入演示环境
+ 开发基于Node.js的Shell程序


## 相关链接

+ [Node.js之REPL](http://segmentfault.com/a/1190000002673137)
+ [Build Your Own App Specific REPL For Your NodeJS App](http://derickbailey.com/2014/07/02/build-your-own-app-specific-repl-for-your-nodejs-app/)
+ [Node.js命令行程序开发教程](http://www.ruanyifeng.com/blog/2015/05/command-line-with-node.html)
+ [Node.js里的REPL](https://cnodejs.org/topic/55c2ba865965fe2c74f478ac)

