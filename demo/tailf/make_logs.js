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
