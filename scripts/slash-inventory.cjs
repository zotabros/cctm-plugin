#!/usr/bin/env node
'use strict';
const { call } = require('./slash-helper.cjs');
(async () => {
  const r = await call('POST', '/inventory/refresh', {}, 30000);
  console.log(JSON.stringify(r.body, null, 2));
})();
