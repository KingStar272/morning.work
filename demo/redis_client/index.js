'use strict';

/**
 * 简单Redis客户端
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

const events = require('events');
const net = require('net');
const debug = require('debug')('redis');
const parseResult = require('./parser');

class Redis extends events.EventEmitter {

  constructor(options) {
    super();

    options = options || {};
    options.host = options.host || '127.0.0.1';
    options.port = options.port || 6379;

    this.options = options;

    this._isClosed = false;
    this._isConnected = false;
    this._buffer = '';
    this._pendingCommands = [];
    this._callbacks = [];

    this.connection = net.createConnection(options.port, options.host, () => {
      debug('connect event');
      this._isConnected = true;
      this.emit('connect');
      this._sendPendingCommands();
    });

    this.connection.on('error', err => {
      debug('error event: %s', err);
      this.emit('error', err);
    });

    this.connection.on('close', () => {
      debug('close event');
      this._isClosed = true;
      this._callbackAll();
      this.emit('close');
    });

    this.connection.on('end', () => {
      debug('end event');
      this.emit('end');
    });

    this.connection.on('data', data => {
      debug('data event: %s', data);
      this._pushData(data);
    });

  }

  _sendPendingCommands() {

    for (const item of this._pendingCommands) {
      this._sendCommandToServer(item.cmd, item.cb);
    }

    this._pendingCommands = null;

  }

  _sendCommand(cmd, callback) {
    return new Promise((resolve, reject) => {

      const cb = (err, ret) => {
        debug('callback: cmd=%s, err=%s, ret=%j', cmd, err, ret);
        callback && callback(err, ret);
        err ? reject(err) : resolve(ret);
      };

      if (this._isClosed) {
        return reject(new Error('connection has been closed'));
      }

      if (!this._isConnected) {
        this._pendingCommands.push({cmd: cmd, cb: cb})
      } else {
        this._sendCommandToServer(cmd, cb);
      }

    });
  }

  _sendCommandToServer(cmd, cb) {

    this._callbacks.push(cb);

    debug('send command: %s', cmd);
    this.connection.write(`${cmd}\r\n`);

  }

  _pushData(data) {

    this._buffer = this._buffer + data.toString();

    while (true) {

      const result = this._parseResult();
      if (!result) break;

      const cb = this._callbacks.shift();
      if (result.error) {
        cb(new Error(result.error));
      } else {
        cb(null, result.data);
      }

    }

  }

  _parseResult() {

    const result = parseResult(this._buffer);
    if (result) {
      this._buffer = result.rest;
    }

    return result;

  }

  _callbackAll() {

    if (this._pendingCommands) {
      for (const item of this._pendingCommands) {
        item.cb(new Error('connection has been closed'));
      }
    }

    for (const cb of this._callbacks) {
      cb(new Error('connection has been closed'));
    }

  }

  end() {

    debug('end');
    this.connection.destroy();

  }

}

module.exports = Redis;
