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
