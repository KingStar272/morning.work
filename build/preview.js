/**
 * preview morning.work
 *
 * @author Zongmin Lei <leizongmin@gmail.com>
 */

import path from 'path';
import fs from 'fs';
import express from 'express';
import serveStatic from 'serve-static';
import open from 'open';
import {readFile, renderPost, renderPostList, renderFeed} from './index';

let app = express();
app.get('/', (req, res, next) => {
  renderPostList(false, next);
});
app.get('/rss.xml', (req, res, next) => {
  renderFeed(false, next);
});
app.get('/page/*.html', (req, res, next) => {
  let f = path.resolve(__dirname, `../source/${req.params[0]}.md`);
  renderPost(Object.assign({ is_preview: true }, readFile(f)), next);
});

app.use('/', serveStatic(path.resolve(__dirname, '..')));

app.listen(8000, err => {
  if (err) throw err;
  console.log('server started');
  open('http://127.0.0.1:8000');
});
