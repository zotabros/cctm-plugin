#!/usr/bin/env node
// Probe worker /healthz; if down, double-fork detached worker. Always exit 0.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn, spawnSync } = require('node:child_process');

const CCTM_DIR = path.join(os.homedir(), '.cctm');
const PORT_FILE = path.join(CCTM_DIR, 'worker.port');
const PID_FILE = path.join(CCTM_DIR, 'worker.pid');
const LOG_FILE = path.join(CCTM_DIR, 'worker.log');
const INSTALL_LOG = path.join(CCTM_DIR, 'install.log');
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const WORKER_ENTRY = path.join(PLUGIN_ROOT, 'worker', 'index.mjs');
const NODE_MODULES = path.join(PLUGIN_ROOT, 'node_modules');
const INSTALL_STAMP = path.join(PLUGIN_ROOT, 'node_modules', '.cctm-install-stamp');

function ensureDeps() {
  // Skip if node_modules + stamp exist (idempotent fast path).
  if (fs.existsSync(INSTALL_STAMP)) return true;
  ensureDir();
  let logFd;
  try { logFd = fs.openSync(INSTALL_LOG, 'a'); } catch (_) { logFd = 'ignore'; }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npm, ['install', '--omit=dev', '--no-audit', '--no-fund', '--silent'], {
    cwd: PLUGIN_ROOT,
    stdio: ['ignore', logFd, logFd],
    env: process.env,
  });
  if (res.status !== 0) return false;
  try { fs.writeFileSync(INSTALL_STAMP, new Date().toISOString()); } catch (_) {}
  return true;
}

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

function readPid() {
  try { return Number(fs.readFileSync(PID_FILE, 'utf8').trim()) || 0; } catch (_) { return 0; }
}

function pidAlive(pid = readPid()) {
  try {
    if (!pid) return false;
    process.kill(pid, 0);
    return true;
  } catch (_) { return false; }
}

function pidCommand(pid) {
  const res = spawnSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' });
  return res.status === 0 ? String(res.stdout || '').trim() : '';
}

function workerMatchesCurrentPlugin() {
  const pid = readPid();
  if (!pidAlive(pid)) return false;
  const cmd = pidCommand(pid);
  if (!cmd.includes(path.join('worker', 'index.mjs'))) return false;
  return cmd.includes(WORKER_ENTRY);
}

function stopPid(pid) {
  if (!pidAlive(pid)) return;
  try { process.kill(pid, 'SIGTERM'); } catch (_) {}
  const deadline = Date.now() + 1500;
  while (pidAlive(pid) && Date.now() < deadline) {}
  if (pidAlive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }
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
let port = readPort();
const pid = readPid();
if (pidAlive(pid) && !workerMatchesCurrentPlugin()) {
  stopPid(pid);
  try { fs.unlinkSync(PID_FILE); } catch (_) {}
  try { fs.unlinkSync(PORT_FILE); } catch (_) {}
  port = readPort();
}
probe(port, (alive) => {
  if (alive && workerMatchesCurrentPlugin()) { process.exit(0); return; }
  if (!pidAlive()) {
    if (!ensureDeps()) { process.exit(0); return; }
    spawnWorker();
  }
  waitHealthy(port, Date.now() + 1500, () => process.exit(0));
});
setTimeout(() => process.exit(0), 5000).unref();
