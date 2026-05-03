// Single source of truth for plugin version + name + root path.
// Synchronous read at module load — no top-level await.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const PLUGIN_ROOT = dirname(HERE);

const PKG = JSON.parse(readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));

export const PLUGIN_VERSION = PKG.version;
export const PLUGIN_NAME = PKG.name;
