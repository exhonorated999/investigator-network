import { promises as fs } from "fs";
import path from "path";

/**
 * Durable queue of opt-outs that could not be written to Postgres.
 *
 * The file lives on UPLOAD_DIR, which production mounts as a persistent
 * volume, so a redeploy during an outage does not drop the queue. Each
 * change rewrites a snapshot under an exclusive lock. If the disk write
 * fails, the same record stays in process memory and the in-process
 * reconciler still retries it. Stdout JSON logs are the copy that survives
 * both a disk loss and a restart.
 */

export interface PendingUnsubscribe {
  token: string;
  email: string | null;
  via: "one-click" | "confirm";
  at: string;
}

export interface JournalOptions {
  maxPending?: number;
}

export const DEFAULT_MAX_PENDING = 5000;

const memory = new Map<string, Map<string, PendingUnsubscribe>>();

export function defaultJournalPath(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.UNSUBSCRIBE_JOURNAL_PATH?.trim();
  if (override) return override;
  const upload = env.UPLOAD_DIR?.trim() || "./.uploads";
  return path.join(upload, "unsubscribe-journal.jsonl");
}

function fallbackFor(file: string): Map<string, PendingUnsubscribe> {
  let map = memory.get(file);
  if (!map) {
    map = new Map();
    memory.set(file, map);
  }
  return map;
}

function mergeFallback(
  file: string,
  map: Map<string, PendingUnsubscribe>
): Map<string, PendingUnsubscribe> {
  const extra = memory.get(file);
  if (!extra) return map;
  for (const [token, row] of extra) {
    const disk = map.get(token);
    if (!disk) map.set(token, row);
    else if (!disk.email && row.email) map.set(token, { ...disk, email: row.email });
  }
  return map;
}

function parseRow(value: unknown): PendingUnsubscribe | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Partial<PendingUnsubscribe>;
  if (typeof row.token !== "string" || !row.token) return null;
  return {
    token: row.token,
    email: typeof row.email === "string" && row.email ? row.email : null,
    via: row.via === "one-click" ? "one-click" : "confirm",
    at: typeof row.at === "string" ? row.at : new Date(0).toISOString(),
  };
}

async function readSnapshot(file: string): Promise<Map<string, PendingUnsubscribe>> {
  const map = new Map<string, PendingUnsubscribe>();
  let text = "";
  try {
    text = await fs.readFile(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return map;
    throw err;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = parseRow(JSON.parse(trimmed));
      if (row) map.set(row.token, row);
    } catch {
      // Skip a torn or corrupt line; the rest of the queue still replays.
    }
  }
  return map;
}

async function writeSnapshot(
  file: string,
  map: Map<string, PendingUnsubscribe>
): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const body =
    [...map.values()].map((row) => JSON.stringify(row)).join("\n") +
    (map.size ? "\n" : "");
  const tmp = `${file}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tmp, body, { mode: 0o600 });
    await fs.rename(tmp, file);
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

async function withLock<T>(file: string, fn: () => Promise<T>): Promise<T> {
  const lockPath = `${file}.lock`;
  await fs.mkdir(path.dirname(file), { recursive: true });
  const start = Date.now();
  for (;;) {
    try {
      const handle = await fs.open(lockPath, "wx");
      try {
        return await fn();
      } finally {
        await handle.close().catch(() => {});
        await fs.rm(lockPath, { force: true }).catch(() => {});
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      if (Date.now() - start > 4000) {
        await fs.rm(lockPath, { force: true }).catch(() => {});
        continue;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  }
}

function clearFallback(file: string, tokens: Iterable<string>) {
  const extra = memory.get(file);
  if (!extra) return;
  for (const token of tokens) extra.delete(token);
}

export async function listPending(file: string): Promise<PendingUnsubscribe[]> {
  try {
    return await withLock(file, async () => {
      const map = mergeFallback(file, await readSnapshot(file));
      return [...map.values()];
    });
  } catch {
    const extra = memory.get(file);
    return extra ? [...extra.values()] : [];
  }
}

export type RememberResult = "persisted" | "memory" | "full";

export async function rememberPending(
  file: string,
  entry: PendingUnsubscribe,
  opts: JournalOptions = {}
): Promise<RememberResult> {
  const max = opts.maxPending ?? DEFAULT_MAX_PENDING;
  const fallback = fallbackFor(file);
  const store = (next: PendingUnsubscribe): RememberResult => {
    fallback.set(entry.token, next);
    return "memory";
  };
  try {
    return await withLock(file, async () => {
      const map = mergeFallback(file, await readSnapshot(file));
      const existing = map.get(entry.token);
      if (!existing && map.size >= max) return "full";
      const next: PendingUnsubscribe = existing
        ? { ...existing, email: existing.email || entry.email, via: entry.via }
        : entry;
      map.set(entry.token, next);
      try {
        await writeSnapshot(file, map);
        clearFallback(file, map.keys());
        return "persisted";
      } catch {
        return store(next);
      }
    });
  } catch {
    if (!fallback.has(entry.token) && fallback.size >= max) return "full";
    return store(entry);
  }
}

export async function updatePendingEmail(
  file: string,
  token: string,
  email: string
): Promise<void> {
  const fallback = fallbackFor(file);
  const current = fallback.get(token);
  if (current) fallback.set(token, { ...current, email });
  try {
    await withLock(file, async () => {
      const map = mergeFallback(file, await readSnapshot(file));
      const existing = map.get(token);
      if (!existing) return;
      map.set(token, { ...existing, email });
      try {
        await writeSnapshot(file, map);
        clearFallback(file, map.keys());
      } catch {
        fallback.set(token, { ...existing, email });
      }
    });
  } catch {
    // The in-memory copy, when we had one, already carries the address.
  }
}

export async function forgetPending(file: string, token: string): Promise<void> {
  try {
    await withLock(file, async () => {
      memory.get(file)?.delete(token);
      const map = mergeFallback(file, await readSnapshot(file));
      map.delete(token);
      await writeSnapshot(file, map);
      clearFallback(file, map.keys());
    });
  } catch {
    // Drop the memory copy either way. A record the disk kept is retried,
    // and suppression writes are idempotent.
    memory.get(file)?.delete(token);
  }
}
