# cctm — Local-First Telemetry for Claude Code

`cctm` is a Claude Code plugin that captures **per-turn** token usage, latency,
tool/MCP attribution, and subagent costs, and stores everything **locally** in
a SQLite database under `~/.cctm/`. A bundled Next.js dashboard renders
turns, sessions, tools, and subagents on demand.

No cloud. No pairing. No prompts leave your machine.

## Install

### From the Claude Code marketplace

```
/plugin install cctm
```

### Local development

```
git clone https://github.com/zotabros/cctm-plugin.git
cd cctm-plugin
pnpm install
pnpm --dir webapp install
pnpm --dir webapp prisma:generate
pnpm --dir webapp build
claude --plugin-dir "$PWD"
```

## Architecture

```
Claude Code hooks → scripts/dispatch.cjs → 127.0.0.1:39636 (worker) → SQLite
                                                              ↓
                                       ~/.cctm/cctm.db (WAL, single-writer)
                                                              ↓
                                       webapp (read-only) + MCP server
```

- **Hooks** (`hooks/hooks.json`) fire on `SessionStart`, `UserPromptSubmit`,
  `PreToolUse`, `PostToolUse`, `SubagentStart`, `SubagentStop`, `Stop`,
  `SessionEnd`, `PreCompact`. Each posts to the local worker with a 750 ms
  hard timeout — hooks never block Claude Code.
- **Worker** (`worker/index.mjs`) is auto-spawned by `SessionStart` via
  double-fork (`scripts/ensure-worker.cjs`). It binds `127.0.0.1:39636`
  (scans up to 39646 if busy) and writes the chosen port to
  `~/.cctm/worker.port`.
- **Reconciler** (`worker/reconcile.mjs`) reads the transcript JSONL from a
  per-session cursor on `Stop`, parses with the cctm-agent parser, and runs
  the **token attribution rule** (`worker/attribution.mjs`).
- **MCP server** (`worker/mcp.mjs`) exposes 6 read-only query tools so any
  Claude Code session can introspect its own cost data.
- **Dashboard** (`webapp/`) is a vendored Next.js 15 app, `output: 'standalone'`,
  launched on demand via `/cctm:dashboard`.

## Slash commands

- `/cctm:dashboard` — start the embedded webapp and open it in your browser.
- `/cctm:status` — print today's tokens, cost, last turn latency, top tools.
- `/cctm:backfill` — re-scan `~/.claude/projects/**/*.jsonl` and replay.
- `/cctm:inventory` — refresh the local Claude Code config snapshot.
- `/cctm:nuke` — delete `~/.cctm/cctm.db*` (CONFIRM via the slash command).

## Skill

- `cctm:analyze-prompt` — auto-triggers when you ask "why was that turn
  expensive?" and walks the MCP server to surface bottlenecks.

## Data location

Everything lives under `~/.cctm/`:

| File | Purpose |
|---|---|
| `cctm.db` (+ `-wal`, `-shm`) | SQLite database |
| `worker.log` | worker stdout/stderr |
| `worker.pid` | worker pidfile |
| `worker.port` | port the worker is currently bound to |
| `hook-errors.log` | rolling log of hook dispatch errors (always exit-0) |

Safe to delete the entire directory — the next `SessionStart` will recreate it.

## Token attribution rule

For every Turn (one user prompt → one `Stop`), the reconciler:

1. Sums `usage.*` across all assistant messages in the turn → Turn rollup.
2. For each assistant message with N>0 `tool_use` blocks:
   - Splits `output_tokens` equally across the N `tool_use_id`s (floor + carry).
   - Splits `input_tokens` (+ cache) across the `tool_use_id`s appearing in
     `tool_result` blocks of the immediately prior user message.
3. **Byte-size override:** if any single `tool_result` is ≥80% of the total
   tool-result bytes in that prior user message, input is distributed by
   byte weight instead of equal split — keeps a giant MCP response from
   getting under-attributed.
4. SubagentSpan rolls up by summing ToolInvocation attributed tokens within
   `[startedAt, endedAt]`.

The UI labels these as "equal-split estimate" because the rule is a heuristic.
Raw `UsageEvent` rows are preserved so attribution can be re-run offline if
the rule changes.

## Migration from cctm-agent / cctm-server

Once `cctm` is installed, the `cctm-agent` CLI daemon is no longer needed:

```
cctm-agent stop
launchctl remove com.zotabros.cctm-agent  # macOS
systemctl --user disable cctm-agent       # linux
```

Historical events the agent uploaded to the hosted `cctm-server` remain on
that server. The plugin's local database starts empty; run `/cctm:backfill`
to replay 30+ days of `~/.claude/projects/*.jsonl` into it.

## Privacy

- No network calls beyond `127.0.0.1`.
- No prompt content, no usage events, no inventory data ever leave the
  machine.
- The MCP server is a read-only handle to the same SQLite file — only the
  Claude Code instance that started it can connect.

## License

MIT
