#!/usr/bin/env node
// Probe worker /healthz; if down or running stale code, double-fork a new
// detached worker. Always exit 0 — this script must never block Claude.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { PLUGIN_VERSION } = require('../shared/version.cjs');

const CCTM_DIR = path.join(os.homedir(), '.cctm');
const PORT_FILE = path.join(CCTM_DIR, 'worker.port');
const PID_FILE = path.join(CCTM_DIR, 'worker.pid');
const STAMP_FILE = path.join(CCTM_DIR, 'worker.stamp');
const LOCK_FILE = path.join(CCTM_DIR, 'ensure.lock');
const LOG_FILE = path.join(CCTM_DIR, 'worker.log');
const INSTALL_LOG = path.join(CCTM_DIR, 'install.log');
const INSTALL_FAIL = path.join(CCTM_DIR, 'install.fail');
const PLUGIN_ROOT = path.resolve(__dirname, '..');
const WORKER_ENTRY = path.join(PLUGIN_ROOT, 'worker', 'index.mjs');
const INSTALL_STAMP = path.join(PLUGIN_ROOT, 'node_modules', '.cctm-install-stamp');

function ensureDir() {
  try { fs.mkdirSync(CCTM_DIR, { recursive: true }); } catch (_) {}
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; }
}

function ensureDeps() {
  if (fs.existsSync(INSTALL_STAMP)) {
    try { fs.unlinkSync(INSTALL_FAIL); } catch (_) {}
    return true;
  }
  ensureDir();

  // Backoff: skip if last failed attempt < 60s ago.
  const fail = readJsonSafe(INSTALL_FAIL);
  if (fail && Date.now() - (fail.lastAttemptAt || 0) < 60_000) return false;

  let logFd;
  try { logFd = fs.openSync(INSTALL_LOG, 'a'); } catch (_) { logFd = 'ignore'; }
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const res = spawnSync(npm, ['install', '--omit=dev', '--no-audit', '--no-fund', '--silent'], {
    cwd: PLUGIN_ROOT,
    stdio: ['ignore', logFd, logFd],
    env: process.env,
  });
  if (res.status !== 0) {
    const count = (fail?.count || 0) + 1;
    try {
      fs.writeFileSync(INSTALL_FAIL, JSON.stringify({ count, lastAttemptAt: Date.now() }));
      if (count >= 3) {
        fs.appendFileSync(INSTALL_LOG,
          `\n[${new Date().toISOString()}] cctm: npm install has failed ${count} times. ` +
          `Run \`cd ${PLUGIN_ROOT} && npm install\` manually to diagnose.\n`);
      }
    } catch (_) {}
    return false;
  }
  try { fs.writeFileSync(INSTALL_STAMP, new Date().toISOString()); } catch (_) {}
  try { fs.unlinkSync(INSTALL_FAIL); } catch (_) {}
  return true;
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

function pidAlive(pid) {
  try { if (!pid) return false; process.kill(pid, 0); return true; } catch (_) { return false; }
}

function stopPid(pid) {
  if (!pidAlive(pid)) return;
  try { process.kill(pid, 'SIGTERM'); } catch (_) {}
  const deadline = Date.now() + 1500;
  while (pidAlive(pid) && Date.now() < deadline) {
    try { spawnSync('sleep', ['0.05']); } catch (_) {}
  }
  if (pidAlive(pid)) { try { process.kill(pid, 'SIGKILL'); } catch (_) {} }
}

function postStop(port, urlPath, timeoutMs) {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, method: 'POST' }, (res) => { res.resume(); res.on('end', resolve); });
    req.setTimeout(timeoutMs, () => { try { req.destroy(); } catch (_) {} resolve(); });
    req.on('error', () => resolve());
    req.end();
  });
}

function expectedStamp() {
  const h = crypto.createHash('sha256');
  for (const f of ['index.mjs', 'db.mjs', 'mcp.mjs', 'reconcile.mjs', 'attribution.mjs', 'parser.mjs']) {
    try { h.update(fs.readFileSync(path.join(PLUGIN_ROOT, 'worker', f))); } catch (_) {}
  }
  return { version: PLUGIN_VERSION, codeHash: h.digest('hex').slice(0, 16) };
}

function readLegacyPid() {
  try { const n = Number(fs.readFileSync(PID_FILE, 'utf8').trim()); return n || 0; } catch (_) { return 0; }
}

function workerInSync() {
  const stamp = readJsonSafe(STAMP_FILE);
  if (stamp && pidAlive(stamp.pid)) {
    const want = expectedStamp();
    if (stamp.version === want.version && stamp.codeHash === want.codeHash) {
      return { inSync: true, have: stamp };
    }
    return { inSync: false, have: stamp, want };
  }
  // No stamp (or its PID is dead) — fall back to legacy PID file. A pre-0.2.9
  // worker writes worker.pid but no stamp; we treat it as drift.
  const legacyPid = readLegacyPid();
  if (legacyPid && pidAlive(legacyPid)) {
    return { inSync: false, have: { pid: legacyPid, port: readPort(), legacy: true } };
  }
  return { inSync: false, have: null };
}

// Concurrent-safety: only one ensure-worker.cjs at a time may kill+respawn.
function acquireLock() {
  ensureDir();
  try { fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' }); return true; }
  catch (e) {
    if (e.code !== 'EEXIST') return false;
    try {
      const st = fs.statSync(LOCK_FILE);
      if (Date.now() - st.mtimeMs > 5000) {
        try { fs.unlinkSync(LOCK_FILE); } catch (_) {}
        return acquireLock();
      }
    } catch (_) {}
    return false;
  }
}

function releaseLock() { try { fs.unlinkSync(LOCK_FILE); } catch (_) {} }

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

// Wait for a stamp file matching expected version+codeHash to appear — proves
// the NEW worker we just spawned is the one writing it (not a stale legacy
// worker on the same default port).
function waitForFreshStamp(want, deadline, done) {
  const have = readJsonSafe(STAMP_FILE);
  if (have && have.version === want.version && have.codeHash === want.codeHash && pidAlive(have.pid)) return done(true);
  if (Date.now() > deadline) return done(false);
  setTimeout(() => waitForFreshStamp(want, deadline, done), 100);
}

// Sweep PORT_RANGE for any worker reporting a stale version OR codeHash and
// kill it. Covers updates where worker source is unchanged (codeHash same)
// but the plugin version bumped — and updates where source did change.
// Skips our own freshly-spawned worker by matching both fields.
const PORT_RANGE = [39636, 39646];
function reapStaleWorkers(want, done) {
  let pending = PORT_RANGE[1] - PORT_RANGE[0] + 1;
  const finish = () => { if (--pending <= 0) done(); };
  for (let p = PORT_RANGE[0]; p <= PORT_RANGE[1]; p++) {
    const req = http.request({ host: '127.0.0.1', port: p, path: '/healthz', method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          if (j && j.pid && (j.version !== want.version || j.codeHash !== want.codeHash)) {
            stopPid(j.pid);
          }
        } catch (_) {}
        finish();
      });
    });
    req.setTimeout(200, () => { try { req.destroy(); } catch (_) {} finish(); });
    req.on('error', () => finish());
    req.end();
  }
}

function fireBuildAsync(port) {
  try {
    const req = http.request({ host: '127.0.0.1', port, path: '/webapp/build-async', method: 'POST' });
    req.on('error', () => {});
    req.setTimeout(300, () => { try { req.destroy(); } catch (_) {} });
    req.end();
  } catch (_) {}
}

ensureDir();

const sync = workerInSync();
const port = readPort();

if (sync.inSync) {
  // Fast-path: probe once then exit. Kicks build-async in background.
  probe(port, (ok) => {
    if (ok) fireBuildAsync(port);
    process.exit(0);
  });
} else {
  if (!acquireLock()) {
    // Another instance is bootstrapping; just wait for healthz.
    waitHealthy(port, Date.now() + 2000, () => process.exit(0));
  } else {
    let cleanupDone = false;
    const finish = () => {
      if (cleanupDone) return;
      cleanupDone = true;
      releaseLock();
      process.exit(0);
    };
    process.on('exit', releaseLock);

    (async () => {
      // Drift: stop old webapp first, then old worker, then respawn.
      if (sync.have && pidAlive(sync.have.pid)) {
        await postStop(sync.have.port || port, '/webapp/stop', 800);
        stopPid(sync.have.pid);
      }
      try { fs.unlinkSync(PID_FILE); } catch (_) {}
      try { fs.unlinkSync(PORT_FILE); } catch (_) {}
      try { fs.unlinkSync(STAMP_FILE); } catch (_) {}

      if (!ensureDeps()) return finish();
      const want = expectedStamp();
      spawnWorker();
      waitForFreshStamp(want, Date.now() + 3000, (ok) => {
        if (!ok) return finish();
        // New worker's stamp is up. Sweep range to remove any legacy workers
        // that are still bound to other ports in PORT_RANGE.
        reapStaleWorkers(want, () => {
          fireBuildAsync(readPort());
          finish();
        });
      });
    })().catch(() => finish());
  }
}

setTimeout(() => { try { releaseLock(); } catch (_) {} process.exit(0); }, 6000).unref();
