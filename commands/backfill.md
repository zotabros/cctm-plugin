---
description: Re-scan ~/.claude/projects/**/*.jsonl and replay into the local DB
allowed-tools: Bash
---

!`node ${CLAUDE_PLUGIN_ROOT}/scripts/slash-backfill.cjs`
