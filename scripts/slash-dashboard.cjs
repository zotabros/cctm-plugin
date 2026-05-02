#!/usr/bin/env node
'use strict';
const { call } = require('./slash-helper.cjs');
const { exec } = require('node:child_process');
const os = require('node:os');
(async () => {
  console.log('Starting CCTM dashboard...');
  const r = await call('POST', '/webapp/start', {}, 15000);
  if (r.status !== 200 || r.body?.ok === false) {
    console.log(JSON.stringify(r.body, null, 2));
    process.exit(0);
  }
  const url = `http://localhost:${r.body.port}`;
  console.log(`Dashboard: ${url}`);
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try { exec(`${opener} "${url}"`); } catch (_) {}
})();
