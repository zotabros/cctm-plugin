// CommonJS twin of version.mjs for scripts/ that use require().
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const HERE = __dirname;
const PLUGIN_ROOT = path.dirname(HERE);
const PKG = JSON.parse(fs.readFileSync(path.join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));

module.exports = {
  PLUGIN_ROOT,
  PLUGIN_VERSION: PKG.version,
  PLUGIN_NAME: PKG.name,
};
