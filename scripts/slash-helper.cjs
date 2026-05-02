// Shared helpers for slash command scripts.
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const PORT_FILE = path.join(os.homedir(), '.cctm', 'worker.port');

function readPort() {
  if (process.env.CCTM_PORT) return Number(process.env.CCTM_PORT) || 39636;
  try { return Number(fs.readFileSync(PORT_FILE, 'utf8').trim()) || 39636; } catch (_) { return 39636; }
}

function call(method, urlPath, body, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const port = readPort();
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      host: '127.0.0.1', port, path: urlPath, method,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) },
    }, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
        catch { resolve({ status: res.statusCode, body: text }); }
      });
    });
    req.setTimeout(timeoutMs, () => { try { req.destroy(); } catch (_) {} resolve({ status: 0, body: { error: 'timeout' } }); });
    req.on('error', (e) => resolve({ status: 0, body: { error: e.message } }));
    req.end(data);
  });
}

module.exports = { call, readPort };
