'use strict';

class RedisProto {

  constructor() {

    this._lines = []; // 已初步解析出来的行
    this._text = '';  // 剩余不能构成一行的文本

  }

  push(text) {

    const lines = (this._text + text).split('\r\n');
    this._text = lines.pop();
    this._lines = this._lines.concat(lines);

  }

  next() {

    const lines = this._lines;
    const first = lines[0];

    const popResult = (lineNumber, result) => {
      this._lines = this._lines.slice(lineNumber);
      return this.result = result;
    };

    const popEmpty = () => {
      return this.result = false;
    };

    if (lines.length < 1) return popEmpty();

    switch (first[0]) {

      case '+':
        return popResult(1, {data: first.slice(1)});

      case '-':
        return popResult(1, {error: first.slice(1)});

      case ':':
        return popResult(1, {data: Number(first.slice(1))});

      case '$': {
        const n = Number(first.slice(1));
        if (n === -1) {
          return popResult(1, {data: null});
        } else {
          const second = lines[1];
          if (typeof second !== 'undefined') {
            return popResult(2, {data: second});
          } else {
            return popEmpty();
          }
        }
      }

      case '*': {
        const n = Number(first.slice(1));
        if (n === 0) {
          return popResult(1, {data: []});
        } else {
          const array = [];
          let i = 1;
          for (; i < lines.length && array.length < n; i++) {
            const a = lines[i];
            const b = lines[i + 1];
            if (a.slice(0, 3) === '$-1') {
              array.push(null);
            } else if (a[0] === ':') {
              array.push(Number(a.slice(1)));
            } else {
              if (typeof b !== 'undefined') {
                array.push(b);
                i++;
              } else {
                return popEmpty();
              }
            }
          }
          if (array.length === n) {
            return popResult(i, {data: array});
          } else {
            return popEmpty();
          }
        }
      }

      default:
        return popEmpty();

    }

  }

}


module.exports = RedisProto;

/*
const proto = new RedisProto();

// 接受到数据
proto.push('$6\r\n123456\r\n');
proto.push('*3\r\n$3\r\nabc\r\n$3\r\naa1\r\n$1\r\na\r\n');
proto.push('-ERR unknown command \'help\'\r\n');
proto.push('+OK\r\n');
proto.push(':5\r\n');
proto.push('*3\r\n$5\r\nhe');
proto.push('llo\r\n$-');
proto.push('1\r\n$5\r\nworld\r\n');

while (proto.next()) {
  // proto.next() 如果有解析出完整的结果则返回结果，没有则返回false
  // 另外可以通过 proto.result 获得
  console.log(proto.result);
}
*/
