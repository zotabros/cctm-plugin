---
name: analyze-prompt
description: Analyze why a recent Claude Code turn was expensive or slow. Triggers on phrases like "analyze my last prompt", "why was that expensive", "what did that turn cost". Calls the cctm MCP server (getRecentTurns + getTurn + getToolBreakdown) to surface per-tool costs, MCP server hot spots, oversized tool_results, and suggest cacheable prefixes or redundant Reads.
---

# analyze-prompt

When the user asks for analysis of a recent turn:

1. Call `cctm.getRecentTurns({ limit: 5 })` to find candidates.
2. Pick the most relevant turn (most recent unless the user named one). Call `cctm.getTurn({ turnId })` and `cctm.getToolBreakdown({ turnId })`.
3. Summarize:
   - Total tokens (input/output/cache) and USD cost.
   - Top 3 tools by attributed cost.
   - Any single tool with >40% of total cost (likely the bottleneck).
   - Subagent breakdown if any spans exist.
4. Suggest concrete optimizations:
   - **Cacheable prefix**: if many turns share the same first ~10K input tokens.
   - **Redundant Reads**: same file path read >2x in one turn.
   - **Oversized tool_results**: any single tool returning >50KB; prompt user to scope.
   - **MCP latency**: any server with avgMs > 2000.

Be concise: lead with the cost, then the bottleneck, then 1-2 actions.
