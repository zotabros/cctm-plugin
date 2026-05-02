// SQLite bootstrap. Single-writer instance for the worker.
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = dirname(HERE);

export function defaultDbPath() {
  return process.env.CCTM_DB_PATH || join(homedir(), '.cctm', 'cctm.db');
}

export function openWriter(path = defaultDbPath()) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');
  return db;
}

export function openReader(path = defaultDbPath()) {
  const db = new Database(path, { readonly: true, fileMustExist: true });
  db.pragma('busy_timeout = 5000');
  return db;
}

export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, appliedAt TEXT NOT NULL DEFAULT (datetime('now')));`);
  const applied = new Set(db.prepare('SELECT id FROM _migrations').all().map((r) => r.id));
  const migrations = [
    { id: 1, file: join(PLUGIN_ROOT, 'prisma', 'migrations', '0001_init.sql') },
  ];
  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    if (!existsSync(m.file)) throw new Error(`Missing migration file: ${m.file}`);
    const sql = readFileSync(m.file, 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO _migrations (id) VALUES (?)').run(m.id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
}

export function ensureLocalAccount(db) {
  db.prepare(`INSERT OR IGNORE INTO Account (id, label, color) VALUES ('local', 'Local', '#0F766E')`).run();
}
