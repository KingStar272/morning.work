'use strict';

const Redis = require('./');

const client = new Redis();

client._sendCommand('KEYS *')
  .then(ret => console.log('success', ret))
  .catch(err => console.log('error', err))

