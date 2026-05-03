#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { call } = require('./slash-helper.cjs');

const CCTM_DIR = path.join(os.homedir(), '.cctm');

(async () => {
  console.log('Stopping CCTM dashboard...');
  await call('POST', '/webapp/stop', {}, 1500);
  await new Promise((resolve) => setTimeout(resolve, 250));

  console.log(`Removing ${CCTM_DIR}/cctm.db* — confirmed by invoking /cctm:nuke.`);
  for (const f of ['cctm.db', 'cctm.db-shm', 'cctm.db-wal']) {
    try { fs.unlinkSync(path.join(CCTM_DIR, f)); console.log(`  removed ${f}`); } catch (_) {}
  }
  try {
    const pid = Number(fs.readFileSync(path.join(CCTM_DIR, 'worker.pid'), 'utf8').trim());
    if (pid) process.kill(pid, 'SIGTERM');
  } catch (_) {}
  console.log('Done. Dashboard stopped; next SessionStart will re-init the database.');
})();
