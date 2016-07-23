'use strict';

const fs = require('fs');

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

        fs.read(fd, new Buffer(CHUNK_SIZE), 0, CHUNK_SIZE, position,
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
    });
  });
}

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

