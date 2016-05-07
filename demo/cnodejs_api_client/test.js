'use strict';

const CNodeJS = require('./');

const client = new CNodeJS({token: '4d45561f-304b-41fc-87bc-7d507d0e5904'});

/*
client.request('GET', 'topics', {page: 1})
  .then(ret => console.log(ret))
  .catch(err => console.error(err));
*/
/*
client.request('GET', 'topics', {page: 1}, (err, ret) => {
  if (err) {
    console.error(err);
  } else {
    console.log(ret);
  }
});
*/

client.getTopicDetail({id: '5433d5e4e737cbe96dcef312'})
  .then(ret => console.log(ret))
  .catch(err => console.error(err));
