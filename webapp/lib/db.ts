// Local-only Prisma client. Connects to the SQLite DB managed by the cctm worker.
import { PrismaClient } from "@prisma/client";
import { homedir } from "node:os";
import { join } from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function dbUrl(): string {
  if (process.env.CCTM_DB_URL) return process.env.CCTM_DB_URL;
  const path = process.env.CCTM_DB_PATH || join(homedir(), ".cctm", "cctm.db");
  return `file:${path}`;
}

function createPrisma() {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasources: { db: { url: dbUrl() } },
  });
  // Match worker pragmas so Prisma doesn't busy-spin on SQLITE_BUSY.
  // These run on every new connection via Prisma's query engine.
  client.$executeRawUnsafe("PRAGMA journal_mode = WAL").catch(() => {});
  client.$executeRawUnsafe("PRAGMA busy_timeout = 5000").catch(() => {});
  return client;
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

/** Constant local account id seeded by the worker. */
export const LOCAL_ACCOUNT_ID = "local";
