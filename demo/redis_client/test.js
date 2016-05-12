'use strict';

const Redis = require('./');

const client = new Redis();

client.get('a', (err, ret) => {
  console.log('a=%s, err=%s', ret, err);
});

client.get('b', (err, ret) => {
  console.log('b=%s, err=%s', ret, err);
});

client.set('a', Date.now())
  .then(ret => console.log('success', ret))
  .catch(err => console.log('error', err))
  .then(() => client.end())
