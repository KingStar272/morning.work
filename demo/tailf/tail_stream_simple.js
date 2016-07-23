'use strict';

const fs = require('fs');
const stream = require('stream');

class TailStream extends stream.Readable {

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

  // 监听文件内容变化
  _watchFile() {
    this._watcher = fs.watch(this._file, (event, filename) => {
      if (event === 'change') {
        this._tryRead();
      }
    });
  }

  // 定位到文件尾部
  _goToEnd(callback) {
    fs.fstat(this._fd, (err, stats) => {
      if (err) return this.emit('error', err);
      this._position = stats.size;
      callback();
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




const file = process.argv[2];
const s = new TailStream({file});
// const s = new TailStream({file, position: 'end'});
s.on('data', data => {
  process.stdout.write(data);
});
s.on('readable', () => {
  console.log('readable');
});

// setTimeout(() => {
//   console.log('pause');
//   s.pause();
//   setTimeout(() => {
//     console.log('resume');
//     s.resume();
//   }, 2000);
// }, 2000);