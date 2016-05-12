'use strict';

const Redis = require('./simple');
const client = new Redis();

client.get('a', (err, ret) => {
  console.log('a=%s, err=%s', ret, err);

  client.end();

  client.get('b', (err, ret) => {
    console.log('b=%s, err=%s', ret, err);
  });
});
