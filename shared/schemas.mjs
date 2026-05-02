// Zod schemas — port of cctm-agent shared/schemas.ts (worker uses these for validation).
import { z } from 'zod';

export const ToolCallSchema = z.object({
  name: z.string().min(1).max(128),
  inputBytes: z.number().int().nonnegative().optional(),
  outputBytes: z.number().int().nonnegative().optional(),
});

export const IngestEventSchema = z.object({
  sessionUuid: z.string().min(1).max(128),
  cwd: z.string().min(1).max(2048),
  projectName: z.string().min(1).max(256).optional(),
  timestamp: z.string().datetime(),
  role: z.enum(['assistant', 'user']),
  model: z.string().min(1).max(128).optional(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheCreationTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  toolCalls: z.array(ToolCallSchema).max(64).optional(),
  claudeUserEmail: z.string().email().optional(),
});

export const InventoryPluginSchema = z.object({
  name: z.string().min(1).max(256),
  source: z.string().max(256).optional(),
  version: z.string().max(64).optional(),
  scope: z.enum(['user', 'project']).optional(),
  enabled: z.boolean().optional(),
  installedAt: z.string().datetime().optional(),
  projectPath: z.string().max(2048).optional(),
});

export const InventoryPayloadSchema = z.object({
  schemaVersion: z.literal(1),
  capturedAt: z.string().datetime(),
  os: z.string().max(64).optional(),
  agentVersion: z.string().max(64).optional(),
  plugins: z.array(InventoryPluginSchema).max(256),
  skills: z.array(z.any()).max(512),
  agents: z.array(z.any()).max(512),
  mcpServers: z.array(z.any()).max(128),
  hooks: z.array(z.any()).max(256),
  claudeMd: z.array(z.any()).max(64),
  commands: z.array(z.string().max(128)).max(256),
  settingsBytes: z.number().int().nonnegative().optional(),
});
