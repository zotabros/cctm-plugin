#!/usr/bin/env node
// Probe worker /healthz; if down, double-fork detached worker. Always exit 0.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const CCTM_DIR = path.join(os.homedir(), '.cctm');
const PORT_FILE = path.join(CCTM_DIR, 'worker.port');
const PID_FILE = path.join(CCTM_DIR, 'worker.pid');
const LOG_FILE = path.join(CCTM_DIR, 'worker.log');
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const WORKER_ENTRY = path.join(PLUGIN_ROOT, 'worker', 'index.mjs');

function ensureDir() {
  try { fs.mkdirSync(CCTM_DIR, { recursive: true }); } catch (_) {}
}

function readPort() {
  if (process.env.CCTM_PORT) return Number(process.env.CCTM_PORT) || 39636;
  try { return Number(fs.readFileSync(PORT_FILE, 'utf8').trim()) || 39636; } catch (_) { return 39636; }
}

function probe(port, cb) {
  const req = http.request({ host: '127.0.0.1', port, path: '/healthz', method: 'GET' }, (res) => {
    res.resume();
    cb(res.statusCode === 200);
  });
  req.setTimeout(300, () => { try { req.destroy(); } catch (_) {} cb(false); });
  req.on('error', () => cb(false));
  req.end();
}

function pidAlive() {
  try {
    const pid = Number(fs.readFileSync(PID_FILE, 'utf8').trim());
    if (!pid) return false;
    process.kill(pid, 0);
    return true;
  } catch (_) { return false; }
}

function spawnWorker() {
  ensureDir();
  let logFd;
  try { logFd = fs.openSync(LOG_FILE, 'a'); } catch (_) { logFd = 'ignore'; }
  const child = spawn(process.execPath, [WORKER_ENTRY], {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, CCTM_PLUGIN_ROOT: PLUGIN_ROOT },
  });
  child.unref();
  try { fs.writeFileSync(PID_FILE, String(child.pid)); } catch (_) {}
}

function waitHealthy(port, deadline, done) {
  probe(port, (ok) => {
    if (ok) return done(true);
    if (Date.now() > deadline) return done(false);
    setTimeout(() => waitHealthy(port, deadline, done), 100);
  });
}

ensureDir();
const port = readPort();
probe(port, (alive) => {
  if (alive) { process.exit(0); return; }
  if (!pidAlive()) spawnWorker();
  waitHealthy(port, Date.now() + 1500, () => process.exit(0));
});
setTimeout(() => process.exit(0), 2000).unref();
