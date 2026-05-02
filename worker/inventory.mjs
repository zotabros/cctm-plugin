// Pure-ESM port of cctm-agent/src/inventory.ts. Collects local Claude Code config snapshot.
import { homedir, platform } from 'node:os';
import { join, basename, dirname, relative } from 'node:path';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const CLAUDE_HOME = join(homedir(), '.claude');

async function safeStat(p) {
  try {
    const st = await stat(p);
    if (!st.isFile()) return null;
    const buf = await readFile(p, 'utf-8');
    return { size: st.size, lines: buf.split('\n').length };
  } catch { return null; }
}

async function readJsonSafe(p) {
  try { return JSON.parse(await readFile(p, 'utf-8')); } catch { return null; }
}

async function listDir(p) {
  try { return await readdir(p); } catch { return []; }
}

function commandHash(cmd) {
  return createHash('sha256').update(cmd).digest('hex').slice(0, 12);
}

async function collectPlugins(enabledMap) {
  const file = await readJsonSafe(join(CLAUDE_HOME, 'plugins', 'installed_plugins.json'));
  const out = [];
  if (!file?.plugins) return out;
  for (const [name, installs] of Object.entries(file.plugins)) {
    for (const inst of installs) {
      out.push({
        name,
        source: name.includes('@') ? name.split('@')[1] : undefined,
        version: inst.version && inst.version !== 'unknown' ? inst.version : undefined,
        scope: inst.scope === 'project' ? 'project' : 'user',
        enabled: !!enabledMap[name],
        installedAt: inst.installedAt,
        projectPath: inst.projectPath,
      });
    }
  }
  return out;
}

async function readSkillMeta(skillPath) {
  const meta = await safeStat(skillPath);
  if (!meta) return null;
  const buf = await readFile(skillPath, 'utf-8').catch(() => '');
  let descriptionBytes = 0;
  const fm = /^---\s*\n([\s\S]*?)\n---/m.exec(buf);
  if (fm) {
    const m = /description:\s*([\s\S]*?)(?:\n[a-zA-Z_]+:|\n---|$)/.exec(fm[1]);
    if (m) descriptionBytes = m[1].trim().length;
  }
  return { bodyBytes: meta.size, descriptionBytes };
}

async function walkSkills(root, out, depth = 0) {
  if (depth > 6) return;
  for (const e of await listDir(root)) {
    const p = join(root, e);
    const st = await stat(p).catch(() => null);
    if (!st) continue;
    if (st.isFile() && e === 'SKILL.md') {
      const m = await readSkillMeta(p);
      if (m) {
        const rel = relative(join(CLAUDE_HOME, 'plugins', 'cache'), p).split('/');
        const pluginName = rel.length >= 2 ? `${rel[1]}@${rel[0]}` : undefined;
        out.push({ name: basename(dirname(p)), origin: 'plugin', pluginName, ...m });
      }
    } else if (st.isDirectory()) {
      await walkSkills(p, out, depth + 1);
    }
  }
}

async function collectSkills() {
  const out = [];
  for (const name of await listDir(join(CLAUDE_HOME, 'skills'))) {
    const m = await readSkillMeta(join(CLAUDE_HOME, 'skills', name, 'SKILL.md'));
    if (m) out.push({ name, origin: 'user', ...m });
  }
  await walkSkills(join(CLAUDE_HOME, 'plugins', 'cache'), out);
  return out;
}

async function collectAgents() {
  const out = [];
  for (const f of await listDir(join(CLAUDE_HOME, 'agents'))) {
    if (!f.endsWith('.md')) continue;
    const meta = await safeStat(join(CLAUDE_HOME, 'agents', f));
    if (meta) out.push({ name: f.replace(/\.md$/, ''), origin: 'user', bodyBytes: meta.size });
  }
  return out;
}

async function walkMcp(root, out, depth = 0) {
  if (depth > 6) return;
  for (const e of await listDir(root)) {
    const p = join(root, e);
    const st = await stat(p).catch(() => null);
    if (!st) continue;
    if (st.isFile() && (e === '.mcp.json' || e === 'mcp.json')) {
      const data = await readJsonSafe(p);
      if (!data) continue;
      const servers = (data.mcpServers && typeof data.mcpServers === 'object') ? data.mcpServers : data;
      const rel = relative(join(CLAUDE_HOME, 'plugins', 'cache'), p).split('/');
      const pluginName = rel.length >= 2 ? `${rel[1]}@${rel[0]}` : undefined;
      for (const [name, cfg] of Object.entries(servers)) {
        if (!cfg || typeof cfg !== 'object') continue;
        const transport = (cfg.type === 'http' || cfg.type === 'sse') ? cfg.type : cfg.command ? 'stdio' : 'unknown';
        out.push({ name, origin: 'plugin', transport, command: cfg.command ? basename(cfg.command) : undefined, pluginName });
      }
    } else if (st.isDirectory()) {
      await walkMcp(p, out, depth + 1);
    }
  }
}

async function collectMcpServers(settings) {
  const out = [];
  for (const [name, cfg] of Object.entries(settings?.mcpServers ?? {})) {
    const transport = cfg.type === 'http' ? 'http' : cfg.type === 'sse' ? 'sse' : cfg.command ? 'stdio' : 'unknown';
    out.push({ name, origin: 'user', transport, command: cfg.command });
  }
  await walkMcp(join(CLAUDE_HOME, 'plugins', 'cache'), out);
  return out;
}

function collectHooks(settings) {
  const out = [];
  for (const [event, entries] of Object.entries(settings?.hooks ?? {})) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      for (const h of entry.hooks ?? []) {
        const cmd = h.command ?? '';
        out.push({ event, matcher: entry.matcher, commandPreview: cmd.slice(0, 160), commandHash: commandHash(cmd) });
      }
    }
  }
  return out;
}

async function collectClaudeMd() {
  const global = await safeStat(join(CLAUDE_HOME, 'CLAUDE.md'));
  const out = [];
  if (global) out.push({ scope: 'global', bytes: global.size, lines: global.lines });
  return out;
}

async function collectCommands() {
  return (await listDir(join(CLAUDE_HOME, 'commands'))).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
}

export async function collectInventory() {
  const settings = await readJsonSafe(join(CLAUDE_HOME, 'settings.json'));
  const settingsBytes = (await safeStat(join(CLAUDE_HOME, 'settings.json')))?.size ?? 0;
  const enabledMap = settings?.enabledPlugins ?? {};

  const [plugins, skills, agents, mcpServers, claudeMd, commands] = await Promise.all([
    collectPlugins(enabledMap),
    collectSkills(),
    collectAgents(),
    collectMcpServers(settings),
    collectClaudeMd(),
    collectCommands(),
  ]);
  const hooks = collectHooks(settings);

  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    os: platform(),
    agentVersion: '0.2.0',
    plugins, skills, agents, mcpServers, hooks, claudeMd, commands, settingsBytes,
  };
}
