#!/usr/bin/env node
'use strict';
const { call } = require('./slash-helper.cjs');
(async () => {
  const r = await call('POST', '/backfill', {}, 120000);
  console.log(JSON.stringify(r.body, null, 2));
})();
