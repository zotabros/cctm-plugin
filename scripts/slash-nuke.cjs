#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const CCTM_DIR = path.join(os.homedir(), '.cctm');
(async () => {
  console.log(`Removing ${CCTM_DIR}/cctm.db* — confirmed by invoking /cctm:nuke.`);
  for (const f of ['cctm.db', 'cctm.db-shm', 'cctm.db-wal']) {
    try { fs.unlinkSync(path.join(CCTM_DIR, f)); console.log(`  removed ${f}`); } catch (_) {}
  }
  // Best-effort kill worker so it respawns next SessionStart.
  try {
    const pid = Number(fs.readFileSync(path.join(CCTM_DIR, 'worker.pid'), 'utf8').trim());
    if (pid) process.kill(pid, 'SIGTERM');
  } catch (_) {}
  console.log('Done. Next SessionStart will re-init the database.');
})();
