'use strict';

const Redis = require('./');

const client = new Redis();

client.get('a', console.log);

client.setex('a 123 456')
  .then(ret => console.log('success', ret))
  .catch(err => console.log('error', err))
  .then(() => client.end())

