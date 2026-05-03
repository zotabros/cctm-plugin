#!/usr/bin/env node
'use strict';
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { call } = require('./slash-helper.cjs');
(async () => {
  try { execFileSync(process.execPath, [path.join(__dirname, 'ensure-worker.cjs')], { stdio: 'ignore' }); } catch (_) {}
  const r = await call('POST', '/inventory/refresh', {}, 30000);
  console.log(JSON.stringify(r.body, null, 2));
})();
