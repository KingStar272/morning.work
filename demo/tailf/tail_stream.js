'use strict';

const fs = require('fs');
const path = require('path');
const stream = require('stream');

class TailStream extends stream.Readable {

  /**
   * TailStream
   *
   * @param {Object} options
   *   - {String} file 文件名
   *   - {Number|String} position 位置，如果为"end"表示直接定位到文件末尾
   */
  constructor(options) {
    options = options || {};
    // 调用基类的构造函数
    super(options);
    // 文件名
    this._file = options.file;
    // 开始位置，默认为文件头
    this._position = options.position || 0;
    // 仅当_ready=true才开始读取内容
    this._ready = false;
    // 需要读取的字节数量，当_ready=true时开始读取
    this._needBytes = 0;
    // 开始打开文件
    this._openFile();
  }

  // 打开文件
  _openFile() {
    fs.open(this._file, 'r', (err, fd) => {
      if (err) {
        this.emit('error', err);
      } else {
        this._fd = fd;
        this._ready = true;
        this._watchFile();
      }
    });
  }

  // 监听文件内容变化
  _watchFile() {
    this._watcher = fs.watch(this._file, (event, filename) => {
      if (event === 'change') {
        console.log(event, filename);
        this._tryRead();
      }
    });
  }

  // 如果是合适的时机则读取数据
  _tryRead() {
    if (this._needBytes > 0)
  }

  // 获取每次合适的读取字节数
  _getHighWaterMark() {
    return this._readableState.highWaterMark;
  }

  // 读取数据
  _read(size) {
    console.log('_read', size);
    // 在读取之前需要判断是否ready，避免数据错乱
    if (this._ready) {
      this._ready = false;
      fs.read(this._fd, new Buffer(size), 0, size, this._position,
      (err, bytesRead, buf) => {
        if (err) return this.emit('error', err);
        this._ready = true;
        if (bytesRead > 0) {
          // 将数据推送到队列
          this._position += bytesRead;
          this.push(buf.slice(0, bytesRead));
        }
      });
    } else {
      this._needBytes = size;
    }
  }

}





const file = process.argv[2];
const s = new TailStream({file});
s.on('data', data => {
  process.stdout.write(data);
});

