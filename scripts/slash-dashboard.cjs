#!/usr/bin/env node
'use strict';
const { call } = require('./slash-helper.cjs');
const { execFileSync, exec } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
(async () => {
  console.log('Starting CCTM dashboard...');
  try { execFileSync(process.execPath, [path.join(__dirname, 'ensure-worker.cjs')], { stdio: 'ignore' }); } catch (_) {}
  const r = await call('POST', '/webapp/start', {}, 10 * 60 * 1000);
  if (r.status !== 200 || r.body?.ok === false) {
    console.log(JSON.stringify(r.body, null, 2));
    process.exit(0);
  }
  const url = `http://localhost:${r.body.port}`;
  console.log(`Dashboard: ${url}`);
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
  try { exec(`${opener} "${url}"`); } catch (_) {}
})();
