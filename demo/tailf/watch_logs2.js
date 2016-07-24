'use strict';

const readLine = require('lei-stream').readLine;
const TailStream = require('./tail_stream2');

// 创建按行读取日志文件流
const s = readLine(new TailStream({file: 'test.log'}), {
  encoding: 'json',  // 使用JSON编码
  autoNext: false,   // 不自动读下一行
});

s.on('data', data => {
  // 将日志打印到屏幕
  console.log(data);
  // 处理完后调用next()继续读取下一行
  s.next();
});

setTimeout(() => {
  s.close();
}, 10000);