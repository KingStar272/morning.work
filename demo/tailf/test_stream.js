'use strict';

const fs = require('fs');
const stream = require('stream');

class TestStream extends stream.Readable {

  _read(size) {
    // console.log('_read', size);
  }

}

const s = new TestStream();
setInterval(() => {
  s.push(new Date().toString());
}, 500);

